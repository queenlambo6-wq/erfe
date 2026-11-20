import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import {
  ECHOBOY_PRESETS,
  FAB_PROQ_PRESETS,
  FAB_PROR_PRESETS,
  FL_CONVOLVER_PRESETS,
  FL_EQ2_PRESETS,
  FL_SOUNDGOODIZER_PRESETS,
} from '../data/presets';
import type {
  ConvolverImpulseType,
  EchoBoyDivision,
  EchoBoySettings,
  EchoBoyStyle,
  EqBandShape,
  FabProQSettings,
  FabProRSettings,
  FlConvolverSettings,
  FlEq2Settings,
  FlSoundgoodizerSettings,
  ParametricBand,
  SoundgoodizerMode,
} from '../types/studio';

const FL_BAND_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#A855F7'];
const FL_BAND_NAMES = ['Sub', 'Bass', 'Low Mid', 'Mid', 'High Mid', 'Presence', 'Treble'];

const FAB_BAND_COLORS = ['#F59E0B', '#FBBF24', '#38BDF8', '#34D399', '#F472B6', '#A78BFA'];

function freqToX(freq: number, width: number): number {
  const clamped = Math.max(20, Math.min(20000, freq));
  return (Math.log10(clamped / 20) / 3) * width;
}

function xToFreq(x: number, width: number): number {
  const norm = Math.max(0, Math.min(1, x / Math.max(1, width)));
  return Math.round(20 * Math.pow(1000, norm));
}

function dbToY(db: number, height: number, maxDb = 18): number {
  const pad = 16;
  const usable = height / 2 - pad;
  return height / 2 - (Math.max(-maxDb, Math.min(maxDb, db)) / maxDb) * usable;
}

function yToDb(y: number, height: number, maxDb = 18): number {
  const pad = 16;
  const usable = Math.max(1, height / 2 - pad);
  const db = ((height / 2 - y) / usable) * maxDb;
  return Math.max(-maxDb, Math.min(maxDb, Math.round(db * 2) / 2));
}

