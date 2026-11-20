import React from 'react';
import type {
  EchoBoyDivision,
  FlChorusSettings,
  FlDelay3Settings,
  FlLimiterSettings,
  FlReeverb2Settings,
  FlSoftClipperSettings,
  GrossBeatPreset,
  GrossBeatSettings,
} from '../types/studio';

/* ============================================================================
   1. FRUITY REEVERB 2
   ============================================================================ */
interface FlReeverb2PanelProps {
  settings: FlReeverb2Settings;
  onChange: (next: FlReeverb2Settings) => void;
}

export const FlReeverb2Panel: React.FC<FlReeverb2PanelProps> = ({ settings, onChange }) => {
  const presets: { label: string; patch: Partial<FlReeverb2Settings> }[] = [
    { label: 'Cathedral', patch: { size: 92, decaySec: 4.8, preDelayMs: 35, lowCutHz: 160, highCutHz: 11000, wet: 48, dry: 85, stereoSep: 1.4 } },
    { label: 'Vocal Plate', patch: { size: 68, decaySec: 2.3, preDelayMs: 22, lowCutHz: 240, highCutHz: 12000, wet: 34, dry: 95, stereoSep: 1.2 } },
    { label: 'Drum Room', patch: { size: 38, decaySec: 0.95, preDelayMs: 8, lowCutHz: 120, highCutHz: 14000, wet: 24, dry: 100, stereoSep: 1.0 } },
    { label: 'Trap Dark Hall', patch: { size: 84, decaySec: 3.6, preDelayMs: 28, lowCutHz: 200, highCutHz: 6800, wet: 42, dry: 90, stereoSep: 1.5 } },
  ];

  const roomScale = 0.45 + (settings.size / 100) * 0.5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold text-orange-400 tracking-tight">Fruity Reeverb 2</div>
          <div className="text-xs text-[#9CA3AF]">
            FL Studio Algorithmic Stereo Room &amp; Cathedral Reverb
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ ...settings, ...p.patch, enabled: true })}
              className="px-2.5 py-1 rounded bg-[#272B35] hover:bg-orange-600/25 border border-[#3C4252] text-[11px] font-medium text-[#E5E7EB] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 bg-[#12161D] border border-[#2D3442] rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] mb-2">
            <span>ACOUSTIC SPACE</span>
            <span className="font-mono-tabular text-orange-300">
              {settings.decaySec.toFixed(1)}s · {settings.size}% Size
            </span>
          </div>
          <div className="h-32 bg-[#0A0D12] border border-[#232A36] rounded flex items-center justify-center relative overflow-hidden">
            <svg viewBox="0 0 220 120" className="w-full h-full">
              <defs>
                <radialGradient id="flVerbGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FB923C" stopOpacity={settings.enabled ? 0.35 : 0.08} />
                  <stop offset="100%" stopColor="#FB923C" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect x="0" y="0" width="220" height="120" fill="url(#flVerbGlow)" />
              <polygon
                points={`${110 - 65 * roomScale},${60 - 38 * roomScale} ${110 + 65 * roomScale},${60 - 38 * roomScale} ${110 + 82 * roomScale},${60 + 42 * roomScale} ${110 - 82 * roomScale},${60 + 42 * roomScale}`}
                fill="none"
                stroke={settings.enabled ? '#FB923C' : '#64748B'}
                strokeWidth="1.8"
              />
              <polygon
                points={`${110 - 38 * roomScale},${60 - 20 * roomScale} ${110 + 38 * roomScale},${60 - 20 * roomScale} ${110 + 48 * roomScale},${60 + 22 * roomScale} ${110 - 48 * roomScale},${60 + 22 * roomScale}`}
                fill="rgba(251,146,60,0.08)"
                stroke="#475569"
                strokeWidth="1"
              />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#CBD5E1]">DRY</span>
                <span className="font-mono-tabular text-emerald-400">{Math.round(settings.dry)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={settings.dry}
                onChange={(e) => onChange({ ...settings, dry: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#CBD5E1]">WET</span>
                <span className="font-mono-tabular text-orange-400">{Math.round(settings.wet)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={settings.wet}
                onChange={(e) => onChange({ ...settings, wet: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
          </div>
        </div>

        <div className="col-span-7 grid grid-cols-2 gap-3">
          {[
            { label: 'Room Size (SIZE)', val: settings.size, disp: `${settings.size}%`, min: 10, max: 100, step: 1, set: (v: number) => onChange({ ...settings, size: v }) },
            { label: 'Decay Time (DEC)', val: settings.decaySec, disp: `${settings.decaySec.toFixed(2)} s`, min: 0.3, max: 8.0, step: 0.1, set: (v: number) => onChange({ ...settings, decaySec: v }) },
            { label: 'Low Cut (L.CUT)', val: settings.lowCutHz, disp: `${Math.round(settings.lowCutHz)} Hz`, min: 20, max: 800, step: 10, set: (v: number) => onChange({ ...settings, lowCutHz: v }) },
            { label: 'High Cut (H.CUT)', val: settings.highCutHz, disp: `${(settings.highCutHz / 1000).toFixed(1)} kHz`, min: 1500, max: 18000, step: 200, set: (v: number) => onChange({ ...settings, highCutHz: v }) },
            { label: 'Pre-Delay (DEL)', val: settings.preDelayMs, disp: `${Math.round(settings.preDelayMs)} ms`, min: 0, max: 150, step: 2, set: (v: number) => onChange({ ...settings, preDelayMs: v }) },
            { label: 'Stereo Separation (SEP)', val: settings.stereoSep, disp: `${Math.round(settings.stereoSep * 100)}%`, min: 0, max: 2, step: 0.05, set: (v: number) => onChange({ ...settings, stereoSep: v }) },
          ].map((ctrl) => (
            <div key={ctrl.label} className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#CBD5E1] font-medium">{ctrl.label}</span>
                <span className="font-mono-tabular text-orange-400">{ctrl.disp}</span>
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
      </div>
    </div>
  );
};

/* ============================================================================
   2. FRUITY DELAY 3
   ============================================================================ */
interface FlDelay3PanelProps {
  bpm: number;
  settings: FlDelay3Settings;
  onChange: (next: FlDelay3Settings) => void;
}

const DELAY_DIVISIONS: { id: EchoBoyDivision; label: string; beats: number }[] = [
  { id: '1/16', label: '1/16', beats: 0.25 },
  { id: '1/8', label: '1/8', beats: 0.5 },
  { id: '1/8D', label: '1/8 Dotted', beats: 0.75 },
  { id: '1/4', label: '1/4', beats: 1.0 },
  { id: '1/4D', label: '1/4 Dotted', beats: 1.5 },
  { id: '1/2', label: '1/2', beats: 2.0 },
];

export const FlDelay3Panel: React.FC<FlDelay3PanelProps> = ({ bpm, settings, onChange }) => {
  const activeDiv = DELAY_DIVISIONS.find((d) => d.id === settings.division) || DELAY_DIVISIONS[2];
  const delayMs = Math.round((60 / bpm) * activeDiv.beats * 1000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold text-amber-400 tracking-tight">Fruity Delay 3</div>
          <div className="text-xs text-[#9CA3AF]">
            Tempo-Synced Analog &amp; Ping-Pong Echo with Feedback Tone Filter &amp; Tape Saturation
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...settings, pingPong: !settings.pingPong })}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
              settings.pingPong
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                : 'bg-[#1F232D] border-[#394050] text-[#9CA3AF]'
            }`}
          >
            Mode: {settings.pingPong ? 'Ping-Pong Stereo' : 'Mono / Stereo'}
          </button>
          <span className="font-mono-tabular text-xs text-sky-400 bg-[#12151C] border border-[#2C3342] rounded px-2.5 py-1">
            {delayMs} ms @ {bpm} BPM
          </span>
        </div>
      </div>

      <div className="bg-[#141820] border border-[#2B3240] rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs font-semibold text-[#D1D5DB]">TIME (Tempo Sync Division)</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DELAY_DIVISIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ ...settings, division: opt.id, enabled: true })}
              className={`px-2.5 py-1 rounded text-xs font-mono-tabular transition-colors ${
                settings.division === opt.id
                  ? 'bg-amber-500 text-[#111317] font-bold'
                  : 'bg-[#222733] text-[#CBD5E1] hover:bg-[#2E3546]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Wet Level (WET)', val: settings.wet, disp: `${Math.round(settings.wet)}%`, min: 0, max: 100, step: 1, set: (v: number) => onChange({ ...settings, wet: v }) },
          { label: 'Feedback (FBK)', val: settings.feedback, disp: `${Math.round(settings.feedback)}%`, min: 0, max: 90, step: 1, set: (v: number) => onChange({ ...settings, feedback: v }) },
          { label: 'Tone Cutoff (CUT)', val: settings.toneHz, disp: `${(settings.toneHz / 1000).toFixed(1)} kHz`, min: 600, max: 16000, step: 200, set: (v: number) => onChange({ ...settings, toneHz: v }) },
          { label: 'Analog Sat (SAT)', val: settings.saturation, disp: `${Math.round(settings.saturation)}%`, min: 0, max: 100, step: 1, set: (v: number) => onChange({ ...settings, saturation: v }) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#CBD5E1] font-medium">{ctrl.label}</span>
              <span className="font-mono-tabular text-amber-400">{ctrl.disp}</span>
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
    </div>
  );
};

/* ============================================================================
   3. GROSS BEAT (ICONIC FL STUDIO TIME & VOLUME GATE)
   ============================================================================ */
interface GrossBeatPanelProps {
  settings: GrossBeatSettings;
  onChange: (next: GrossBeatSettings) => void;
}

const GROSS_BEAT_PRESETS: { id: GrossBeatPreset; name: string; desc: string; bars: number[] }[] = [
  {
    id: 'half-speed',
    name: '1/2 Speed (Trap)',
    desc: 'Classic Metro Boomin / dark trap half-time pulse envelope',
    bars: [1, 0.88, 0.72, 0.56, 0.85, 0.7, 0.55, 0.42, 1, 0.88, 0.72, 0.56, 0.85, 0.7, 0.55, 0.42],
  },
  {
    id: 'sidechain',
    name: 'Sidechain Pump',
    desc: '4-on-the-floor EDM & house pumping ducking curve',
    bars: [0.12, 0.55, 0.9, 1, 0.12, 0.55, 0.9, 1, 0.12, 0.55, 0.9, 1, 0.12, 0.55, 0.9, 1],
  },
  {
    id: 'trance-gate',
    name: 'Trance Gate',
    desc: 'Rhythmic 16th-note chopper gate for Omnisphere pads & synths',
    bars: [1, 0.1, 1, 0.1, 1, 1, 0.1, 1, 1, 0.1, 1, 0.1, 0.9, 0.2, 1, 0.1],
  },
  {
    id: 'triplet-stutter',
    name: 'Triplet Stutter',
    desc: 'Rapid stutter chop built for trap hi-hat & synth drops',
    bars: [1, 0.18, 1, 0.18, 1, 0.18, 0.9, 0.15, 1, 0.18, 1, 0.18, 1, 0.18, 0.9, 0.15],
  },
  {
    id: 'vinyl-pump',
    name: 'Vinyl Pump',
    desc: 'Warm lo-fi vinyl dip & swell rhythmic breathing',
    bars: [0.3, 0.75, 1, 0.85, 0.3, 0.75, 1, 0.85, 0.3, 0.75, 1, 0.85, 0.3, 0.75, 1, 0.85],
  },
  {
    id: 'basic-chop',
    name: 'Basic Chop',
    desc: 'Syncopated hip-hop & bounce groove slicer',
    bars: [1, 0.8, 0.15, 1, 0.2, 1, 0.85, 0.15, 1, 0.2, 1, 0.9, 0.15, 1, 0.15, 0.75],
  },
];

export const GrossBeatPanel: React.FC<GrossBeatPanelProps> = ({ settings, onChange }) => {
  const currentPreset =
    GROSS_BEAT_PRESETS.find((p) => p.id === settings.preset) || GROSS_BEAT_PRESETS[0];
  const mixNorm = settings.mix / 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-emerald-400 tracking-tight">
            Gross Beat · Time &amp; Volume Manipulator
          </div>
          <div className="text-xs text-[#9CA3AF]">
            {currentPreset.desc}
          </div>
        </div>
        <span className="font-mono-tabular text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded px-2.5 py-1">
          Slot: {currentPreset.name}
        </span>
      </div>

      <div className="bg-[#0B1210] border border-emerald-500/35 rounded-lg p-3">
        <div className="flex items-center justify-between text-[10px] font-mono-tabular text-emerald-400/80 mb-2">
          <span>BEAT 1</span>
          <span>BEAT 2</span>
          <span>BEAT 3</span>
          <span>BEAT 4</span>
        </div>
        <div className="h-28 grid grid-cols-16 gap-1 items-end">
          {currentPreset.bars.map((v, idx) => {
            const effective = 1 - mixNorm + v * mixNorm;
            return (
              <div
                key={idx}
                className="h-full bg-[#121D19] border border-emerald-500/15 rounded-xs flex items-end overflow-hidden"
              >
                <div
                  className="w-full transition-all duration-150"
                  style={{
                    height: `${Math.round(effective * 100)}%`,
                    backgroundColor: settings.enabled
                      ? idx % 4 === 0
                        ? '#34D399'
                        : '#10B981'
                      : '#4B5563',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {GROSS_BEAT_PRESETS.map((preset) => {
          const active = settings.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...settings, preset: preset.id, enabled: true })}
              className={`px-3 py-2 rounded-md border text-left transition-colors ${
                active
                  ? 'bg-emerald-600/25 border-emerald-400 text-white'
                  : 'bg-[#171B22] border-[#2D3341] text-[#CBD5E1] hover:border-emerald-500/50'
              }`}
            >
              <div className="text-xs font-semibold">{preset.name}</div>
              <div className="text-[10px] text-[#94A3B8] truncate mt-0.5">{preset.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-[#CBD5E1] font-medium">Gross Beat Mix (Volume / Gate Depth)</span>
          <span className="font-mono-tabular text-emerald-400">{Math.round(settings.mix)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={settings.mix}
          onChange={(e) => onChange({ ...settings, mix: Number(e.target.value) })}
          className="studio-slider w-full"
        />
      </div>
    </div>
  );
};

/* ============================================================================
   4. FRUITY SOFT CLIPPER
   ============================================================================ */
interface FlSoftClipperPanelProps {
  settings: FlSoftClipperSettings;
  onChange: (next: FlSoftClipperSettings) => void;
}

export const FlSoftClipperPanel: React.FC<FlSoftClipperPanelProps> = ({ settings, onChange }) => {
  const buildCurve = () => {
    const pts: string[] = [];
    const threshNorm = Math.max(0.18, Math.min(0.95, 1 - (settings.threshold / 100) * 0.78));
    for (let i = 0; i <= 40; i++) {
      const xNorm = (i / 40) * 2 - 1;
      const absX = Math.abs(xNorm);
      let yNorm = xNorm;
      if (settings.enabled && absX > threshNorm) {
        const excess = absX - threshNorm;
        const clipped =
          threshNorm +
          (1 - threshNorm) * Math.tanh((excess / Math.max(0.08, 1 - threshNorm)) * 2.4);
        yNorm = Math.sign(xNorm) * clipped;
      }
      const x = (i / 40) * 240;
      const y = 70 - yNorm * 58;
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-orange-400 tracking-tight">Fruity Soft Clipper</div>
          <div className="text-xs text-[#9CA3AF]">
            Classic FL Studio 808 &amp; Master Bus Soft-Knee Saturation Clipper
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange({ enabled: true, threshold: 72, postGain: 2.5 })}
          className="px-2.5 py-1 rounded bg-orange-600/20 hover:bg-orange-600/35 border border-orange-500/45 text-[11px] font-semibold text-orange-200"
        >
          Trap 808 Punch Default
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4 items-center">
        <div className="col-span-2 bg-[#11141B] border border-[#2E3442] rounded-lg p-3">
          <div className="text-[10px] text-[#9CA3AF] mb-1">Soft Clipping Transfer Curve</div>
          <svg viewBox="0 0 240 140" className="w-full h-36">
            <line x1="0" y1="70" x2="240" y2="70" stroke="#252C3B" strokeWidth="1" />
            <line x1="120" y1="0" x2="120" y2="140" stroke="#252C3B" strokeWidth="1" />
            <line x1="0" y1="128" x2="240" y2="12" stroke="#1F2633" strokeWidth="1" strokeDasharray="3,3" />
            <path
              d={buildCurve()}
              fill="none"
              stroke={settings.enabled ? '#FB923C' : '#64748B'}
              strokeWidth="2.8"
            />
          </svg>
        </div>

        <div className="col-span-3 space-y-3">
          <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-semibold text-[#E5E7EB]">THRESH (Soft Clip Drive)</span>
              <span className="font-mono-tabular text-orange-400">
                {Math.round(settings.threshold)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.threshold}
              onChange={(e) => onChange({ ...settings, threshold: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
          <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-semibold text-[#E5E7EB]">POST (Output Gain Trim)</span>
              <span className="font-mono-tabular text-emerald-400">
                {settings.postGain >= 0 ? `+${settings.postGain.toFixed(1)}` : settings.postGain.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={-6}
              max={12}
              step={0.5}
              value={settings.postGain}
              onChange={(e) => onChange({ ...settings, postGain: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   5. FRUITY LIMITER
   ============================================================================ */
interface FlLimiterPanelProps {
  settings: FlLimiterSettings;
  onChange: (next: FlLimiterSettings) => void;
}

export const FlLimiterPanel: React.FC<FlLimiterPanelProps> = ({ settings, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-sky-400 tracking-tight">Fruity Limiter</div>
          <div className="text-xs text-[#9CA3AF]">
            Brickwall Peak Limiter &amp; Loudness Maximizer with Ceiling Control
          </div>
        </div>
        <div className="font-mono-tabular text-xs text-sky-300 bg-[#12161E] border border-sky-500/35 rounded px-2.5 py-1">
          CEIL: {settings.ceiling.toFixed(1)} dB · GAIN: +{settings.gain.toFixed(1)} dB
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'CEIL (Ceiling)', val: settings.ceiling, disp: `${settings.ceiling.toFixed(1)} dB`, min: -6, max: 0, step: 0.2, set: (v: number) => onChange({ ...settings, ceiling: v }) },
          { label: 'GAIN (Input Push)', val: settings.gain, disp: `+${settings.gain.toFixed(1)} dB`, min: 0, max: 18, step: 0.5, set: (v: number) => onChange({ ...settings, gain: v }) },
          { label: 'SAT (Saturation)', val: settings.sat, disp: `${Math.round(settings.sat)}%`, min: 0, max: 100, step: 1, set: (v: number) => onChange({ ...settings, sat: v }) },
          { label: 'ATT (Attack)', val: settings.attackMs, disp: `${settings.attackMs.toFixed(1)} ms`, min: 0.5, max: 40, step: 0.5, set: (v: number) => onChange({ ...settings, attackMs: v }) },
          { label: 'REL (Release)', val: settings.releaseMs, disp: `${Math.round(settings.releaseMs)} ms`, min: 20, max: 400, step: 5, set: (v: number) => onChange({ ...settings, releaseMs: v }) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#CBD5E1] font-medium">{ctrl.label}</span>
              <span className="font-mono-tabular text-sky-400">{ctrl.disp}</span>
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
    </div>
  );
};

/* ============================================================================
   6. FRUITY CHORUS
   ============================================================================ */
interface FlChorusPanelProps {
  settings: FlChorusSettings;
  onChange: (next: FlChorusSettings) => void;
}

export const FlChorusPanel: React.FC<FlChorusPanelProps> = ({ settings, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-bold text-violet-400 tracking-tight">Fruity Chorus</div>
          <div className="text-xs text-[#9CA3AF]">
            LFO-Modulated Stereo Detune &amp; Ensemble Thickener for Synths, Guitars &amp; Vocals
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { label: 'Wide Synth', patch: { depth: 55, rateHz: 0.65, mix: 45 } },
            { label: 'Dreamy Vocal', patch: { depth: 40, rateHz: 0.45, mix: 32 } },
            { label: '80s Ensemble', patch: { depth: 82, rateHz: 1.15, mix: 62 } },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ ...settings, ...p.patch, enabled: true })}
              className="px-2.5 py-1 rounded bg-[#272B35] hover:bg-violet-600/25 border border-[#3C4252] text-[11px] font-medium text-[#E5E7EB]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Mod Depth', val: settings.depth, disp: `${Math.round(settings.depth)}%`, min: 0, max: 100, step: 1, set: (v: number) => onChange({ ...settings, depth: v }) },
          { label: 'LFO Frequency', val: settings.rateHz, disp: `${settings.rateHz.toFixed(2)} Hz`, min: 0.1, max: 5.0, step: 0.05, set: (v: number) => onChange({ ...settings, rateHz: v }) },
          { label: 'Dry / Wet Mix', val: settings.mix, disp: `${Math.round(settings.mix)}%`, min: 0, max: 100, step: 1, set: (v: number) => onChange({ ...settings, mix: v }) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#CBD5E1] font-medium">{ctrl.label}</span>
              <span className="font-mono-tabular text-violet-400">{ctrl.disp}</span>
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
    </div>
  );
};
