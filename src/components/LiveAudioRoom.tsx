import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as Ably from "ably";
import { Mic, MicOff, Users, Volume2, WifiOff } from "lucide-react";

interface Participant {
  connectionId: string;
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

// Google STUN + Open Relay TURN (free, no account needed)
const TURN_CREDS = { username: "openrelayproject", credential: "openrelayproject" };
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",               ...TURN_CREDS },
  { urls: "turn:openrelay.metered.ca:80?transport=tcp", ...TURN_CREDS },
  { urls: "turn:openrelay.metered.ca:443",              ...TURN_CREDS },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp",...TURN_CREDS },
  ...(import.meta.env.VITE_TURN_URL
    ? [{ urls: import.meta.env.VITE_TURN_URL as string,
         username: import.meta.env.VITE_TURN_USER as string ?? "",
         credential: import.meta.env.VITE_TURN_PASS as string ?? "" }]
    : []),
];

const LiveAudioRoom = forwardRef<LiveAudioRoomHandle, Props>(
  ({ roomId, displayName, role, isMicAllowed = false, className = "" }, ref) => {

    const ablyRef    = useRef<Ably.Realtime | null>(null);
    const myConnId   = useRef<string>("");
    const pcsRef     = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef    = useRef<MediaStream | null>(null);
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const remoteStreamsRef  = useRef<Map<string, MediaStream>>(new Map());

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isMuted,      setIsMuted]      = useState(role === "student");
    const [isConnected,  setIsConnected]  = useState(false);
    const [micError,     setMicError]     = useState<string | null>(null);
    const [speakingSet,  setSpeakingSet]  = useState<Set<string>>(new Set());

    const analyserRefs = useRef<Map<string, { ctx: AudioContext; raf: number }>>(new Map());

    // ── Attach stored remote streams after every render (fixes race with <audio> elements)
    useEffect(() => {
      remoteStreamsRef.current.forEach((stream, connId) => {
        const el = document.getElementById(`audio-${connId}`) as HTMLAudioElement | null;
        if (el && el.srcObject !== stream) { el.srcObject = stream; el.play().catch(() => {}); }
      });
    });

    // ── Speaking detection ────────────────────────────────────────────────
    const attachAnalyser = useCallback((id: string, stream: MediaStream) => {
      try {
        const existing = analyserRefs.current.get(id);
        if (existing) { cancelAnimationFrame(existing.raf); existing.ctx.close().catch(() => {}); }
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let was = false;
        let rafId = 0;
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const speaking = data.reduce((a, b) => a + b, 0) / data.length > 12;
          if (speaking !== was) {
            was = speaking;
            setSpeakingSet(prev => { const n = new Set(prev); speaking ? n.add(id) : n.delete(id); return n; });
          }
          const e = analyserRefs.current.get(id);
          if (e) { rafId = requestAnimationFrame(tick); e.raf = rafId; }
        };
        rafId = requestAnimationFrame(tick);
        analyserRefs.current.set(id, { ctx, raf: rafId });
      } catch { }
    }, []);

    const detachAnalyser = useCallback((id: string) => {
      const e = analyserRefs.current.get(id);
      if (!e) return;
      cancelAnimationFrame(e.raf);
      e.ctx.close().catch(() => {});
      analyserRefs.current.delete(id);
      setSpeakingSet(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, []);

    // ── Mic control ───────────────────────────────────────────────────────
    const applyMute = useCallback((muted: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    }, []);

    const toggleMute = useCallback(() => {
      setIsMuted(prev => { applyMute(!prev); return !prev; });
    }, [applyMute]);

    useEffect(() => {
      if (role !== "student") return;
      setIsMuted(!isMicAllowed);
      applyMute(!isMicAllowed);
    }, [isMicAllowed, role, applyMute]);

    // ── Send signal to a specific peer via their Ably channel ─────────────
    const sendSignal = useCallback((toConnId: string, signal: unknown) => {
      const ch = ablyRef.current?.channels.get(`signal:${toConnId}`);
      ch?.publish("signal", { from: myConnId.current, signal });
    }, []);

    // ── Create RTCPeerConnection ───────────────────────────────────────────
    const createPC = useCallback((peerId: string): RTCPeerConnection => {
      pcsRef.current.get(peerId)?.close();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(peerId, pc);

      localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) sendSignal(peerId, { type: "candidate", candidate: candidate.toJSON() });
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        remoteStreamsRef.current.set(peerId, stream);
        attachAnalyser(peerId, stream);
        setParticipants(prev => [...prev]); // trigger re-render so post-render effect attaches stream
      };

      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") pc.restartIce(); };
      return pc;
    }, [sendSignal, attachAnalyser]);

    // ── Send WebRTC offer (explicit createOffer — required by Safari) ──────
    const sendOffer = useCallback(async (peerId: string) => {
      const pc = pcsRef.current.get(peerId);
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(peerId, { type: "offer", sdp: pc.localDescription });
      } catch { }
    }, [sendSignal]);

    // ── Clean up one peer ─────────────────────────────────────────────────
    const closePeer = useCallback((peerId: string) => {
      pcsRef.current.get(peerId)?.close();
      pcsRef.current.delete(peerId);
      pendingCandidatesRef.current.delete(peerId);
      remoteStreamsRef.current.delete(peerId);
      detachAnalyser(peerId);
      const el = document.getElementById(`audio-${peerId}`) as HTMLAudioElement | null;
      if (el) el.srcObject = null;
    }, [detachAnalyser]);

    // ── Handle an incoming WebRTC signal ──────────────────────────────────
    const handleSignal = useCallback(async (from: string, signal: any) => {
      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPC(from);
      try {
        if (signal.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          for (const c of pendingCandidatesRef.current.get(from) ?? []) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(from, { type: "answer", sdp: pc.localDescription });
        } else if (signal.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "candidate" && signal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            const q = pendingCandidatesRef.current.get(from) ?? [];
            q.push(signal.candidate);
            pendingCandidatesRef.current.set(from, q);
          }
        }
      } catch { }
    }, [createPC, sendSignal]);

    // ── Lecturer controls via ref ─────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      muteAll: () => {
        if (!ablyRef.current) return;
        ablyRef.current.channels.get(`room:${roomId}`).publish("mute-all", {});
      },
      grantMic: (name: string) => {
        const peer = participants.find(p => p.displayName === name);
        if (peer) ablyRef.current?.channels.get(`signal:${peer.connectionId}`).publish("mic-granted", {});
      },
      revokeMic: (name: string) => {
        const peer = participants.find(p => p.displayName === name);
        if (peer) ablyRef.current?.channels.get(`signal:${peer.connectionId}`).publish("force-mute", {});
      },
    }), [participants, roomId]);

    // ── Main effect: mic + Ably + WebRTC ─────────────────────────────────
    useEffect(() => {
      let destroyed = false;

      (async () => {
        // 1. Get microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
          if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }
          localStreamRef.current = stream;
          stream.getAudioTracks().forEach(t => { t.enabled = role === "lecturer"; });
          attachAnalyser("self", stream);
        } catch {
          setMicError("Microphone access denied — allow mic permission and reload.");
          return;
        }

        // 2. Connect to Ably (signaling server — free, no persistent backend needed)
        const token = localStorage.getItem("edu_token");
        const ably = new Ably.Realtime({
          authUrl: "/api/ably-token",
          authHeaders: { Authorization: `Bearer ${token}` },
          authMethod: "GET",
        });
        ablyRef.current = ably;

        const roomChannel = ably.channels.get(`room:${roomId}`);

        ably.connection.on("connected", async () => {
          if (destroyed) return;
          myConnId.current = ably.connection.id!;
          setIsConnected(true);

          // 3. Subscribe to MY personal signal channel
          const myChannel = ably.channels.get(`signal:${myConnId.current}`);

          myChannel.subscribe("signal", (msg: Ably.Message) => {
            const { from, signal } = msg.data;
            handleSignal(from, signal);
          });
          myChannel.subscribe("force-mute", () => { setIsMuted(true); applyMute(true); });
          myChannel.subscribe("mic-granted", () => { setIsMuted(false); applyMute(false); });

          // 4. Listen for room-wide mute-all (students only)
          roomChannel.subscribe("mute-all", () => {
            if (role === "student") { setIsMuted(true); applyMute(true); }
          });

          // 5. Enter presence (announces us to the room)
          await roomChannel.presence.enter({ displayName, role });

          // 6. Get existing peers → we are the newcomer → send offers to all
          const existing = await roomChannel.presence.get();
          const others = existing.filter((m: Ably.PresenceMessage) => m.connectionId !== myConnId.current);
          if (others.length > 0) {
            setParticipants(others.map((m: Ably.PresenceMessage) => ({
              connectionId: m.connectionId!,
              displayName: (m.data as any).displayName,
              role: (m.data as any).role,
              isMuted: false,
            })));
            for (const m of others) {
              createPC(m.connectionId!);
              await sendOffer(m.connectionId!);
            }
          }

          // 7. New peer enters → we already exist → create PC, wait for their offer
          roomChannel.presence.subscribe("enter", (m: Ably.PresenceMessage) => {
            if (m.connectionId === myConnId.current || destroyed) return;
            setParticipants(prev => [
              ...prev.filter(p => p.connectionId !== m.connectionId),
              { connectionId: m.connectionId!, displayName: (m.data as any).displayName, role: (m.data as any).role, isMuted: false },
            ]);
            createPC(m.connectionId!);
          });

          // 8. Peer leaves
          roomChannel.presence.subscribe("leave", (m: Ably.PresenceMessage) => {
            closePeer(m.connectionId!);
            setParticipants(prev => prev.filter(p => p.connectionId !== m.connectionId));
          });
        });

        ably.connection.on("disconnected", () => setIsConnected(false));
        ably.connection.on("failed",       () => setIsConnected(false));
      })();

      return () => {
        destroyed = true;
        ablyRef.current?.channels.get(`room:${roomId}`).presence.leave().catch(() => {});
        ablyRef.current?.close();
        ablyRef.current = null;
        pcsRef.current.forEach(pc => pc.close());
        pcsRef.current.clear();
        pendingCandidatesRef.current.clear();
        remoteStreamsRef.current.clear();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        analyserRefs.current.forEach(({ ctx, raf }) => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); });
        analyserRefs.current.clear();
        setSpeakingSet(new Set());
        setParticipants([]);
        setIsConnected(false);
      };
    }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

    const selfSpeaking = speakingSet.has("self") && !isMuted;

    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {/* Hidden audio elements — attached to remote streams after render */}
        {participants.map(p => (
          <audio key={p.connectionId} id={`audio-${p.connectionId}`} autoPlay playsInline style={{ display: "none" }} />
        ))}

        {micError ? (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-[12px]">
            <MicOff className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-red-600 dark:text-red-400">{micError}</p>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 dark:bg-black/60 rounded-[14px] border border-white/[0.06]">
              <div className="flex items-center gap-3">
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
                  <Users className="h-3 w-3" />{participants.length + 1}
                </span>
              </div>

              <button
                type="button"
                onClick={role === "student" && !isMicAllowed ? undefined : toggleMute}
                disabled={role === "student" && !isMicAllowed}
                title={role === "student" && !isMicAllowed ? "Raise hand to request mic" : isMuted ? "Unmute" : "Mute"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed select-none ${
                  isMuted ? "bg-red-600/80 hover:bg-red-600 text-white" : "bg-emerald-500/90 hover:bg-emerald-500 text-white"
                }`}
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className={`h-3.5 w-3.5 ${selfSpeaking ? "animate-pulse" : ""}`} />}
                {isMuted ? "Muted" : "Live"}
              </button>
            </div>

            {/* Speaking indicator */}
            {selfSpeaking && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/30 border border-emerald-700/30 rounded-[10px]">
                <span className="flex gap-[3px] items-end h-4">
                  {[1,2,3].map(i => (
                    <span key={i} className="w-[3px] bg-emerald-400 rounded-full animate-pulse"
                      style={{ height: `${8+i*4}px`, animationDelay: `${i*0.1}s` }} />
                  ))}
                </span>
                <Volume2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11.5px] font-semibold text-emerald-400">Speaking…</span>
              </div>
            )}

            {/* Participant list */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/30 px-1 pb-0.5">
                In Room ({participants.length + 1})
              </p>

              {/* Self */}
              <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] rounded-[10px]">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ring-1 ${
                  role === "lecturer" ? "bg-emerald-900/50 text-emerald-300 ring-emerald-700/40" : "bg-blue-900/50 text-blue-300 ring-blue-700/40"
                } ${selfSpeaking ? "ring-2 ring-emerald-400" : ""}`}>
                  {displayName.trim().charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-semibold text-slate-200 flex-1 truncate">
                  {displayName} <span className="text-[10px] font-normal text-slate-500">(you)</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {selfSpeaking && <Volume2 className="h-3 w-3 text-emerald-400 animate-pulse" />}
                  {isMuted ? <MicOff className="h-3.5 w-3.5 text-red-400" /> : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
              </div>

              {/* Remote participants */}
              {participants.map(p => {
                const speaking = speakingSet.has(p.connectionId);
                return (
                  <div key={p.connectionId} className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] border transition-all ${
                    speaking ? "bg-emerald-950/20 border-emerald-700/30" : "bg-white/[0.02] border-white/[0.04]"
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ring-1 ${
                      p.role === "lecturer" ? "bg-emerald-900/50 text-emerald-300 ring-emerald-700/40" : "bg-slate-800 text-slate-300 ring-slate-700/40"
                    } ${speaking ? "ring-2 ring-emerald-400" : ""}`}>
                      {p.displayName.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] text-slate-300 truncate block">{p.displayName}</span>
                      {p.role === "lecturer" && <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Lecturer</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {speaking && <Volume2 className="h-3 w-3 text-emerald-400 animate-pulse" />}
                      {p.isMuted ? <MicOff className="h-3 w-3 text-red-400/70" /> : <Mic className="h-3 w-3 text-slate-500" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {participants.length === 0 && isConnected && (
              <div className="flex flex-col items-center py-6 gap-2">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Users className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-[12px] text-slate-500 text-center">
                  {role === "lecturer" ? "Waiting for students to join…" : "Connected — waiting for class to start"}
                </p>
              </div>
            )}

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
