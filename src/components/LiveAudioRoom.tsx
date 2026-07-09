import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { io, Socket } from "socket.io-client";
import { Mic, MicOff, Users, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";

interface Participant {
  socketId: string;
  displayName: string;
  role: string;
  isMuted: boolean;
}

export interface LiveAudioRoomHandle {
  muteAll: () => void;
  grantMic: (displayName: string) => void;
  revokeMic: (displayName: string) => void;
}

interface Props {
  roomId: string;
  displayName: string;
  role: "lecturer" | "student";
  /** For students: whether the lecturer has granted this student mic permission */
  isMicAllowed?: boolean;
  className?: string;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const LiveAudioRoom = forwardRef<LiveAudioRoomHandle, Props>(
  ({ roomId, displayName, role, isMicAllowed = false, className = "" }, ref) => {
    const socketRef = useRef<Socket | null>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isMuted, setIsMuted] = useState(role === "student");
    const [isConnected, setIsConnected] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);
    const [speakingSet, setSpeakingSet] = useState<Set<string>>(new Set());
    const analyserRefs = useRef<Map<string, { analyser: AnalyserNode; ctx: AudioContext; raf: number }>>(new Map());

    // --- Audio visualisation: detect speaking via AnalyserNode ---
    const attachAnalyser = useCallback((socketId: string, stream: MediaStream) => {
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setSpeakingSet(prev => {
            const next = new Set(prev);
            if (avg > 12) next.add(socketId); else next.delete(socketId);
            return next;
          });
          const raf = requestAnimationFrame(tick);
          const entry = analyserRefs.current.get(socketId);
          if (entry) entry.raf = raf;
        };
        const raf = requestAnimationFrame(tick);
        analyserRefs.current.set(socketId, { analyser, ctx, raf });
      } catch { /* AudioContext not available */ }
    }, []);

    const detachAnalyser = useCallback((socketId: string) => {
      const entry = analyserRefs.current.get(socketId);
      if (!entry) return;
      cancelAnimationFrame(entry.raf);
      entry.ctx.close().catch(() => {});
      analyserRefs.current.delete(socketId);
      setSpeakingSet(prev => { const n = new Set(prev); n.delete(socketId); return n; });
    }, []);

    // --- Create RTCPeerConnection for a peer ---
    const createPC = useCallback((peerId: string, polite: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(peerId, pc);

      // Add local tracks
      localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

      // ICE
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socketRef.current?.emit("signal", { to: peerId, signal: { type: "candidate", candidate } });
      };

      // Receive remote audio
      pc.ontrack = ({ streams: [stream] }) => {
        if (!stream) return;
        const el = document.getElementById(`audio-${peerId}`) as HTMLAudioElement | null;
        if (el) { el.srcObject = stream; el.play().catch(() => {}); }
        attachAnalyser(peerId, stream);
      };

      // Polite peer creates offer
      if (polite) {
        pc.onnegotiationneeded = async () => {
          try {
            await pc.setLocalDescription();
            socketRef.current?.emit("signal", { to: peerId, signal: { type: "offer", sdp: pc.localDescription } });
          } catch { /* ignore */ }
        };
      }

      return pc;
    }, [attachAnalyser]);

    const closePeer = useCallback((peerId: string) => {
      pcsRef.current.get(peerId)?.close();
      pcsRef.current.delete(peerId);
      pendingCandidates.current.delete(peerId);
      detachAnalyser(peerId);
      const el = document.getElementById(`audio-${peerId}`) as HTMLAudioElement | null;
      if (el) { el.srcObject = null; }
    }, [detachAnalyser]);

    // --- Mic: apply local mute ---
    const applyMute = useCallback((muted: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    }, []);

    const toggleMute = useCallback(() => {
      setIsMuted(prev => {
        applyMute(!prev);
        return !prev;
      });
    }, [applyMute]);

    // --- External handle for lecturer to control participants ---
    useImperativeHandle(ref, () => ({
      muteAll: () => {
        socketRef.current?.emit("mute-all", { roomId });
      },
      grantMic: (name: string) => {
        const peer = participants.find(p => p.displayName === name);
        if (peer) socketRef.current?.emit("grant-mic", { to: peer.socketId });
      },
      revokeMic: (name: string) => {
        const peer = participants.find(p => p.displayName === name);
        if (peer) socketRef.current?.emit("mute-peer", { to: peer.socketId });
      },
    }), [participants, roomId]);

    // --- isMicAllowed prop change for students ---
    useEffect(() => {
      if (role !== "student") return;
      if (isMicAllowed) {
        setIsMuted(false);
        applyMute(false);
      } else {
        setIsMuted(true);
        applyMute(true);
      }
    }, [isMicAllowed, role, applyMute]);

    // --- Main effect: get mic, connect socket, set up signaling ---
    useEffect(() => {
      let destroyed = false;

      (async () => {
        // Acquire microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
          if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }
          localStreamRef.current = stream;
          // Apply initial mute state
          stream.getAudioTracks().forEach(t => { t.enabled = role === "lecturer"; });
        } catch (err: any) {
          setMicError("Microphone access denied. Please allow mic permission and reload.");
          return;
        }

        // Connect Socket.io
        const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (destroyed) return;
          setIsConnected(true);
          socket.emit("join-room", { roomId, displayName, role });
          // Add self-analyser for local speaking indicator
          if (localStreamRef.current) attachAnalyser("self", localStreamRef.current);
        });

        socket.on("disconnect", () => setIsConnected(false));

        // Existing peers in the room
        socket.on("room-peers", (peers: { socketId: string; displayName: string; role: string }[]) => {
          if (destroyed) return;
          setParticipants(peers.map(p => ({ ...p, isMuted: false })));
          // Initiate connection to each existing peer (we are the new joiner → polite)
          peers.forEach(p => createPC(p.socketId, true));
        });

        // New participant joined
        socket.on("peer-joined", ({ socketId, displayName: pName, role: pRole }: { socketId: string; displayName: string; role: string }) => {
          if (destroyed) return;
          setParticipants(prev => [...prev.filter(p => p.socketId !== socketId), { socketId, displayName: pName, role: pRole, isMuted: false }]);
          createPC(socketId, false); // impolite — wait for offer
        });

        // Participant left
        socket.on("peer-left", ({ socketId }: { socketId: string }) => {
          closePeer(socketId);
          setParticipants(prev => prev.filter(p => p.socketId !== socketId));
        });

        // WebRTC signal relay
        socket.on("signal", async ({ from, signal }: { from: string; signal: any }) => {
          if (destroyed) return;
          let pc = pcsRef.current.get(from);
          if (!pc) { pc = createPC(from, false); }

          if (signal.type === "offer") {
            await pc.setRemoteDescription(signal.sdp);
            // Flush any queued candidates
            const queued = pendingCandidates.current.get(from) ?? [];
            for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
            pendingCandidates.current.delete(from);
            await pc.setLocalDescription();
            socket.emit("signal", { to: from, signal: { type: "answer", sdp: pc.localDescription } });
          } else if (signal.type === "answer") {
            await pc.setRemoteDescription(signal.sdp).catch(() => {});
          } else if (signal.type === "candidate") {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(signal.candidate).catch(() => {});
            } else {
              // Queue until remote description is set
              const q = pendingCandidates.current.get(from) ?? [];
              q.push(signal.candidate);
              pendingCandidates.current.set(from, q);
            }
          }
        });

        // Mute commands
        socket.on("force-mute", () => {
          setIsMuted(true);
          applyMute(true);
        });

        socket.on("mic-granted", () => {
          setIsMuted(false);
          applyMute(false);
        });
      })();

      return () => {
        destroyed = true;
        socketRef.current?.disconnect();
        socketRef.current = null;
        pcsRef.current.forEach((pc) => pc.close());
        pcsRef.current.clear();
        pendingCandidates.current.clear();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        analyserRefs.current.forEach(({ ctx, raf }) => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); });
        analyserRefs.current.clear();
        setSpeakingSet(new Set());
        setParticipants([]);
        setIsConnected(false);
      };
    }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

    const selfIsSpeaking = speakingSet.has("self");

    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {/* Hidden audio elements for each remote participant */}
        {participants.map(p => (
          <audio key={p.socketId} id={`audio-${p.socketId}`} autoPlay playsInline style={{ display: "none" }} />
        ))}

        {micError ? (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-[12px]">
            <MicOff className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-[12.5px] text-red-600 dark:text-red-400">{micError}</p>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 dark:bg-black/50 rounded-[14px]">
              <div className="flex items-center gap-3">
                {/* Connection dot */}
                <div className="relative flex items-center justify-center">
                  {isConnected ? (
                    <>
                      <span className="animate-ping absolute h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                    </>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[12px] font-semibold text-slate-200">
                  {isConnected ? "Audio Room Live" : "Connecting…"}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Users className="h-3 w-3" />
                  {participants.length + 1}
                </span>
              </div>

              {/* Mic toggle */}
              <button
                onClick={role === "student" && !isMicAllowed ? undefined : toggleMute}
                disabled={role === "student" && !isMicAllowed}
                title={role === "student" && !isMicAllowed ? "Raise your hand to request mic" : isMuted ? "Unmute" : "Mute"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                  isMuted
                    ? "bg-red-600/80 hover:bg-red-600 text-white"
                    : "bg-emerald-600/80 hover:bg-emerald-600 text-white"
                }`}
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isMuted ? "Muted" : "Live"}
              </button>
            </div>

            {/* Self speaking indicator */}
            {!isMuted && selfIsSpeaking && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-[10px]">
                <Volume2 className="h-3.5 w-3.5 text-emerald-500 animate-pulse shrink-0" />
                <span className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">Speaking…</span>
              </div>
            )}

            {/* Participant list */}
            {participants.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#8e8e93] dark:text-white/30 px-1">
                  In Room ({participants.length + 1})
                </p>
                {/* Self */}
                <div className="flex items-center gap-2.5 px-3 py-2 bg-black/[0.03] dark:bg-white/[0.04] rounded-[10px]">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    role === "lecturer" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                  }`}>
                    {displayName.trim().charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white/90 flex-1 truncate">
                    {displayName} <span className="text-[10px] font-normal text-[#8e8e93]">(you)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selfIsSpeaking && !isMuted && <Volume2 className="h-3 w-3 text-emerald-500 animate-pulse" />}
                    {isMuted ? <MicOff className="h-3 w-3 text-red-400" /> : <Mic className="h-3 w-3 text-emerald-500" />}
                  </div>
                </div>
                {/* Others */}
                {participants.map(p => (
                  <div key={p.socketId} className="flex items-center gap-2.5 px-3 py-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-[10px] border border-black/[0.04] dark:border-white/[0.04]">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      p.role === "lecturer" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}>
                      {p.displayName.trim().charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[12px] text-[#3a3a3c] dark:text-white/75 flex-1 truncate">{p.displayName}</span>
                    <div className="flex items-center gap-1.5">
                      {speakingSet.has(p.socketId) && <Volume2 className="h-3 w-3 text-emerald-500 animate-pulse" />}
                      {p.isMuted
                        ? <MicOff className="h-3 w-3 text-red-400/60" />
                        : <Mic className="h-3 w-3 text-slate-400/60" />
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}

            {participants.length === 0 && isConnected && (
              <div className="text-center py-6">
                <Users className="h-6 w-6 text-[#8e8e93] dark:text-white/25 mx-auto mb-2" />
                <p className="text-[12px] text-[#8e8e93] dark:text-white/35">
                  {role === "lecturer" ? "Waiting for students to join…" : "Connected — waiting for class to start"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

LiveAudioRoom.displayName = "LiveAudioRoom";
export default LiveAudioRoom;
