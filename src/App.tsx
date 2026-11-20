import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc, X } from 'lucide-react';
import { audioEngine } from './audio/AudioEngine';
import { MicRecorder } from './audio/MicRecorder';
import { AbletonSessionView } from './components/AbletonSessionView';
import { ArrangementView } from './components/ArrangementView';
import { BeatMakerView } from './components/BeatMakerView';
import { CollaborationDock } from './components/CollaborationDock';
import { InstrumentModal } from './components/InstrumentModal';
import { LogicInspector } from './components/LogicInspector';
import { MasteringSuiteView } from './components/MasteringSuiteView';
import { MixerView } from './components/MixerView';
import { PianoRollView } from './components/PianoRollView';
import { PluginModal } from './components/PluginModal';
import { PluginPickerModal, type PluginPickerMode } from './components/PluginPickerModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TopTransportBar } from './components/TopTransportBar';
import {
  createDefaultInstrumentParams,
  getFxPluginMeta,
  getTrackFxSlots,
  renderSampleToAudioClip,
} from './data/instruments';
import {
  createDefaultBusSends,
  createDefaultMasteringChain,
  createDefaultTrackFx,
} from './data/presets';
import { useStudioSocket } from './hooks/useStudioSocket';
import { useVoiceRoom } from './hooks/useVoiceRoom';
import type {
  AudioClip,
  AutomationParam,
  InstrumentDefinition,
  SampleBankItem,
  StudioTrack,
  StudioView,
  TrackPluginType,
} from './types/studio';

function getInitialRoomId(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('room');
  if (fromUrl && fromUrl.trim()) {
    return fromUrl.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '').slice(0, 24) || 'STUDIO-MAIN';
  }
  return 'STUDIO-MAIN';
}

