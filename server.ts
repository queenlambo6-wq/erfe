import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createInitialProject, DRUM_PATTERNS } from './src/data/presets.ts';
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
  VoiceSignalPayload,
} from './src/types/studio.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const USER_COLORS = ['#F59E0B', '#38BDF8', '#A78BFA', '#34D399', '#FB7185', '#F97316', '#2DD4BF'];

const rooms = new Map<string, StudioProject>();
const roomUsers = new Map<string, Map<string, Collaborator>>();

function sanitizeRoomId(raw: string): string {
  const cleaned = String(raw || 'STUDIO-MAIN')
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, '')
    .slice(0, 24);
  return cleaned || 'STUDIO-MAIN';
}

function getOrCreateRoom(roomId: string): StudioProject {
  let project = rooms.get(roomId);
  if (!project) {
    project = createInitialProject(roomId);
    rooms.set(roomId, project);
  }
  return project;
}

function getRoomUsers(roomId: string): Map<string, Collaborator> {
  let users = roomUsers.get(roomId);
  if (!users) {
    users = new Map<string, Collaborator>();
    roomUsers.set(roomId, users);
  }
  return users;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 15 * 1024 * 1024, // 15MB for recorded audio clip syncing
  });

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
    });
  });

  io.on('connection', (socket) => {
    let currentRoomId: string | null = null;

    const leaveCurrentRoom = () => {
      if (!currentRoomId) return;
      const users = roomUsers.get(currentRoomId);
      const leaving = users?.get(socket.id);
      if (users) {
        users.delete(socket.id);
        io.to(currentRoomId).emit('presence:update', Array.from(users.values()));
        if (leaving?.inVoice) {
          socket.to(currentRoomId).emit('voice:peer-left', { peerId: socket.id });
        }
        if (leaving) {
          const project = rooms.get(currentRoomId);
          if (project) {
            const sysMsg: ChatMessage = {
              id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              senderId: 'system',
              senderName: 'Studio Room',
              senderColor: '#94A3B8',
              text: `${leaving.name} left the session.`,
              timestamp: Date.now(),
              isSystem: true,
            };
            project.messages.push(sysMsg);
            if (project.messages.length > 150) project.messages.shift();
            io.to(currentRoomId).emit('chat:message', sysMsg);
          }
        }
      }
      socket.leave(currentRoomId);
      currentRoomId = null;
    };

    socket.on('room:join', (payload: { roomId: string; userName?: string }) => {
      leaveCurrentRoom();
      const roomId = sanitizeRoomId(payload?.roomId || 'STUDIO-MAIN');
      currentRoomId = roomId;
      socket.join(roomId);

      const project = getOrCreateRoom(roomId);
      const users = getRoomUsers(roomId);

      const colorIndex = users.size % USER_COLORS.length;
      const cleanName = (payload?.userName || '').trim().slice(0, 28) || `Producer ${users.size + 1}`;
      const collaborator: Collaborator = {
        id: socket.id,
        name: cleanName,
        color: USER_COLORS[colorIndex],
        activeView: 'arrangement',
        inVoice: false,
        isMuted: false,
        isSpeaking: false,
        joinedAt: Date.now(),
      };
      users.set(socket.id, collaborator);

      // Send authoritative full state to joining client
      socket.emit('room:init', {
        project,
        collaborators: Array.from(users.values()),
        selfId: socket.id,
      });

      // Notify everyone in room of presence update
      io.to(roomId).emit('presence:update', Array.from(users.values()));

      const sysMsg: ChatMessage = {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: 'system',
        senderName: 'Studio Room',
        senderColor: collaborator.color,
        text: `${collaborator.name} joined the studio.`,
        timestamp: Date.now(),
        isSystem: true,
      };
      project.messages.push(sysMsg);
      if (project.messages.length > 150) project.messages.shift();
      socket.to(roomId).emit('chat:message', sysMsg);
    });

    socket.on('presence:update-self', (updates: Partial<Pick<Collaborator, 'name' | 'activeView' | 'isSpeaking'>>) => {
      if (!currentRoomId) return;
      const users = roomUsers.get(currentRoomId);
      const user = users?.get(socket.id);
      if (!user) return;

      if (typeof updates.name === 'string' && updates.name.trim()) {
        user.name = updates.name.trim().slice(0, 28);
      }
      if (updates.activeView && ['arrangement', 'session', 'beats', 'pianoroll', 'mixer', 'mastering'].includes(updates.activeView)) {
        user.activeView = updates.activeView as StudioView;
      }
      if (typeof updates.isSpeaking === 'boolean') {
        user.isSpeaking = updates.isSpeaking;
      }
      io.to(currentRoomId).emit('presence:update', Array.from(users!.values()));
    });

    // Project Metadata Updates
    socket.on('project:meta', (meta: Partial<Pick<StudioProject, 'title' | 'bpm' | 'swing' | 'musicalKey'>>) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;

      if (typeof meta.title === 'string') {
        project.title = meta.title.trim().slice(0, 48) || 'Untitled Session';
      }
      if (typeof meta.bpm === 'number' && Number.isFinite(meta.bpm)) {
        project.bpm = Math.max(50, Math.min(200, Math.round(meta.bpm)));
      }
      if (typeof meta.swing === 'number' && Number.isFinite(meta.swing)) {
        project.swing = Math.max(0, Math.min(0.5, meta.swing));
      }
      if (typeof meta.musicalKey === 'string' && meta.musicalKey.length <= 24) {
        project.musicalKey = meta.musicalKey;
      }

      socket.to(currentRoomId).emit('project:meta', {
        title: project.title,
        bpm: project.bpm,
        swing: project.swing,
        musicalKey: project.musicalKey,
      });
    });

    // Master Bus Mastering Chain Sync
    socket.on('project:mastering', (payload: { mastering: StudioProject['mastering'] }) => {
      if (!currentRoomId || !payload?.mastering) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      project.mastering = { ...project.mastering, ...payload.mastering };
      socket.to(currentRoomId).emit('project:mastering', { mastering: project.mastering });
    });

    // Logic Pro Aux Bus Channel Strip Sync
    socket.on('aux:update', (payload: { busId: AuxBusId; updates: Partial<StudioAuxBus> }) => {
      if (!currentRoomId || !payload?.busId) return;
      const project = rooms.get(currentRoomId);
      if (!project || !project.auxBuses) return;
      const bus = project.auxBuses.find((b) => b.id === payload.busId);
      if (!bus) return;
      Object.assign(bus, payload.updates);
      socket.to(currentRoomId).emit('aux:update', { busId: payload.busId, updates: payload.updates });
    });

    // Ableton Session View Clips, Scenes & Macro Rack Sync
    socket.on('session:update', (payload: { session: AbletonSessionState }) => {
      if (!currentRoomId || !payload?.session) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      project.session = payload.session;
      socket.to(currentRoomId).emit('session:update', { session: project.session });
    });

    // Drum Step Sequencer Events
    socket.on('drum:step', (payload: { channelId: DrumChannelId; stepIndex: number; value: number }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      const channel = project.drumChannels.find((c) => c.id === payload.channelId);
      if (!channel) return;
      if (payload.stepIndex < 0 || payload.stepIndex >= channel.steps.length) return;

      const clamped = Math.max(0, Math.min(1, Number(payload.value) || 0));
      channel.steps[payload.stepIndex] = clamped;
      socket.to(currentRoomId).emit('drum:step', {
        channelId: payload.channelId,
        stepIndex: payload.stepIndex,
        value: clamped,
      });
    });

    socket.on('drum:channel', (payload: { channelId: DrumChannelId; updates: Partial<Pick<DrumChannel, 'volume' | 'pitch' | 'muted'>> }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      const channel = project.drumChannels.find((c) => c.id === payload.channelId);
      if (!channel) return;

      if (typeof payload.updates.volume === 'number') {
        channel.volume = Math.max(0, Math.min(1.2, payload.updates.volume));
      }
      if (typeof payload.updates.pitch === 'number') {
        channel.pitch = Math.max(-12, Math.min(12, payload.updates.pitch));
      }
      if (typeof payload.updates.muted === 'boolean') {
        channel.muted = payload.updates.muted;
      }
      socket.to(currentRoomId).emit('drum:channel', {
        channelId: payload.channelId,
        updates: { volume: channel.volume, pitch: channel.pitch, muted: channel.muted },
      });
    });

    socket.on('drum:preset', (payload: { presetName: string }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      const preset = DRUM_PATTERNS[payload.presetName];
      if (!preset) return;

      project.drumChannels = project.drumChannels.map((ch) => ({
        ...ch,
        steps: [...(preset[ch.id] || ch.steps)],
      }));
      io.to(currentRoomId).emit('drum:all', project.drumChannels);
    });

    // Track Events
    socket.on('track:add', (track: StudioTrack) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project || !track?.id) return;
      if (project.tracks.some((t) => t.id === track.id)) return; // idempotent
      project.tracks.push(track);
      socket.to(currentRoomId).emit('track:add', track);
    });

    socket.on('track:update', (payload: { trackId: string; updates: Partial<StudioTrack> }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      const track = project.tracks.find((t) => t.id === payload.trackId);
      if (!track) return;

      Object.assign(track, payload.updates);
      socket.to(currentRoomId).emit('track:update', {
        trackId: payload.trackId,
        updates: payload.updates,
      });
    });

    socket.on('track:delete', (payload: { trackId: string }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      const target = project.tracks.find((t) => t.id === payload.trackId);
      if (!target || target.type === 'drums') return; // Keep core Drum Rack

      project.tracks = project.tracks.filter((t) => t.id !== payload.trackId);
      project.notes = project.notes.filter((n) => n.trackId !== payload.trackId);
      project.audioClips = project.audioClips.filter((c) => c.trackId !== payload.trackId);
      socket.to(currentRoomId).emit('track:delete', { trackId: payload.trackId });
    });

    // MIDI Note Events (Idempotent)
    socket.on('note:add', (note: MidiNote) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project || !note?.id) return;
      if (project.notes.some((n) => n.id === note.id)) return;
      project.notes.push(note);
      socket.to(currentRoomId).emit('note:add', note);
    });

    socket.on('note:update', (payload: { noteId: string; updates: Partial<MidiNote> }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      const note = project.notes.find((n) => n.id === payload.noteId);
      if (!note) return;
      Object.assign(note, payload.updates);
      socket.to(currentRoomId).emit('note:update', payload);
    });

    socket.on('note:delete', (payload: { noteId: string }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      project.notes = project.notes.filter((n) => n.id !== payload.noteId);
      socket.to(currentRoomId).emit('note:delete', payload);
    });

    socket.on('note:clear-track', (payload: { trackId: string }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      project.notes = project.notes.filter((n) => n.trackId !== payload.trackId);
      socket.to(currentRoomId).emit('note:clear-track', payload);
    });

    // Audio Recording Clips
    socket.on('clip:add', (clip: AudioClip) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project || !clip?.id) return;
      if (project.audioClips.some((c) => c.id === clip.id)) return;
      project.audioClips.push(clip);
      socket.to(currentRoomId).emit('clip:add', clip);
    });

    socket.on('clip:delete', (payload: { clipId: string }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      if (!project) return;
      project.audioClips = project.audioClips.filter((c) => c.id !== payload.clipId);
      socket.to(currentRoomId).emit('clip:delete', payload);
    });

    // Live Chat & Bar Marker Feed
    socket.on('chat:send', (payload: { text: string; barMarker?: number }) => {
      if (!currentRoomId) return;
      const project = rooms.get(currentRoomId);
      const users = roomUsers.get(currentRoomId);
      const sender = users?.get(socket.id);
      if (!project || !sender) return;

      const text = String(payload?.text || '').trim().slice(0, 500);
      if (!text) return;

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: sender.id,
        senderName: sender.name,
        senderColor: sender.color,
        text,
        timestamp: Date.now(),
        barMarker: typeof payload.barMarker === 'number' ? payload.barMarker : undefined,
      };
      project.messages.push(msg);
      if (project.messages.length > 150) project.messages.shift();
      io.to(currentRoomId).emit('chat:message', msg);
    });

    // WebRTC Voice Call Signaling (Zoom-style Studio Comms)
    socket.on('voice:join', () => {
      if (!currentRoomId) return;
      const users = roomUsers.get(currentRoomId);
      const self = users?.get(socket.id);
      if (!self || !users) return;

      self.inVoice = true;
      self.isMuted = false;

      const existingPeers = Array.from(users.values())
        .filter((u) => u.inVoice && u.id !== socket.id)
        .map((u) => u.id);

      socket.emit('voice:existing-peers', { peerIds: existingPeers });
      socket.to(currentRoomId).emit('voice:peer-joined', { peerId: socket.id });
      io.to(currentRoomId).emit('presence:update', Array.from(users.values()));
    });

    socket.on('voice:leave', () => {
      if (!currentRoomId) return;
      const users = roomUsers.get(currentRoomId);
      const self = users?.get(socket.id);
      if (!self || !users) return;

      self.inVoice = false;
      self.isSpeaking = false;
      socket.to(currentRoomId).emit('voice:peer-left', { peerId: socket.id });
      io.to(currentRoomId).emit('presence:update', Array.from(users.values()));
    });

    socket.on('voice:mute', (payload: { isMuted: boolean }) => {
      if (!currentRoomId) return;
      const users = roomUsers.get(currentRoomId);
      const self = users?.get(socket.id);
      if (!self || !users) return;
      self.isMuted = Boolean(payload?.isMuted);
      if (self.isMuted) self.isSpeaking = false;
      io.to(currentRoomId).emit('presence:update', Array.from(users.values()));
    });

    socket.on('voice:offer', (payload: VoiceSignalPayload) => {
      if (!payload?.targetId || !payload?.sdp) return;
      io.to(payload.targetId).emit('voice:offer', {
        fromId: socket.id,
        sdp: payload.sdp,
      });
    });

    socket.on('voice:answer', (payload: VoiceSignalPayload) => {
      if (!payload?.targetId || !payload?.sdp) return;
      io.to(payload.targetId).emit('voice:answer', {
        fromId: socket.id,
        sdp: payload.sdp,
      });
    });

    socket.on('voice:ice-candidate', (payload: VoiceSignalPayload) => {
      if (!payload?.targetId || !payload?.candidate) return;
      io.to(payload.targetId).emit('voice:ice-candidate', {
        fromId: socket.id,
        candidate: payload.candidate,
      });
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackRoom Studio Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
