import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, Power, Sparkles, X } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import {
  getFxPluginMeta,
  getInstrumentInfo,
  getTrackFxSlots,
} from '../data/instruments';
import {
  createDefaultAuxBuses,
  createDefaultBusSends,
  createDefaultMasteringChain,
  createDefaultTrackFx,
} from '../data/presets';
import type {
  AutomationMode,
  AutomationParam,
  AuxBusId,
  BusSendSlot,
  OutputBusId,
  StudioAuxBus,
  StudioProject,
  StudioTrack,
  TrackFxChain,
  TrackPluginType,
} from '../types/studio';

interface MixerViewProps {
  project: StudioProject;
  masterVolume: number;
  isPlaying: boolean;
  onChangeMasterVolume: (vol: number) => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onUpdateAuxBus: (busId: AuxBusId, updates: Partial<StudioAuxBus>) => void;
  onWriteAutomationPoint: (trackId: string, param: AutomationParam, normalizedValue: number) => void;
  onOpenPlugin: (trackId: string, plugin: TrackPluginType) => void;
  onOpenFxPicker: (track: StudioTrack, replacePlugin?: TrackPluginType) => void;
  onRemoveFxSlot: (trackId: string, plugin: TrackPluginType) => void;
  onOpenInstrument: (trackId: string) => void;
  onOpenInstrumentPicker: (track: StudioTrack) => void;
  onOpenMastering: () => void;
}