export default function App() {
  const [roomId, setRoomId] = useState<string>(getInitialRoomId);
  const [activeView, setActiveView] = useState<StudioView>('arrangement');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track-keys');
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [browserOpen, setBrowserOpen] = useState<boolean>(true);
  const [automationVisible, setAutomationVisible] = useState<boolean>(false);
  const [collabDockOpen, setCollabDockOpen] = useState<boolean>(true);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Floating Logic Pro Plugin Window, VST Instrument Window & Visual Plugin Picker state
  const [openPlugin, setOpenPlugin] = useState<{
    trackId: string;
    plugin: TrackPluginType;
  } | null>(null);
  const [openInstrumentTrackId, setOpenInstrumentTrackId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<PluginPickerMode | null>(null);

  // Transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Audio recording & export state
  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  const recorderRef = useRef<MicRecorder | null>(null);
  const recordMetaRef = useRef<{ trackId: string; startStep: number } | null>(null);

  const studio = useStudioSocket(roomId);

  const voice = useVoiceRoom({
    socket: studio.socket,
    onSpeakingChange: studio.updateSpeakingState,
  });

  // Sync project (including all track FX, Mono/Aux Bus routing, Automation & Ableton Macros) to Web Audio Engine
  useEffect(() => {
    audioEngine.syncProject(studio.project);
  }, [studio.project]);

  useEffect(() => {
    audioEngine.setCallbacks(
      (step) => setCurrentStep(step),
      () => setIsPlaying(false)
    );
    return () => {
      audioEngine.pause();
    };
  }, []);

  useEffect(() => {
    audioEngine.setLooping(isLooping);
  }, [isLooping]);

  useEffect(() => {
    audioEngine.setMetronome(metronomeOn);
  }, [metronomeOn]);

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    studio.updateActiveView(activeView);
  }, [activeView, studio.updateActiveView]);

  const showNotice = useCallback((msg: string) => {
    setStudioNotice(msg);
  }, []);

  useEffect(() => {
    if (!studioNotice) return;
    const t = window.setTimeout(() => setStudioNotice(null), 4200);
    return () => clearTimeout(t);
  }, [studioNotice]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleStartPlayback = useCallback(() => {
    if (!isPlaying) {
      audioEngine.start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleWriteAutomationPoint = useCallback(
    (trackId: string, param: AutomationParam, normalizedValue: number) => {
      const track = studio.project.tracks.find((t) => t.id === trackId);
      if (!track) return;
      const existing = track.automationLanes?.[param] || [];
      const clampedVal = Math.max(0, Math.min(1, normalizedValue));
      const snappedStep = currentStep;
      // Replace any existing point within 1 step so Touch/Latch/Write produces clean curves
      const filtered = existing.filter((p) => Math.abs(p.step - snappedStep) >= 1);
      const nextPoints = [
        ...filtered,
        {
          id: `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          step: snappedStep,
          value: clampedVal,
        },
      ].sort((a, b) => a.step - b.step);

      studio.updateTrack(trackId, {
        automationParam: param,
        automationLanes: {
          ...(track.automationLanes || {}),
          [param]: nextPoints,
        },
      });
    },
    [currentStep, studio]
  );

  const stopRecordingAndSave = useCallback(async () => {
    if (!recorderRef.current || !recordMetaRef.current) {
      setIsRecording(false);
      return;
    }

    const meta = recordMetaRef.current;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    recordMetaRef.current = null;
    setIsRecording(false);

    const result = await recorder.stop();
    if (!result) {
      showNotice('Recording was too short to save.');
      return;
    }

    const takeNumber =
      studio.project.audioClips.filter((c) => c.trackId === meta.trackId).length + 1;
    const newClip: AudioClip = {
      id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      trackId: meta.trackId,
      name: `Take ${takeNumber}`,
      startStep: meta.startStep,
      durationSeconds: result.durationSeconds,
      audioDataUrl: result.audioDataUrl,
      peaks: result.peaks,
      recordedBy: studio.userName,
      createdAt: Date.now(),
      channelFormat: result.channelFormat || 'mono',
    };

    await audioEngine.decodeAudioClip(newClip);
    studio.addAudioClip(newClip);
    showNotice(`Saved Mono ${newClip.name} (${result.durationSeconds.toFixed(1)}s) and synced with the room.`);
  }, [showNotice, studio]);

  const handleStop = useCallback(() => {
    if (isRecording) {
      void stopRecordingAndSave();
    }
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentStep(0);
  }, [isRecording, stopRecordingAndSave]);

  const handleRewind = useCallback(() => {
    audioEngine.setCurrentStep(0);
    setCurrentStep(0);
  }, []);

  const startRecordingOnTrack = useCallback(
    async (explicitTrackId?: string) => {
      if (isRecording) {
        await stopRecordingAndSave();
        return;
      }

      let targetTrack = explicitTrackId
        ? studio.project.tracks.find((t) => t.id === explicitTrackId && t.type === 'audio')
        : studio.project.tracks.find((t) => t.type === 'audio' && t.armed) ||
          studio.project.tracks.find((t) => t.type === 'audio');

      if (!targetTrack) {
        const created: StudioTrack = {
          id: `track-audio-${Date.now().toString(36)}`,
          name: 'Lead Vocal · Mic 1',
          type: 'audio',
          color: '#06B6D4',
          inputFormat: 'mono',
          inputSource: 'Input 1 (Mono)',
          outputBus: 'bus-2',
          busSends: createDefaultBusSends(0.24, 0.12),
          automationMode: 'read',
          automationParam: 'volume',
          automationLanes: {},
          volume: 0.9,
          pan: 0,
          reverbSend: 0.24,
          delaySend: 0.12,
          muted: false,
          solo: false,
          armed: true,
          fx: createDefaultTrackFx(),
        };
        studio.addTrack(created);
        targetTrack = created;
      } else if (!targetTrack.armed) {
        studio.updateTrack(targetTrack.id, { armed: true });
      }

      setSelectedTrackId(targetTrack.id);

      try {
        const recorder = new MicRecorder();
        await recorder.start();
        recorderRef.current = recorder;
        recordMetaRef.current = {
          trackId: targetTrack.id,
          startStep: currentStep,
        };
        setIsRecording(true);
        if (!isPlaying) {
          audioEngine.start(currentStep);
          setIsPlaying(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Microphone permission denied';
        showNotice(`Unable to record audio: ${msg}`);
      }
    },
    [currentStep, isPlaying, isRecording, showNotice, stopRecordingAndSave, studio]
  );

  const handleExportWav = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const wavBlob = await audioEngine.exportProjectToWav(studio.project);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      const safeName = studio.project.title.replace(/[^a-zA-Z0-9-_]+/g, '_') || 'TrackRoom_Master';
      a.href = url;
      a.download = `${safeName}_${studio.project.bpm}bpm_Master.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice(`Bounced mastered stereo WAV: ${safeName}_${studio.project.bpm}bpm_Master.wav`);
    } catch {
      showNotice('Could not bounce WAV file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, showNotice, studio.project]);

  const handleToggleBrowserFromTop = useCallback(() => {
    if (activeView !== 'beats') {
      setActiveView('beats');
      setBrowserOpen(true);
    } else {
      setBrowserOpen((v) => !v);
    }
  }, [activeView]);

  // Complete FL Studio + Logic Pro + Ableton Live Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerMode) setPickerMode(null);
        else if (openPlugin) setOpenPlugin(null);
        else if (openInstrumentTrackId) setOpenInstrumentTrackId(null);
        else if (shortcutsOpen) setShortcutsOpen(false);
        return;
      }

      // FL Studio Function Keys work globally (prevent browser reload/help)
      if (e.key === 'F1') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setActiveView('arrangement');
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        setActiveView('beats');
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setActiveView('pianoroll');
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        handleToggleBrowserFromTop();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setActiveView('mixer');
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        setActiveView('mastering');
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;

      const mod = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      if (mod && keyLower === 'm') {
        e.preventDefault();
        setMetronomeOn((v) => !v);
        return;
      }
      if (mod && keyLower === 'b') {
        e.preventDefault();
        void handleExportWav();
        return;
      }

      if (mod || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActiveView((prev) => (prev === 'session' ? 'arrangement' : 'session'));
      } else if (e.key === 'Home' || e.key === '0') {
        e.preventDefault();
        handleRewind();
      } else if (keyLower === 'r') {
        e.preventDefault();
        void startRecordingOnTrack();
      } else if (keyLower === 'l') {
        e.preventDefault();
        setIsLooping((v) => !v);
      } else if (keyLower === 'a' && activeView !== 'pianoroll') {
        e.preventDefault();
        setActiveView('arrangement');
        setAutomationVisible((v) => !v);
      } else if (keyLower === 'i') {
        setInspectorOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeView,
    handleExportWav,
    handleRewind,
    handleToggleBrowserFromTop,
    handleTogglePlay,
    openInstrumentTrackId,
    openPlugin,
    pickerMode,
    shortcutsOpen,
    startRecordingOnTrack,
  ]);

  const handleOpenEditorForTrack = useCallback((track: StudioTrack, view: StudioView) => {
    setSelectedTrackId(track.id);
    setActiveView(view);
  }, []);

  const handleOpenPlugin = useCallback((trackId: string, plugin: TrackPluginType) => {
    setSelectedTrackId(trackId);
    setOpenInstrumentTrackId(null);
    setOpenPlugin({ trackId, plugin });
  }, []);

  const handleOpenInstrument = useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
    setOpenPlugin(null);
    setOpenInstrumentTrackId(trackId);
  }, []);

  const handlePickInstrument = useCallback(
    (inst: InstrumentDefinition, replaceTrackId?: string) => {
      const nextParams = createDefaultInstrumentParams(inst.preset);
      const cleanName = `${inst.pluginName.replace(' 2', '').replace(' 7', '')} · ${inst.patchName
        .split(' ')
        .slice(0, 2)
        .join(' ')}`;

      if (replaceTrackId) {
        studio.updateTrack(replaceTrackId, {
          preset: inst.preset,
          name: cleanName,
          color: inst.accent,
          instrumentParams: nextParams,
        });
        setSelectedTrackId(replaceTrackId);
        setPickerMode(null);
        setOpenPlugin(null);
        setOpenInstrumentTrackId(replaceTrackId);
        audioEngine.triggerPresetPreview(inst.preset, 60, 0.7);
        showNotice(
          `Replaced instrument with ${inst.pluginName} (${inst.patchName}) — MIDI, mixer routing & FX preserved.`
        );
        return;
      }

      const id = `track-vst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      const newTrack: StudioTrack = {
        id,
        name: cleanName,
        type: 'synth',
        preset: inst.preset,
        instrumentParams: nextParams,
        color: inst.accent,
        inputFormat: 'stereo',
        outputBus: 'stereo-out',
        busSends: createDefaultBusSends(0.18, 0.12),
        automationMode: 'read',
        automationParam: 'volume',
        automationLanes: {},
        volume: 0.8,
        pan: 0,
        reverbSend: 0.18,
        delaySend: 0.12,
        muted: false,
        solo: false,
        armed: false,
        fx: createDefaultTrackFx(),
      };
      studio.addTrack(newTrack);
      setSelectedTrackId(id);
      setPickerMode(null);
      setOpenPlugin(null);
      setOpenInstrumentTrackId(id);
      audioEngine.triggerPresetPreview(inst.preset, 60, 0.7);
      showNotice(`Loaded ${inst.pluginName} (${inst.patchName}) into Channel Rack & Playlist.`);
    },
    [showNotice, studio]
  );

  const handleAddInstrumentChannel = useCallback(
    (inst: InstrumentDefinition) => {
      handlePickInstrument(inst);
    },
    [handlePickInstrument]
  );

  const handlePickFx = useCallback(
    (trackId: string, chosen: TrackPluginType, replacePlugin?: TrackPluginType) => {
      const target = studio.project.tracks.find((t) => t.id === trackId);
      if (!target) return;

      const currentSlots = getTrackFxSlots(target);
      let nextSlots: TrackPluginType[];
      if (replacePlugin) {
        // Replace the target slot in place and dedupe if chosen already sits elsewhere
        const replaced = currentSlots.map((slot) => (slot === replacePlugin ? chosen : slot));
        nextSlots = Array.from(new Set(replaced));
      } else {
        nextSlots = currentSlots.includes(chosen) ? currentSlots : [...currentSlots, chosen];
      }

      const nextFx =
        replacePlugin && replacePlugin !== chosen
          ? {
              ...target.fx,
              [replacePlugin]: {
                ...target.fx[replacePlugin],
                enabled: false,
              },
              [chosen]: {
                ...target.fx[chosen],
                enabled: true,
              },
            }
          : {
              ...target.fx,
              [chosen]: {
                ...target.fx[chosen],
                enabled: true,
              },
            };

      studio.updateTrack(trackId, {
        fxSlots: nextSlots,
        fx: nextFx,
      });

      const meta = getFxPluginMeta(chosen);
      setSelectedTrackId(trackId);
      setPickerMode(null);
      setOpenInstrumentTrackId(null);
      setOpenPlugin({ trackId, plugin: chosen });
      showNotice(
        replacePlugin
          ? `Replaced slot with ${meta.name} on ${target.name}.`
          : `Inserted ${meta.name} on ${target.name}.`
      );
    },
    [showNotice, studio]
  );

  const handleRemoveFxSlot = useCallback(
    (trackId: string, plugin: TrackPluginType) => {
      const target = studio.project.tracks.find((t) => t.id === trackId);
      if (!target) return;

      const currentSlots = getTrackFxSlots(target);
      const nextSlots = currentSlots.filter((s) => s !== plugin);
      studio.updateTrack(trackId, {
        fxSlots: nextSlots,
        fx: {
          ...target.fx,
          [plugin]: {
            ...target.fx[plugin],
            enabled: false,
          },
        },
      });

      if (openPlugin && openPlugin.trackId === trackId && openPlugin.plugin === plugin) {
        setOpenPlugin(null);
      }
      const meta = getFxPluginMeta(plugin);
      showNotice(`Removed ${meta.name} from ${target.name}.`);
    },
    [openPlugin, showNotice, studio]
  );

  const handleDropSampleToTrack = useCallback(
    async (item: SampleBankItem) => {
      try {
        let targetTrack =
          studio.project.tracks.find((t) => t.type === 'audio' && t.id === selectedTrackId) ||
          studio.project.tracks.find((t) => t.type === 'audio');

        if (!targetTrack) {
          const created: StudioTrack = {
            id: `track-sample-${Date.now().toString(36)}`,
            name: 'Sample Bank · Audio',
            type: 'audio',
            color: item.color,
            inputFormat: 'mono',
            inputSource: 'Input 1 (Mono)',
            outputBus: 'stereo-out',
            busSends: createDefaultBusSends(0.16, 0.1),
            automationMode: 'read',
            automationParam: 'volume',
            automationLanes: {},
            volume: 0.88,
            pan: 0,
            reverbSend: 0.16,
            delaySend: 0.1,
            muted: false,
            solo: false,
            armed: false,
            fx: createDefaultTrackFx(),
          };
          studio.addTrack(created);
          targetTrack = created;
        }

        const clip = await renderSampleToAudioClip(item, targetTrack.id, currentStep, studio.userName);
        await audioEngine.decodeAudioClip(clip);
        studio.addAudioClip(clip);
        setSelectedTrackId(targetTrack.id);
        showNotice(`Dropped "${item.name}" onto ${targetTrack.name} at Bar ${Math.floor(currentStep / 16) + 1} (Press F5 to view).`);
      } catch {
        showNotice(`Could not render sample "${item.name}".`);
      }
    },
    [currentStep, selectedTrackId, showNotice, studio]
  );

  const handleSeekStep = useCallback((step: number) => {
    audioEngine.setCurrentStep(step);
    setCurrentStep(step);
  }, []);

  const handleJumpToBar = useCallback((barMarker: number) => {
    const wholeBar = Math.max(1, Math.floor(barMarker));
    const beatFrac = Math.round((barMarker - wholeBar) * 10);
    const beatOffset = Math.max(0, Math.min(3, beatFrac - 1));
    const targetStep = ((wholeBar - 1) * 16 + beatOffset * 4) % (studio.project.totalBars * 16);
    audioEngine.setCurrentStep(targetStep);
    setCurrentStep(targetStep);
  }, [studio.project.totalBars]);

  const handleSwitchRoom = useCallback(
    (nextRoomId: string) => {
      if (voice.inCall) voice.leaveCall();
      if (isPlaying) {
        audioEngine.stop();
        setIsPlaying(false);
      }
      setOpenPlugin(null);
      setOpenInstrumentTrackId(null);
      setPickerMode(null);
      const clean = nextRoomId.toUpperCase().replace(/[^A-Z0-9-_]/g, '').slice(0, 24) || 'STUDIO-MAIN';
      setRoomId(clean);
      const url = new URL(window.location.href);
      url.searchParams.set('room', clean);
      window.history.replaceState({}, '', url.toString());
    },
    [isPlaying, voice]
  );

  const inVoiceCount = studio.collaborators.filter((c) => c.inVoice).length;
  const selectedTrack =
    studio.project.tracks.find((t) => t.id === selectedTrackId) || studio.project.tracks[0] || null;
  const pluginModalTrack = openPlugin
    ? studio.project.tracks.find((t) => t.id === openPlugin.trackId) || null
    : null;
  const instrumentModalTrack = openInstrumentTrackId
    ? studio.project.tracks.find((t) => t.id === openInstrumentTrackId) || null
    : null;
  const mastering = studio.project.mastering || createDefaultMasteringChain();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1E2025] text-[#E5E7EB] overflow-hidden">
      {/* Logic Pro Top Control Bar */}
      <TopTransportBar
        project={studio.project}
        roomId={roomId}
        connected={studio.connected}
        collaboratorCount={studio.collaborators.length}
        inVoiceCount={inVoiceCount}
        activeView={activeView}
        onSelectView={setActiveView}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        browserOpen={browserOpen}
        onToggleBrowser={handleToggleBrowserFromTop}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        isPlaying={isPlaying}
        isRecording={isRecording}
        isLooping={isLooping}
        metronomeOn={metronomeOn}
        currentStep={currentStep}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onRewind={handleRewind}
        onToggleRecord={() => void startRecordingOnTrack()}
        onToggleLoop={() => setIsLooping((v) => !v)}
        onToggleMetronome={() => setMetronomeOn((v) => !v)}
        onUpdateMeta={studio.updateProjectMeta}
        onExportWav={() => void handleExportWav()}
        isExporting={isExporting}
        collabDockOpen={collabDockOpen}
        onToggleCollabDock={() => setCollabDockOpen((v) => !v)}
        onSwitchRoom={handleSwitchRoom}
      />

      {/* Recording / Bounce Notice Strip */}
      {(isRecording || studioNotice) && (
        <div
          className={`px-4 py-1.5 text-xs flex items-center justify-between border-b shrink-0 ${
            isRecording
              ? 'bg-red-950/80 border-red-500/45 text-red-100'
              : 'bg-[#252A34] border-[#384050] text-[#E5E7EB]'
          }`}
        >
          <div className="flex items-center gap-2">
            {isRecording && <Disc className="w-3.5 h-3.5 text-red-400 animate-spin" />}
            <span className="font-medium">
              {isRecording
                ? 'Recording Mono microphone input (Input 1 ○) onto armed audio track. Click Stop or Record again to save and sync.'
                : studioNotice}
            </span>
          </div>
          {isRecording ? (
            <button
              type="button"
              onClick={() => void stopRecordingAndSave()}
              className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px]"
            >
              Finish Take
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStudioNotice(null)}
              className="text-[#9CA3AF] hover:text-white"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Logic Pro Workspace: Left Channel Strip Inspector + Center DAW Viewport + Right Call/Chat Dock */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {inspectorOpen && activeView !== 'mixer' && activeView !== 'mastering' && (
          <LogicInspector
            track={selectedTrack}
            auxBuses={studio.project.auxBuses}
            mastering={mastering}
            isPlaying={isPlaying}
            onUpdateTrack={studio.updateTrack}
            onWriteAutomationPoint={handleWriteAutomationPoint}
            onOpenPlugin={handleOpenPlugin}
            onOpenInstrument={handleOpenInstrument}
            onOpenFxPicker={(track, replacePlugin) =>
              setPickerMode({ kind: 'fx', track, replacePlugin })
            }
            onRemoveFxSlot={handleRemoveFxSlot}
            onOpenInstrumentPicker={(track) => setPickerMode({ kind: 'instrument', track })}
            onOpenMastering={() => setActiveView('mastering')}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {activeView === 'arrangement' && (
            <ArrangementView
              project={studio.project}
              currentStep={currentStep}
              selectedTrackId={selectedTrackId}
              isPlaying={isPlaying}
              isRecording={isRecording}
              automationVisible={automationVisible}
              onToggleAutomation={() => setAutomationVisible((v) => !v)}
              onSelectTrack={setSelectedTrackId}
              onOpenEditorForTrack={handleOpenEditorForTrack}
              onOpenPlugin={handleOpenPlugin}
              onOpenInstrument={handleOpenInstrument}
              onAddTrack={studio.addTrack}
              onUpdateTrack={studio.updateTrack}
              onWriteAutomationPoint={handleWriteAutomationPoint}
              onDeleteTrack={studio.deleteTrack}
              onDeleteClip={studio.deleteAudioClip}
              onSeekStep={handleSeekStep}
              onStartRecordingTrack={(trackId) => void startRecordingOnTrack(trackId)}
            />
          )}

          {activeView === 'session' && (
            <AbletonSessionView
              project={studio.project}
              isPlaying={isPlaying}
              currentStep={currentStep}
              onStartPlayback={handleStartPlayback}
              onUpdateTrack={studio.updateTrack}
              onApplyDrumPreset={studio.applyDrumPreset}
              onUpdateSession={studio.updateSession}
            />
          )}

          {activeView === 'beats' && (
            <BeatMakerView
              project={studio.project}
              currentStep={currentStep}
              isPlaying={isPlaying}
              browserOpen={browserOpen}
              onToggleBrowser={() => setBrowserOpen((v) => !v)}
              onUpdateDrumStep={studio.updateDrumStep}
              onUpdateDrumChannel={studio.updateDrumChannel}
              onApplyPreset={studio.applyDrumPreset}
              onUpdateSwing={(swing) => studio.updateProjectMeta({ swing })}
              onUpdateTrack={studio.updateTrack}
              onOpenInstrument={handleOpenInstrument}
              onOpenPianoRoll={(trackId) => {
                setSelectedTrackId(trackId);
                setActiveView('pianoroll');
              }}
              onAddInstrumentChannel={handleAddInstrumentChannel}
              onOpenInstrumentPicker={(replaceTrack) =>
                setPickerMode({ kind: 'instrument', track: replaceTrack })
              }
              onDropSample={(item) => void handleDropSampleToTrack(item)}
            />
          )}

          {activeView === 'pianoroll' && (
            <PianoRollView
              project={studio.project}
              selectedTrackId={selectedTrackId}
              currentStep={currentStep}
              isPlaying={isPlaying}
              onSelectTrack={setSelectedTrackId}
              onUpdateTrack={studio.updateTrack}
              onOpenInstrument={handleOpenInstrument}
              onAddNote={studio.addNote}
              onUpdateNote={studio.updateNote}
              onDeleteNote={studio.deleteNote}
              onClearTrackNotes={studio.clearTrackNotes}
            />
          )}

          {activeView === 'mixer' && (
            <MixerView
              project={studio.project}
              masterVolume={masterVolume}
              isPlaying={isPlaying}
              onChangeMasterVolume={setMasterVolume}
              onUpdateTrack={studio.updateTrack}
              onUpdateAuxBus={studio.updateAuxBus}
              onWriteAutomationPoint={handleWriteAutomationPoint}
              onOpenPlugin={handleOpenPlugin}
              onOpenInstrument={handleOpenInstrument}
              onOpenFxPicker={(track, replacePlugin) =>
                setPickerMode({ kind: 'fx', track, replacePlugin })
              }
              onRemoveFxSlot={handleRemoveFxSlot}
              onOpenInstrumentPicker={(track) => setPickerMode({ kind: 'instrument', track })}
              onOpenMastering={() => setActiveView('mastering')}
            />
          )}

          {activeView === 'mastering' && (
            <MasteringSuiteView
              mastering={mastering}
              onUpdateMastering={studio.updateMastering}
              onExportWav={() => void handleExportWav()}
              isExporting={isExporting}
            />
          )}
        </main>

        {collabDockOpen && (
          <CollaborationDock
            collaborators={studio.collaborators}
            selfId={studio.selfId}
            userName={studio.userName}
            onChangeUserName={studio.setUserName}
            messages={studio.project.messages}
            currentStep={currentStep}
            onSendMessage={studio.sendChatMessage}
            onJumpToBar={handleJumpToBar}
            inCall={voice.inCall}
            isMuted={voice.isMuted}
            isDeafened={voice.isDeafened}
            micLevel={voice.micLevel}
            voiceError={voice.error}
            connectedPeerCount={voice.connectedPeerIds.length}
            onJoinCall={() => void voice.joinCall()}
            onLeaveCall={voice.leaveCall}
            onToggleMute={voice.toggleMute}
            onToggleDeafen={voice.toggleDeafen}
            onClearVoiceError={voice.clearError}
          />
        )}
      </div>

      {/* Floating Logic Pro Audio FX Plugin Window */}
      {openPlugin && pluginModalTrack && (
        <PluginModal
          track={pluginModalTrack}
          bpm={studio.project.bpm}
          activePlugin={openPlugin.plugin}
          onSelectPlugin={(plugin) => setOpenPlugin({ trackId: pluginModalTrack.id, plugin })}
          onUpdateTrack={studio.updateTrack}
          onOpenReplacePicker={(track, currentPlugin) =>
            setPickerMode({ kind: 'fx', track, replacePlugin: currentPlugin })
          }
          onClose={() => setOpenPlugin(null)}
        />
      )}

      {/* Floating Actual VST Instrument Window (Omnisphere 2 · Kontakt 7 · FL Stock Synths) */}
      {instrumentModalTrack && (
        <InstrumentModal
          track={instrumentModalTrack}
          onUpdateTrack={studio.updateTrack}
          onReplaceInstrumentPicker={(track) => setPickerMode({ kind: 'instrument', track })}
          onOpenPianoRoll={(trackId) => {
            setSelectedTrackId(trackId);
            setActiveView('pianoroll');
          }}
          onClose={() => setOpenInstrumentTrackId(null)}
        />
      )}

      {/* Visual Plugin Picker & Instrument Chooser Modal */}
      {pickerMode && (
        <PluginPickerModal
          mode={pickerMode}
          onPickFx={handlePickFx}
          onPickInstrument={handlePickInstrument}
          onClose={() => setPickerMode(null)}
        />
      )}

      {/* FL Studio + Logic Pro + Ableton Shortcuts Cheatsheet Modal (F1) */}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
