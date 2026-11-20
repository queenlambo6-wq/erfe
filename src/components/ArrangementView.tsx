import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Disc,
  Drum,
  Mic,
  Music,
  Plus,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { INDUSTRY_INSTRUMENTS } from '../data/instruments';
import {
  createDefaultAuxBuses,
  createDefaultBusSends,
  createDefaultTrackFx,
  TRACK_COLORS,
} from '../data/presets';
import type {
  AudioClip,
  AutomationMode,
  AutomationParam,
  AutomationPoint,
  StudioProject,
  StudioTrack,
  StudioView,
  SynthPreset,
  TrackPluginType,
} from '../types/studio';

interface ArrangementViewProps {
  project: StudioProject;
  currentStep: number;
  selectedTrackId: string;
  isPlaying: boolean;
  isRecording: boolean;
  automationVisible: boolean;
  onToggleAutomation: () => void;
  onSelectTrack: (trackId: string) => void;
  onOpenEditorForTrack: (track: StudioTrack, view: StudioView) => void;
  onOpenPlugin: (trackId: string, plugin: TrackPluginType) => void;
  onOpenInstrument: (trackId: string) => void;
  onAddTrack: (track: StudioTrack) => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onWriteAutomationPoint: (trackId: string, param: AutomationParam, normalizedValue: number) => void;
  onDeleteTrack: (trackId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onSeekStep: (step: number) => void;
  onStartRecordingTrack: (trackId: string) => void;
}

const AUTO_PARAM_META: Record<AutomationParam, { label: string; color: string }> = {
  volume: { label: 'Volume', color: '#FACC15' },
  pan: { label: 'Pan', color: '#38BDF8' },
  filterCutoff: { label: 'Filter Cutoff', color: '#A78BFA' },
  reverbSend: { label: 'Bus 3 Verb Send', color: '#34D399' },
  delaySend: { label: 'Bus 4 Echo Send', color: '#FB923C' },
};

const AUTO_MODE_COLOR: Record<AutomationMode, string> = {
  off: 'text-[#9CA3AF] border-[#3A404D]',
  read: 'text-emerald-300 border-emerald-500/45',
  touch: 'text-amber-300 border-amber-500/45',
  latch: 'text-orange-300 border-orange-500/45',
  write: 'text-red-300 border-red-500/50',
};

function formatAutomationValue(param: AutomationParam, norm: number): string {
  const n = Math.max(0, Math.min(1, norm));
  if (param === 'volume') {
    const gain = n * 1.2;
    if (gain <= 0.005) return '-∞ dB';
    const db = 20 * Math.log10(gain);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  }
  if (param === 'pan') {
    const p = n * 2 - 1;
    if (Math.abs(p) < 0.04) return 'C';
    return p < 0 ? `${Math.round(Math.abs(p) * 64)}L` : `${Math.round(p * 64)}R`;
  }
  if (param === 'filterCutoff') {
    const hz = 140 * Math.pow(20000 / 140, n);
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
  }
  return `${Math.round(n * 100)}%`;
}

export const ArrangementView: React.FC<ArrangementViewProps> = ({
  project,
  currentStep,
  selectedTrackId,
  isPlaying,
  isRecording,
  automationVisible,
  onToggleAutomation,
  onSelectTrack,
  onOpenEditorForTrack,
  onOpenPlugin,
  onOpenInstrument,
  onAddTrack,
  onUpdateTrack,
  onWriteAutomationPoint,
  onDeleteTrack,
  onDeleteClip,
  onSeekStep,
  onStartRecordingTrack,
}) => {
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  const totalSteps = project.totalBars * 16;
  const auxBuses = project.auxBuses && project.auxBuses.length > 0 ? project.auxBuses : createDefaultAuxBuses();

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      setTrackLevels(audioEngine.getTrackLevels());
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleAddSynthTrack = () => {
    const idx = project.tracks.length;
    const newTrack: StudioTrack = {
      id: `track-synth-${Date.now().toString(36)}`,
      name: `Software Inst ${idx + 1}`,
      type: 'synth',
      preset: 'lush-pad',
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      inputFormat: 'stereo',
      outputBus: 'stereo-out',
      busSends: createDefaultBusSends(0.3, 0.15),
      automationMode: 'read',
      automationParam: 'volume',
      automationLanes: {},
      volume: 0.72,
      pan: 0,
      reverbSend: 0.3,
      delaySend: 0.15,
      muted: false,
      solo: false,
      armed: false,
      fx: createDefaultTrackFx(),
    };
    onAddTrack(newTrack);
    onSelectTrack(newTrack.id);
  };

  const handleAddAudioTrack = () => {
    const audioCount = project.tracks.filter((t) => t.type === 'audio').length;
    const idx = project.tracks.length;
    const newTrack: StudioTrack = {
      id: `track-audio-${Date.now().toString(36)}`,
      name: `Audio · Mic ${audioCount + 1}`,
      type: 'audio',
      color: TRACK_COLORS[(idx + 5) % TRACK_COLORS.length],
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
      fx: createDefaultTrackFx({
        autotune: { enabled: true, key: 'C', scale: 'Minor', retuneSpeed: 18, flexTune: 25, humanize: 20, formant: 0, transpose: 0, classicMode: false },
        neve1073: { enabled: true, preampDrive: 18, hpFreq: 80, lowFreq: 110, lowGain: 1.5, midFreq: 3200, midGain: 2.5, highGain: 3.0, outputTrim: -1.0 },
        fet1176: { enabled: true, input: 54, output: 50, attack: 3.5, release: 5.5, ratio: 4 },
        la2a: { enabled: true, peakReduction: 48, gain: 54, mode: 'compress', tubeWarmth: 45 },
      }),
    };
    onAddTrack(newTrack);
    onSelectTrack(newTrack.id);
  };

  const applyAutomationPreset = (
    track: StudioTrack,
    param: AutomationParam,
    preset: 'fade-in' | 'fade-out' | 'sweep' | 'clear'
  ) => {
    let points: AutomationPoint[] = [];
    const uid = () => `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    if (preset === 'fade-in') {
      points = [
        { id: uid(), step: 0, value: 0.15 },
        { id: uid(), step: Math.round(totalSteps * 0.5), value: 0.72 },
        { id: uid(), step: totalSteps, value: 0.88 },
      ];
    } else if (preset === 'fade-out') {
      points = [
        { id: uid(), step: 0, value: 0.85 },
        { id: uid(), step: Math.round(totalSteps * 0.65), value: 0.78 },
        { id: uid(), step: totalSteps, value: 0.1 },
      ];
    } else if (preset === 'sweep') {
      points = [
        { id: uid(), step: 0, value: 0.25 },
        { id: uid(), step: Math.round(totalSteps * 0.25), value: 0.85 },
        { id: uid(), step: Math.round(totalSteps * 0.5), value: 0.35 },
        { id: uid(), step: Math.round(totalSteps * 0.75), value: 0.92 },
        { id: uid(), step: totalSteps, value: 0.5 },
      ];
    }
    onUpdateTrack(track.id, {
      automationMode: preset === 'clear' ? track.automationMode || 'read' : 'read',
      automationLanes: {
        ...(track.automationLanes || {}),
        [param]: points,
      },
    });
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (e.clientX - rect.left) / rect.width));
    const targetStep = Math.floor(ratio * totalSteps);
    onSeekStep(targetStep);
  };

  const playheadPercent = (currentStep / totalSteps) * 100;
  const anySolo = project.tracks.some((t) => t.solo);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1B1D22]">
      {/* Logic Track Area Sub-Toolbar */}
      <div className="h-9 px-3.5 bg-[#262930] border-b border-[#14161A] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <button
            type="button"
            onClick={handleAddSynthTrack}
            title="New Software Instrument Track"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#323640] hover:bg-[#3E4350] border border-[#444A58] text-[11px] font-medium text-[#F3F4F6] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Software Instrument</span>
          </button>
          <button
            type="button"
            onClick={handleAddAudioTrack}
            title="New Mono Audio / Vocal Track (Input 1 Mono → Bus 2)"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#323640] hover:bg-[#3E4350] border border-[#444A58] text-[11px] font-medium text-[#F3F4F6] transition-colors whitespace-nowrap"
          >
            <Mic className="w-3.5 h-3.5 text-sky-400" />
            <span>Audio Track (Mono)</span>
          </button>

          <div className="w-px h-4 bg-[#3A404D] mx-0.5" />

          {/* Logic Pro Automation View Toggle (A) */}
          <button
            type="button"
            onClick={onToggleAutomation}
            title="Show / Hide Logic Pro Track Automation Lanes (Shortcut: A)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors whitespace-nowrap ${
              automationVisible
                ? 'bg-amber-500/25 border-amber-400/70 text-amber-200'
                : 'bg-[#1D2027] hover:bg-[#2C313C] border-[#3C4250] text-[#CBD5E1]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Automation (A)</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-[#9CA3AF]">
          <span>{project.totalBars} Bars Cycle</span>
          <span aria-hidden="true">·</span>
          <span>{project.tracks.length} Tracks</span>
          <span className="hidden xl:inline" aria-hidden="true">·</span>
          <span className="hidden xl:inline">
            {automationVisible
              ? 'Click lane to add node · Drag nodes · Double-click node to delete'
              : 'Press A for Automation · Press Tab for Ableton Session'}
          </span>
        </div>
      </div>

      {/* Logic Ruler Header */}
      <div className="flex border-b border-[#14161A] bg-[#22252C] shrink-0">
        <div className="w-64 shrink-0 px-3.5 py-2 border-r border-[#14161A] flex items-center justify-between text-[11px] font-medium text-[#9CA3AF]">
          <span>Tracks</span>
          <span>M · S · R · FX</span>
        </div>

        {/* Clickable Logic Pro Bar Ruler with Gold Cycle Strip */}
        <div
          onClick={handleRulerClick}
          className="flex-1 relative h-8 cursor-pointer select-none overflow-hidden bg-[#1D2026]"
          title="Click ruler to set playhead position"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-[#CA8A04] border-b border-[#EAB308]" />
          <div
            className="grid h-full pt-2"
            style={{ gridTemplateColumns: `repeat(${project.totalBars * 4}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: project.totalBars * 4 }).map((_, beatIdx) => {
              const isBarStart = beatIdx % 4 === 0;
              const barNum = Math.floor(beatIdx / 4) + 1;
              const beatNum = (beatIdx % 4) + 1;
              return (
                <div
                  key={beatIdx}
                  className={`border-l ${
                    isBarStart ? 'border-[#484F5E]' : 'border-[#2B303B]'
                  } pl-1.5 flex items-center`}
                >
                  <span
                    className={`font-mono-tabular text-[10px] ${
                      isBarStart ? 'text-[#E5E7EB] font-semibold' : 'text-[#6B7280]'
                    }`}
                  >
                    {isBarStart ? `${barNum}` : `${barNum}.${beatNum}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-20"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="w-2.5 h-2.5 bg-white -ml-[4px] rounded-b-xs shadow-xs" />
          </div>
        </div>
      </div>

      {/* Scrollable Logic Track Lanes */}
      <div className="flex-1 overflow-y-auto relative">
        {project.tracks.map((track) => {
          const isSelected = track.id === selectedTrackId;
          const isDimmed = anySolo ? !track.solo : track.muted;
          const trackNotes = project.notes.filter((n) => n.trackId === track.id);
          const trackClips = project.audioClips.filter((c) => c.trackId === track.id);
          const level = trackLevels[track.id] || 0;
          const channelFormat = track.inputFormat || (track.type === 'audio' ? 'mono' : 'stereo');
          const outBusId = track.outputBus || 'stereo-out';
          const outBusLabel =
            outBusId === 'stereo-out'
              ? 'St Out'
              : auxBuses.find((b) => b.id === outBusId)?.shortLabel || outBusId;
          const autoMode: AutomationMode = track.automationMode || 'read';
          const activeAutoParam: AutomationParam = track.automationParam || 'volume';
          const lanePoints = track.automationLanes?.[activeAutoParam] || [];

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className={`flex border-b border-[#16181D] ${
                automationVisible ? 'min-h-[126px]' : 'min-h-[98px]'
              } transition-colors ${
                isSelected ? 'bg-[#2C313C]' : 'bg-[#22252C] hover:bg-[#272B34]'
              }`}
            >
              {/* Logic Track Header */}
              <div className="w-64 shrink-0 border-r border-[#14161A] px-3 py-2 flex flex-col justify-between gap-1.5 relative">
                <div
                  className="absolute right-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: track.color }}
                />

                <div className="flex items-center justify-between gap-1.5 pr-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[#9CA3AF] shrink-0">
                      {track.type === 'drums' && <Drum className="w-3.5 h-3.5 text-amber-400" />}
                      {track.type === 'synth' && <Music className="w-3.5 h-3.5 text-emerald-400" />}
                      {track.type === 'audio' && <Mic className="w-3.5 h-3.5 text-sky-400" />}
                    </span>
                    <input
                      type="text"
                      value={track.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateTrack(track.id, { name: e.target.value })}
                      className="bg-transparent text-xs font-semibold text-[#F3F4F6] truncate outline-none focus:bg-[#14171D] focus:px-1 rounded w-full"
                    />
                  </div>

                  {/* Logic M / S / R / FX Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack(track.id, { muted: !track.muted });
                      }}
                      title="Mute Track"
                      className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                        track.muted
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-[#191C22] border border-[#363B47] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack(track.id, { solo: !track.solo });
                      }}
                      title="Solo Track"
                      className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                        track.solo
                          ? 'bg-[#EAB308] text-[#111317]'
                          : 'bg-[#191C22] border border-[#363B47] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      S
                    </button>
                    {track.type === 'audio' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTrack(track.id, { armed: !track.armed });
                        }}
                        title="Record Enable (Mono)"
                        className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                          track.armed
                            ? 'bg-red-600 text-white'
                            : 'bg-[#191C22] border border-[#363B47] text-[#9CA3AF] hover:text-red-400'
                        }`}
                      >
                        R
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const defaultPlugin: TrackPluginType =
                          track.type === 'audio'
                            ? 'autotune'
                            : track.type === 'drums'
                              ? 'fet1176'
                              : 'neve1073';
                        onOpenPlugin(track.id, defaultPlugin);
                      }}
                      title="Open Audio FX Plugins"
                      className="w-5 h-5 rounded bg-[#1E4B7A] hover:bg-[#2B629B] text-sky-100 flex items-center justify-center transition-colors"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Instrument / Mic + Mono/Stereo & Output Bus Info */}
                <div className="flex items-center justify-between gap-1.5 pr-1">
                  {track.type === 'synth' ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <select
                        value={track.preset || 'kontakt-rhodes'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateTrack(track.id, { preset: e.target.value as SynthPreset })}
                        className="bg-[#171A20] border border-[#353A46] rounded px-1 py-0.5 text-[10px] text-[#D1D5DB] outline-none cursor-pointer max-w-[106px]"
                      >
                        {INDUSTRY_INSTRUMENTS.map((inst) => (
                          <option key={inst.preset} value={inst.preset} className="bg-[#1D2027]">
                            {inst.pluginName}: {inst.patchName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenInstrument(track.id);
                        }}
                        title="Open VST Instrument Window (Omnisphere 2 / Kontakt 7 / FL Stock)"
                        className="px-1.5 py-0.5 rounded bg-sky-600/25 hover:bg-sky-600/45 border border-sky-400/45 text-[9px] font-bold text-sky-200 shrink-0"
                      >
                        VST
                      </button>
                    </div>
                  ) : track.type === 'audio' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartRecordingTrack(track.id);
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        isRecording && track.armed
                          ? 'bg-red-600 text-white'
                          : 'bg-[#191C22] border border-[#3A404E] hover:border-red-500/50 text-[#E5E7EB]'
                      }`}
                    >
                      <Disc className="w-3 h-3 text-red-400" />
                      <span>{isRecording && track.armed ? 'Stop Rec' : 'Rec Mono'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#9CA3AF] truncate">Drum Machine</span>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack(track.id, {
                          inputFormat: channelFormat === 'mono' ? 'stereo' : 'mono',
                        });
                      }}
                      title={`Input Format: ${channelFormat === 'mono' ? 'Mono (○)' : 'Stereo (○○)'}`}
                      className="text-[10px] font-mono-tabular text-sky-300 hover:text-white transition-colors"
                    >
                      {channelFormat === 'mono' ? '○' : '○○'}
                    </button>
                    <span className="text-[10px] font-mono-tabular text-[#9CA3AF]" title={`Routed to ${outBusLabel}`}>
                      → {outBusLabel}
                    </span>
                    {track.type !== 'drums' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTrack(track.id);
                        }}
                        title="Delete Track"
                        className="text-[#6B7280] hover:text-red-400 transition-colors p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Logic Pro Track Automation Controls (shown when Automation View is active) */}
                {automationVisible && (
                  <div
                    className="space-y-1 pt-1 border-t border-[#323743] pr-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <select
                        value={autoMode}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { automationMode: e.target.value as AutomationMode })
                        }
                        className={`w-16 h-5 px-1 rounded bg-[#15181E] border text-[10px] font-semibold outline-none cursor-pointer ${AUTO_MODE_COLOR[autoMode]}`}
                        title="Automation Mode"
                      >
                        <option value="off" className="bg-[#1D2027]">Off</option>
                        <option value="read" className="bg-[#1D2027]">Read</option>
                        <option value="touch" className="bg-[#1D2027]">Touch</option>
                        <option value="latch" className="bg-[#1D2027]">Latch</option>
                        <option value="write" className="bg-[#1D2027]">Write</option>
                      </select>

                      <select
                        value={activeAutoParam}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { automationParam: e.target.value as AutomationParam })
                        }
                        className="flex-1 h-5 px-1.5 rounded bg-[#15181E] border border-[#3A404E] text-[10px] font-medium text-[#E5E7EB] outline-none cursor-pointer"
                        title="Automation Parameter Lane"
                      >
                        {(Object.keys(AUTO_PARAM_META) as AutomationParam[]).map((pKey) => (
                          <option key={pKey} value={pKey} className="bg-[#1D2027]">
                            {AUTO_PARAM_META[pKey].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      {(['fade-in', 'fade-out', 'sweep', 'clear'] as const).map((shape) => (
                        <button
                          key={shape}
                          type="button"
                          onClick={() => applyAutomationPreset(track, activeAutoParam, shape)}
                          className="flex-1 py-0.5 rounded bg-[#191C22] hover:bg-[#2E3442] border border-[#323846] text-[9px] text-[#CBD5E1] transition-colors"
                        >
                          {shape === 'fade-in'
                            ? 'Fade In'
                            : shape === 'fade-out'
                              ? 'Fade Out'
                              : shape === 'sweep'
                                ? 'Sweep'
                                : 'Clear'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compact Volume & Level Meter */}
                <div className="flex items-center gap-2 pr-1">
                  <Volume2 className="w-3 h-3 text-[#6B7280] shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.02}
                    value={track.volume}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateTrack(track.id, { volume: val });
                      if (
                        isPlaying &&
                        (autoMode === 'touch' || autoMode === 'latch' || autoMode === 'write')
                      ) {
                        onWriteAutomationPoint(track.id, 'volume', Math.max(0, Math.min(1, val / 1.2)));
                      }
                    }}
                    className="studio-slider flex-1"
                    aria-label={`${track.name} volume`}
                  />
                  <div className="w-10 h-1.5 bg-[#101217] rounded-xs overflow-hidden shrink-0">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75"
                      style={{
                        width: `${Math.round((isDimmed ? 0 : level) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Logic Pro Timeline Grid */}
              <div className={`flex-1 relative overflow-hidden bg-[#181A20] ${isDimmed ? 'opacity-40' : ''}`}>
                <div
                  className="absolute inset-0 grid pointer-events-none"
                  style={{ gridTemplateColumns: `repeat(${project.totalBars * 4}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: project.totalBars * 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`border-l ${i % 4 === 0 ? 'border-[#2E333E]' : 'border-[#20232C]'}`}
                    />
                  ))}
                </div>

                {/* Drum Pattern Regions */}
                {track.type === 'drums' && (
                  <div className={`absolute inset-1.5 grid grid-cols-2 gap-1 ${automationVisible ? 'opacity-45' : ''}`}>
                    {[0, 1].map((blockIdx) => (
                      <button
                        key={blockIdx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditorForTrack(track, 'beats');
                        }}
                        className="relative h-full rounded-[4px] border text-left overflow-hidden group transition-all"
                        style={{
                          backgroundColor: `${track.color}22`,
                          borderColor: `${track.color}88`,
                        }}
                      >
                        <div
                          className="h-5 px-2 flex items-center justify-between text-[10px] font-semibold text-[#111317]"
                          style={{ backgroundColor: track.color }}
                        >
                          <span>Pattern Region · Bars {blockIdx * 2 + 1}–{blockIdx * 2 + 2}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Open Step Sequencer
                          </span>
                        </div>
                        <div className="p-1.5 h-[calc(100%-20px)] flex flex-col justify-between">
                          {project.drumChannels.slice(0, 6).map((ch) => (
                            <div key={ch.id} className="grid grid-cols-32 gap-px h-1.5">
                              {ch.steps.map((vel, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="rounded-[1px]"
                                  style={{
                                    backgroundColor: vel > 0 ? ch.color : 'transparent',
                                    opacity: vel > 0 ? 0.4 + vel * 0.6 : 0,
                                  }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* MIDI Instrument Region */}
                {track.type === 'synth' && (
                  <div className={`absolute inset-1.5 ${automationVisible ? 'opacity-45' : ''}`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditorForTrack(track, 'pianoroll');
                      }}
                      className="relative w-full h-full rounded-[4px] border text-left overflow-hidden group transition-all"
                      style={{
                        backgroundColor: `${track.color}22`,
                        borderColor: `${track.color}88`,
                      }}
                    >
                      <div
                        className="h-5 px-2 flex items-center justify-between text-[10px] font-semibold text-white"
                        style={{ backgroundColor: `${track.color}DD` }}
                      >
                        <span>
                          {track.name} · {trackNotes.length} MIDI {trackNotes.length === 1 ? 'note' : 'notes'}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          Open Piano Roll
                        </span>
                      </div>

                      <div className="relative w-full h-[calc(100%-20px)]">
                        {trackNotes.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-[#9CA3AF]">
                            Click region to compose MIDI in Piano Roll
                          </div>
                        ) : (
                          trackNotes.map((note) => {
                            const leftPct = (note.startStep / totalSteps) * 100;
                            const widthPct = Math.max(1.2, (note.durationSteps / totalSteps) * 100);
                            const normalizedPitch = Math.max(0, Math.min(1, (note.pitch - 36) / 48));
                            const topPct = (1 - normalizedPitch) * 82 + 4;
                            return (
                              <div
                                key={note.id}
                                className="absolute h-1.5 rounded-[1px]"
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  top: `${topPct}%`,
                                  backgroundColor: '#F8FAFC',
                                  opacity: 0.9,
                                }}
                              />
                            );
                          })
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* Audio Waveform Regions */}
                {track.type === 'audio' && (
                  <div className={`absolute inset-1.5 ${automationVisible ? 'opacity-45' : ''}`}>
                    {trackClips.length === 0 ? (
                      <div className="h-full border border-dashed border-[#343A47] rounded-[4px] flex items-center justify-center gap-3 px-4">
                        <span className="text-xs text-[#8E96A4]">
                          Empty Audio Track · Input 1 (○ Mono)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartRecordingTrack(track.id);
                          }}
                          className="px-2.5 py-1 rounded bg-[#2A2F3A] hover:bg-red-600/25 border border-[#3E4554] text-xs font-medium text-[#F3F4F6] transition-colors"
                        >
                          Record Mono Mic
                        </button>
                      </div>
                    ) : (
                      trackClips.map((clip) => (
                        <AudioClipRegion
                          key={clip.id}
                          clip={clip}
                          color={track.color}
                          bpm={project.bpm}
                          totalSteps={totalSteps}
                          onDelete={() => onDeleteClip(clip.id)}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Logic Pro Interactive Track Automation Overlay */}
                {automationVisible && (
                  <AutomationLaneOverlay
                    param={activeAutoParam}
                    mode={autoMode}
                    points={lanePoints}
                    totalSteps={totalSteps}
                    onChangePoints={(nextPoints) =>
                      onUpdateTrack(track.id, {
                        automationLanes: {
                          ...(track.automationLanes || {}),
                          [activeAutoParam]: nextPoints,
                        },
                      })
                    }
                  />
                )}

                {/* Logic Pro Crisp White Playhead Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-30"
                  style={{ left: `${playheadPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface AutomationLaneOverlayProps {
  param: AutomationParam;
  mode: AutomationMode;
  points: AutomationPoint[];
  totalSteps: number;
  onChangePoints: (points: AutomationPoint[]) => void;
}

const AutomationLaneOverlay: React.FC<AutomationLaneOverlayProps> = ({
  param,
  mode,
  points,
  totalSteps,
  onChangePoints,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [readout, setReadout] = useState<string | null>(null);

  const color = AUTO_PARAM_META[param].color;
  const sorted = [...points].sort((a, b) => a.step - b.step);

  const clientToStepVal = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { step: 0, value: 0.5 };
    const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const step = Math.round(xRatio * totalSteps * 2) / 2;
    const value = Math.max(0, Math.min(1, 1 - yRatio));
    return { step, value };
  };

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (draggingId) return;
    const { step, value } = clientToStepVal(e.clientX, e.clientY);
    const newPt: AutomationPoint = {
      id: `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      step,
      value,
    };
    onChangePoints([...sorted, newPt].sort((a, b) => a.step - b.step));
    setReadout(formatAutomationValue(param, value));
  };

  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: PointerEvent) => {
      const { step, value } = clientToStepVal(e.clientX, e.clientY);
      setReadout(formatAutomationValue(param, value));
      onChangePoints(
        points
          .map((p) => (p.id === draggingId ? { ...p, step, value } : p))
          .sort((a, b) => a.step - b.step)
      );
    };
    const onUp = () => {
      setDraggingId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  // Build SVG path in 0..1000 x 0..100 normalized viewBox
  const pathPoints =
    sorted.length > 0
      ? [
          { x: 0, y: (1 - sorted[0].value) * 100 },
          ...sorted.map((p) => ({
            x: (p.step / totalSteps) * 1000,
            y: (1 - p.value) * 100,
          })),
          { x: 1000, y: (1 - sorted[sorted.length - 1].value) * 100 },
        ]
      : [
          { x: 0, y: 50 },
          { x: 1000, y: 50 },
        ];

  const lineD = pathPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
  const areaD = `${lineD} L1000,100 L0,100 Z`;

  return (
    <div
      ref={containerRef}
      onClick={handleBackgroundClick}
      className="absolute inset-0 z-20 bg-[#0B0E14]/45 cursor-crosshair select-none"
      title={`Click to add ${AUTO_PARAM_META[param].label} breakpoint · Drag nodes · Double-click node to delete`}
    >
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full pointer-events-none">
        <line x1="0" y1="50" x2="1000" y2="50" stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" strokeWidth="1" />
        <path d={areaD} fill={color} fillOpacity={mode === 'off' ? 0.05 : 0.14} />
        <path
          d={lineD}
          fill="none"
          stroke={color}
          strokeOpacity={mode === 'off' ? 0.35 : 0.95}
          strokeWidth={sorted.length > 0 ? 2.2 : 1.2}
          strokeDasharray={sorted.length === 0 ? '6 4' : undefined}
        />
      </svg>

      {/* Interactive Breakpoint Nodes */}
      {sorted.map((pt) => {
        const leftPct = (pt.step / totalSteps) * 100;
        const topPct = (1 - pt.value) * 100;
        return (
          <div
            key={pt.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDraggingId(pt.id);
              setReadout(formatAutomationValue(param, pt.value));
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onChangePoints(sorted.filter((p) => p.id !== pt.id));
            }}
            title={`${formatAutomationValue(param, pt.value)} (Drag to move · Double-click to delete)`}
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-[#0E1117] shadow-sm cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              backgroundColor: color,
            }}
          />
        );
      })}

      {/* Corner Parameter Readout */}
      <div className="absolute top-1 left-2 pointer-events-none flex items-center gap-2 text-[10px] font-mono-tabular">
        <span className="font-semibold" style={{ color }}>
          {AUTO_PARAM_META[param].label}
        </span>
        {readout && <span className="text-white bg-[#11141B]/85 px-1.5 py-0.5 rounded">{readout}</span>}
        {sorted.length === 0 && (
          <span className="text-[#9CA3AF]">Click lane to draw curve</span>
        )}
      </div>
    </div>
  );
};

interface AudioClipRegionProps {
  clip: AudioClip;
  color: string;
  bpm: number;
  totalSteps: number;
  onDelete: () => void;
}

const AudioClipRegion: React.FC<AudioClipRegionProps> = ({ clip, color, bpm, totalSteps, onDelete }) => {
  const stepSec = 60 / bpm / 4;
  const clipSteps = Math.max(2, clip.durationSeconds / stepSec);
  const leftPct = (clip.startStep / totalSteps) * 100;
  const widthPct = Math.min(100 - leftPct, Math.max(8, (clipSteps / totalSteps) * 100));
  const fmt = clip.channelFormat || 'mono';

  return (
    <div
      className="absolute top-0 bottom-0 rounded-[4px] border overflow-hidden flex flex-col"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: `${color}26`,
        borderColor: `${color}AA`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="h-5 px-2 flex items-center justify-between text-[10px] font-semibold text-white shrink-0"
        style={{ backgroundColor: `${color}DD` }}
      >
        <span className="truncate">
          {fmt === 'mono' ? '○' : '○○'} {clip.name} · {clip.recordedBy} ({clip.durationSeconds.toFixed(1)}s)
        </span>
        <button
          type="button"
          onClick={onDelete}
          title="Delete Audio Region"
          className="hover:text-red-200 ml-1 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 flex items-center gap-px px-1.5 py-1">
        {clip.peaks.map((peak, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-full"
            style={{
              height: `${Math.max(12, Math.round(peak * 95))}%`,
              backgroundColor: '#F8FAFC',
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    </div>
  );
};