function gainToDb(gain: number): string {
  if (gain <= 0.001) return '-∞ dB';
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

function formatPan(pan: number): string {
  if (Math.abs(pan) < 0.04) return 'C';
  const pct = Math.round(Math.abs(pan) * 64);
  return pan < 0 ? `${pct}L` : `${pct}R`;
}

export const MixerView: React.FC<MixerViewProps> = ({
  project,
  masterVolume,
  isPlaying,
  onChangeMasterVolume,
  onUpdateTrack,
  onUpdateAuxBus,
  onWriteAutomationPoint,
  onOpenPlugin,
  onOpenFxPicker,
  onRemoveFxSlot,
  onOpenInstrument,
  onOpenInstrumentPicker,
  onOpenMastering,
}) => {
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({});
  const [auxLevels, setAuxLevels] = useState<Record<AuxBusId, number>>({
    'bus-1': 0,
    'bus-2': 0,
    'bus-3': 0,
    'bus-4': 0,
  });
  const [masterLevels, setMasterLevels] = useState({ left: 0, right: 0 });

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      setTrackLevels(audioEngine.getTrackLevels());
      setAuxLevels(audioEngine.getAuxBusLevels());
      const ms = audioEngine.getMasterStereoLevels();
      setMasterLevels({ left: ms.left, right: ms.right });
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const anySolo = project.tracks.some((t) => t.solo);
  const auxBuses = project.auxBuses && project.auxBuses.length > 0 ? project.auxBuses : createDefaultAuxBuses();
  const anyAuxSolo = auxBuses.some((b) => b.solo);
  const mastering = project.mastering || createDefaultMasteringChain();

  const toggleTrackPlugin = (track: StudioTrack, plugin: TrackPluginType) => {
    const fx = createDefaultTrackFx(track.fx);
    const nextFx: TrackFxChain = {
      ...fx,
      [plugin]: {
        ...fx[plugin],
        enabled: !fx[plugin].enabled,
      },
    };
    onUpdateTrack(track.id, { fx: nextFx });
  };

  const updateTrackSend = (track: StudioTrack, busId: AuxBusId, patch: Partial<BusSendSlot>) => {
    const sends =
      track.busSends && track.busSends.length > 0
        ? track.busSends
        : createDefaultBusSends(track.reverbSend, track.delaySend);
    const nextSends = sends.map((s) => (s.busId === busId ? { ...s, ...patch } : s));
    const updates: Partial<StudioTrack> = { busSends: nextSends };
    if (busId === 'bus-3' && typeof patch.level === 'number') updates.reverbSend = patch.level;
    if (busId === 'bus-4' && typeof patch.level === 'number') updates.delaySend = patch.level;
    onUpdateTrack(track.id, updates);
  };

  const handleTrackVolume = (track: StudioTrack, val: number) => {
    onUpdateTrack(track.id, { volume: val });
    const mode = track.automationMode || 'read';
    if (isPlaying && (mode === 'touch' || mode === 'latch' || mode === 'write')) {
      onWriteAutomationPoint(track.id, 'volume', Math.max(0, Math.min(1, val / 1.2)));
    }
  };

  const handleTrackPan = (track: StudioTrack, val: number) => {
    onUpdateTrack(track.id, { pan: val });
    const mode = track.automationMode || 'read';
    if (isPlaying && (mode === 'touch' || mode === 'latch' || mode === 'write')) {
      onWriteAutomationPoint(track.id, 'pan', Math.max(0, Math.min(1, (val + 1) / 2)));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1A1C21]">
      <div className="h-10 px-4 bg-[#252830] border-b border-[#14161A] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
          <span className="font-semibold text-[#F3F4F6]">Logic Mixer Console</span>
          <span aria-hidden="true">·</span>
          <span>Channels → Bus 1–4 Aux Strips → Stereo Out · Pre/Post Sends &amp; Mono/Stereo I/O</span>
        </div>
        <button
          type="button"
          onClick={onOpenMastering}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1F3A52] hover:bg-[#284D6E] border border-sky-500/45 text-xs font-semibold text-sky-100 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Open Mastering Assistant</span>
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-4 flex items-stretch gap-2.5">
        {/* Track Channel Strips */}
        {project.tracks.map((track) => {
          const dimmed = anySolo ? !track.solo : track.muted;
          const level = dimmed ? 0 : trackLevels[track.id] || 0;
          const fx = createDefaultTrackFx(track.fx);
          const format = track.inputFormat || (track.type === 'audio' ? 'mono' : 'stereo');
          const outBus: OutputBusId = track.outputBus || 'stereo-out';
          const autoMode: AutomationMode = track.automationMode || 'read';
          const sends =
            track.busSends && track.busSends.length > 0
              ? track.busSends
              : createDefaultBusSends(track.reverbSend, track.delaySend);
          const sendVerb = sends.find((s) => s.busId === 'bus-3') || { busId: 'bus-3' as AuxBusId, level: track.reverbSend, preFader: false, enabled: true };
          const sendEcho = sends.find((s) => s.busId === 'bus-4') || { busId: 'bus-4' as AuxBusId, level: track.delaySend, preFader: false, enabled: true };

          const slots: { id: TrackPluginType; label: string; enabled: boolean }[] = getTrackFxSlots(
            track
          ).map((id) => ({
            id,
            label: getFxPluginMeta(id).shortName,
            enabled: fx[id].enabled,
          }));

          return (
            <div
              key={track.id}
              className="w-48 shrink-0 bg-[#23262E] border border-[#343945] rounded-md flex flex-col justify-between overflow-hidden"
            >
              {/* Channel I/O + Inserts + Sends */}
              <div className="p-2 space-y-1.5 border-b border-[#1A1D23]">
                {/* Input / Instrument + Replace + Mono/Stereo Switch */}
                <div className="flex items-center gap-1">
                  {track.type === 'synth' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenInstrument(track.id)}
                        title="Open Actual VST Instrument Plugin"
                        className="flex-1 h-5 px-1.5 rounded text-[10px] font-semibold text-white flex items-center truncate logic-inst-slot hover:brightness-110 min-w-0"
                      >
                        <span className="truncate">{getInstrumentInfo(track.preset).pluginName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenInstrumentPicker(track)}
                        title="Replace Instrument Plugin"
                        className="w-5 h-5 rounded bg-[#2B313E] hover:bg-amber-600/35 border border-[#41495B] text-amber-300 flex items-center justify-center shrink-0"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                      </button>
                    </>
                  ) : (
                    <div
                      className={`flex-1 h-5 px-1.5 rounded text-[10px] font-semibold text-white flex items-center truncate ${
                        track.type === 'audio'
                          ? 'bg-[#2E333E] border border-[#444A58]'
                          : 'logic-inst-slot'
                      }`}
                    >
                      <span className="truncate">
                        {track.type === 'drums'
                          ? 'FL Drum Rack'
                          : format === 'mono'
                            ? 'In 1 (Mono)'
                            : 'In 1-2 (St)'}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrack(track.id, {
                        inputFormat: format === 'mono' ? 'stereo' : 'mono',
                      })
                    }
                    title={`Channel format: ${format}. Click to toggle Mono / Stereo`}
                    className={`h-5 px-1.5 rounded text-[9px] font-bold border shrink-0 ${
                      format === 'mono'
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                        : 'bg-[#1A1D24] border-[#383E4C] text-[#9CA3AF]'
                    }`}
                  >
                    {format === 'mono' ? '○' : '○○'}
                  </button>
                </div>

                {/* Customizable Audio FX Blue Slots */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[#7C8594] font-semibold px-0.5">
                    <span>Audio FX</span>
                    <span>{slots.filter((s) => s.enabled).length} On</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`h-5 rounded flex items-center overflow-hidden ${
                          slot.enabled ? 'logic-fx-slot' : 'logic-fx-slot-bypassed'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleTrackPlugin(track, slot.id)}
                          title={`Toggle ${slot.label}`}
                          className={`w-4 h-full flex items-center justify-center border-r border-black/25 shrink-0 ${
                            slot.enabled ? 'text-sky-200' : 'text-[#6B7280]'
                          }`}
                        >
                          <Power className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPlugin(track.id, slot.id)}
                          className={`flex-1 h-full px-1 text-left text-[10px] font-medium truncate min-w-0 ${
                            slot.enabled ? 'text-white' : 'text-[#9CA3AF]'
                          }`}
                        >
                          {slot.label}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenFxPicker(track, slot.id)}
                          title={`Replace ${slot.label}`}
                          className="w-4 h-full flex items-center justify-center text-white/60 hover:text-amber-300 shrink-0"
                        >
                          <ArrowLeftRight className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveFxSlot(track.id, slot.id)}
                          title={`Remove ${slot.label}`}
                          className="w-4 h-full flex items-center justify-center text-white/45 hover:text-red-300 shrink-0"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onOpenFxPicker(track)}
                      className="w-full h-5 rounded border border-dashed border-[#3C4456] hover:border-sky-400/70 bg-[#181B22] hover:bg-[#202634] text-[9px] font-semibold text-[#9CA3AF] hover:text-sky-300 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Insert FX</span>
                    </button>
                  </div>
                </div>

                {/* Bus 3 & Bus 4 Sends with Pre/Post */}
                <div className="space-y-1 pt-1 border-t border-[#2E333E]">
                  <div>
                    <div className="flex items-center justify-between text-[9px] text-[#9CA3AF]">
                      <span>Bus 3 Verb</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateTrackSend(track, 'bus-3', { preFader: !sendVerb.preFader })}
                          className={`px-1 rounded text-[8px] font-bold ${
                            sendVerb.preFader ? 'bg-emerald-500/25 text-emerald-300' : 'bg-[#2E333E] text-[#9CA3AF]'
                          }`}
                        >
                          {sendVerb.preFader ? 'PRE' : 'PST'}
                        </button>
                        <span className="font-mono-tabular">{Math.round(sendVerb.level * 100)}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={sendVerb.level}
                      onChange={(e) =>
                        updateTrackSend(track, 'bus-3', { level: parseFloat(e.target.value), enabled: true })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[9px] text-[#9CA3AF]">
                      <span>Bus 4 Echo</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateTrackSend(track, 'bus-4', { preFader: !sendEcho.preFader })}
                          className={`px-1 rounded text-[8px] font-bold ${
                            sendEcho.preFader ? 'bg-emerald-500/25 text-emerald-300' : 'bg-[#2E333E] text-[#9CA3AF]'
                          }`}
                        >
                          {sendEcho.preFader ? 'PRE' : 'PST'}
                        </button>
                        <span className="font-mono-tabular">{Math.round(sendEcho.level * 100)}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={sendEcho.level}
                      onChange={(e) =>
                        updateTrackSend(track, 'bus-4', { level: parseFloat(e.target.value), enabled: true })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>

                {/* Output Bus Selector + Automation Mode */}
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#2E333E]">
                  <select
                    value={outBus}
                    onChange={(e) => onUpdateTrack(track.id, { outputBus: e.target.value as OutputBusId })}
                    className="h-5 px-1 rounded bg-[#1B3146] border border-sky-500/35 text-[9px] font-semibold text-sky-200 outline-none cursor-pointer"
                    title="Output Bus Routing"
                  >
                    <option value="stereo-out" className="bg-[#1D2027]">Stereo Out</option>
                    {auxBuses.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#1D2027]">
                        {b.shortLabel}
                      </option>
                    ))}
                  </select>
                  <select
                    value={autoMode}
                    onChange={(e) => onUpdateTrack(track.id, { automationMode: e.target.value as AutomationMode })}
                    className="h-5 px-1 rounded bg-[#181B22] border border-[#39404F] text-[9px] font-semibold text-emerald-300 outline-none cursor-pointer"
                    title="Automation Mode"
                  >
                    <option value="off" className="bg-[#1D2027]">Off</option>
                    <option value="read" className="bg-[#1D2027]">Read</option>
                    <option value="touch" className="bg-[#1D2027]">Touch</option>
                    <option value="latch" className="bg-[#1D2027]">Latch</option>
                    <option value="write" className="bg-[#1D2027]">Write</option>
                  </select>
                </div>
              </div>

              {/* Pan + Vertical Fader + Live Meter */}
              <div className="flex-1 p-2 flex flex-col items-center justify-between bg-[#1E2027]">
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-[#9CA3AF] mb-0.5">
                    <span>Pan</span>
                    <span className="font-mono-tabular">{formatPan(track.pan)}</span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={track.pan}
                    onChange={(e) => handleTrackPan(track, parseFloat(e.target.value))}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="flex items-center justify-center gap-4 h-32 my-1">
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.01}
                    value={track.volume}
                    onChange={(e) => handleTrackVolume(track, parseFloat(e.target.value))}
                    className="mixer-fader h-28"
                    aria-label={`${track.name} volume fader`}
                  />
                  <div className="w-3 h-28 bg-[#0E1014] border border-[#2C313C] rounded-xs p-0.5 flex flex-col justify-end overflow-hidden">
                    <div
                      className="w-full rounded-xs transition-[height] duration-75"
                      style={{
                        height: `${Math.round(level * 100)}%`,
                        background: 'linear-gradient(to top, #22C55E 0%, #EAB308 74%, #EF4444 100%)',
                      }}
                    />
                  </div>
                </div>

                <div className="font-mono-tabular text-[10px] text-[#E5E7EB] bg-[#111318] border border-[#2C313C] rounded px-2 py-0.5 mb-1.5">
                  {gainToDb(track.volume)}
                </div>

                <div className="grid grid-cols-2 gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                    className={`py-1 rounded text-[11px] font-bold transition-colors ${
                      track.muted
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#2E323C] text-[#9CA3AF] hover:text-white'
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
                        : 'bg-[#2E323C] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>

              <div className="px-2 py-1.5 bg-[#282C35] border-t border-[#14161A]">
                <div className="text-[11px] font-semibold text-[#F3F4F6] truncate text-center">
                  {track.name}
                </div>
              </div>
              <div className="h-1.5 w-full" style={{ backgroundColor: track.color }} />
            </div>
          );
        })}

        {/* Divider between Track Strips and Logic Aux Buses */}
        <div className="w-px bg-[#343A47] mx-1 shrink-0" />

        {/* Logic Pro Aux / Bus Channel Strips (Bus 1 - Bus 4) */}
        {auxBuses.map((bus) => {
          const dimmed = anyAuxSolo ? !bus.solo : bus.muted;
          const level = dimmed ? 0 : auxLevels[bus.id] || 0;
          const routedTracksCount = project.tracks.filter((t) => t.outputBus === bus.id).length;

          return (
            <div
              key={bus.id}
              className="w-40 shrink-0 bg-[#20242C] border border-[#3B4252] rounded-md flex flex-col justify-between overflow-hidden"
            >
              <div className="p-2 space-y-2 border-b border-[#161920]">
                <div className="h-5 px-2 rounded bg-[#2F3645] border border-[#485266] text-[10px] font-bold text-amber-200 flex items-center justify-between">
                  <span>{bus.shortLabel} IN</span>
                  <span className="text-[9px] text-[#9CA3AF] font-normal">
                    {routedTracksCount > 0 ? `${routedTracksCount} trk` : 'Send'}
                  </span>
                </div>

                {/* Role-specific Aux DSP Controls */}
                <div className="space-y-1.5 bg-[#181B21] border border-[#2C323F] rounded p-1.5">
                  {bus.role === 'submix' && (
                    <div>
                      <div className="flex justify-between text-[9px] text-[#CBD5E1]">
                        <span>Bus Glue Comp</span>
                        <span className="font-mono-tabular">{bus.compAmount}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={2}
                        value={bus.compAmount}
                        onChange={(e) => onUpdateAuxBus(bus.id, { compAmount: parseFloat(e.target.value) })}
                        className="studio-slider w-full"
                      />
                    </div>
                  )}

                  {bus.role === 'reverb' && (
                    <div>
                      <div className="flex justify-between text-[9px] text-[#CBD5E1]">
                        <span>Space Decay</span>
                        <span className="font-mono-tabular">{bus.decaySec.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={5.5}
                        step={0.1}
                        value={bus.decaySec}
                        onChange={(e) => onUpdateAuxBus(bus.id, { decaySec: parseFloat(e.target.value) })}
                        className="studio-slider w-full"
                      />
                    </div>
                  )}

                  {bus.role === 'delay' && (
                    <div>
                      <div className="flex justify-between text-[9px] text-[#CBD5E1]">
                        <span>Echo Feedback</span>
                        <span className="font-mono-tabular">{bus.feedback}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={85}
                        step={1}
                        value={bus.feedback}
                        onChange={(e) => onUpdateAuxBus(bus.id, { feedback: parseFloat(e.target.value) })}
                        className="studio-slider w-full"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-[9px] text-[#9CA3AF]">
                      <span>Tone LP</span>
                      <span className="font-mono-tabular">
                        {bus.toneHz >= 1000 ? `${(bus.toneHz / 1000).toFixed(1)}k` : `${bus.toneHz}Hz`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={600}
                      max={18000}
                      step={200}
                      value={bus.toneHz}
                      onChange={(e) => onUpdateAuxBus(bus.id, { toneHz: parseFloat(e.target.value) })}
                      className="studio-slider w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[9px] text-[#9CA3AF]">
                      <span>Width</span>
                      <span className="font-mono-tabular">{Math.round(bus.width * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.8}
                      step={0.05}
                      value={bus.width}
                      onChange={(e) => onUpdateAuxBus(bus.id, { width: parseFloat(e.target.value) })}
                      className="studio-slider w-full"
                    />
                  </div>
                </div>

                <div className="h-5 px-1.5 rounded bg-[#1B3146] border border-sky-500/35 text-[9px] font-semibold text-sky-200 flex items-center justify-between">
                  <span>Out</span>
                  <span>Stereo Out</span>
                </div>
              </div>

              <div className="flex-1 p-2 flex flex-col items-center justify-between bg-[#1A1D24]">
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-[#9CA3AF] mb-0.5">
                    <span>Pan</span>
                    <span className="font-mono-tabular">{formatPan(bus.pan)}</span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={bus.pan}
                    onChange={(e) => onUpdateAuxBus(bus.id, { pan: parseFloat(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="flex items-center justify-center gap-3.5 h-32 my-1">
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.01}
                    value={bus.volume}
                    onChange={(e) => onUpdateAuxBus(bus.id, { volume: parseFloat(e.target.value) })}
                    className="mixer-fader h-28"
                    aria-label={`${bus.name} aux fader`}
                  />
                  <div className="w-2.5 h-28 bg-[#0E1014] border border-[#2C313C] rounded-xs p-0.5 flex flex-col justify-end overflow-hidden">
                    <div
                      className="w-full rounded-xs transition-[height] duration-75"
                      style={{
                        height: `${Math.round(level * 100)}%`,
                        background: 'linear-gradient(to top, #38BDF8 0%, #34D399 65%, #F59E0B 100%)',
                      }}
                    />
                  </div>
                </div>

                <div className="font-mono-tabular text-[10px] text-[#E5E7EB] bg-[#111318] border border-[#2C313C] rounded px-2 py-0.5 mb-1.5">
                  {gainToDb(bus.volume)}
                </div>

                <div className="grid grid-cols-2 gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => onUpdateAuxBus(bus.id, { muted: !bus.muted })}
                    className={`py-1 rounded text-[11px] font-bold transition-colors ${
                      bus.muted
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#2E323C] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAuxBus(bus.id, { solo: !bus.solo })}
                    className={`py-1 rounded text-[11px] font-bold transition-colors ${
                      bus.solo
                        ? 'bg-[#EAB308] text-[#111317]'
                        : 'bg-[#2E323C] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>

              <div className="px-2 py-1.5 bg-[#262B35] border-t border-[#14161A]">
                <div className="text-[10px] font-semibold text-amber-100 truncate text-center">
                  {bus.name}
                </div>
              </div>
              <div className="h-1.5 w-full" style={{ backgroundColor: bus.color }} />
            </div>
          );
        })}

        {/* Logic Stereo Out (Master Bus) Channel Strip */}
        <div className="w-48 shrink-0 bg-[#262A34] border border-sky-500/45 rounded-md flex flex-col justify-between overflow-hidden ml-auto">
          <div className="p-2.5 space-y-1.5 border-b border-[#181B22]">
            <div className="text-[9px] uppercase tracking-wider text-sky-400 font-semibold px-0.5">
              Mastering Chain
            </div>
            {[
              { label: 'Linear Master EQ', on: !mastering.bypassAll && mastering.eqEnabled },
              { label: 'Bus Glue Comp', on: !mastering.bypassAll && mastering.compEnabled },
              { label: 'Tape Exciter & Width', on: !mastering.bypassAll && mastering.exciterEnabled },
              { label: 'Adaptive Limiter', on: !mastering.bypassAll && mastering.limiterEnabled },
            ].map((slot) => (
              <button
                key={slot.label}
                type="button"
                onClick={onOpenMastering}
                className={`w-full h-5 px-2 rounded text-left text-[10px] font-medium truncate transition-colors ${
                  slot.on ? 'logic-fx-slot text-white' : 'logic-fx-slot-bypassed text-[#9CA3AF]'
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-3 flex flex-col items-center justify-center bg-[#1D2028]">
            <div className="flex items-center justify-center gap-4 h-44">
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.01}
                value={masterVolume}
                onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
                className="mixer-fader h-40"
                aria-label="Stereo Out Master Fader"
              />
              <div className="flex gap-1 h-40">
                <div className="w-2.5 h-full bg-[#0E1014] border border-[#2C313C] rounded-xs p-0.5 flex flex-col justify-end overflow-hidden">
                  <div
                    className="w-full rounded-xs transition-[height] duration-75"
                    style={{
                      height: `${Math.round(masterLevels.left * 100)}%`,
                      background: 'linear-gradient(to top, #22C55E 0%, #EAB308 75%, #EF4444 100%)',
                    }}
                  />
                </div>
                <div className="w-2.5 h-full bg-[#0E1014] border border-[#2C313C] rounded-xs p-0.5 flex flex-col justify-end overflow-hidden">
                  <div
                    className="w-full rounded-xs transition-[height] duration-75"
                    style={{
                      height: `${Math.round(masterLevels.right * 100)}%`,
                      background: 'linear-gradient(to top, #22C55E 0%, #EAB308 75%, #EF4444 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-2 font-mono-tabular text-[11px] font-semibold text-sky-400 bg-[#111318] border border-[#2C313C] rounded px-2.5 py-0.5">
              {gainToDb(masterVolume)}
            </div>
          </div>

          <div className="px-2.5 py-1.5 bg-[#2B303B] border-t border-[#14161A]">
            <div className="text-[11px] font-bold text-white text-center">Stereo Out</div>
          </div>
          <div className="h-1.5 w-full bg-sky-500" />
        </div>
      </div>
    </div>
  );
};
