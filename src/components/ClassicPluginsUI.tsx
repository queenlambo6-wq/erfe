import React, { useEffect, useState } from 'react';
import { audioEngine, type TrackPitchTelemetry } from '../audio/AudioEngine';
import {
  AUTOTUNE_PRESETS,
  AUTOTUNE_SCALE_INTERVALS,
  FET1176_PRESETS,
  LA2A_PRESETS,
  NEVE1073_PRESETS,
  NOTE_NAMES,
  PULTEC_PRESETS,
} from '../data/presets';
import type {
  AutoTuneScale,
  AutoTuneSettings,
  Fet1176Ratio,
  Fet1176Settings,
  La2aSettings,
  Neve1073Settings,
  PultecSettings,
} from '../types/studio';

/* ============================================================================
 * 1. ANTARES AUTO-TUNE PRO UI
 * ========================================================================== */
interface AutoTunePanelProps {
  trackId: string;
  settings: AutoTuneSettings;
  onChange: (next: AutoTuneSettings) => void;
}

export const AutoTunePanel: React.FC<AutoTunePanelProps> = ({ trackId, settings, onChange }) => {
  const [pitchInfo, setPitchInfo] = useState<TrackPitchTelemetry>({
    active: false,
    detectedHz: 0,
    detectedNote: '--',
    targetNote: '--',
    centsOffset: 0,
  });

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      setPitchInfo(audioEngine.getTrackPitchInfo(trackId));
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [trackId]);

  const needleDeg = pitchInfo.active ? (pitchInfo.centsOffset / 50) * 65 : 0;

  return (
    <div className="rounded-lg bg-gradient-to-b from-[#171B24] via-[#12161E] to-[#0E1117] border border-[#2C3648] p-4 space-y-4">
      {/* Antares Brand Bar + Presets */}
      <div className="flex items-center justify-between gap-3 border-b border-[#252E3F] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-white">AUTO-TUNE PRO</span>
            <span className="text-[11px] font-medium text-cyan-400">Real-Time Pitch &amp; Formant</span>
          </div>
          <div className="text-[11px] text-[#8B97AD]">
            Scale quantization, vocal throat formant shaping &amp; pitch correction
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {Object.entries(AUTOTUNE_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#1E2533] hover:bg-[#293347] border border-[#344056] text-[11px] text-[#E2E8F0] transition-colors whitespace-nowrap"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Cockpit: Key/Scale + Iconic Center Pitch Wheel + Classic Mode */}
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Left: Key, Scale & Transpose */}
        <div className="col-span-4 space-y-3 bg-[#10141C] border border-[#232C3C] rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#8B97AD] block mb-1">Key</label>
              <select
                value={settings.key}
                onChange={(e) => onChange({ ...settings, key: e.target.value })}
                className="w-full bg-[#1B2230] border border-[#323E54] rounded px-2 py-1.5 text-xs font-semibold text-cyan-300 outline-none cursor-pointer"
              >
                {NOTE_NAMES.map((k) => (
                  <option key={k} value={k} className="bg-[#141923]">
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#8B97AD] block mb-1">Scale</label>
              <select
                value={settings.scale}
                onChange={(e) => onChange({ ...settings, scale: e.target.value as AutoTuneScale })}
                className="w-full bg-[#1B2230] border border-[#323E54] rounded px-2 py-1.5 text-xs font-semibold text-white outline-none cursor-pointer"
              >
                {(Object.keys(AUTOTUNE_SCALE_INTERVALS) as AutoTuneScale[]).map((sc) => (
                  <option key={sc} value={sc} className="bg-[#141923]">
                    {sc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#CBD5E1]">Transpose</span>
              <span className="font-mono-tabular text-cyan-400">
                {settings.transpose > 0 ? `+${settings.transpose}` : settings.transpose} st
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={settings.transpose}
              onChange={(e) => onChange({ ...settings, transpose: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...settings, classicMode: !settings.classicMode })}
            className={`w-full py-1.5 px-3 rounded text-xs font-semibold border transition-colors ${
              settings.classicMode
                ? 'bg-amber-500/20 border-amber-400/70 text-amber-300'
                : 'bg-[#19202D] border-[#2F3A4E] text-[#94A3B8] hover:text-white'
            }`}
          >
            {settings.classicMode ? 'Classic Auto-Tune 5 Mode: ON' : 'Classic Auto-Tune 5 Mode: OFF'}
          </button>
        </div>

        {/* Center: Iconic Antares Live Pitch Correction Wheel */}
        <div className="col-span-4 flex flex-col items-center justify-center bg-[#0B0E14] border border-[#243044] rounded-lg p-3">
          <div className="text-[10px] font-medium text-[#7C8BA3] mb-1">Pitch Correction Meter</div>
          <svg viewBox="0 0 180 108" className="w-44 h-28">
            {/* Outer Dial Arc */}
            <path
              d="M 22 92 A 68 68 0 0 1 158 92"
              fill="none"
              stroke="#1E293B"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 55 34 A 68 68 0 0 1 125 34"
              fill="none"
              stroke={settings.enabled ? '#06B6D4' : '#475569'}
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.45"
            />
            {/* Tick labels */}
            <text x="16" y="104" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">-50</text>
            <text x="86" y="16" fill="#22D3EE" fontSize="9" fontFamily="JetBrains Mono">0</text>
            <text x="148" y="104" fill="#64748B" fontSize="9" fontFamily="JetBrains Mono">+50</text>

            {/* Rotating Needle */}
            <g transform={`rotate(${needleDeg}, 90, 92)`}>
              <line
                x1="90"
                y1="92"
                x2="90"
                y2="30"
                stroke={settings.enabled ? '#22D3EE' : '#64748B'}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="90" cy="92" r="5" fill="#E2E8F0" />
            </g>
          </svg>

          <div className="flex items-center justify-center gap-4 w-full border-t border-[#1E2636] pt-2 mt-1">
            <div className="text-center">
              <div className="text-[9px] text-[#64748B]">Input</div>
              <div className="font-mono-tabular text-sm font-bold text-[#CBD5E1]">
                {pitchInfo.detectedNote}
              </div>
            </div>
            <div className="text-cyan-500 text-xs">→</div>
            <div className="text-center">
              <div className="text-[9px] text-[#64748B]">Target</div>
              <div className="font-mono-tabular text-sm font-bold text-cyan-400">
                {settings.enabled ? pitchInfo.targetNote : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Retune Speed, Flex-Tune, Humanize, Throat Formant */}
        <div className="col-span-4 space-y-2.5 bg-[#10141C] border border-[#232C3C] rounded-lg p-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-semibold text-white">Retune Speed</span>
              <span className="font-mono-tabular text-cyan-400">
                {settings.retuneSpeed === 0 ? '0 ms (Hard)' : `${settings.retuneSpeed} ms`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={400}
              step={2}
              value={settings.retuneSpeed}
              onChange={(e) => onChange({ ...settings, retuneSpeed: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#CBD5E1]">Flex-Tune</span>
              <span className="font-mono-tabular text-[#E2E8F0]">{settings.flexTune}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.flexTune}
              onChange={(e) => onChange({ ...settings, flexTune: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#CBD5E1]">Humanize</span>
              <span className="font-mono-tabular text-[#E2E8F0]">{settings.humanize}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.humanize}
              onChange={(e) => onChange({ ...settings, humanize: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#CBD5E1]">Throat / Formant</span>
              <span className="font-mono-tabular text-amber-400">
                {settings.formant > 0 ? `+${settings.formant}` : settings.formant}
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={settings.formant}
              onChange={(e) => onChange({ ...settings, formant: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. UAD TELETRONIX LA-2A OPTICAL TUBE LEVELER
 * ========================================================================== */
interface La2aPanelProps {
  trackId: string;
  settings: La2aSettings;
  onChange: (next: La2aSettings) => void;
}

export const La2aPanel: React.FC<La2aPanelProps> = ({ trackId, settings, onChange }) => {
  const [gr, setGr] = useState(0);

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      setGr(audioEngine.getTrackHardwareMeters(trackId).la2aGr);
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [trackId]);

  // VU needle rests on the right (0 dB) and swings left with Gain Reduction
  const needleAngle = Math.max(-44, 38 - (gr / 16) * 80);

  return (
    <div className="rounded-lg bg-gradient-to-b from-[#C7CCD4] via-[#B4BAC4] to-[#9DA4B0] border-2 border-[#6B7280] text-[#181B20] p-5 shadow-inner space-y-4">
      {/* Top Plate Header */}
      <div className="flex items-center justify-between border-b border-[#7E8694] pb-3">
        <div>
          <div className="text-base font-extrabold tracking-wide text-[#111317]">
            TELETRONIX LA-2A
          </div>
          <div className="text-[11px] font-semibold text-[#374151]">
            Leveling Amplifier · Electro-Optical Tube Compressor
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {Object.entries(LA2A_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#232730] hover:bg-[#111317] text-[#F3F4F6] text-[11px] font-medium transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 items-center">
        {/* Mode Switch + Jewel Lamp */}
        <div className="col-span-3 flex flex-col items-center gap-3 bg-[#AEB5C0]/60 border border-[#8A92A0] rounded-lg p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#1F2937]">Mode</div>
          <div className="flex flex-col gap-1.5 w-full">
            <button
              type="button"
              onClick={() => onChange({ ...settings, mode: 'compress' })}
              className={`py-1.5 rounded text-xs font-bold border transition-colors ${
                settings.mode === 'compress'
                  ? 'bg-[#181B20] text-amber-300 border-black'
                  : 'bg-[#D6DAE0] text-[#374151] border-[#8A92A0]'
              }`}
            >
              Compress
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...settings, mode: 'limit' })}
              className={`py-1.5 rounded text-xs font-bold border transition-colors ${
                settings.mode === 'limit'
                  ? 'bg-[#181B20] text-red-400 border-black'
                  : 'bg-[#D6DAE0] text-[#374151] border-[#8A92A0]'
              }`}
            >
              Limit
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span
              className={`w-3 h-3 rounded-full border border-black/50 ${
                settings.enabled ? 'bg-red-500 shadow-[0_0_8px_#EF4444]' : 'bg-[#4B5563]'
              }`}
            />
            <span className="text-[10px] font-bold text-[#1F2937]">
              {settings.enabled ? 'TUBE ON' : 'BYPASS'}
            </span>
          </div>
        </div>

        {/* Center Warm Cream Analog VU Meter */}
        <div className="col-span-5 bg-[#1D1F24] p-2.5 rounded-lg border-2 border-[#4B5563] shadow-inner">
          <div className="rounded bg-gradient-to-b from-[#F9ECCB] via-[#F4DFAC] to-[#E6C77E] p-2 relative overflow-hidden">
            <svg viewBox="0 0 200 105" className="w-full h-28">
              <path d="M 24 84 A 86 86 0 0 1 176 84" fill="none" stroke="#1F2937" strokeWidth="2" />
              <path d="M 142 36 A 86 86 0 0 1 176 84" fill="none" stroke="#B91C1C" strokeWidth="3.5" />
              <text x="20" y="64" fill="#1F2937" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">-20</text>
              <text x="54" y="38" fill="#1F2937" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">-10</text>
              <text x="94" y="28" fill="#1F2937" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">-5</text>
              <text x="132" y="38" fill="#B91C1C" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">0</text>
              <text x="86" y="66" fill="#4B5563" fontSize="11" fontWeight="800">VU · GR</text>
              <g transform={`rotate(${needleAngle}, 100, 102)`}>
                <line x1="100" y1="102" x2="100" y2="20" stroke="#111317" strokeWidth="2.2" />
              </g>
              <circle cx="100" cy="102" r="8" fill="#181B20" />
            </svg>
            <div className="text-center font-mono-tabular text-[11px] font-bold text-[#78350F]">
              Gain Reduction: -{gr.toFixed(1)} dB
            </div>
          </div>
        </div>

        {/* Right: Classic Dual Knobs (Peak Reduction & Gain + Tube Warmth) */}
        <div className="col-span-4 space-y-3 bg-[#1E222A] text-[#F3F4F6] rounded-lg p-3.5 border border-[#4B5563]">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold">Peak Reduction</span>
              <span className="font-mono-tabular text-amber-400">{settings.peakReduction}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.peakReduction}
              onChange={(e) => onChange({ ...settings, peakReduction: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold">Output Gain</span>
              <span className="font-mono-tabular text-sky-400">{settings.gain}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.gain}
              onChange={(e) => onChange({ ...settings, gain: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#CBD5E1]">Tube Warmth (12AX7)</span>
              <span className="font-mono-tabular text-amber-300">{settings.tubeWarmth}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={2}
              value={settings.tubeWarmth}
              onChange={(e) => onChange({ ...settings, tubeWarmth: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. UAD 1176LN REV E FET LIMITING AMPLIFIER
 * ========================================================================== */
interface Fet1176PanelProps {
  trackId: string;
  settings: Fet1176Settings;
  onChange: (next: Fet1176Settings) => void;
}

export const Fet1176Panel: React.FC<Fet1176PanelProps> = ({ trackId, settings, onChange }) => {
  const [gr, setGr] = useState(0);

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      setGr(audioEngine.getTrackHardwareMeters(trackId).fet1176Gr);
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [trackId]);

  const ratios: { val: Fet1176Ratio; label: string }[] = [
    { val: 4, label: '4:1' },
    { val: 8, label: '8:1' },
    { val: 12, label: '12:1' },
    { val: 20, label: '20:1' },
    { val: 'all', label: 'ALL' },
  ];

  const needleAngle = Math.max(-44, 38 - (gr / 18) * 80);

  return (
    <div className="rounded-lg bg-gradient-to-b from-[#1D2025] via-[#14161A] to-[#0E1013] border-2 border-[#3C424F] p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#2C313C] pb-3">
        <div>
          <div className="text-base font-extrabold tracking-wider text-white">
            1176LN <span className="text-sky-400 font-semibold text-xs">REV E · BLACKFACE</span>
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            Ultra-Fast FET Limiting Amplifier · Classic All-Buttons-In British Mode
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {Object.entries(FET1176_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#272B34] hover:bg-[#343A47] border border-[#3E4554] text-[11px] text-[#E5E7EB]"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Input / Output / Attack / Release */}
        <div className="col-span-5 grid grid-cols-2 gap-3">
          <div className="bg-[#1B1E25] border border-[#323744] rounded p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-bold text-white">INPUT</span>
              <span className="font-mono-tabular text-amber-400">{settings.input}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.input}
              onChange={(e) => onChange({ ...settings, input: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div className="bg-[#1B1E25] border border-[#323744] rounded p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-bold text-white">OUTPUT</span>
              <span className="font-mono-tabular text-sky-400">{settings.output}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.output}
              onChange={(e) => onChange({ ...settings, output: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div className="bg-[#1B1E25] border border-[#323744] rounded p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-bold text-[#D1D5DB]">ATTACK</span>
              <span className="font-mono-tabular text-[#E5E7EB]">{settings.attack} / 7</span>
            </div>
            <input
              type="range"
              min={1}
              max={7}
              step={1}
              value={settings.attack}
              onChange={(e) => onChange({ ...settings, attack: Number(e.target.value) })}
              className="studio-slider w-full"
            />
            <div className="flex justify-between text-[9px] text-[#6B7280] mt-1">
              <span>Slow</span>
              <span>Fast 20µs</span>
            </div>
          </div>

          <div className="bg-[#1B1E25] border border-[#323744] rounded p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-bold text-[#D1D5DB]">RELEASE</span>
              <span className="font-mono-tabular text-[#E5E7EB]">{settings.release} / 7</span>
            </div>
            <input
              type="range"
              min={1}
              max={7}
              step={1}
              value={settings.release}
              onChange={(e) => onChange({ ...settings, release: Number(e.target.value) })}
              className="studio-slider w-full"
            />
            <div className="flex justify-between text-[9px] text-[#6B7280] mt-1">
              <span>Slow</span>
              <span>Fast 50ms</span>
            </div>
          </div>
        </div>

        {/* Iconic Vertical/Row Ratio Push-Buttons */}
        <div className="col-span-3 bg-[#1B1E25] border border-[#323744] rounded p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2 text-center">
            Ratio Select
          </div>
          <div className="space-y-1.5">
            {ratios.map((r) => {
              const active = settings.ratio === r.val;
              return (
                <button
                  key={String(r.val)}
                  type="button"
                  onClick={() => onChange({ ...settings, ratio: r.val })}
                  className={`w-full py-1 rounded text-xs font-mono-tabular font-bold border transition-all ${
                    active
                      ? r.val === 'all'
                        ? 'bg-red-600 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.45)]'
                        : 'bg-amber-500 border-amber-300 text-[#111317]'
                      : 'bg-[#101216] border-[#303542] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {r.label} {r.val === 'all' ? '· SLAM' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Glowing Amber VU Meter */}
        <div className="col-span-4 bg-[#0B0D10] p-2.5 rounded-lg border border-[#3E4554]">
          <div className="rounded bg-gradient-to-b from-[#FCE6B1] via-[#F2CE7E] to-[#DDA949] p-2">
            <svg viewBox="0 0 180 98" className="w-full h-24">
              <path d="M 18 78 A 78 78 0 0 1 162 78" fill="none" stroke="#18181B" strokeWidth="2" />
              <path d="M 130 34 A 78 78 0 0 1 162 78" fill="none" stroke="#DC2626" strokeWidth="3.5" />
              <text x="18" y="60" fill="#18181B" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">-20</text>
              <text x="80" y="28" fill="#18181B" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">-7</text>
              <text x="128" y="38" fill="#DC2626" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">0</text>
              <text x="72" y="62" fill="#451A03" fontSize="10" fontWeight="800">FET GR</text>
              <g transform={`rotate(${needleAngle}, 90, 96)`}>
                <line x1="90" y1="96" x2="90" y2="18" stroke="#111317" strokeWidth="2" />
              </g>
              <circle cx="90" cy="96" r="7" fill="#111317" />
            </svg>
            <div className="text-center font-mono-tabular text-[11px] font-bold text-[#78350F]">
              GR: -{gr.toFixed(1)} dB
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. UAD PULTEC EQP-1A PROGRAM EQUALIZER
 * ========================================================================== */
interface PultecPanelProps {
  settings: PultecSettings;
  onChange: (next: PultecSettings) => void;
}

export const PultecPanel: React.FC<PultecPanelProps> = ({ settings, onChange }) => {
  return (
    <div className="rounded-lg bg-gradient-to-b from-[#2E425C] via-[#24354B] to-[#1C2A3C] border-2 border-[#4B6485] p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#3D5574] pb-3">
        <div>
          <div className="text-base font-extrabold tracking-wide text-white">
            PULTEC EQP-1A
          </div>
          <div className="text-[11px] text-[#BFD4EE]">
            Passive Tube Program Equalizer · Simultaneous Low Boost &amp; Attenuation
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {Object.entries(PULTEC_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#152130] hover:bg-[#0F1824] border border-[#486387] text-[11px] text-[#E2EEFC]"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Low Frequency Section (Pultec Low-End Trick) */}
        <div className="bg-[#182536] border border-[#3B5270] rounded-lg p-3.5 space-y-3">
          <div className="text-xs font-bold text-amber-300 border-b border-[#2D4059] pb-1.5">
            LOW FREQUENCY
          </div>
          <div className="flex items-center gap-1">
            {([20, 30, 60, 100] as const).map((hz) => (
              <button
                key={hz}
                type="button"
                onClick={() => onChange({ ...settings, lowFreq: hz })}
                className={`flex-1 py-1 rounded text-[11px] font-mono-tabular font-semibold ${
                  settings.lowFreq === hz
                    ? 'bg-amber-400 text-[#111317]'
                    : 'bg-[#101A27] text-[#9BB4D3] hover:text-white'
                }`}
              >
                {hz}
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#E2EEFC] font-medium">Boost</span>
              <span className="font-mono-tabular text-amber-300">{settings.lowBoost.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={settings.lowBoost}
              onChange={(e) => onChange({ ...settings, lowBoost: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#E2EEFC] font-medium">Atten</span>
              <span className="font-mono-tabular text-sky-300">{settings.lowAtten.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={settings.lowAtten}
              onChange={(e) => onChange({ ...settings, lowAtten: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>

        {/* High Frequency Boost & Bandwidth */}
        <div className="bg-[#182536] border border-[#3B5270] rounded-lg p-3.5 space-y-3">
          <div className="text-xs font-bold text-sky-300 border-b border-[#2D4059] pb-1.5">
            HIGH BOOST
          </div>
          <select
            value={settings.highFreq}
            onChange={(e) =>
              onChange({ ...settings, highFreq: Number(e.target.value) as PultecSettings['highFreq'] })
            }
            className="w-full bg-[#101A27] border border-[#3B5270] rounded px-2 py-1 text-xs font-mono-tabular text-white outline-none"
          >
            {[3000, 4000, 5000, 8000, 10000, 12000, 16000].map((hz) => (
              <option key={hz} value={hz} className="bg-[#142030]">
                {hz / 1000} kHz
              </option>
            ))}
          </select>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#E2EEFC] font-medium">Boost</span>
              <span className="font-mono-tabular text-sky-300">{settings.highBoost.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={settings.highBoost}
              onChange={(e) => onChange({ ...settings, highBoost: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#E2EEFC] font-medium">Bandwidth</span>
              <span className="font-mono-tabular text-[#BFD4EE]">{settings.bandwidth}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={settings.bandwidth}
              onChange={(e) => onChange({ ...settings, bandwidth: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>

        {/* High Attenuation Section */}
        <div className="bg-[#182536] border border-[#3B5270] rounded-lg p-3.5 space-y-3">
          <div className="text-xs font-bold text-emerald-300 border-b border-[#2D4059] pb-1.5">
            HIGH ATTEN SEL
          </div>
          <div className="flex items-center gap-1">
            {([5000, 10000, 20000] as const).map((hz) => (
              <button
                key={hz}
                type="button"
                onClick={() => onChange({ ...settings, highAttenFreq: hz })}
                className={`flex-1 py-1 rounded text-[11px] font-mono-tabular font-semibold ${
                  settings.highAttenFreq === hz
                    ? 'bg-emerald-400 text-[#111317]'
                    : 'bg-[#101A27] text-[#9BB4D3] hover:text-white'
                }`}
              >
                {hz / 1000}k
              </button>
            ))}
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#E2EEFC] font-medium">Attenuation</span>
              <span className="font-mono-tabular text-emerald-300">{settings.highAtten.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={settings.highAtten}
              onChange={(e) => onChange({ ...settings, highAtten: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div className="text-[10px] text-[#9BB4D3] leading-relaxed pt-1">
            Tip: Boost and Atten the same low frequency together for the iconic tight Pultec sub-punch.
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. UAD NEVE 1073 PREAMP & 3-BAND INDUCTOR EQ
 * ========================================================================== */
interface Neve1073PanelProps {
  settings: Neve1073Settings;
  onChange: (next: Neve1073Settings) => void;
}

export const Neve1073Panel: React.FC<Neve1073PanelProps> = ({ settings, onChange }) => {
  return (
    <div className="rounded-lg bg-gradient-to-b from-[#455568] via-[#3A4858] to-[#2F3B49] border-2 border-[#64748B] p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#526378] pb-3">
        <div>
          <div className="text-base font-extrabold tracking-wide text-white">
            NEVE 1073 <span className="text-red-300 text-xs font-semibold">CLASS-A PREAMP &amp; EQ</span>
          </div>
          <div className="text-[11px] text-[#CBD5E1]">
            Marinair Transformer Saturation · 12 kHz Silky Air Shelf · Stepped Inductor EQ
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {Object.entries(NEVE1073_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#232C37] hover:bg-[#182029] border border-[#5B6D82] text-[11px] text-white"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3.5">
        {/* Iconic Maroon Preamp Drive & HPF */}
        <div className="col-span-4 bg-[#26313E] border border-[#4D5E73] rounded-lg p-3.5 space-y-3">
          <div className="text-xs font-bold text-red-300 border-b border-[#3D4C5E] pb-1">
            MIC / LINE PREAMP
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-white">Preamp Drive</span>
              <span className="font-mono-tabular text-red-300">+{settings.preampDrive} dB</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={2}
              value={settings.preampDrive}
              onChange={(e) => onChange({ ...settings, preampDrive: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="text-[11px] text-[#CBD5E1] mb-1">High-Pass Filter (Hz)</div>
            <div className="grid grid-cols-5 gap-1">
              {([0, 50, 80, 160, 300] as const).map((hz) => (
                <button
                  key={hz}
                  type="button"
                  onClick={() => onChange({ ...settings, hpFreq: hz })}
                  className={`py-1 rounded text-[10px] font-mono-tabular font-semibold ${
                    settings.hpFreq === hz
                      ? 'bg-[#991B1B] text-white'
                      : 'bg-[#19222C] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {hz === 0 ? 'OFF' : hz}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#CBD5E1]">Output Trim</span>
              <span className="font-mono-tabular text-sky-300">
                {settings.outputTrim >= 0 ? `+${settings.outputTrim}` : settings.outputTrim} dB
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={settings.outputTrim}
              onChange={(e) => onChange({ ...settings, outputTrim: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>

        {/* 3-Band British Inductor EQ */}
        <div className="col-span-8 grid grid-cols-3 gap-3">
          {/* Low Shelf */}
          <div className="bg-[#26313E] border border-[#4D5E73] rounded-lg p-3 space-y-2.5">
            <div className="text-xs font-bold text-amber-300">LOW SHELF</div>
            <div className="grid grid-cols-2 gap-1">
              {([35, 60, 110, 220] as const).map((hz) => (
                <button
                  key={hz}
                  type="button"
                  onClick={() => onChange({ ...settings, lowFreq: hz })}
                  className={`py-1 rounded text-[10px] font-mono-tabular ${
                    settings.lowFreq === hz
                      ? 'bg-amber-400 text-[#111317] font-bold'
                      : 'bg-[#19222C] text-[#CBD5E1]'
                  }`}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#CBD5E1]">Gain</span>
                <span className="font-mono-tabular text-amber-300">
                  {settings.lowGain >= 0 ? `+${settings.lowGain.toFixed(1)}` : settings.lowGain.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-16}
                max={16}
                step={0.5}
                value={settings.lowGain}
                onChange={(e) => onChange({ ...settings, lowGain: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
          </div>

          {/* Mid Bell */}
          <div className="bg-[#26313E] border border-[#4D5E73] rounded-lg p-3 space-y-2.5">
            <div className="text-xs font-bold text-emerald-300">MID BAND</div>
            <select
              value={settings.midFreq}
              onChange={(e) =>
                onChange({ ...settings, midFreq: Number(e.target.value) as Neve1073Settings['midFreq'] })
              }
              className="w-full bg-[#19222C] border border-[#4D5E73] rounded px-2 py-1 text-xs font-mono-tabular text-white outline-none"
            >
              {[360, 700, 1600, 3200, 4800, 7200].map((hz) => (
                <option key={hz} value={hz} className="bg-[#1C2530]">
                  {hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`}
                </option>
              ))}
            </select>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#CBD5E1]">Gain</span>
                <span className="font-mono-tabular text-emerald-300">
                  {settings.midGain >= 0 ? `+${settings.midGain.toFixed(1)}` : settings.midGain.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-18}
                max={18}
                step={0.5}
                value={settings.midGain}
                onChange={(e) => onChange({ ...settings, midGain: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
          </div>

          {/* 12 kHz Signature High Shelf */}
          <div className="bg-[#26313E] border border-[#4D5E73] rounded-lg p-3 space-y-2.5">
            <div className="text-xs font-bold text-sky-300">HIGH · 12 kHz</div>
            <div className="py-1 px-2 rounded bg-[#19222C] text-[10px] font-mono-tabular text-sky-300 text-center">
              Fixed 12.0 kHz Air
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#CBD5E1]">Air Boost</span>
                <span className="font-mono-tabular text-sky-300">
                  {settings.highGain >= 0 ? `+${settings.highGain.toFixed(1)}` : settings.highGain.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-16}
                max={16}
                step={0.5}
                value={settings.highGain}
                onChange={(e) => onChange({ ...settings, highGain: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
