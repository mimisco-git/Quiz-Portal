import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { io, Socket } from "socket.io-client";
import { Mic, MicOff, Users, Volume2, WifiOff } from "lucide-react";

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
  isMicAllowed?: boolean;
  className?: string;
}

// Google STUN + optional TURN via env vars (set in .env for production)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: import.meta.env.VITE_TURN_URL as string,
          username: (import.meta.env.VITE_TURN_USER as string) ?? "",
          credential: (import.meta.env.VITE_TURN_PASS as string) ?? "",
        },
      ]
    : []),
];

const LiveAudioRoom = forwardRef<LiveAudioRoomHandle, Props>(
  ({ roomId, displayName, role, isMicAllowed = false, className = "" }, ref) => {
    const socketRef = useRef<Socket | null>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    // Stores remote streams so we can attach them after React renders <audio> elements
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isMuted, setIsMuted] = useState(role === "student");
    const [isConnected, setIsConnected] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);
    const [speakingSet, setSpeakingSet] = useState<Set<string>>(new Set());

    const analyserRefs = useRef<
      Map<string, { analyser: AnalyserNode; ctx: AudioContext; raf: number }>
    >(new Map());

    // ── After every render: attach any stored remote streams to their <audio> elements.
    // This fixes the race where ontrack fires before React renders the <audio> element.
    useEffect(() => {
      remoteStreamsRef.current.forEach((stream, socketId) => {
        const el = document.getElementById(`audio-${socketId}`) as HTMLAudioElement | null;
        if (el && el.srcObject !== stream) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
      });
    });

    // ── Speaking detection via AnalyserNode ───────────────────────────────
    const attachAnalyser = useCallback((socketId: string, stream: MediaStream) => {
      try {
        detachAnalyser(socketId); // clear any existing one first
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let wasSpeaking = false;
        let rafId = 0;
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          const speaking = avg > 12;
          // Only update React state when speaking status actually changes
          if (speaking !== wasSpeaking) {
            wasSpeaking = speaking;
            setSpeakingSet(prev => {
              const next = new Set(prev);
              if (speaking) next.add(socketId); else next.delete(socketId);
              return next;
            });
          }
          const entry = analyserRefs.current.get(socketId);
          if (entry) { rafId = requestAnimationFrame(tick); entry.raf = rafId; }
        };
        rafId = requestAnimationFrame(tick);
        analyserRefs.current.set(socketId, { analyser, ctx, raf: rafId });
      } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const detachAnalyser = useCallback((socketId: string) => {
      const entry = analyserRefs.current.get(socketId);
      if (!entry) return;
      cancelAnimationFrame(entry.raf);
      entry.ctx.close().catch(() => {});
      analyserRefs.current.delete(socketId);
      setSpeakingSet(prev => { const n = new Set(prev); n.delete(socketId); return n; });
    }, []);

    // ── Create a peer connection ──────────────────────────────────────────
    const createPC = useCallback(
      (peerId: string): RTCPeerConnection => {
        // Close any stale connection for this peer
        pcsRef.current.get(peerId)?.close();

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcsRef.current.set(peerId, pc);

        // Add local tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => {
            pc.addTrack(t, localStreamRef.current!);
          });
        }

        // Trickle ICE
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socketRef.current?.emit("signal", {
              to: peerId,
              signal: { type: "candidate", candidate: candidate.toJSON() },
            });
          }
        };

        // Remote audio track — store stream in ref; React's post-render effect attaches it
        pc.ontrack = (event) => {
          // event.streams[0] may be undefined in some browsers — build one from the track
          const stream = event.streams[0] ?? new MediaStream([event.track]);
          remoteStreamsRef.current.set(peerId, stream);
          attachAnalyser(peerId, stream);
          // Force a re-render so the post-render effect can pick up the stream
          setParticipants(prev => [...prev]);
        };

        // Auto-restart ICE if the connection fails
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") pc.restartIce();
        };

        return pc;
      },
      [attachAnalyser]
    );

    // ── Send an offer to a peer (explicit createOffer — required by Safari) ─
    const sendOffer = useCallback(async (peerId: string) => {
      const pc = pcsRef.current.get(peerId);
      if (!pc || !socketRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit("signal", {
          to: peerId,
          signal: { type: "offer", sdp: pc.localDescription },
        });
      } catch { }
    }, []);

    // ── Close and clean up a peer ─────────────────────────────────────────
    const closePeer = useCallback(
      (peerId: string) => {
        pcsRef.current.get(peerId)?.close();
        pcsRef.current.delete(peerId);
        pendingCandidatesRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
        detachAnalyser(peerId);
        const el = document.getElementById(`audio-${peerId}`) as HTMLAudioElement | null;
        if (el) el.srcObject = null;
      },
      [detachAnalyser]
    );

    // ── Mic mute helpers ──────────────────────────────────────────────────
    const applyMute = useCallback((muted: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    }, []);

    const toggleMute = useCallback(() => {
      setIsMuted(prev => { applyMute(!prev); return !prev; });
    }, [applyMute]);

    // ── isMicAllowed prop → auto mute/unmute student ──────────────────────
    useEffect(() => {
      if (role !== "student") return;
      setIsMuted(!isMicAllowed);
      applyMute(!isMicAllowed);
    }, [isMicAllowed, role, applyMute]);

    // ── Lecturer controls exposed via ref ─────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        muteAll: () => socketRef.current?.emit("mute-all", { roomId }),
        grantMic: (name: string) => {
          const peer = participants.find(p => p.displayName === name);
          if (peer) socketRef.current?.emit("grant-mic", { to: peer.socketId });
        },
        revokeMic: (name: string) => {
          const peer = participants.find(p => p.displayName === name);
          if (peer) socketRef.current?.emit("mute-peer", { to: peer.socketId });
        },
      }),
      [participants, roomId]
    );

    // ── Main effect: mic + socket + WebRTC ───────────────────────────────
    useEffect(() => {
      let destroyed = false;

      (async () => {
        // 1. Get microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
            },
            video: false,
          });
          if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }
          localStreamRef.current = stream;
          // Lecturers start live; students start muted until granted permission
          stream.getAudioTracks().forEach(t => { t.enabled = role === "lecturer"; });
          attachAnalyser("self", stream);
        } catch {
          setMicError("Microphone access denied — allow mic permission and reload.");
          return;
        }

        // 2. Connect to Socket.io signaling server
        const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (destroyed) return;
          setIsConnected(true);
          socket.emit("join-room", { roomId, displayName, role });
        });

        socket.on("disconnect", () => setIsConnected(false));

        // 3. Server sends us the list of peers already in the room.
        //    We are the newcomer → we initiate offers to all existing peers.
        socket.on(
          "room-peers",
          async (peers: { socketId: string; displayName: string; role: string }[]) => {
            if (destroyed) return;
            setParticipants(peers.map(p => ({ ...p, isMuted: false })));
            for (const p of peers) {
              createPC(p.socketId);
              await sendOffer(p.socketId);
            }
          }
        );

        // 4. A new peer just joined → we are an existing peer.
        //    We create a PC for them but DO NOT offer — they will offer us.
        socket.on(
          "peer-joined",
          ({ socketId, displayName: pName, role: pRole }: {
            socketId: string; displayName: string; role: string;
          }) => {
            if (destroyed) return;
            setParticipants(prev => [
              ...prev.filter(p => p.socketId !== socketId),
              { socketId, displayName: pName, role: pRole, isMuted: false },
            ]);
            createPC(socketId); // wait for their offer
          }
        );

        // 5. A peer disconnected
        socket.on("peer-left", ({ socketId }: { socketId: string }) => {
          closePeer(socketId);
          setParticipants(prev => prev.filter(p => p.socketId !== socketId));
        });

        // 6. WebRTC signaling relay
        socket.on("signal", async ({ from, signal }: { from: string; signal: any }) => {
          if (destroyed) return;
          let pc = pcsRef.current.get(from);
          if (!pc) pc = createPC(from);

          try {
            if (signal.type === "offer") {
              // Explicit createAnswer — required by Safari (setLocalDescription() with no args is Chrome-only)
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              // Flush ICE candidates that arrived before the remote description
              for (const c of pendingCandidatesRef.current.get(from) ?? []) {
                await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }
              pendingCandidatesRef.current.delete(from);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("signal", {
                to: from,
                signal: { type: "answer", sdp: pc.localDescription },
              });

            } else if (signal.type === "answer") {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

            } else if (signal.type === "candidate" && signal.candidate) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
              } else {
                // Queue: remote description not set yet (offer hasn't arrived)
                const q = pendingCandidatesRef.current.get(from) ?? [];
                q.push(signal.candidate);
                pendingCandidatesRef.current.set(from, q);
              }
            }
          } catch { }
        });

        // 7. Lecturer mute commands
        socket.on("force-mute", () => { setIsMuted(true); applyMute(true); });
        socket.on("mic-granted", () => { setIsMuted(false); applyMute(false); });
      })();

      return () => {
        destroyed = true;
        socketRef.current?.disconnect();
        socketRef.current = null;
        pcsRef.current.forEach(pc => pc.close());
        pcsRef.current.clear();
        pendingCandidatesRef.current.clear();
        remoteStreamsRef.current.clear();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        analyserRefs.current.forEach(({ ctx, raf }) => {
          cancelAnimationFrame(raf);
          ctx.close().catch(() => {});
        });
        analyserRefs.current.clear();
        setSpeakingSet(new Set());
        setParticipants([]);
        setIsConnected(false);
      };
    }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

    const selfIsSpeaking = speakingSet.has("self") && !isMuted;

    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {/* Hidden audio playback elements — one per remote participant */}
        {participants.map(p => (
          <audio
            key={p.socketId}
            id={`audio-${p.socketId}`}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />
        ))}

        {micError ? (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-[12px]">
            <MicOff className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-red-600 dark:text-red-400">{micError}</p>
          </div>
        ) : (
          <>
            {/* ── Status bar ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 dark:bg-black/60 rounded-[14px] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                {/* Live/connecting dot */}
                <div className="relative flex items-center justify-center w-4 h-4">
                  {isConnected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[12px] font-semibold text-slate-200">
                  {isConnected ? "Audio Room · Live" : "Connecting…"}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                  <Users className="h-3 w-3" />
                  {participants.length + 1}
                </span>
              </div>

              {/* Mic toggle button */}
              <button
                type="button"
                onClick={role === "student" && !isMicAllowed ? undefined : toggleMute}
                disabled={role === "student" && !isMicAllowed}
                title={
                  role === "student" && !isMicAllowed
                    ? "Raise your hand to request the mic"
                    : isMuted
                    ? "Unmute (click to go live)"
                    : "Mute"
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed select-none ${
                  isMuted
                    ? "bg-red-600/80 hover:bg-red-600 text-white"
                    : "bg-emerald-500/90 hover:bg-emerald-500 text-white"
                }`}
              >
                {isMuted ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className={`h-3.5 w-3.5 ${selfIsSpeaking ? "animate-pulse" : ""}`} />
                )}
                {isMuted ? "Muted" : "Live"}
              </button>
            </div>

            {/* ── Speaking indicator for self ─────────────────────────── */}
            {selfIsSpeaking && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/30 border border-emerald-700/30 rounded-[10px]">
                <span className="flex gap-[3px] items-end h-4">
                  {[1, 2, 3].map(i => (
                    <span
                      key={i}
                      className="w-[3px] bg-emerald-400 rounded-full animate-pulse"
                      style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </span>
                <Volume2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11.5px] font-semibold text-emerald-400">Speaking…</span>
              </div>
            )}

            {/* ── Participant list ────────────────────────────────────── */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/30 px-1 pb-0.5">
                In Room ({participants.length + 1})
              </p>

              {/* Self */}
              <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] rounded-[10px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ring-1 ${
                    role === "lecturer"
                      ? "bg-emerald-900/50 text-emerald-300 ring-emerald-700/40"
                      : "bg-blue-900/50 text-blue-300 ring-blue-700/40"
                  } ${selfIsSpeaking ? "ring-2 ring-emerald-400" : ""}`}
                >
                  {displayName.trim().charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-semibold text-slate-200 flex-1 truncate">
                  {displayName}{" "}
                  <span className="text-[10px] font-normal text-slate-500">(you)</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {selfIsSpeaking && <Volume2 className="h-3 w-3 text-emerald-400 animate-pulse" />}
                  {isMuted ? (
                    <MicOff className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
              </div>

              {/* Remote participants */}
              {participants.map(p => {
                const isSpeaking = speakingSet.has(p.socketId);
                return (
                  <div
                    key={p.socketId}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] border transition-all ${
                      isSpeaking
                        ? "bg-emerald-950/20 border-emerald-700/30"
                        : "bg-white/[0.02] border-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ring-1 ${
                        p.role === "lecturer"
                          ? "bg-emerald-900/50 text-emerald-300 ring-emerald-700/40"
                          : "bg-slate-800 text-slate-300 ring-slate-700/40"
                      } ${isSpeaking ? "ring-2 ring-emerald-400" : ""}`}
                    >
                      {p.displayName.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] text-slate-300 truncate block">{p.displayName}</span>
                      {p.role === "lecturer" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                          Lecturer
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isSpeaking && <Volume2 className="h-3 w-3 text-emerald-400 animate-pulse" />}
                      {p.isMuted ? (
                        <MicOff className="h-3 w-3 text-red-400/70" />
                      ) : (
                        <Mic className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Empty state ─────────────────────────────────────────── */}
            {participants.length === 0 && isConnected && (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Users className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-[12px] text-slate-500 text-center">
                  {role === "lecturer"
                    ? "Waiting for students to join the room…"
                    : "Connected — waiting for class to start"}
                </p>
              </div>
            )}

            {/* ── Not connected fallback ──────────────────────────────── */}
            {!isConnected && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-800/30 rounded-[10px]">
                <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-[11.5px] text-amber-400">Connecting to audio server…</span>
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
