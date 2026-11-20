import React, { useEffect, useState } from 'react';
import {
  Activity,
  Drum,
  Mic,
  Music,
  Play,
  RotateCcw,
  Sliders,
  Square,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { createDefaultAbletonSession, createDefaultMacroRack } from '../data/presets';
import type {
  AbletonMacroRack,
  AbletonScene,
  AbletonSessionState,
  StudioProject,
  StudioTrack,
} from '../types/studio';

interface AbletonSessionViewProps {
  project: StudioProject;
  isPlaying: boolean;
  currentStep: number;
  onStartPlayback: () => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onApplyDrumPreset: (presetName: string) => void;
  onUpdateSession: (updater: (prev: AbletonSessionState) => AbletonSessionState) => void;
}

const BEAT_REPEAT_OPTIONS: { id: AbletonMacroRack['beatRepeat']; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: '1/4', label: '1/4' },
  { id: '1/8', label: '1/8' },
  { id: '1/16', label: '1/16' },
  { id: '1/32', label: '1/32' },
];

export const AbletonSessionView: React.FC<AbletonSessionViewProps> = ({
  project,
  isPlaying,
  currentStep,
  onStartPlayback,
  onUpdateTrack,
  onApplyDrumPreset,
  onUpdateSession,
}) => {
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  const session = project.session || createDefaultAbletonSession();
  const macro = session.macroRack || createDefaultMacroRack();

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      setTrackLevels(audioEngine.getTrackLevels());
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const updateMacro = (updates: Partial<AbletonMacroRack>) => {
    onUpdateSession((prev) => ({
      ...prev,
      macroRack: {
        ...prev.macroRack,
        ...updates,
      },
    }));
  };

  const launchScene = (scene: AbletonScene) => {
    const nextClipMap: Record<string, string | null> = {};
    for (const track of project.tracks) {
      const shouldPlay = scene.activeTrackIds.includes(track.id);
      nextClipMap[track.id] = shouldPlay ? scene.id : null;
      if (track.muted === shouldPlay) {
        onUpdateTrack(track.id, { muted: !shouldPlay });
      }
    }
    onApplyDrumPreset(scene.drumPreset);
    onUpdateSession((prev) => ({
      ...prev,
      activeSceneId: scene.id,
      clipPlayingByTrack: nextClipMap,
    }));
    if (!isPlaying) {
      onStartPlayback();
    }
  };

  const toggleTrackClip = (track: StudioTrack, scene: AbletonScene) => {
    const currentlyPlayingScene = session.clipPlayingByTrack[track.id];
    const isThisSlotActive = currentlyPlayingScene === scene.id && !track.muted;

    if (isThisSlotActive) {
      onUpdateTrack(track.id, { muted: true });
      onUpdateSession((prev) => ({
        ...prev,
        clipPlayingByTrack: {
          ...prev.clipPlayingByTrack,
          [track.id]: null,
        },
      }));
    } else {
      if (track.type === 'drums') {
        onApplyDrumPreset(scene.drumPreset);
      }
      if (track.muted) {
        onUpdateTrack(track.id, { muted: false });
      }
      onUpdateSession((prev) => ({
        ...prev,
        clipPlayingByTrack: {
          ...prev.clipPlayingByTrack,
          [track.id]: scene.id,
        },
      }));
      if (!isPlaying) {
        onStartPlayback();
      }
    }
  };

  const stopTrackClip = (track: StudioTrack) => {
    onUpdateTrack(track.id, { muted: true });
    onUpdateSession((prev) => ({
      ...prev,
      clipPlayingByTrack: {
        ...prev.clipPlayingByTrack,
        [track.id]: null,
      },
    }));
  };

  const stopAllClips = () => {
    const cleared: Record<string, string | null> = {};
    for (const track of project.tracks) {
      cleared[track.id] = null;
      if (!track.muted) {
        onUpdateTrack(track.id, { muted: true });
      }
    }
    onUpdateSession((prev) => ({
      ...prev,
      activeSceneId: '',
      clipPlayingByTrack: cleared,
    }));
  };

  const beatInBar = Math.floor((currentStep % 16) / 4) + 1;

  const macroControls: {
    key: keyof Omit<AbletonMacroRack, 'beatRepeat'>;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    display: string;
  }[] = [
    {
      key: 'djFilter',
      label: 'DJ Filter',
      min: -100,
      max: 100,
      step: 1,
      value: macro.djFilter,
      display:
        Math.abs(macro.djFilter) <= 2
          ? 'Flat'
          : macro.djFilter < 0
            ? `LP ${Math.abs(macro.djFilter)}%`
            : `HP ${macro.djFilter}%`,
    },
    {
      key: 'filterRes',
      label: 'Filter Res',
      min: 0,
      max: 100,
      step: 1,
      value: macro.filterRes,
      display: `${macro.filterRes}%`,
    },
    {
      key: 'tapeWarmth',
      label: 'Tape Warmth',
      min: 0,
      max: 100,
      step: 1,
      value: macro.tapeWarmth,
      display: `${macro.tapeWarmth}%`,
    },
    {
      key: 'spaceWash',
      label: 'Space Wash',
      min: 0,
      max: 100,
      step: 1,
      value: macro.spaceWash,
      display: `${macro.spaceWash}%`,
    },
    {
      key: 'dubEcho',
      label: 'Dub Echo',
      min: 0,
      max: 100,
      step: 1,
      value: macro.dubEcho,
      display: `${macro.dubEcho}%`,
    },
    {
      key: 'stereoWidth',
      label: 'Stereo Width',
      min: 0,
      max: 200,
      step: 2,
      value: macro.stereoWidth,
      display: `${macro.stereoWidth}%`,
    },
    {
      key: 'ottPunch',
      label: 'OTT Punch',
      min: 0,
      max: 100,
      step: 1,
      value: macro.ottPunch,
      display: `${macro.ottPunch}%`,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1B1D22] select-none">
      {/* Top Session Bar */}
      <div className="h-10 px-4 bg-[#252830] border-b border-[#14161A] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
          <span className="font-semibold text-[#F3F4F6]">Ableton Session View</span>
          <span aria-hidden="true">·</span>
          <span className="hidden md:inline">Trigger clips &amp; scenes live · Press Tab for Arrangement</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
            <span>Launch Quantize</span>
            <select
              value={session.quantize}
              onChange={(e) =>
                onUpdateSession((prev) => ({
                  ...prev,
                  quantize: e.target.value as AbletonSessionState['quantize'],
                }))
              }
              className="bg-[#181B21] border border-[#3A404D] rounded px-2 py-0.5 text-[11px] text-[#E5E7EB] outline-none cursor-pointer"
            >
              <option value="1-bar">1 Bar</option>
              <option value="half-bar">1/2 Bar</option>
              <option value="instant">Instant</option>
            </select>
          </div>

          <button
            type="button"
            onClick={stopAllClips}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2D313B] hover:bg-red-600/30 border border-[#424856] hover:border-red-500/50 text-[11px] font-semibold text-[#E5E7EB] transition-colors whitespace-nowrap"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop All Clips</span>
          </button>
        </div>
      </div>

      {/* Main Session Clip Matrix */}
      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-[680px] flex items-stretch gap-2">
          {/* Track Columns */}
          {project.tracks.map((track) => {
            const playingSceneId = session.clipPlayingByTrack[track.id];
            const level = track.muted ? 0 : trackLevels[track.id] || 0;
            const format = track.inputFormat || (track.type === 'audio' ? 'mono' : 'stereo');

            return (
              <div
                key={track.id}
                className="flex-1 min-w-[138px] bg-[#22252D] border border-[#343945] rounded-md flex flex-col overflow-hidden"
              >
                {/* Track Header */}
                <div className="px-2.5 py-2 bg-[#2A2E38] border-b border-[#16181E]">
                  <div className="flex items-center gap-1.5 mb-1">
                    {track.type === 'drums' && <Drum className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {track.type === 'synth' && <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {track.type === 'audio' && <Mic className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                    <span className="text-xs font-semibold text-[#F3F4F6] truncate">{track.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]">
                    <span>{format === 'mono' ? '○ Mono' : '○○ Stereo'}</span>
                    <span className="font-mono-tabular">
                      {track.outputBus && track.outputBus !== 'stereo-out'
                        ? track.outputBus.toUpperCase()
                        : 'ST OUT'}
                    </span>
                  </div>
                </div>

                {/* Clip Slots (one per Scene) */}
                <div className="p-1.5 space-y-1.5 flex-1">
                  {session.scenes.map((scene) => {
                    const includedInScene = scene.activeTrackIds.includes(track.id);
                    const isClipActive = playingSceneId === scene.id && !track.muted;

                    return (
                      <button
                        key={scene.id}
                        type="button"
                        onClick={() => toggleTrackClip(track, scene)}
                        className={`w-full h-12 px-2 rounded border text-left flex items-center justify-between gap-1.5 transition-all ${
                          isClipActive
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-inner'
                            : includedInScene
                              ? 'bg-[#2A2F3A] hover:bg-[#323846] border-[#3F4655] text-[#D1D5DB]'
                              : 'bg-[#191C22] hover:bg-[#232730] border-[#292E39] text-[#6B7280]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-xs flex items-center justify-center shrink-0 ${
                              isClipActive
                                ? 'bg-emerald-400 text-[#0E1115]'
                                : 'bg-[#171A20] text-[#9CA3AF]'
                            }`}
                          >
                            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate">
                              {track.type === 'drums'
                                ? scene.drumPreset
                                : includedInScene
                                  ? scene.name.split('·')[1]?.trim() || scene.name
                                  : 'Empty Slot'}
                            </div>
                            <div className="text-[9px] text-[#9CA3AF] font-mono-tabular">
                              {isClipActive && isPlaying ? `Playing · Beat ${beatInBar}` : includedInScene ? 'Ready' : 'Tap to arm'}
                            </div>
                          </div>
                        </div>
                        <div
                          className="w-1 h-7 rounded-full shrink-0"
                          style={{
                            backgroundColor: isClipActive ? '#34D399' : includedInScene ? track.color : '#2D323E',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Track Clip Stop + Mini Fader & Meter */}
                <div className="p-2 bg-[#1D2027] border-t border-[#14161A] space-y-2">
                  <button
                    type="button"
                    onClick={() => stopTrackClip(track)}
                    className="w-full py-1 rounded bg-[#282C36] hover:bg-[#343A47] border border-[#3A404D] text-[10px] font-semibold text-[#CBD5E1] flex items-center justify-center gap-1 transition-colors"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Stop Clip</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1.2}
                      step={0.02}
                      value={track.volume}
                      onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                      className="studio-slider flex-1"
                      aria-label={`${track.name} session volume`}
                    />
                    <div className="w-10 h-2 bg-[#0E1014] rounded-xs overflow-hidden shrink-0">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75"
                        style={{ width: `${Math.round(level * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="h-1 w-full" style={{ backgroundColor: track.color }} />
              </div>
            );
          })}

          {/* Right-hand Ableton Master Scene Launch Column */}
          <div className="w-52 shrink-0 bg-[#252933] border border-emerald-500/40 rounded-md flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-[#2B303C] border-b border-[#16181E]">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-white">Master Scenes</span>
              </div>
              <div className="text-[10px] text-[#9CA3AF]">Launch full arrangement rows</div>
            </div>

            <div className="p-1.5 space-y-1.5 flex-1">
              {session.scenes.map((scene) => {
                const isSceneActive = session.activeSceneId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => launchScene(scene)}
                    className={`w-full h-12 px-2.5 rounded border text-left flex items-center justify-between gap-2 transition-all ${
                      isSceneActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-[#1D212A] hover:bg-[#2A303D] border-[#383F4E] text-[#E5E7EB]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold truncate">{scene.name}</div>
                      <div className="text-[9px] text-[#9CA3AF] truncate">
                        {scene.drumPreset} · {scene.activeTrackIds.length} tracks
                      </div>
                    </div>
                    <span
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                        isSceneActive ? 'bg-emerald-400 text-[#0E1115]' : 'bg-[#2D3340] text-emerald-300'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-2 bg-[#1D2027] border-t border-[#14161A]">
              <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]">
                <span>Master Tempo</span>
                <span className="font-mono-tabular text-emerald-400 font-semibold">{project.bpm} BPM</span>
              </div>
            </div>
            <div className="h-1 w-full bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* Bottom Ableton Live Master Macro Performance Rack + Beat Repeat */}
      <div className="bg-[#22262E] border-t border-[#14161A] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-[#F3F4F6]">
              Ableton Master Macro Performance Rack
            </span>
            <span className="text-[11px] text-[#9CA3AF] hidden md:inline">
              Live master bus DJ filter, tape warmth, OTT punch &amp; beat repeat
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateSession((prev) => ({
                ...prev,
                macroRack: createDefaultMacroRack(),
              }))
            }
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#2D323D] hover:bg-[#3A404F] border border-[#424959] text-[11px] text-[#D1D5DB] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Macros</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {macroControls.map((ctrl) => {
            const isNeutral =
              (ctrl.key === 'djFilter' && Math.abs(ctrl.value) <= 2) ||
              (ctrl.key === 'stereoWidth' && ctrl.value === 100) ||
              (ctrl.key !== 'djFilter' && ctrl.key !== 'stereoWidth' && ctrl.value === 0);

            return (
              <div
                key={ctrl.key}
                className={`rounded border p-2 flex flex-col justify-between gap-1.5 ${
                  isNeutral
                    ? 'bg-[#191C22] border-[#313643]'
                    : 'bg-[#1B2422] border-emerald-500/45'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-[#D1D5DB] truncate">
                    {ctrl.label}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-emerald-400 shrink-0">
                    {ctrl.display}
                  </span>
                </div>
                <input
                  type="range"
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={ctrl.value}
                  onChange={(e) => updateMacro({ [ctrl.key]: parseFloat(e.target.value) })}
                  className="studio-slider w-full accent-emerald-400"
                  aria-label={ctrl.label}
                />
              </div>
            );
          })}

          {/* Beat Repeat / Stutter Performance Pads */}
          <div
            className={`rounded border p-2 flex flex-col justify-between gap-1.5 ${
              macro.beatRepeat !== 'off'
                ? 'bg-amber-950/40 border-amber-400/60'
                : 'bg-[#191C22] border-[#313643]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#D1D5DB] flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber-400" />
                <span>Beat Repeat</span>
              </span>
              <span className="font-mono-tabular text-[10px] text-amber-300">
                {macro.beatRepeat.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {BEAT_REPEAT_OPTIONS.map((opt) => {
                const active = macro.beatRepeat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateMacro({ beatRepeat: opt.id })}
                    className={`py-1 rounded text-[9px] font-bold transition-colors ${
                      active
                        ? opt.id === 'off'
                          ? 'bg-[#3A404D] text-white'
                          : 'bg-amber-400 text-[#111317]'
                        : 'bg-[#262B35] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
