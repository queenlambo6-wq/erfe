import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, Power, Sliders, Sparkles, X } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import {
  getFxPluginMeta,
  getInstrumentInfo,
  getTrackFxSlots,
} from '../data/instruments';
import { createDefaultAuxBuses, createDefaultBusSends, createDefaultTrackFx } from '../data/presets';
import type {
  AutomationMode,
  AutomationParam,
  AuxBusId,
  BusSendSlot,
  MasteringChain,
  OutputBusId,
  StudioAuxBus,
  StudioTrack,
  TrackFxChain,
  TrackPluginType,
} from '../types/studio';

interface LogicInspectorProps {
  track: StudioTrack | null;
  auxBuses?: StudioAuxBus[];
  mastering: MasteringChain;
  isPlaying: boolean;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onWriteAutomationPoint: (trackId: string, param: AutomationParam, normalizedValue: number) => void;
  onOpenPlugin: (trackId: string, plugin: TrackPluginType) => void;
  onOpenFxPicker: (track: StudioTrack, replacePlugin?: TrackPluginType) => void;
  onRemoveFxSlot: (trackId: string, plugin: TrackPluginType) => void;
  onOpenInstrument: (trackId: string) => void;
  onOpenInstrumentPicker: (track: StudioTrack) => void;
  onOpenMastering: () => void;
}

function gainToDb(gain: number): string {
  if (gain <= 0.001) return '-∞';
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
}

const AUTO_MODE_STYLE: Record<AutomationMode, string> = {
  off: 'text-[#9CA3AF] border-[#3A404D] bg-[#191C22]',
  read: 'text-emerald-300 border-emerald-500/45 bg-emerald-950/40',
  touch: 'text-amber-300 border-amber-500/45 bg-amber-950/40',
  latch: 'text-orange-300 border-orange-500/45 bg-orange-950/40',
  write: 'text-red-300 border-red-500/50 bg-red-950/45',
};

function computeMiniEqPath(fx: TrackFxChain): string {
  const { eq } = fx;
  const w = 180;
  const h = 44;
  const midY = h / 2;
  const points: string[] = [];

  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const freq = 20 * Math.pow(1000, t);
    let db = 0;

    if (eq.enabled) {
      if (freq < eq.hpFreq * 1.35) {
        const ratio = freq / Math.max(20, eq.hpFreq);
        db -= Math.max(0, (1 - ratio) * 18);
      }
      const lowFactor = 1 / (1 + Math.pow(freq / Math.max(40, eq.lowFreq), 2));
      db += eq.lowGain * lowFactor;

      const logDist = Math.log2(freq / Math.max(100, eq.midFreq));
      const bell = Math.exp(-Math.pow(logDist * eq.midQ * 1.4, 2));
      db += eq.midGain * bell;

      const highFactor = 1 / (1 + Math.pow(Math.max(1000, eq.highFreq) / freq, 2));
      db += eq.highGain * highFactor;
    }

    const clamped = Math.max(-15, Math.min(15, db));
    const x = t * w;
    const y = midY - (clamped / 16) * (h / 2 - 4);
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return points.join(' ');
}

