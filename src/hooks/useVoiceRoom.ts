import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseVoiceRoomOptions {
  socket: Socket | null;
  onSpeakingChange?: (speaking: boolean) => void;
}

export function useVoiceRoom({ socket, onSpeakingChange }: UseVoiceRoomOptions) {
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const vadCtxRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const isDeafenedRef = useRef(false);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
    for (const audio of remoteAudioRef.current.values()) {
      audio.muted = isDeafened;
    }
  }, [isDeafened]);

  const syncPeerList = useCallback(() => {
    setConnectedPeerIds(Array.from(peersRef.current.keys()));
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      peersRef.current.delete(peerId);
    }
    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRef.current.delete(peerId);
    }
    syncPeerList();
  }, [syncPeerList]);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      cleanupPeer(peerId);
      const pc = new RTCPeerConnection(RTC_CONFIG);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('voice:ice-candidate', {
            targetId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        let audio = remoteAudioRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.muted = isDeafenedRef.current;
          remoteAudioRef.current.set(peerId, audio);
        }
        audio.srcObject = stream;
        void audio.play().catch(() => {
          // Autoplay blocked until interaction
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupPeer(peerId);
        }
      };

      peersRef.current.set(peerId, pc);
      syncPeerList();
      return pc;
    },
    [cleanupPeer, socket, syncPeerList]
  );

  const stopVad = useCallback(() => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (vadCtxRef.current) {
      void vadCtxRef.current.close();
      vadCtxRef.current = null;
    }
    setMicLevel(0);
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      onSpeakingChange?.(false);
    }
  }, [onSpeakingChange]);

  const startVad = useCallback(
    (stream: MediaStream) => {
      stopVad();
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        vadCtxRef.current = ctx;

        const data = new Uint8Array(analyser.frequencyBinCount);
        let lastBroadcast = 0;

        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const trackEnabled = stream.getAudioTracks()[0]?.enabled ?? false;
          const level = trackEnabled ? Math.min(1, rms * 4.5) : 0;
          setMicLevel(level);

          const speakingNow = trackEnabled && level > 0.14;
          const now = performance.now();
          if (speakingNow !== isSpeakingRef.current && now - lastBroadcast > 180) {
            isSpeakingRef.current = speakingNow;
            lastBroadcast = now;
            onSpeakingChange?.(speakingNow);
          }
          vadRafRef.current = requestAnimationFrame(loop);
        };
        vadRafRef.current = requestAnimationFrame(loop);
      } catch {
        // VAD optional if audio context fails
      }
    },
    [onSpeakingChange, stopVad]
  );

  const leaveCall = useCallback(() => {
    stopVad();
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    for (const peerId of Array.from(peersRef.current.keys())) {
      cleanupPeer(peerId);
    }
    setInCall(false);
    setIsMuted(false);
    socket?.emit('voice:leave');
  }, [cleanupPeer, socket, stopVad]);

  const joinCall = useCallback(async () => {
    if (!socket) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setInCall(true);
      setIsMuted(false);
      startVad(stream);
      socket.emit('voice:join');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setError(`Could not access microphone: ${msg}`);
    }
  }, [socket, startVad]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    setIsMuted(nextMuted);
    if (nextMuted && isSpeakingRef.current) {
      isSpeakingRef.current = false;
      onSpeakingChange?.(false);
    }
    socket?.emit('voice:mute', { isMuted: nextMuted });
  }, [isMuted, onSpeakingChange, socket]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => !prev);
  }, []);

  // Wire WebRTC signaling listeners
  useEffect(() => {
    if (!socket) return;

    const handleExistingPeers = async ({ peerIds }: { peerIds: string[] }) => {
      for (const peerId of peerIds) {
        const pc = createPeerConnection(peerId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice:offer', { targetId: peerId, sdp: offer });
        } catch {
          cleanupPeer(peerId);
        }
      }
    };

    const handleOffer = async ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!localStreamRef.current) return;
      const pc = createPeerConnection(fromId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', { targetId: fromId, sdp: answer });
      } catch {
        cleanupPeer(fromId);
      }
    };

    const handleAnswer = async ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peersRef.current.get(fromId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch {
        cleanupPeer(fromId);
      }
    };

    const handleIce = async ({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(fromId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale ICE
      }
    };

    const handlePeerLeft = ({ peerId }: { peerId: string }) => {
      cleanupPeer(peerId);
    };

    socket.on('voice:existing-peers', handleExistingPeers);
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice-candidate', handleIce);
    socket.on('voice:peer-left', handlePeerLeft);

    return () => {
      socket.off('voice:existing-peers', handleExistingPeers);
      socket.off('voice:offer', handleOffer);
      socket.off('voice:answer', handleAnswer);
      socket.off('voice:ice-candidate', handleIce);
      socket.off('voice:peer-left', handlePeerLeft);
    };
  }, [cleanupPeer, createPeerConnection, socket]);

  useEffect(() => {
    return () => {
      stopVad();
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
      }
      for (const peerId of Array.from(peersRef.current.keys())) {
        cleanupPeer(peerId);
      }
    };
  }, [cleanupPeer, stopVad]);

  return {
    inCall,
    isMuted,
    isDeafened,
    micLevel,
    error,
    connectedPeerIds,
    joinCall,
    leaveCall,
    toggleMute,
    toggleDeafen,
    clearError: () => setError(null),
  };
}
