import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { createDefaultAbletonSession, createDefaultAuxBuses, createInitialProject, DRUM_PATTERNS } from '../data/presets';
import type {
  AbletonSessionState,
  AudioClip,
  AuxBusId,
  ChatMessage,
  Collaborator,
  DrumChannel,
  DrumChannelId,
  MidiNote,
  StudioAuxBus,
  StudioProject,
  StudioTrack,
  StudioView,
} from '../types/studio';

function getStoredUserName(): string {
  try {
    const saved = localStorage.getItem('trackroom_username');
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore storage restrictions
  }
  const randomTag = Math.floor(100 + Math.random() * 899);
  return `Producer ${randomTag}`;
}

export function useStudioSocket(roomId: string) {
  const [project, setProject] = useState<StudioProject>(() => createInitialProject(roomId));
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selfId, setSelfId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [userName, setUserNameState] = useState<string>(getStoredUserName);

  const socketRef = useRef<Socket | null>(null);
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit('room:join', { roomId, userName: userNameRef.current });
    };

    socket.on('connect', () => {
      setConnected(true);
      joinRoom();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room:init', (data: { project: StudioProject; collaborators: Collaborator[]; selfId: string }) => {
      setProject(data.project);
      setCollaborators(data.collaborators);
      setSelfId(data.selfId);
    });

    socket.on('presence:update', (list: Collaborator[]) => {
      setCollaborators(list);
    });

    socket.on('project:meta', (meta: Partial<Pick<StudioProject, 'title' | 'bpm' | 'swing' | 'musicalKey'>>) => {
      setProject((prev) => ({ ...prev, ...meta }));
    });

    socket.on('project:mastering', ({ mastering }: { mastering: StudioProject['mastering'] }) => {
      if (!mastering) return;
      setProject((prev) => ({ ...prev, mastering: { ...prev.mastering, ...mastering } }));
    });

    socket.on('aux:update', ({ busId, updates }: { busId: AuxBusId; updates: Partial<StudioAuxBus> }) => {
      setProject((prev) => ({
        ...prev,
        auxBuses: (prev.auxBuses || createDefaultAuxBuses()).map((b) =>
          b.id === busId ? { ...b, ...updates } : b
        ),
      }));
    });

    socket.on('session:update', ({ session }: { session: AbletonSessionState }) => {
      if (!session) return;
      setProject((prev) => ({ ...prev, session }));
    });

    socket.on('drum:step', ({ channelId, stepIndex, value }: { channelId: DrumChannelId; stepIndex: number; value: number }) => {
      setProject((prev) => ({
        ...prev,
        drumChannels: prev.drumChannels.map((ch) => {
          if (ch.id !== channelId) return ch;
          const next = [...ch.steps];
          next[stepIndex] = value;
          return { ...ch, steps: next };
        }),
      }));
    });

    socket.on('drum:channel', ({ channelId, updates }: { channelId: DrumChannelId; updates: Partial<DrumChannel> }) => {
      setProject((prev) => ({
        ...prev,
        drumChannels: prev.drumChannels.map((ch) => (ch.id === channelId ? { ...ch, ...updates } : ch)),
      }));
    });

    socket.on('drum:all', (channels: DrumChannel[]) => {
      setProject((prev) => ({ ...prev, drumChannels: channels }));
    });

    socket.on('track:add', (track: StudioTrack) => {
      setProject((prev) => {
        if (prev.tracks.some((t) => t.id === track.id)) return prev;
        return { ...prev, tracks: [...prev.tracks, track] };
      });
    });

    socket.on('track:update', ({ trackId, updates }: { trackId: string; updates: Partial<StudioTrack> }) => {
      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
      }));
    });

    socket.on('track:delete', ({ trackId }: { trackId: string }) => {
      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.filter((t) => t.id !== trackId),
        notes: prev.notes.filter((n) => n.trackId !== trackId),
        audioClips: prev.audioClips.filter((c) => c.trackId !== trackId),
      }));
    });

    socket.on('note:add', (note: MidiNote) => {
      setProject((prev) => {
        if (prev.notes.some((n) => n.id === note.id)) return prev;
        return { ...prev, notes: [...prev.notes, note] };
      });
    });

    socket.on('note:update', ({ noteId, updates }: { noteId: string; updates: Partial<MidiNote> }) => {
      setProject((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === noteId ? { ...n, ...updates } : n)),
      }));
    });

    socket.on('note:delete', ({ noteId }: { noteId: string }) => {
      setProject((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== noteId),
      }));
    });

    socket.on('note:clear-track', ({ trackId }: { trackId: string }) => {
      setProject((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.trackId !== trackId),
      }));
    });

    socket.on('clip:add', (clip: AudioClip) => {
      setProject((prev) => {
        if (prev.audioClips.some((c) => c.id === clip.id)) return prev;
        return { ...prev, audioClips: [...prev.audioClips, clip] };
      });
    });

    socket.on('clip:delete', ({ clipId }: { clipId: string }) => {
      setProject((prev) => ({
        ...prev,
        audioClips: prev.audioClips.filter((c) => c.id !== clipId),
      }));
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setProject((prev) => {
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const setUserName = useCallback((nextName: string) => {
    const clean = nextName.trim().slice(0, 28);
    if (!clean) return;
    setUserNameState(clean);
    try {
      localStorage.setItem('trackroom_username', clean);
    } catch {
      // ignore
    }
    socketRef.current?.emit('presence:update-self', { name: clean });
  }, []);

  const updateActiveView = useCallback((activeView: StudioView) => {
    socketRef.current?.emit('presence:update-self', { activeView });
  }, []);

  const updateSpeakingState = useCallback((isSpeaking: boolean) => {
    socketRef.current?.emit('presence:update-self', { isSpeaking });
  }, []);

  const updateProjectMeta = useCallback((meta: Partial<Pick<StudioProject, 'title' | 'bpm' | 'swing' | 'musicalKey'>>) => {
    setProject((prev) => ({ ...prev, ...meta }));
    socketRef.current?.emit('project:meta', meta);
  }, []);

  const updateMastering = useCallback((updates: Partial<StudioProject['mastering']>) => {
    setProject((prev) => {
      const nextMastering = { ...prev.mastering, ...updates };
      socketRef.current?.emit('project:mastering', { mastering: nextMastering });
      return { ...prev, mastering: nextMastering };
    });
  }, []);

  const updateAuxBus = useCallback((busId: AuxBusId, updates: Partial<StudioAuxBus>) => {
    setProject((prev) => {
      const base = prev.auxBuses || createDefaultAuxBuses();
      const nextAux = base.map((b) => (b.id === busId ? { ...b, ...updates } : b));
      socketRef.current?.emit('aux:update', { busId, updates });
      return { ...prev, auxBuses: nextAux };
    });
  }, []);

  const updateSession = useCallback((updater: (prev: AbletonSessionState) => AbletonSessionState) => {
    setProject((prev) => {
      const current = prev.session || createDefaultAbletonSession();
      const nextSession = updater(current);
      socketRef.current?.emit('session:update', { session: nextSession });
      return { ...prev, session: nextSession };
    });
  }, []);

  const updateDrumStep = useCallback((channelId: DrumChannelId, stepIndex: number, value: number) => {
    setProject((prev) => ({
      ...prev,
      drumChannels: prev.drumChannels.map((ch) => {
        if (ch.id !== channelId) return ch;
        const next = [...ch.steps];
        next[stepIndex] = value;
        return { ...ch, steps: next };
      }),
    }));
    socketRef.current?.emit('drum:step', { channelId, stepIndex, value });
  }, []);

  const updateDrumChannel = useCallback(
    (channelId: DrumChannelId, updates: Partial<Pick<DrumChannel, 'volume' | 'pitch' | 'muted'>>) => {
      setProject((prev) => ({
        ...prev,
        drumChannels: prev.drumChannels.map((ch) => (ch.id === channelId ? { ...ch, ...updates } : ch)),
      }));
      socketRef.current?.emit('drum:channel', { channelId, updates });
    },
    []
  );

  const applyDrumPreset = useCallback((presetName: string) => {
    const preset = DRUM_PATTERNS[presetName];
    if (!preset) return;
    setProject((prev) => ({
      ...prev,
      drumChannels: prev.drumChannels.map((ch) => ({
        ...ch,
        steps: [...(preset[ch.id] || ch.steps)],
      })),
    }));
    socketRef.current?.emit('drum:preset', { presetName });
  }, []);

  const addTrack = useCallback((track: StudioTrack) => {
    setProject((prev) => {
      if (prev.tracks.some((t) => t.id === track.id)) return prev;
      return { ...prev, tracks: [...prev.tracks, track] };
    });
    socketRef.current?.emit('track:add', track);
  }, []);

  const updateTrack = useCallback((trackId: string, updates: Partial<StudioTrack>) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
    }));
    socketRef.current?.emit('track:update', { trackId, updates });
  }, []);

  const deleteTrack = useCallback((trackId: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
      notes: prev.notes.filter((n) => n.trackId !== trackId),
      audioClips: prev.audioClips.filter((c) => c.trackId !== trackId),
    }));
    socketRef.current?.emit('track:delete', { trackId });
  }, []);

  const addNote = useCallback((note: MidiNote) => {
    setProject((prev) => {
      if (prev.notes.some((n) => n.id === note.id)) return prev;
      return { ...prev, notes: [...prev.notes, note] };
    });
    socketRef.current?.emit('note:add', note);
  }, []);

  const updateNote = useCallback((noteId: string, updates: Partial<MidiNote>) => {
    setProject((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === noteId ? { ...n, ...updates } : n)),
    }));
    socketRef.current?.emit('note:update', { noteId, updates });
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setProject((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== noteId),
    }));
    socketRef.current?.emit('note:delete', { noteId });
  }, []);

  const clearTrackNotes = useCallback((trackId: string) => {
    setProject((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.trackId !== trackId),
    }));
    socketRef.current?.emit('note:clear-track', { trackId });
  }, []);

  const addAudioClip = useCallback((clip: AudioClip) => {
    setProject((prev) => {
      if (prev.audioClips.some((c) => c.id === clip.id)) return prev;
      return { ...prev, audioClips: [...prev.audioClips, clip] };
    });
    socketRef.current?.emit('clip:add', clip);
  }, []);

  const deleteAudioClip = useCallback((clipId: string) => {
    setProject((prev) => ({
      ...prev,
      audioClips: prev.audioClips.filter((c) => c.id !== clipId),
    }));
    socketRef.current?.emit('clip:delete', { clipId });
  }, []);

  const sendChatMessage = useCallback((text: string, barMarker?: number) => {
    socketRef.current?.emit('chat:send', { text, barMarker });
  }, []);

  return {
    socket: socketRef.current,
    project,
    collaborators,
    selfId,
    connected,
    userName,
    setUserName,
    updateActiveView,
    updateSpeakingState,
    updateProjectMeta,
    updateMastering,
    updateAuxBus,
    updateSession,
    updateDrumStep,
    updateDrumChannel,
    applyDrumPreset,
    addTrack,
    updateTrack,
    deleteTrack,
    addNote,
    updateNote,
    deleteNote,
    clearTrackNotes,
    addAudioClip,
    deleteAudioClip,
    sendChatMessage,
  };
}