function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz` : `${Math.round(hz)} Hz`;
}

function evaluateBandResponseDb(freq: number, band: ParametricBand): number {
  if (!band.enabled) return 0;
  const f0 = Math.max(20, band.freq);
  if (band.type === 'highpass') {
    if (freq >= f0 * 1.6) return 0;
    const ratio = freq / f0;
    return -Math.min(24, Math.pow(Math.max(0, 1 - ratio * 0.72), 1.7) * 26);
  }
  if (band.type === 'lowpass') {
    if (freq <= f0 * 0.65) return 0;
    const ratio = f0 / freq;
    return -Math.min(24, Math.pow(Math.max(0, 1 - ratio * 0.72), 1.7) * 26);
  }
  if (band.type === 'lowshelf') {
    const factor = 1 / (1 + Math.pow(freq / f0, 2));
    return band.gain * factor;
  }
  if (band.type === 'highshelf') {
    const factor = 1 / (1 + Math.pow(f0 / freq, 2));
    return band.gain * factor;
  }
  if (band.type === 'notch') {
    const oct = Math.log2(freq / f0);
    return -18 * Math.exp(-Math.pow(oct * Math.max(1.5, band.q * 2.2), 2));
  }
  // Peaking bell
  const oct = Math.log2(freq / f0);
  const bell = Math.exp(-Math.pow(oct * Math.max(0.35, band.q) * 1.45, 2));
  return band.gain * bell;
}

function evaluateTotalBandsDb(freq: number, bands: ParametricBand[], enabled: boolean): number {
  if (!enabled) return 0;
  let sum = 0;
  for (const b of bands) {
    sum += evaluateBandResponseDb(freq, b);
  }
  return Math.max(-18, Math.min(18, sum));
}

const BAND_TYPE_OPTIONS: { value: EqBandShape; label: string }[] = [
  { value: 'peaking', label: 'Peaking' },
  { value: 'lowshelf', label: 'Low Shelf' },
  { value: 'highshelf', label: 'High Shelf' },
  { value: 'highpass', label: 'Low Cut (HP)' },
  { value: 'lowpass', label: 'High Cut (LP)' },
  { value: 'notch', label: 'Notch' },
];

// =============================================================================
// 1. FL STUDIO FRUITY PARAMETRIC EQ 2 (7-BAND + THERMAL HEATMAP + DRAG TOKENS)
// =============================================================================
export const FlEq2Panel: React.FC<{
  trackId: string;
  settings: FlEq2Settings;
  onChange: (next: FlEq2Settings) => void;
}> = ({ trackId, settings, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBandId, setSelectedBandId] = useState<number>(settings.bands[3]?.id ?? 4);
  const draggingBandRef = useRef<number | null>(null);

  const selectedBand = settings.bands.find((b) => b.id === selectedBandId) || settings.bands[0];

  const updateBand = (id: number, patch: Partial<ParametricBand>) => {
    onChange({
      ...settings,
      bands: settings.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // FL Parametric EQ 2 dark charcoal-olive background
          ctx.fillStyle = '#14171A';
          ctx.fillRect(0, 0, w, h);

          // Live Vertical Thermal Heatmap (FL Signature)
          if (settings.heatmap) {
            const fft = audioEngine.getTrackFrequencyData(trackId);
            if (fft.length > 0) {
              const cols = 96;
              const colW = w / cols;
              for (let c = 0; c < cols; c++) {
                const t = c / cols;
                const freq = 20 * Math.pow(1000, t);
                const bin = Math.min(fft.length - 1, Math.floor((freq / 22050) * fft.length));
                const mag = fft[bin] / 255;
                if (mag > 0.04) {
                  const alpha = Math.min(0.72, Math.pow(mag, 1.25) * 0.85);
                  const grad = ctx.createLinearGradient(0, 0, 0, h);
                  grad.addColorStop(0, `rgba(190, 24, 93, ${alpha * 0.45})`);
                  grad.addColorStop(0.45, `rgba(249, 115, 22, ${alpha * 0.85})`);
                  grad.addColorStop(0.55, `rgba(253, 224, 71, ${alpha})`);
                  grad.addColorStop(1, `rgba(124, 45, 18, ${alpha * 0.45})`);
                  ctx.fillStyle = grad;
                  ctx.fillRect(c * colW, 0, colW + 0.5, h);
                }
              }
            }
          }

          // Frequency Grid & Musical Region Labels
          const gridHz = [30, 60, 100, 200, 500, 1000, 2000, 5000, 10000];
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.lineWidth = 1;
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillStyle = '#8B95A5';
          for (const hz of gridHz) {
            const x = freqToX(hz, w);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, x + 3, h - 6);
          }

          for (const db of [-12, -6, 0, 6, 12]) {
            const y = dbToY(db, h);
            ctx.strokeStyle = db === 0 ? 'rgba(203, 213, 225, 0.35)' : 'rgba(148, 163, 184, 0.12)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Total Composite EQ Response Curve
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const freq = xToFreq(x, w);
            const db = evaluateTotalBandsDb(freq, settings.bands, settings.enabled);
            const y = dbToY(db, h);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = settings.enabled ? '#E2E8F0' : '#64748B';
          ctx.lineWidth = 2.4;
          ctx.stroke();

          // 7 Numbered Color-Coded FL Tokens
          settings.bands.forEach((band, idx) => {
            const x = freqToX(band.freq, w);
            const y =
              band.type === 'highpass' || band.type === 'lowpass'
                ? dbToY(0, h)
                : dbToY(band.gain, h);
            const color = FL_BAND_COLORS[idx % FL_BAND_COLORS.length];
            const isSel = band.id === selectedBandId;

            if (isSel) {
              ctx.beginPath();
              ctx.arc(x, y, 13, 0, Math.PI * 2);
              ctx.fillStyle = `${color}38`;
              ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(x, y, isSel ? 9.5 : 8, 0, Math.PI * 2);
            ctx.fillStyle = band.enabled && settings.enabled ? color : '#374151';
            ctx.fill();
            ctx.strokeStyle = isSel ? '#FFFFFF' : '#0F1317';
            ctx.lineWidth = isSel ? 2 : 1.5;
            ctx.stroke();

            ctx.fillStyle = '#0B0D11';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(band.id), x, y + 0.5);
          });
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selectedBandId, settings, trackId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

    let closestId: number | null = null;
    let closestDist = 26;
    settings.bands.forEach((b) => {
      const bx = freqToX(b.freq, canvas.width);
      const by = b.type === 'highpass' || b.type === 'lowpass' ? dbToY(0, canvas.height) : dbToY(b.gain, canvas.height);
      const dist = Math.hypot(px - bx, py - by);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = b.id;
      }
    });

    if (closestId !== null) {
      setSelectedBandId(closestId);
      draggingBandRef.current = closestId;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const bandId = draggingBandRef.current;
    const canvas = canvasRef.current;
    if (bandId === null || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const nextFreq = xToFreq(px, canvas.width);
    const nextGain = yToDb(py, canvas.height);
    updateBand(bandId, { freq: nextFreq, gain: nextGain, enabled: true });
  };

  const handlePointerUp = () => {
    draggingBandRef.current = null;
  };

  return (
    <div className="rounded-lg border border-[#3B4249] bg-[#21262B] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#F3F4F6] tracking-tight">
            Fruity Parametric EQ 2
          </h3>
          <p className="text-[11px] text-[#9CA3AF]">
            7-Band FL Studio Equalizer · Drag numbered tokens on the spectrum or use vertical band sliders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...settings, heatmap: !settings.heatmap })}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
              settings.heatmap
                ? 'bg-orange-500/20 border-orange-400/60 text-orange-200'
                : 'bg-[#171B1F] border-[#343A42] text-[#9CA3AF]'
            }`}
          >
            Heatmap {settings.heatmap ? 'On' : 'Off'}
          </button>
          {Object.entries(FL_EQ2_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  ...vals,
                  bands: vals.bands ? vals.bands.map((b) => ({ ...b })) : settings.bands,
                })
              }
              className="px-2 py-1 rounded bg-[#2A3037] hover:bg-[#363E47] border border-[#3E4752] text-[11px] text-[#E5E7EB] whitespace-nowrap"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive 7-Band FL Spectrum Canvas */}
      <div className="rounded-md border border-[#384048] overflow-hidden bg-[#14171A]">
        <canvas
          ref={canvasRef}
          width={780}
          height={210}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-52 block cursor-crosshair touch-none"
        />
      </div>

      {/* Selected Band Inspector + 7 FL Band Faders */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-5 bg-[#181C20] border border-[#323942] rounded-md p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#F3F4F6]">
              Band {selectedBand.id} · {FL_BAND_NAMES[(selectedBand.id - 1) % 7]}
            </span>
            <button
              type="button"
              onClick={() => updateBand(selectedBand.id, { enabled: !selectedBand.enabled })}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                selectedBand.enabled ? 'bg-emerald-600 text-white' : 'bg-[#2C333B] text-[#9CA3AF]'
              }`}
            >
              {selectedBand.enabled ? 'Active' : 'Muted'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#9CA3AF] block mb-1">Filter Type</label>
              <select
                value={selectedBand.type}
                onChange={(e) => updateBand(selectedBand.id, { type: e.target.value as EqBandShape })}
                className="w-full bg-[#111418] border border-[#343C46] rounded px-2 py-1 text-xs text-[#F3F4F6]"
              >
                {BAND_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#9CA3AF] block mb-1">Output Level</label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={settings.outputGain}
                  onChange={(e) => onChange({ ...settings, outputGain: Number(e.target.value) })}
                  className="studio-slider flex-1"
                />
                <span className="font-mono-tabular text-[11px] text-[#E5E7EB] w-11 text-right">
                  {settings.outputGain >= 0 ? `+${settings.outputGain.toFixed(1)}` : settings.outputGain.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-[#CBD5E1] mb-1">
              <span>Frequency</span>
              <span className="font-mono-tabular">{formatHz(selectedBand.freq)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((Math.log10(Math.max(20, selectedBand.freq) / 20) / 3) * 1000)}
              onChange={(e) => {
                const hz = Math.round(20 * Math.pow(1000, Number(e.target.value) / 1000));
                updateBand(selectedBand.id, { freq: hz });
              }}
              className="studio-slider w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[11px] text-[#CBD5E1] mb-1">
                <span>Gain</span>
                <span className="font-mono-tabular">
                  {selectedBand.gain >= 0 ? `+${selectedBand.gain.toFixed(1)}` : selectedBand.gain.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-18}
                max={18}
                step={0.5}
                value={selectedBand.gain}
                onChange={(e) => updateBand(selectedBand.id, { gain: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-[#CBD5E1] mb-1">
                <span>Bandwidth (Q)</span>
                <span className="font-mono-tabular">{selectedBand.q.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={8}
                step={0.1}
                value={selectedBand.q}
                onChange={(e) => updateBand(selectedBand.id, { q: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>
          </div>
        </div>

        {/* 7 FL Color-Coded Band Gain Strip */}
        <div className="col-span-7 bg-[#181C20] border border-[#323942] rounded-md p-3 grid grid-cols-7 gap-2">
          {settings.bands.map((band, idx) => {
            const color = FL_BAND_COLORS[idx % FL_BAND_COLORS.length];
            const isSel = band.id === selectedBandId;
            return (
              <div
                key={band.id}
                onClick={() => setSelectedBandId(band.id)}
                className={`rounded p-1.5 flex flex-col items-center justify-between cursor-pointer border transition-colors ${
                  isSel ? 'bg-[#252C34] border-[#5B6878]' : 'bg-[#13171B] border-[#262C34] hover:border-[#3E4752]'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-[#0B0D11]"
                  style={{ backgroundColor: band.enabled ? color : '#4B5563' }}
                >
                  {band.id}
                </span>
                <div className="h-24 flex items-center justify-center my-1">
                  <input
                    type="range"
                    min={-18}
                    max={18}
                    step={0.5}
                    value={band.gain}
                    onChange={(e) => updateBand(band.id, { gain: Number(e.target.value) })}
                    className="mixer-fader h-20"
                    aria-label={`Band ${band.id} gain`}
                  />
                </div>
                <span className="font-mono-tabular text-[9px] text-[#CBD5E1]">
                  {band.gain >= 0 ? `+${band.gain.toFixed(0)}` : band.gain.toFixed(0)}dB
                </span>
                <span className="font-mono-tabular text-[9px] text-[#7C8594]">
                  {band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}k` : `${band.freq}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 2. FL STUDIO FRUITY CONVOLVER (IMPULSE RESPONSE REVERB)
// =============================================================================
const IMPULSE_OPTIONS: { id: ConvolverImpulseType; label: string; desc: string }[] = [
  { id: 'cathedral', label: 'Cathedral Hall', desc: 'Large stone hall tail' },
  { id: 'plate', label: 'Concert Plate', desc: 'Bright dense vocal plate' },
  { id: 'spring', label: 'Vintage Spring', desc: 'Classic metallic spring tank' },
  { id: 'vocal-booth', label: 'Vocal Booth', desc: 'Tight studio room reflections' },
  { id: 'blur-pink', label: 'Blur Pink Space', desc: 'Smooth ambient wash' },
  { id: 'reverse-swell', label: 'Reverse Swell', desc: 'Backwards rising bloom' },
];

export const FlConvolverPanel: React.FC<{
  settings: FlConvolverSettings;
  onChange: (next: FlConvolverSettings) => void;
}> = ({ settings, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#12161B';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1E252E';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = (i / 6) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2A3340';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Pre-delay region shading
    const preDelayRatio = Math.min(0.28, (settings.preDelayMs / 1000) / Math.max(0.4, settings.decaySec));
    const startX = Math.round(preDelayRatio * w);
    if (startX > 2) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.fillRect(0, 0, startX, h);
    }

    // Draw Stereo IR Waveform Preview
    const bars = 140;
    const usableW = w - startX;
    for (let i = 0; i < bars; i++) {
      const t = i / bars;
      let env = 0;
      if (settings.impulse === 'reverse-swell') {
        env = Math.pow(t, 2.3) * (1 - Math.pow(t, 12));
      } else if (settings.impulse === 'plate') {
        env = Math.pow(1 - t, 1.7);
      } else if (settings.impulse === 'spring') {
        env = Math.pow(1 - t, 2.1) * (0.75 + 0.25 * Math.abs(Math.sin(t * 26)));
      } else if (settings.impulse === 'vocal-booth') {
        env = Math.pow(1 - t, 3.6);
      } else if (settings.impulse === 'blur-pink') {
        env = Math.sin(Math.min(1, t * 4.5) * (Math.PI / 2)) * Math.pow(1 - t, 1.5);
      } else {
        env = Math.pow(1 - t, 2.0) * (1 - Math.exp(-t * 22));
      }

      const jitterL = 0.65 + 0.35 * Math.abs(Math.sin(i * 12.9898));
      const jitterR = 0.65 + 0.35 * Math.abs(Math.cos(i * 78.233));
      const ampL = env * jitterL * (h * 0.42);
      const ampR = env * jitterR * (h * 0.42);
      const x = startX + t * usableW;

      ctx.fillStyle = settings.enabled ? 'rgba(45, 212, 191, 0.8)' : 'rgba(100, 116, 139, 0.45)';
      ctx.fillRect(x, h / 2 - ampL, Math.max(2, usableW / bars - 1), ampL);
      ctx.fillStyle = settings.enabled ? 'rgba(245, 158, 11, 0.72)' : 'rgba(100, 116, 139, 0.35)';
      ctx.fillRect(x, h / 2, Math.max(2, usableW / bars - 1), ampR);
    }

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(`IR: ${settings.impulse.toUpperCase()} · ${settings.decaySec.toFixed(2)}s · Pre-Delay ${settings.preDelayMs}ms`, 10, 16);
  }, [settings]);

  return (
    <div className="rounded-lg border border-[#3B434E] bg-[#1F242B] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#F3F4F6]">Fruity Convolver</h3>
          <p className="text-[11px] text-[#9CA3AF]">
            True Stereo Impulse Response Reverb · Convolution Space &amp; Reverse Swells
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(FL_CONVOLVER_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#29303A] hover:bg-[#353E4A] border border-[#3E4856] text-[11px] text-[#E5E7EB] whitespace-nowrap"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Impulse Selector Bar */}
      <div className="grid grid-cols-6 gap-1.5">
        {IMPULSE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange({ ...settings, impulse: opt.id, enabled: true })}
            className={`px-2 py-1.5 rounded text-left border transition-colors ${
              settings.impulse === opt.id
                ? 'bg-teal-600/25 border-teal-400/70 text-teal-100'
                : 'bg-[#15191E] border-[#2C333D] text-[#9CA3AF] hover:text-white'
            }`}
          >
            <div className="text-[11px] font-semibold truncate">{opt.label}</div>
            <div className="text-[9px] opacity-75 truncate">{opt.desc}</div>
          </button>
        ))}
      </div>

      {/* Live IR Waveform Display */}
      <div className="rounded-md border border-[#343C47] overflow-hidden">
        <canvas ref={canvasRef} width={760} height={150} className="w-full h-36 block" />
      </div>

      {/* Convolver Parameters */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Dry Level', value: settings.dry, display: `${settings.dry}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, dry: v }) },
          { label: 'Wet Level', value: settings.wet, display: `${settings.wet}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, wet: v }) },
          { label: 'Stretch / Decay', value: settings.decaySec, display: `${settings.decaySec.toFixed(2)} s`, min: 0.3, max: 5.0, step: 0.05, onChange: (v: number) => onChange({ ...settings, decaySec: v }) },
          { label: 'Pre-Delay', value: settings.preDelayMs, display: `${settings.preDelayMs} ms`, min: 0, max: 160, step: 2, onChange: (v: number) => onChange({ ...settings, preDelayMs: v }) },
          { label: 'Wet Low Cut', value: settings.lowCutHz, display: `${settings.lowCutHz} Hz`, min: 20, max: 800, step: 10, onChange: (v: number) => onChange({ ...settings, lowCutHz: v }) },
          { label: 'Wet High Cut', value: settings.highCutHz, display: formatHz(settings.highCutHz), min: 1200, max: 18000, step: 200, onChange: (v: number) => onChange({ ...settings, highCutHz: v }) },
          { label: 'Stereo Separation', value: settings.stereoSep, display: `${Math.round((settings.stereoSep - 1) * 100)}%`, min: 0, max: 2, step: 0.05, onChange: (v: number) => onChange({ ...settings, stereoSep: v }) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#161A20] border border-[#2E3540] rounded-md p-3">
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-[#CBD5E1] font-medium">{ctrl.label}</span>
              <span className="font-mono-tabular text-teal-300">{ctrl.display}</span>
            </div>
            <input
              type="range"
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              value={ctrl.value}
              onChange={(e) => ctrl.onChange(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// 3. FL STUDIO SOUNDGOODIZER (MAXIMUS A/B/C/D ONE-KNOB EXCITER)
// =============================================================================
const SG_MODE_DESCS: Record<SoundgoodizerMode, { title: string; detail: string }> = {
  A: { title: 'Preset A', detail: 'Crisp high-end presence & punchy mids' },
  B: { title: 'Preset B', detail: 'Warm analog saturation & low-mid glue' },
  C: { title: 'Preset C', detail: 'Deep 808 sub lift & airy top sheen' },
  D: { title: 'Preset D', detail: 'Loud club compression & transient bite' },
};

export const FlSoundgoodizerPanel: React.FC<{
  settings: FlSoundgoodizerSettings;
  onChange: (next: FlSoundgoodizerSettings) => void;
}> = ({ settings, onChange }) => {
  const glowOpacity = settings.enabled ? 0.15 + (settings.amount / 100) * 0.75 : 0.05;
  const dialAngle = -135 + (settings.amount / 100) * 270;

  return (
    <div className="rounded-lg border border-[#423A2E] bg-gradient-to-b from-[#23252A] to-[#181A1F] p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-amber-200 tracking-tight">Soundgoodizer</h3>
          <p className="text-[11px] text-[#9CA3AF]">
            FL Studio Maximus Multiband Maximizer &amp; Harmonic Enhancer
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(FL_SOUNDGOODIZER_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#2B2E36] hover:bg-[#373B46] border border-[#444A58] text-[11px] text-[#E5E7EB]"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 items-center">
        {/* Iconic Central Golden Glow Dial */}
        <div className="col-span-5 flex flex-col items-center justify-center py-4 bg-[#14161A] border border-[#30343D] rounded-xl relative overflow-hidden">
          <div
            className="w-44 h-44 rounded-full flex items-center justify-center relative transition-all duration-150"
            style={{
              boxShadow: `0 0 ${24 + settings.amount * 0.45}px rgba(245, 158, 11, ${glowOpacity})`,
              background: `radial-gradient(circle at 50% 45%, rgba(251, 191, 36, ${glowOpacity * 0.45}), #1E2026 68%)`,
            }}
          >
            <svg viewBox="0 0 180 180" className="w-40 h-40">
              <circle cx="90" cy="90" r="76" fill="none" stroke="#2D323B" strokeWidth="10" />
              <circle
                cx="90"
                cy="90"
                r="76"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="10"
                strokeDasharray={`${(settings.amount / 100) * 358} 480`}
                strokeLinecap="round"
                transform="rotate(135 90 90)"
              />
              <circle cx="90" cy="90" r="56" fill="#1C1F26" stroke="#4B5563" strokeWidth="2" />
              <g transform={`rotate(${dialAngle} 90 90)`}>
                <line x1="90" y1="90" x2="90" y2="42" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono-tabular text-2xl font-bold text-amber-300 mt-14">
                {settings.amount}%
              </span>
            </div>
          </div>

          <div className="w-48 mt-4">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.amount}
              onChange={(e) => onChange({ ...settings, amount: Number(e.target.value), enabled: true })}
              className="studio-slider w-full"
              aria-label="Soundgoodizer intensity"
            />
          </div>
        </div>

        {/* A / B / C / D Maximus Mode Selectors & Mix */}
        <div className="col-span-7 space-y-4">
          <div className="grid grid-cols-4 gap-2.5">
            {(['A', 'B', 'C', 'D'] as SoundgoodizerMode[]).map((m) => {
              const active = settings.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ ...settings, mode: m, enabled: true })}
                  className={`py-4 rounded-lg border text-center transition-all ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-inner'
                      : 'bg-[#171A20] border-[#313641] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <div className="text-xl font-bold">{m}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">Maximus</div>
                </button>
              );
            })}
          </div>

          <div className="bg-[#15181E] border border-[#2E3440] rounded-lg p-3.5 text-xs text-[#CBD5E1]">
            <span className="font-semibold text-amber-300">{SG_MODE_DESCS[settings.mode].title}:</span>{' '}
            {SG_MODE_DESCS[settings.mode].detail}
          </div>

          <div className="bg-[#15181E] border border-[#2E3440] rounded-lg p-3.5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#E5E7EB] font-medium">Parallel Wet Mix</span>
              <span className="font-mono-tabular text-amber-300">{settings.mix}%</span>
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
      </div>
    </div>
  );
};

// =============================================================================
// 4. FABFILTER PRO-Q 3 (6-BAND ANALYTICAL PRECISION EQUALIZER)
// =============================================================================
export const FabProQPanel: React.FC<{
  trackId: string;
  settings: FabProQSettings;
  onChange: (next: FabProQSettings) => void;
}> = ({ trackId, settings, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBandId, setSelectedBandId] = useState<number>(settings.bands[2]?.id ?? 3);
  const draggingBandRef = useRef<number | null>(null);

  const selectedBand = settings.bands.find((b) => b.id === selectedBandId) || settings.bands[0];

  const updateBand = (id: number, patch: Partial<ParametricBand>) => {
    onChange({
      ...settings,
      bands: settings.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // FabFilter sleek deep slate canvas
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
          bgGrad.addColorStop(0, '#12151C');
          bgGrad.addColorStop(1, '#0C0E13');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, w, h);

          // Precision Logarithmic Grid
          const gridHz = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
          ctx.lineWidth = 1;
          ctx.font = '10px JetBrains Mono, monospace';
          for (const hz of gridHz) {
            const x = freqToX(hz, w);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.fillStyle = '#64748B';
            if (hz > 20 && hz < 20000) {
              ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, x + 3, h - 6);
            }
          }
          for (const db of [-12, -6, 0, 6, 12]) {
            const y = dbToY(db, h);
            ctx.strokeStyle = db === 0 ? 'rgba(226, 232, 240, 0.25)' : 'rgba(148, 163, 184, 0.08)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Real-Time FFT Spectrum Analyzer
          if (settings.analyzerMode !== 'off') {
            const fft = audioEngine.getTrackFrequencyData(trackId);
            if (fft.length > 0) {
              ctx.beginPath();
              ctx.moveTo(0, h);
              for (let x = 0; x <= w; x += 3) {
                const freq = xToFreq(x, w);
                const bin = Math.min(fft.length - 1, Math.floor((freq / 22050) * fft.length));
                const mag = fft[bin] / 255;
                ctx.lineTo(x, h - mag * (h * 0.8));
              }
              ctx.lineTo(w, h);
              ctx.closePath();
              ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(203, 213, 225, 0.3)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }

          // Individual Selected Band Shaded Fill (FabFilter signature)
          if (selectedBand && selectedBand.enabled && settings.enabled) {
            const selIdx = settings.bands.findIndex((b) => b.id === selectedBand.id);
            const selColor = FAB_BAND_COLORS[Math.max(0, selIdx) % FAB_BAND_COLORS.length];
            ctx.beginPath();
            ctx.moveTo(0, dbToY(0, h));
            for (let x = 0; x <= w; x += 2) {
              const freq = xToFreq(x, w);
              const db = evaluateBandResponseDb(freq, selectedBand);
              ctx.lineTo(x, dbToY(db, h));
            }
            ctx.lineTo(w, dbToY(0, h));
            ctx.closePath();
            ctx.fillStyle = `${selColor}24`;
            ctx.fill();
          }

          // Golden Master EQ Curve
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const freq = xToFreq(x, w);
            const db = evaluateTotalBandsDb(freq, settings.bands, settings.enabled);
            const y = dbToY(db, h);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = settings.enabled ? '#FBBF24' : '#64748B';
          ctx.lineWidth = 2.4;
          ctx.stroke();

          // Glowing Draggable Pro-Q 3 Band Nodes
          settings.bands.forEach((band, idx) => {
            const x = freqToX(band.freq, w);
            const y =
              band.type === 'highpass' || band.type === 'lowpass'
                ? dbToY(0, h)
                : dbToY(band.gain, h);
            const color = FAB_BAND_COLORS[idx % FAB_BAND_COLORS.length];
            const isSel = band.id === selectedBandId;

            if (isSel) {
              ctx.beginPath();
              ctx.arc(x, y, 13, 0, Math.PI * 2);
              ctx.strokeStyle = `${color}88`;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(x, y, isSel ? 7.5 : 6, 0, Math.PI * 2);
            ctx.fillStyle = band.enabled && settings.enabled ? color : '#334155';
            ctx.fill();
            ctx.strokeStyle = '#0C0E13';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selectedBand, selectedBandId, settings, trackId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;

    let closestId: number | null = null;
    let closestDist = 26;
    settings.bands.forEach((b) => {
      const bx = freqToX(b.freq, canvas.width);
      const by = b.type === 'highpass' || b.type === 'lowpass' ? dbToY(0, canvas.height) : dbToY(b.gain, canvas.height);
      const dist = Math.hypot(px - bx, py - by);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = b.id;
      }
    });

    if (closestId !== null) {
      setSelectedBandId(closestId);
      draggingBandRef.current = closestId;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const bandId = draggingBandRef.current;
    const canvas = canvasRef.current;
    if (bandId === null || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    updateBand(bandId, {
      freq: xToFreq(px, canvas.width),
      gain: yToDb(py, canvas.height),
      enabled: true,
    });
  };

  return (
    <div className="rounded-lg border border-[#323947] bg-[#131720] p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-[#F8FAFC] tracking-tight">FabFilter Pro-Q 3</span>
          <span className="text-[11px] text-[#94A3B8]">· Precision 6-Band Analytical Equalizer</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onChange({
                ...settings,
                analyzerMode: settings.analyzerMode === 'off' ? 'pre-post' : 'off',
              })
            }
            className={`px-2 py-1 rounded text-[11px] border ${
              settings.analyzerMode !== 'off'
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                : 'bg-[#1A1F2B] border-[#2E3545] text-[#94A3B8]'
            }`}
          >
            Analyzer: {settings.analyzerMode === 'off' ? 'Off' : 'Post FFT'}
          </button>
          {Object.entries(FAB_PROQ_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  ...vals,
                  bands: vals.bands ? vals.bands.map((b) => ({ ...b })) : settings.bands,
                })
              }
              className="px-2 py-1 rounded bg-[#1E2432] hover:bg-[#2A3245] border border-[#343E54] text-[11px] text-[#E2E8F0] whitespace-nowrap"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive FabFilter Pro-Q 3 Spectrum Canvas */}
      <div className="rounded-md border border-[#2A3142] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={780}
          height={230}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            draggingBandRef.current = null;
          }}
          onPointerLeave={() => {
            draggingBandRef.current = null;
          }}
          className="w-full h-56 block cursor-crosshair touch-none"
        />
      </div>

      {/* Bottom Pro-Q Floating Band Control Strip */}
      <div className="bg-[#1A1F2C] border border-[#2F374A] rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
        {/* Band Selector Pills */}
        <div className="flex items-center gap-1">
          {settings.bands.map((band, idx) => (
            <button
              key={band.id}
              type="button"
              onClick={() => setSelectedBandId(band.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                band.id === selectedBandId
                  ? 'bg-[#2B3345] border-amber-400/70 text-white'
                  : 'bg-[#12161F] border-[#2A3142] text-[#94A3B8] hover:text-white'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: band.enabled ? FAB_BAND_COLORS[idx % 6] : '#475569' }}
              />
              B{band.id}
            </button>
          ))}
        </div>

        {/* Selected Band Controls */}
        <div className="flex-1 grid grid-cols-5 gap-3 min-w-[420px] items-center">
          <select
            value={selectedBand.type}
            onChange={(e) => updateBand(selectedBand.id, { type: e.target.value as EqBandShape })}
            className="bg-[#11151E] border border-[#343E54] rounded px-2 py-1.5 text-[11px] text-[#F1F5F9]"
          >
            {BAND_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div>
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>FREQ</span>
              <span className="font-mono-tabular text-amber-300">{formatHz(selectedBand.freq)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((Math.log10(Math.max(20, selectedBand.freq) / 20) / 3) * 1000)}
              onChange={(e) =>
                updateBand(selectedBand.id, {
                  freq: Math.round(20 * Math.pow(1000, Number(e.target.value) / 1000)),
                })
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>GAIN</span>
              <span className="font-mono-tabular text-amber-300">
                {selectedBand.gain >= 0 ? `+${selectedBand.gain.toFixed(1)}` : selectedBand.gain.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={-18}
              max={18}
              step={0.5}
              value={selectedBand.gain}
              onChange={(e) => updateBand(selectedBand.id, { gain: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>Q</span>
              <span className="font-mono-tabular text-sky-300">{selectedBand.q.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={10}
              step={0.1}
              value={selectedBand.q}
              onChange={(e) => updateBand(selectedBand.id, { q: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>OUT</span>
              <span className="font-mono-tabular text-[#E2E8F0]">
                {settings.outputGain >= 0 ? `+${settings.outputGain.toFixed(1)}` : settings.outputGain.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={settings.outputGain}
              onChange={(e) => onChange({ ...settings, outputGain: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 5. FABFILTER PRO-R 2 (MUSICAL SPACE REVERB)
// =============================================================================
export const FabProRPanel: React.FC<{
  settings: FabProRSettings;
  onChange: (next: FabProRSettings) => void;
}> = ({ settings, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0F131B';
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    for (let i = 1; i < 8; i++) {
      const x = (i / 8) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Visual Decay Rate Frequency Curve (FabFilter Pro-R signature cyan/teal glow)
    const brightNorm = settings.brightness / 100;
    const spaceRatio = Math.min(1, settings.spaceSec / 6.5);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const t = x / w;
      const tilt = (t - 0.45) * brightNorm * 0.45;
      const modWave = Math.sin(t * 14) * (settings.character / 100) * 0.05;
      const heightNorm = Math.max(0.12, Math.min(0.92, 0.35 + spaceRatio * 0.45 + tilt + modWave));
      ctx.lineTo(x, h - heightNorm * (h - 24));
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, settings.enabled ? 'rgba(56, 189, 248, 0.38)' : 'rgba(100, 116, 139, 0.14)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.05)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const t = x / w;
      const tilt = (t - 0.45) * brightNorm * 0.45;
      const modWave = Math.sin(t * 14) * (settings.character / 100) * 0.05;
      const heightNorm = Math.max(0.12, Math.min(0.92, 0.35 + spaceRatio * 0.45 + tilt + modWave));
      const y = h - heightNorm * (h - 24);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = settings.enabled ? '#38BDF8' : '#64748B';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(`SPACE ${settings.spaceSec.toFixed(2)}s · BRIGHTNESS ${settings.brightness >= 0 ? '+' : ''}${settings.brightness}% · DISTANCE ${settings.distance}%`, 12, 18);
  }, [settings]);

  return (
    <div className="rounded-lg border border-[#303848] bg-[#131720] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#F8FAFC]">FabFilter Pro-R 2</h3>
          <p className="text-[11px] text-[#94A3B8]">
            Musical Algorithmic Space Reverb · Decay Rate &amp; Distance Modeling
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(FAB_PROR_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#1E2432] hover:bg-[#2A3245] border border-[#343E54] text-[11px] text-[#E2E8F0] whitespace-nowrap"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-[#283042] overflow-hidden">
        <canvas ref={canvasRef} width={760} height={155} className="w-full h-36 block" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Space (Decay)', value: settings.spaceSec, display: `${settings.spaceSec.toFixed(2)} s`, min: 0.2, max: 7.5, step: 0.05, onChange: (v: number) => onChange({ ...settings, spaceSec: v }) },
          { label: 'Brightness', value: settings.brightness, display: `${settings.brightness >= 0 ? '+' : ''}${settings.brightness}%`, min: -100, max: 100, step: 2, onChange: (v: number) => onChange({ ...settings, brightness: v }) },
          { label: 'Character (Chorus)', value: settings.character, display: `${settings.character}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, character: v }) },
          { label: 'Distance', value: settings.distance, display: `${settings.distance}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, distance: v }) },
          { label: 'Pre-Delay', value: settings.preDelayMs, display: `${settings.preDelayMs} ms`, min: 0, max: 120, step: 2, onChange: (v: number) => onChange({ ...settings, preDelayMs: v }) },
          { label: 'Dry / Wet Mix', value: settings.mix, display: `${settings.mix}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, mix: v }) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#1A1F2C] border border-[#2E3648] rounded-md p-3">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#CBD5E1] font-medium">{ctrl.label}</span>
              <span className="font-mono-tabular text-sky-400">{ctrl.display}</span>
            </div>
            <input
              type="range"
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              value={ctrl.value}
              onChange={(e) => ctrl.onChange(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// 6. SOUNDTOYS ECHOBOY (ANALOG ECHO & TAPE DELAY)
// =============================================================================
const ECHOBOY_STYLES: { id: EchoBoyStyle; label: string }[] = [
  { id: 'master-tape', label: 'Master Tape' },
  { id: 'echoplex', label: 'Echoplex' },
  { id: 'space-echo', label: 'Space Echo' },
  { id: 'memory-man', label: 'Memory Man' },
  { id: 'dm2-analog', label: 'DM-2 Analog' },
  { id: 'studio-tape', label: 'Studio Tape' },
  { id: 'telray', label: 'TelRay Oil' },
  { id: 'ambient', label: 'Ambient' },
];

const ECHOBOY_DIVISIONS: EchoBoyDivision[] = ['1/16', '1/8', '1/8D', '1/4', '1/4D', '1/2'];

function divisionToMs(div: EchoBoyDivision, bpm: number, groove: number): number {
  const beatMs = (60 / Math.max(40, bpm)) * 1000;
  const mult = { '1/16': 0.25, '1/8': 0.5, '1/8D': 0.75, '1/4': 1, '1/4D': 1.5, '1/2': 2 }[div];
  return Math.round(beatMs * mult * (1 + (groove / 50) * 0.16));
}

export const EchoBoyPanel: React.FC<{
  bpm: number;
  settings: EchoBoySettings;
  onChange: (next: EchoBoySettings) => void;
}> = ({ bpm, settings, onChange }) => {
  const delayMs = divisionToMs(settings.division, bpm, settings.groove);

  return (
    <div className="rounded-lg border border-[#5A5243] bg-gradient-to-b from-[#2B2926] to-[#1E1C1A] p-5 space-y-4">
      {/* Soundtoys Vintage Rack Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#3F3A32]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-[#F5EAD6] tracking-tight">Soundtoys EchoBoy</h3>
            <span className="font-mono-tabular text-xs text-amber-300 bg-[#141210] border border-[#474035] rounded px-2 py-0.5">
              {settings.division} · {delayMs} ms ({bpm} BPM)
            </span>
          </div>
          <p className="text-[11px] text-[#B8AE9E] mt-0.5">
            Analog Tape, BBD &amp; Space Echo Modeling · Tempo-Synced Stereo Ping-Pong Delay
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(ECHOBOY_PRESETS).map(([name, vals]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ ...settings, ...vals })}
              className="px-2 py-1 rounded bg-[#36322C] hover:bg-[#464038] border border-[#524B40] text-[11px] text-[#F5EAD6] whitespace-nowrap"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Echo Style Selector Bank + Note Division + Ping-Pong */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-8 bg-[#181614] border border-[#3E3830] rounded-lg p-3">
          <div className="text-[10px] font-semibold text-[#C9BDA8] mb-2">
            Analog Echo Style
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {ECHOBOY_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onChange({ ...settings, style: st.id, enabled: true })}
                className={`px-2 py-1.5 rounded text-[11px] font-semibold border transition-colors ${
                  settings.style === st.id
                    ? 'bg-amber-600/30 border-amber-400 text-amber-100'
                    : 'bg-[#23201D] border-[#38332B] text-[#A89E8E] hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-4 bg-[#181614] border border-[#3E3830] rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-semibold text-[#C9BDA8] mb-2">
              Note Sync Division
            </div>
            <div className="grid grid-cols-3 gap-1">
              {ECHOBOY_DIVISIONS.map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => onChange({ ...settings, division: div, enabled: true })}
                  className={`py-1 rounded font-mono-tabular text-[11px] font-bold border transition-colors ${
                    settings.division === div
                      ? 'bg-amber-500 text-[#15120E] border-amber-300'
                      : 'bg-[#23201D] border-[#38332B] text-[#C9BDA8] hover:text-white'
                  }`}
                >
                  {div}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...settings, pingPong: !settings.pingPong })}
            className={`mt-2 w-full py-1.5 rounded text-xs font-semibold border transition-colors ${
              settings.pingPong
                ? 'bg-emerald-600/25 border-emerald-400/70 text-emerald-200'
                : 'bg-[#24211E] border-[#3B362E] text-[#A89E8E]'
            }`}
          >
            Mode: {settings.pingPong ? 'Stereo Ping-Pong' : 'Dual Mono Tape'}
          </button>
        </div>
      </div>

      {/* Tactile EchoBoy Knob Controls */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Mix (Dry / Wet)', value: settings.mix, display: `${settings.mix}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, mix: v }) },
          { label: 'Feedback', value: settings.feedback, display: `${settings.feedback}%`, min: 0, max: 92, step: 1, onChange: (v: number) => onChange({ ...settings, feedback: v }) },
          { label: 'Analog Saturation', value: settings.saturation, display: `${settings.saturation}%`, min: 0, max: 100, step: 1, onChange: (v: number) => onChange({ ...settings, saturation: v }) },
          { label: 'Groove (Rush ↔ Drag)', value: settings.groove, display: settings.groove === 0 ? 'Locked' : settings.groove < 0 ? `${settings.groove} Rush` : `+${settings.groove} Drag`, min: -50, max: 50, step: 2, onChange: (v: number) => onChange({ ...settings, groove: v }) },
          { label: 'Low Cut Filter', value: settings.lowCutHz, display: `${settings.lowCutHz} Hz`, min: 20, max: 1200, step: 20, onChange: (v: number) => onChange({ ...settings, lowCutHz: v }) },
          { label: 'High Cut Tone', value: settings.highCutHz, display: formatHz(settings.highCutHz), min: 1000, max: 16000, step: 200, onChange: (v: number) => onChange({ ...settings, highCutHz: v }) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#181614] border border-[#3E3830] rounded-md p-3">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#E6DEC8] font-medium">{ctrl.label}</span>
              <span className="font-mono-tabular text-amber-300">{ctrl.display}</span>
            </div>
            <input
              type="range"
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              value={ctrl.value}
              onChange={(e) => ctrl.onChange(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
