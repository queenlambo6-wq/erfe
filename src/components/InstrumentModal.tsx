import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Music,
  Play,
  RotateCcw,
  Sliders,
  X,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import {
  createDefaultInstrumentParams,
  getInstrumentInfo,
  INDUSTRY_INSTRUMENTS,
} from '../data/instruments';
import { isBlackKey, midiToNoteName } from '../data/presets';
import type {
  InstrumentDefinition,
  InstrumentSynthParams,
  StudioTrack,
  SynthWaveform,
} from '../types/studio';

interface InstrumentModalProps {
  track: StudioTrack;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onReplaceInstrumentPicker: (track: StudioTrack) => void;
  onOpenPianoRoll: (trackId: string) => void;
  onClose: () => void;
}

const WAVEFORMS: { id: SynthWaveform; label: string; path: string }[] = [
  { id: 'sine', label: 'Sine', path: 'M2,12 Q8,2 14,12 T26,12' },
  { id: 'triangle', label: 'Tri', path: 'M2,12 L8,3 L20,21 L26,12' },
  { id: 'sawtooth', label: 'Saw', path: 'M2,20 L14,4 L14,20 L26,4' },
  { id: 'square', label: 'Sqr', path: 'M2,20 L2,4 L14,4 L14,20 L26,20 L26,4' },
];

const PREVIEW_KEYS = Array.from({ length: 25 }, (_, i) => 48 + i); // C3 to C5

function buildAdsrPath(p: InstrumentSynthParams): string {
  const aX = Math.max(8, Math.min(58, (p.attackMs / 600) * 58));
  const dX = aX + Math.max(14, Math.min(68, (p.decayMs / 1200) * 68));
  const sY = 82 - p.sustain * 66;
  const sEndX = Math.min(185, Math.max(dX + 26, 165));
  const rX = Math.min(236, sEndX + Math.max(12, (p.releaseMs / 1800) * 58));
  return `M4,82 L${aX.toFixed(1)},16 L${dX.toFixed(1)},${sY.toFixed(1)} L${sEndX.toFixed(1)},${sY.toFixed(1)} L${rX.toFixed(1)},82`;
}