export const LogicInspector: React.FC<LogicInspectorProps> = ({
  track,
  auxBuses,
  mastering,
  isPlaying,
  onUpdateTrack,
  onWriteAutomationPoint,
  onOpenPlugin,
  onOpenFxPicker,
  onRemoveFxSlot,
  onOpenInstrument,
  onOpenInstrumentPicker,
  onOpenMastering,
}) => {
  const [level, setLevel] = useState(0);
  const [meters, setMeters] = useState({ la2aGr: 0, fet1176Gr: 0, compGr: 0 });

  useEffect(() => {
    if (!track) return;
    let raf = 0;
    const poll = () => {
      const levels = audioEngine.getTrackLevels();
      setLevel(levels[track.id] || 0);
      setMeters(audioEngine.getTrackHardwareMeters(track.id));
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [track]);

  if (!track) {
    return (
      <aside className="w-60 shrink-0 bg-[#23262C] border-r border-[#14161A] p-4 flex items-center justify-center text-xs text-[#9CA3AF]">
        Select a track to inspect its channel strip.
      </aside>
    );
  }

  const fx = createDefaultTrackFx(track.fx);
  const buses = auxBuses && auxBuses.length > 0 ? auxBuses : createDefaultAuxBuses();
  const channelFormat = track.inputFormat || (track.type === 'audio' ? 'mono' : 'stereo');
  const outputBus: OutputBusId = track.outputBus || 'stereo-out';
  const automationMode: AutomationMode = track.automationMode || 'read';
  const sends: BusSendSlot[] =
    track.busSends && track.busSends.length > 0
      ? track.busSends
      : createDefaultBusSends(track.reverbSend, track.delaySend);

  const togglePlugin = (plugin: TrackPluginType) => {
    const nextFx: TrackFxChain = {
      ...fx,
      [plugin]: {
        ...fx[plugin],
        enabled: !fx[plugin].enabled,
      },
    };
    onUpdateTrack(track.id, { fx: nextFx });
  };

  const updateBusSend = (busId: AuxBusId, patch: Partial<BusSendSlot>) => {
    const nextSends = sends.map((s) => (s.busId === busId ? { ...s, ...patch } : s));
    const updates: Partial<StudioTrack> = { busSends: nextSends };
    if (busId === 'bus-3' && typeof patch.level === 'number') {
      updates.reverbSend = patch.level;
    }
    if (busId === 'bus-4' && typeof patch.level === 'number') {
      updates.delaySend = patch.level;
    }
    onUpdateTrack(track.id, updates);

    if (
      isPlaying &&
      (automationMode === 'touch' || automationMode === 'latch' || automationMode === 'write') &&
      typeof patch.level === 'number'
    ) {
      if (busId === 'bus-3') onWriteAutomationPoint(track.id, 'reverbSend', patch.level);
      if (busId === 'bus-4') onWriteAutomationPoint(track.id, 'delaySend', patch.level);
    }
  };

  const handleVolumeChange = (val: number) => {
    onUpdateTrack(track.id, { volume: val });
    if (isPlaying && (automationMode === 'touch' || automationMode === 'latch' || automationMode === 'write')) {
      onWriteAutomationPoint(track.id, 'volume', Math.max(0, Math.min(1, val / 1.2)));
    }
  };

  const handlePanChange = (val: number) => {
    onUpdateTrack(track.id, { pan: val });
    if (isPlaying && (automationMode === 'touch' || automationMode === 'latch' || automationMode === 'write')) {
      onWriteAutomationPoint(track.id, 'pan', Math.max(0, Math.min(1, (val + 1) / 2)));
    }
  };

  const loadedSlots = getTrackFxSlots(track);
  const insertSlots: {
    key: TrackPluginType;
    label: string;
    enabled: boolean;
    badge?: string;
  }[] = loadedSlots.map((key) => {
    const meta = getFxPluginMeta(key);
    let badge: string | undefined;
    if (key === 'autotune' && fx.autotune.enabled) {
      badge = `${fx.autotune.key} ${fx.autotune.scale.slice(0, 3)}`;
    } else if (key === 'fet1176' && fx.fet1176.enabled && meters.fet1176Gr > 0.3) {
      badge = `-${meters.fet1176Gr.toFixed(0)}dB`;
    } else if (key === 'la2a' && fx.la2a.enabled && meters.la2aGr > 0.3) {
      badge = `-${meters.la2aGr.toFixed(0)}dB`;
    } else if (key === 'flSoundgoodizer' && fx.flSoundgoodizer.enabled) {
      badge = fx.flSoundgoodizer.mode;
    } else if (key === 'grossBeat' && fx.grossBeat.enabled) {
      badge = fx.grossBeat.preset.slice(0, 6);
    } else if (key === 'echoBoy' && fx.echoBoy.enabled) {
      badge = fx.echoBoy.division;
    }
    return {
      key,
      label: meta.shortName,
      enabled: fx[key].enabled,
      badge,
    };
  });

  const eqPath = computeMiniEqPath(fx);

  return (
    <aside className="w-60 shrink-0 bg-[#23262C] border-r border-[#14161A] flex flex-col min-h-0 select-none">
      {/* Logic Inspector Header */}
      <div className="h-9 px-3 bg-[#2B2E36] border-b border-[#17191E] flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold text-[#E5E7EB] tracking-tight">Inspector</span>
        <span className="text-[11px] text-[#9CA3AF] truncate max-w-[125px]">{track.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Mini Channel EQ Thumbnail */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-medium text-[#9CA3AF] mb-1 px-0.5">
            <span>EQ</span>
            <span className="text-sky-400">{fx.eq.enabled ? 'On' : 'Bypass'}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenPlugin(track.id, 'eq')}
            title="Open Channel EQ Plugin"
            className="w-full h-11 rounded bg-[#12161D] border border-[#343944] hover:border-sky-500/70 overflow-hidden relative transition-colors"
          >
            <svg viewBox="0 0 180 44" className="w-full h-full">
              <line x1="0" y1="22" x2="180" y2="22" stroke="#2B3240" strokeWidth="1" />
              <line x1="60" y1="0" x2="60" y2="44" stroke="#1E2430" strokeWidth="1" />
              <line x1="120" y1="0" x2="120" y2="44" stroke="#1E2430" strokeWidth="1" />
              <path
                d={`${eqPath} L180,44 L0,44 Z`}
                fill={fx.eq.enabled ? 'rgba(56, 189, 248, 0.16)' : 'rgba(148, 163, 184, 0.06)'}
              />
              <path
                d={eqPath}
                fill="none"
                stroke={fx.eq.enabled ? '#38BDF8' : '#64748B'}
                strokeWidth="1.6"
              />
            </svg>
          </button>
        </div>

        {/* Instrument / Input Slot + Logic Pro Mono (○) / Stereo (○○) Format Toggle */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-medium text-[#9CA3AF] mb-1 px-0.5">
            <span>{track.type === 'audio' ? 'Input (Mono Rec)' : 'Instrument'}</span>
            <button
              type="button"
              onClick={() =>
                onUpdateTrack(track.id, {
                  inputFormat: channelFormat === 'mono' ? 'stereo' : 'mono',
                  inputSource:
                    track.type === 'audio'
                      ? channelFormat === 'mono'
                        ? 'Input 1-2 (Stereo)'
                        : 'Input 1 (Mono)'
                      : undefined,
                })
              }
              title="Toggle Logic Pro Channel Format (Mono ○ / Stereo ○○)"
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                channelFormat === 'mono'
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                  : 'bg-[#1D2027] border-[#3A404D] text-[#CBD5E1]'
              }`}
            >
              {channelFormat === 'mono' ? '○ Mono' : '○○ Stereo'}
            </button>
          </div>
          {track.type === 'synth' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenInstrument(track.id)}
                title="Open Actual VST Instrument Plugin"
                className="flex-1 h-6 px-2 rounded text-[11px] font-semibold text-white flex items-center justify-between logic-inst-slot hover:brightness-110 transition-all min-w-0"
              >
                <span className="truncate">
                  {getInstrumentInfo(track.preset).pluginName} · {getInstrumentInfo(track.preset).patchName}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenInstrumentPicker(track)}
                title="Replace Instrument Plugin (keeps MIDI & FX)"
                className="w-6 h-6 rounded bg-[#2B313E] hover:bg-amber-600/35 border border-[#41495B] text-amber-300 flex items-center justify-center shrink-0 transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              className={`w-full h-6 px-2 rounded text-[11px] font-medium text-white flex items-center justify-between ${
                track.type === 'audio'
                  ? 'bg-[#2C313B] border border-[#404654]'
                  : 'logic-inst-slot'
              }`}
            >
              <span className="truncate">
                {track.type === 'drums'
                  ? 'FL Drum Machine Rack'
                  : track.inputSource || (channelFormat === 'mono' ? 'Input 1 (Mono)' : 'Input 1-2 (Stereo)')}
              </span>
            </div>
          )}
        </div>

        {/* Customizable Audio FX Insert Rack */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-medium text-[#9CA3AF] mb-1 px-0.5">
            <span>Audio FX Inserts</span>
            <span>{insertSlots.filter((s) => s.enabled).length} On</span>
          </div>
          <div className="space-y-1">
            {insertSlots.map((slot) => (
              <div
                key={slot.key}
                className={`h-6 rounded flex items-center overflow-hidden transition-colors group ${
                  slot.enabled ? 'logic-fx-slot' : 'logic-fx-slot-bypassed'
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePlugin(slot.key)}
                  title={`Bypass / Enable ${slot.label}`}
                  className={`w-5 h-full flex items-center justify-center border-r border-black/25 shrink-0 ${
                    slot.enabled ? 'text-sky-200 hover:text-white' : 'text-[#6B7280] hover:text-[#D1D5DB]'
                  }`}
                >
                  <Power className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPlugin(track.id, slot.key)}
                  title={`Open ${slot.label} plugin`}
                  className="flex-1 h-full px-1.5 flex items-center justify-between text-left text-[11px] font-medium truncate min-w-0"
                >
                  <span className={slot.enabled ? 'text-white truncate' : 'text-[#9CA3AF] truncate'}>
                    {slot.label}
                  </span>
                  {slot.badge && (
                    <span className="font-mono-tabular text-[9px] text-amber-300 ml-1 shrink-0">
                      {slot.badge}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFxPicker(track, slot.key)}
                  title={`Replace ${slot.label} with another plugin`}
                  className="w-5 h-full flex items-center justify-center text-white/60 hover:text-amber-300 hover:bg-black/20 shrink-0"
                >
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFxSlot(track.id, slot.key)}
                  title={`Remove ${slot.label} from slot`}
                  className="w-5 h-full flex items-center justify-center text-white/50 hover:text-red-300 hover:bg-black/20 shrink-0"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onOpenFxPicker(track)}
              className="w-full h-6 rounded border border-dashed border-[#3F4759] hover:border-sky-400/70 bg-[#181B22] hover:bg-[#202634] text-[10px] font-semibold text-[#9CA3AF] hover:text-sky-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Insert Audio FX...</span>
            </button>
          </div>
        </div>

        {/* Logic Pro Bus Sends (Bus 1-4 with Pre / Post Fader) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-medium text-[#9CA3AF] mb-1 px-0.5">
            <span>Bus Sends</span>
            <span>Pre / Post</span>
          </div>
          <div className="space-y-1.5 bg-[#1B1E24] border border-[#30343E] rounded p-2">
            {sends.map((slot) => {
              const auxInfo = buses.find((b) => b.id === slot.busId);
              return (
                <div key={slot.busId} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => updateBusSend(slot.busId, { enabled: !slot.enabled })}
                      className={`truncate text-left font-medium ${
                        slot.enabled && slot.level > 0 ? 'text-[#E5E7EB]' : 'text-[#6B7280]'
                      }`}
                      title={`Toggle send to ${auxInfo?.name || slot.busId}`}
                    >
                      {auxInfo ? `${auxInfo.shortLabel} · ${auxInfo.name.split('·')[1]?.trim() || auxInfo.name}` : slot.busId}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateBusSend(slot.busId, { preFader: !slot.preFader })}
                        title="Toggle Pre-Fader vs Post-Fader Send"
                        className={`px-1 py-0.2 rounded text-[8px] font-bold uppercase border ${
                          slot.preFader
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-[#252A34] border-[#3A404D] text-[#9CA3AF]'
                        }`}
                      >
                        {slot.preFader ? 'Pre' : 'Post'}
                      </button>
                      <span className="font-mono-tabular text-[9px] text-[#9CA3AF] w-6 text-right">
                        {Math.round(slot.level * 100)}%
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={slot.level}
                    onChange={(e) =>
                      updateBusSend(slot.busId, {
                        level: parseFloat(e.target.value),
                        enabled: true,
                      })
                    }
                    className="studio-slider w-full"
                    aria-label={`${auxInfo?.name || slot.busId} send level`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Logic Pro Output Bus Routing + Mastering Shortcut */}
        <div>
          <div className="text-[10px] font-medium text-[#9CA3AF] mb-1 px-0.5">Output Routing</div>
          <div className="flex items-center gap-1">
            <select
              value={outputBus}
              onChange={(e) => onUpdateTrack(track.id, { outputBus: e.target.value as OutputBusId })}
              className="flex-1 h-7 px-2 rounded bg-[#1F3A52] border border-sky-500/45 text-[11px] font-semibold text-sky-100 outline-none cursor-pointer"
              aria-label="Track output bus"
            >
              <option value="stereo-out" className="bg-[#1D2027] text-white">
                Stereo Out (Master)
              </option>
              {buses.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#1D2027] text-white">
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenMastering}
              title="Open Mastering Assistant"
              className={`w-7 h-7 rounded flex items-center justify-center border transition-colors shrink-0 ${
                mastering.bypassAll
                  ? 'bg-[#2C313B] border-[#3F4552] text-[#9CA3AF]'
                  : 'bg-[#1F3A52] hover:bg-[#274A68] border-sky-500/45 text-sky-300'
              }`}
            >
              {mastering.bypassAll ? <Sliders className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Logic Pro Automation Mode */}
        <div>
          <div className="text-[10px] font-medium text-[#9CA3AF] mb-1 px-0.5">Automation</div>
          <select
            value={automationMode}
            onChange={(e) => onUpdateTrack(track.id, { automationMode: e.target.value as AutomationMode })}
            className={`w-full h-6 px-2 rounded border text-[11px] font-semibold outline-none cursor-pointer ${AUTO_MODE_STYLE[automationMode]}`}
            aria-label="Track automation mode"
          >
            <option value="off" className="bg-[#1D2027] text-[#D1D5DB]">Off</option>
            <option value="read" className="bg-[#1D2027] text-emerald-300">Read</option>
            <option value="touch" className="bg-[#1D2027] text-amber-300">Touch (Live Write)</option>
            <option value="latch" className="bg-[#1D2027] text-orange-300">Latch (Live Write)</option>
            <option value="write" className="bg-[#1D2027] text-red-300">Write (Overwrite)</option>
          </select>
        </div>

        {/* Channel Fader */}
        <div className="bg-[#1B1E24] border border-[#30343E] rounded p-2.5 flex flex-col items-center">
          <div className="w-full mb-2">
            <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] mb-0.5">
              <span>Pan</span>
              <span className="font-mono-tabular">
                {Math.abs(track.pan) < 0.04
                  ? 'C'
                  : track.pan < 0
                    ? `${Math.round(Math.abs(track.pan) * 64)}L`
                    : `${Math.round(track.pan * 64)}R`}
              </span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={track.pan}
              onChange={(e) => handlePanChange(parseFloat(e.target.value))}
              className="studio-slider w-full"
              aria-label="Channel pan"
            />
          </div>

          <div className="flex items-center justify-center gap-4 h-32 my-1">
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.01}
              value={track.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="mixer-fader h-28"
              aria-label="Channel volume fader"
            />
            <div className="w-3 h-28 bg-[#0E1014] border border-[#2C313C] rounded-xs p-0.5 flex flex-col justify-end overflow-hidden">
              <div
                className="w-full rounded-xs transition-[height] duration-75"
                style={{
                  height: `${Math.round((track.muted ? 0 : level) * 100)}%`,
                  background: 'linear-gradient(to top, #22C55E 0%, #EAB308 75%, #EF4444 100%)',
                }}
              />
            </div>
          </div>

          <div className="font-mono-tabular text-[11px] text-[#E5E7EB] bg-[#111318] border border-[#2C313C] rounded px-2 py-0.5 mb-2">
            {gainToDb(track.volume)} dB
          </div>

          <div className="grid grid-cols-2 gap-1.5 w-full">
            <button
              type="button"
              onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
              className={`py-1 rounded text-[11px] font-bold transition-colors ${
                track.muted
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#2C3039] text-[#9CA3AF] hover:text-white'
              }`}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => onUpdateTrack(track.id, { solo: !track.solo })}
              className={`py-1 rounded text-[11px] font-bold transition-colors ${
                track.solo
                  ? 'bg-[#EAB308] text-[#111317]'
                  : 'bg-[#2C3039] text-[#9CA3AF] hover:text-white'
              }`}
            >
              S
            </button>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: track.color }} />
    </aside>
  );
};