export const InstrumentModal: React.FC<InstrumentModalProps> = ({
  track,
  onUpdateTrack,
  onReplaceInstrumentPicker,
  onOpenPianoRoll,
  onClose,
}) => {
  const activeInfo = getInstrumentInfo(track.preset);
  const params: InstrumentSynthParams = useMemo(
    () => ({
      ...createDefaultInstrumentParams(track.preset),
      ...(track.instrumentParams || {}),
    }),
    [track.instrumentParams, track.preset]
  );

  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [draggingOrb, setDraggingOrb] = useState(false);
  const orbRef = useRef<HTMLDivElement>(null);

  const sameVendorPresets = useMemo(
    () => INDUSTRY_INSTRUMENTS.filter((i) => i.vendor === activeInfo.vendor),
    [activeInfo.vendor]
  );

  const updateParams = (patch: Partial<InstrumentSynthParams>) => {
    onUpdateTrack(track.id, {
      instrumentParams: { ...params, ...patch },
    });
  };

  const loadPatch = (inst: InstrumentDefinition) => {
    const freshParams = createDefaultInstrumentParams(inst.preset);
    const shortName = `${inst.pluginName.replace(' 2', '').replace(' 7', '')} · ${inst.patchName.split(' ').slice(0, 2).join(' ')}`;
    onUpdateTrack(track.id, {
      preset: inst.preset,
      name: shortName,
      color: inst.accent,
      instrumentParams: freshParams,
    });
    audioEngine.triggerPresetPreview(inst.preset, 60, 0.7, freshParams);
  };

  const stepPreset = (delta: number) => {
    const idx = sameVendorPresets.findIndex((i) => i.preset === activeInfo.preset);
    const nextIdx = (idx + delta + sameVendorPresets.length) % sameVendorPresets.length;
    loadPatch(sameVendorPresets[nextIdx]);
  };

  const handlePlayKey = (midiPitch: number) => {
    setActiveKey(midiPitch);
    audioEngine.triggerNoteLive({ ...track, instrumentParams: params }, midiPitch, 0.65, 0.86);
    window.setTimeout(() => {
      setActiveKey((prev) => (prev === midiPitch ? null : prev));
    }, 240);
  };

  const handlePlayChord = () => {
    const chord = [60, 63, 67, 70]; // Cm7 audition
    chord.forEach((p, idx) => {
      window.setTimeout(() => {
        audioEngine.triggerNoteLive({ ...track, instrumentParams: params }, p, 0.9, 0.72);
      }, idx * 24);
    });
  };

  const updateOrbFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!orbRef.current) return;
    const rect = orbRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round((1 - (e.clientY - rect.top) / rect.height) * 100)));
    updateParams({ xyX: x, xyY: y });
  };

  const isOmnisphere = activeInfo.vendor === 'omnisphere';
  const isKontakt = activeInfo.vendor === 'kontakt';
  const isFl3xOsc = activeInfo.preset === 'fl-3xosc' || activeInfo.preset === 'sub-bass';
  const isFlSytrus = activeInfo.preset === 'fl-sytrus';

  const adsrPath = buildAdsrPath(params);

  // Authentic vendor chassis theming
  const chassisBg = isOmnisphere
    ? 'bg-[#121926]'
    : isKontakt
      ? 'bg-[#1B1815]'
      : 'bg-[#181B21]';
  const panelBg = isOmnisphere
    ? 'bg-[#172133] border-[#283854]'
    : isKontakt
      ? 'bg-[#231F1B] border-[#3E352B]'
      : 'bg-[#1F232C] border-[#313847]';
  const accentText = isOmnisphere
    ? 'text-sky-400'
    : isKontakt
      ? 'text-amber-400'
      : 'text-orange-400';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-5xl ${chassisBg} border border-[#444C5E] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]`}
      >
        {/* Authentic VST Plugin Window Top Bar */}
        <div className="logic-toolbar-bg px-4 py-2.5 border-b border-[#111318] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close instrument plugin"
              className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:brightness-110 flex items-center justify-center text-[#5A0E0B] shrink-0"
            >
              <X className="w-2.5 h-2.5" />
            </button>

            <span className={`text-xs font-bold tracking-tight ${accentText} whitespace-nowrap`}>
              {activeInfo.pluginName}
            </span>

            {/* Patch Selector with Prev/Next */}
            <div className="flex items-center bg-[#14171F] border border-[#343C4D] rounded overflow-hidden">
              <button
                type="button"
                onClick={() => stepPreset(-1)}
                title="Previous Patch"
                className="px-1.5 py-1 text-[#9CA3AF] hover:text-white hover:bg-[#232938]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <select
                value={activeInfo.preset}
                onChange={(e) => {
                  const found = INDUSTRY_INSTRUMENTS.find((i) => i.preset === e.target.value);
                  if (found) loadPatch(found);
                }}
                className="bg-transparent px-2 py-1 text-xs font-semibold text-[#F3F4F6] outline-none cursor-pointer max-w-[210px]"
              >
                {INDUSTRY_INSTRUMENTS.map((inst) => (
                  <option key={inst.preset} value={inst.preset} className="bg-[#181C24] text-white">
                    {inst.pluginName} · {inst.patchName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => stepPreset(1)}
                title="Next Patch"
                className="px-1.5 py-1 text-[#9CA3AF] hover:text-white hover:bg-[#232938]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onReplaceInstrumentPicker(track)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-semibold text-amber-200 transition-colors whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Replace Plugin</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePlayChord}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2563EB] hover:bg-[#3B82F6] text-xs font-semibold text-white whitespace-nowrap"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Test Chord</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateTrack(track.id, {
                  instrumentParams: createDefaultInstrumentParams(track.preset),
                })
              }
              title="Reset synth knobs to factory patch"
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#1E222B] hover:bg-[#2C3240] border border-[#383F50] text-xs text-[#CBD5E1]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPianoRoll(track.id);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E222B] hover:bg-[#2C3240] border border-[#383F50] text-xs text-[#E5E7EB]"
            >
              <Music className="w-3.5 h-3.5 text-sky-400" />
              <span>Piano Roll</span>
            </button>
          </div>
        </div>

        {/* ACTUAL PLUGIN FACEPLATE BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Vendor Banner Header */}
          <div className={`rounded-lg border p-3.5 flex items-center justify-between gap-4 flex-wrap ${panelBg}`}>
            <div>
              <div className="flex items-center gap-2">
                <Sliders className={`w-4 h-4 ${accentText}`} />
                <h2 className="text-base font-bold text-white tracking-tight">
                  {activeInfo.pluginName} — {activeInfo.patchName}
                </h2>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                {activeInfo.category} · {activeInfo.description}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-tabular">
              <div className="flex items-center gap-1.5">
                <span className="text-[#94A3B8]">Transpose</span>
                <input
                  type="range"
                  min={-24}
                  max={24}
                  step={1}
                  value={params.transpose}
                  onChange={(e) => updateParams({ transpose: Number(e.target.value) })}
                  className="studio-slider w-20"
                />
                <span className={`w-9 text-right ${accentText}`}>
                  {params.transpose > 0 ? `+${params.transpose}` : params.transpose}st
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#94A3B8]">Fine</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={params.fineCents}
                  onChange={(e) => updateParams({ fineCents: Number(e.target.value) })}
                  className="studio-slider w-16"
                />
                <span className="text-[#E5E7EB] w-9 text-right">
                  {params.fineCents > 0 ? `+${params.fineCents}` : params.fineCents}c
                </span>
              </div>
            </div>
          </div>

          {/* Main 3-Column Synth Architecture: Oscillators/Engine | Filter & Modulation/XY | Amp ADSR & FX */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* COLUMN 1 (4 cols): Sound Source / Oscillators / Kontakt Library Engine */}
            <div className={`lg:col-span-4 rounded-lg border p-4 space-y-3.5 ${panelBg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${accentText}`}>
                  {isOmnisphere
                    ? 'Oscillator Layers A & B'
                    : isKontakt
                      ? 'Kontakt Instrument Engine'
                      : isFl3xOsc
                        ? '3x Osc Generator Bank'
                        : 'Synthesizer Oscillators & FM'}
                </span>
                <span className="text-[11px] font-mono-tabular text-[#94A3B8]">
                  Detune {params.detuneCents}c
                </span>
              </div>

              {/* Layer A / OSC 1 Waveform */}
              <div>
                <div className="text-[11px] text-[#CBD5E1] font-medium mb-1.5">
                  {isKontakt ? 'Primary Sample Timbre' : 'OSC 1 / Layer A Waveform'}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {WAVEFORMS.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => updateParams({ oscAWave: wf.id })}
                      className={`py-1.5 px-1 rounded border flex flex-col items-center gap-1 transition-colors ${
                        params.oscAWave === wf.id
                          ? 'bg-[#2563EB]/25 border-sky-400 text-white'
                          : 'bg-[#11151E] border-[#2A3242] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <svg viewBox="0 0 28 24" className="w-6 h-4">
                        <path d={wf.path} fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="text-[10px] font-semibold">{wf.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer B / OSC 2 Waveform */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#CBD5E1] font-medium mb-1.5">
                  <span>{isKontakt ? 'Harmonic Overtones / Felt' : 'OSC 2 / Layer B Waveform'}</span>
                  <div className="flex items-center gap-1">
                    {[-1, 0, 1].map((oct) => (
                      <button
                        key={oct}
                        type="button"
                        onClick={() => updateParams({ oscBOctave: oct })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular ${
                          params.oscBOctave === oct
                            ? 'bg-sky-500 text-white font-bold'
                            : 'bg-[#11151E] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        {oct > 0 ? `+${oct}` : oct} Oct
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {WAVEFORMS.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => updateParams({ oscBWave: wf.id })}
                      className={`py-1.5 px-1 rounded border flex flex-col items-center gap-1 transition-colors ${
                        params.oscBWave === wf.id
                          ? 'bg-[#2563EB]/25 border-sky-400 text-white'
                          : 'bg-[#11151E] border-[#2A3242] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <svg viewBox="0 0 28 24" className="w-6 h-4">
                        <path d={wf.path} fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="text-[10px] font-semibold">{wf.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer B Mix, Unison Detune, FM Depth */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1]">
                      {isKontakt ? 'Body / Overtones Mix' : 'OSC 2 Mix Level'}
                    </span>
                    <span className={`font-mono-tabular ${accentText}`}>
                      {Math.round(params.oscBMix * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={params.oscBMix}
                    onChange={(e) => updateParams({ oscBMix: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1]">
                      {isOmnisphere ? 'Harmonia Unison Detune' : 'Stereo Unison Detune'}
                    </span>
                    <span className={`font-mono-tabular ${accentText}`}>{params.detuneCents} cents</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={45}
                    step={1}
                    value={params.detuneCents}
                    onChange={(e) => updateParams({ detuneCents: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1]">
                      {isFlSytrus
                        ? 'Sytrus FM Operator Index'
                        : isKontakt
                          ? 'Tine / Hammer Attack Harmonics'
                          : 'FM / Bell Timbre Depth'}
                    </span>
                    <span className={`font-mono-tabular ${accentText}`}>{params.fmAmount}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={params.fmAmount}
                    onChange={(e) => updateParams({ fmAmount: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>

            {/* COLUMN 2 (4 cols): Resonant Filter + Interactive Orb / Sytrus XY Modulation Pad */}
            <div className={`lg:col-span-4 rounded-lg border p-4 space-y-3.5 ${panelBg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${accentText}`}>
                  {isOmnisphere
                    ? 'Omnisphere Orb & Filter'
                    : isFlSytrus
                      ? 'Sytrus X-Y Mod Pad & Filter'
                      : 'Tone Filter & Modulation'}
                </span>
                <span className="font-mono-tabular text-[11px] text-[#94A3B8]">
                  {params.cutoffHz >= 1000
                    ? `${(params.cutoffHz / 1000).toFixed(1)} kHz`
                    : `${Math.round(params.cutoffHz)} Hz`}
                </span>
              </div>

              {/* Interactive 2D X-Y Orb / Modulation Pad */}
              <div
                ref={orbRef}
                onMouseDown={(e) => {
                  setDraggingOrb(true);
                  updateOrbFromEvent(e);
                }}
                onMouseMove={(e) => {
                  if (draggingOrb) updateOrbFromEvent(e);
                }}
                onMouseUp={() => setDraggingOrb(false)}
                onMouseLeave={() => setDraggingOrb(false)}
                title="Drag to modulate Cutoff (X) and FM/Timbre (Y) in real time"
                className="h-32 rounded-lg bg-[#0B0F17] border border-[#2B3548] relative cursor-crosshair select-none overflow-hidden"
              >
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="border-r border-b border-[#192130]" />
                  ))}
                </div>
                <span className="absolute left-2 bottom-1.5 text-[9px] font-mono-tabular text-[#64748B] pointer-events-none">
                  X: Brightness ({params.xyX}%)
                </span>
                <span className="absolute right-2 top-1.5 text-[9px] font-mono-tabular text-[#64748B] pointer-events-none">
                  Y: Timbre ({params.xyY}%)
                </span>
                <div
                  className="w-5 h-5 rounded-full border-2 border-white shadow-lg absolute -translate-x-1/2 translate-y-1/2 pointer-events-none"
                  style={{
                    left: `${params.xyX}%`,
                    bottom: `${params.xyY}%`,
                    backgroundColor: activeInfo.accent,
                  }}
                />
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1]">Filter Cutoff</span>
                    <span className={`font-mono-tabular ${accentText}`}>
                      {params.cutoffHz >= 1000
                        ? `${(params.cutoffHz / 1000).toFixed(1)} kHz`
                        : `${Math.round(params.cutoffHz)} Hz`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={180}
                    max={16000}
                    step={40}
                    value={params.cutoffHz}
                    onChange={(e) => updateParams({ cutoffHz: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1]">Resonance (Q)</span>
                    <span className={`font-mono-tabular ${accentText}`}>{params.resonance.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={14}
                    step={0.1}
                    value={params.resonance}
                    onChange={(e) => updateParams({ resonance: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1]">Filter Envelope Depth</span>
                    <span className={`font-mono-tabular ${accentText}`}>{params.envDepth}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={params.envDepth}
                    onChange={(e) => updateParams({ envDepth: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>

            {/* COLUMN 3 (4 cols): Live ADSR Envelope + Built-In Shimmer & Drive FX */}
            <div className={`lg:col-span-4 rounded-lg border p-4 space-y-3.5 ${panelBg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${accentText}`}>Amp Envelope (ADSR) &amp; FX</span>
                <span className="font-mono-tabular text-[11px] text-[#94A3B8]">
                  A:{params.attackMs}ms · R:{params.releaseMs}ms
                </span>
              </div>

              {/* Live SVG ADSR Envelope Graph */}
              <div className="h-24 rounded-lg bg-[#0B0F17] border border-[#2B3548] p-2">
                <svg viewBox="0 0 240 88" className="w-full h-full">
                  <line x1="4" y1="82" x2="236" y2="82" stroke="#222C3D" strokeWidth="1" />
                  <path d={`${adsrPath} L4,82 Z`} fill={activeInfo.accent} fillOpacity="0.16" />
                  <path d={adsrPath} fill="none" stroke={activeInfo.accent} strokeWidth="2.4" />
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Attack', val: params.attackMs, disp: `${params.attackMs}ms`, min: 2, max: 600, step: 2, set: (v: number) => updateParams({ attackMs: v }) },
                  { label: 'Decay', val: params.decayMs, disp: `${params.decayMs}ms`, min: 40, max: 1200, step: 10, set: (v: number) => updateParams({ decayMs: v }) },
                  { label: 'Sustain', val: params.sustain, disp: `${Math.round(params.sustain * 100)}%`, min: 0.05, max: 1, step: 0.02, set: (v: number) => updateParams({ sustain: v }) },
                  { label: 'Release', val: params.releaseMs, disp: `${params.releaseMs}ms`, min: 40, max: 1800, step: 10, set: (v: number) => updateParams({ releaseMs: v }) },
                ].map((ctrl) => (
                  <div key={ctrl.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#CBD5E1]">{ctrl.label}</span>
                      <span className={`font-mono-tabular ${accentText}`}>{ctrl.disp}</span>
                    </div>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      step={ctrl.step}
                      value={ctrl.val}
                      onChange={(e) => ctrl.set(Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[#2A3242]">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#CBD5E1]">Analog Drive</span>
                    <span className="font-mono-tabular text-amber-400">{params.drive}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={params.drive}
                    onChange={(e) => updateParams({ drive: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#CBD5E1]">Octave Shimmer</span>
                    <span className="font-mono-tabular text-sky-400">{params.shimmer}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={params.shimmer}
                    onChange={(e) => updateParams({ shimmer: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Playable 2-Octave Hardware Keyboard */}
        <div className="px-4 py-3 bg-[#101319] border-t border-[#2A3140]">
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mb-2">
            <span>
              PLAY KEYS TO AUDITION LIVE SOUND DESIGN · {activeInfo.pluginName} ({activeInfo.patchName})
            </span>
            <span className="font-mono-tabular">C3 – C5</span>
          </div>
          <div className="flex gap-0.5 h-16 select-none">
            {PREVIEW_KEYS.map((pitch) => {
              const black = isBlackKey(pitch);
              const isDown = activeKey === pitch;
              return (
                <button
                  key={pitch}
                  type="button"
                  onMouseDown={() => handlePlayKey(pitch)}
                  className={`flex-1 rounded-b border transition-colors flex flex-col justify-end items-center pb-1 text-[9px] font-mono-tabular ${
                    isDown
                      ? 'bg-sky-500 border-sky-300 text-white font-bold'
                      : black
                        ? 'bg-[#191E28] border-[#2E3647] text-[#7C8698] hover:bg-[#2A3142] h-11'
                        : 'bg-[#E2E8F0] border-[#94A3B8] text-[#1E293B] hover:bg-white h-16'
                  }`}
                >
                  {pitch % 12 === 0 ? midiToNoteName(pitch) : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
