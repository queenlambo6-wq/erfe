import React, { useEffect, useRef, useState } from 'react';
import { Download, Power, RotateCcw } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { createDefaultMasteringChain, MASTERING_PRESETS } from '../data/presets';
import type { MasteringChain } from '../types/studio';

interface MasteringSuiteViewProps {
  mastering: MasteringChain;
  onUpdateMastering: (updates: Partial<MasteringChain>) => void;
  onExportWav: () => void;
  isExporting: boolean;
}

function evaluateMasterEq(freq: number, m: MasteringChain): number {
  if (m.bypassAll || !m.eqEnabled) return 0;
  let db = 0;
  if (freq < m.lowCutHz * 1.45) {
    const ratio = freq / Math.max(20, m.lowCutHz);
    db -= Math.max(0, Math.pow(1 - ratio, 1.3) * 20);
  }
  db += m.subGain * (1 / (1 + Math.pow(freq / 65, 2)));
  db += m.mudGain * Math.exp(-Math.pow(Math.log2(freq / 320) * 1.4, 2));
  db += m.presenceGain * Math.exp(-Math.pow(Math.log2(freq / 2800) * 1.2, 2));
  db += m.airGain * (1 / (1 + Math.pow(10000 / freq, 2)));
  return Math.max(-12, Math.min(12, db));
}

export const MasteringSuiteView: React.FC<MasteringSuiteViewProps> = ({
  mastering,
  onUpdateMastering,
  onExportWav,
  isExporting,
}) => {
  const m = mastering || createDefaultMasteringChain();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meters, setMeters] = useState({
    left: 0,
    right: 0,
    lufsApprox: -60,
    glueGr: 0,
    limiterGr: 0,
  });

  useEffect(() => {
    let raf = 0;
    const render = () => {
      const stereo = audioEngine.getMasterStereoLevels();
      const gr = audioEngine.getMasterCompressorReduction();
      setMeters({
        left: stereo.left,
        right: stereo.right,
        lufsApprox: stereo.lufsApprox,
        glueGr: gr.glueGr,
        limiterGr: gr.limiterGr,
      });

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#0D1016';
          ctx.fillRect(0, 0, w, h);

          // Frequency Grid
          const freqs = [30, 60, 120, 250, 500, 1000, 2500, 5000, 10000, 16000];
          ctx.strokeStyle = '#1C222F';
          ctx.lineWidth = 1;
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillStyle = '#64748B';
          for (const hz of freqs) {
            const t = Math.log10(hz / 20) / 3;
            const x = t * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, x + 3, h - 6);
          }

          // Center 0 dB axis
          ctx.strokeStyle = '#2E3648';
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          // Live Stereo Out FFT Spectrum
          const fft = audioEngine.getMasterFrequencyData();
          if (fft.length > 0) {
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x < w; x += 3) {
              const t = x / w;
              const freq = 20 * Math.pow(1000, t);
              const bin = Math.min(fft.length - 1, Math.floor((freq / 22050) * fft.length));
              const mag = fft[bin] / 255;
              ctx.lineTo(x, h - mag * (h * 0.85));
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = m.bypassAll ? 'rgba(148,163,184,0.12)' : 'rgba(56,189,248,0.18)';
            ctx.fill();
          }

          // Mastering EQ Curve
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const t = x / w;
            const freq = 20 * Math.pow(1000, t);
            const db = evaluateMasterEq(freq, m);
            const y = h / 2 - (db / 12) * (h / 2 - 14);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = m.bypassAll || !m.eqEnabled ? '#64748B' : '#38BDF8';
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [m]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1B1D22]">
      {/* Logic Mastering Assistant Header */}
      <div className="h-11 px-4 bg-[#252830] border-b border-[#14161A] flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-[#F3F4F6] whitespace-nowrap">
            Mastering Assistant · Stereo Out Bus
          </span>
          <span className="text-[#4B5563]" aria-hidden="true">|</span>
          <div className="flex items-center gap-1">
            {Object.entries(MASTERING_PRESETS).map(([name, preset]) => (
              <button
                key={name}
                type="button"
                onClick={() => onUpdateMastering(preset)}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-[#30343F] hover:bg-[#3B404E] border border-[#434958] text-[#E5E7EB] transition-colors whitespace-nowrap"
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onUpdateMastering({ bypassAll: !m.bypassAll })}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border transition-colors whitespace-nowrap ${
              m.bypassAll
                ? 'bg-[#2C3039] border-[#434958] text-[#9CA3AF]'
                : 'bg-[#2563EB] border-sky-400/60 text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{m.bypassAll ? 'A/B: Raw Mix (Bypassed)' : 'A/B: Master Active'}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateMastering(createDefaultMasteringChain())}
            title="Reset Mastering Chain"
            className="p-1.5 rounded bg-[#2C3039] hover:bg-[#383D49] border border-[#404654] text-[#CBD5E1]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onExportWav}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Rendering Master...' : 'Bounce Master WAV'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Mastering Rack */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Top Row: Live Master FFT Spectrum & Loudness Meters */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-9 bg-[#14171D] border border-[#2F3440] rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] mb-2">
              <span className="font-semibold text-[#E5E7EB]">Stereo Out Real-Time Frequency &amp; Mastering EQ Curve</span>
              <span className="font-mono-tabular">20 Hz — 20 kHz · Linear Phase Modeling</span>
            </div>
            <canvas
              ref={canvasRef}
              width={860}
              height={170}
              className="w-full h-44 rounded border border-[#232833] block"
            />
          </div>

          {/* True Peak & Loudness Metering Box */}
          <div className="col-span-3 bg-[#14171D] border border-[#2F3440] rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-[#E5E7EB] mb-0.5">Loudness &amp; True Peak</div>
              <div className="text-[10px] text-[#9CA3AF]">Real-time Stereo Output</div>
            </div>

            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="bg-[#0D1015] border border-[#262B37] rounded p-2 text-center">
                <div className="text-[10px] text-[#9CA3AF]">Momentary</div>
                <div className="font-mono-tabular text-base font-bold text-sky-400">
                  {meters.lufsApprox <= -59 ? '-∞' : meters.lufsApprox.toFixed(1)}
                </div>
                <div className="text-[9px] text-[#64748B]">LUFS</div>
              </div>
              <div className="bg-[#0D1015] border border-[#262B37] rounded p-2 text-center">
                <div className="text-[10px] text-[#9CA3AF]">Ceiling</div>
                <div className="font-mono-tabular text-base font-bold text-emerald-400">
                  {m.limiterCeiling.toFixed(1)}
                </div>
                <div className="text-[9px] text-[#64748B]">dBTP</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] font-mono-tabular text-[#9CA3AF]">
                <span className="w-3">L</span>
                <div className="flex-1 h-2 bg-[#0B0D12] rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75"
                    style={{ width: `${Math.round(meters.left * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono-tabular text-[#9CA3AF]">
                <span className="w-3">R</span>
                <div className="flex-1 h-2 bg-[#0B0D12] rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75"
                    style={{ width: `${Math.round(meters.right * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Mastering Signal-Flow Modules */}
        <div className={`grid grid-cols-1 lg:grid-cols-4 gap-4 transition-opacity ${m.bypassAll ? 'opacity-50' : ''}`}>
          {/* Module 1: Mastering EQ */}
          <div className="bg-[#23262E] border border-[#363B47] rounded-lg p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-[#323743] pb-2">
              <div>
                <div className="text-xs font-bold text-[#F3F4F6]">1. Linear EQ</div>
                <div className="text-[10px] text-[#9CA3AF]">Tonal Balance</div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateMastering({ eqEnabled: !m.eqEnabled })}
                className={`p-1.5 rounded ${
                  m.eqEnabled ? 'bg-[#2563EB] text-white' : 'bg-[#181B21] text-[#6B7280]'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {[
                { label: 'Low Cut Rumble', val: m.lowCutHz, min: 20, max: 100, step: 2, fmt: `${m.lowCutHz} Hz`, key: 'lowCutHz' as const },
                { label: 'Sub Warmth (65 Hz)', val: m.subGain, min: -8, max: 8, step: 0.2, fmt: `${m.subGain >= 0 ? '+' : ''}${m.subGain.toFixed(1)} dB`, key: 'subGain' as const },
                { label: 'Mud Cleanup (320 Hz)', val: m.mudGain, min: -8, max: 8, step: 0.2, fmt: `${m.mudGain >= 0 ? '+' : ''}${m.mudGain.toFixed(1)} dB`, key: 'mudGain' as const },
                { label: 'Presence (2.8 kHz)', val: m.presenceGain, min: -8, max: 8, step: 0.2, fmt: `${m.presenceGain >= 0 ? '+' : ''}${m.presenceGain.toFixed(1)} dB`, key: 'presenceGain' as const },
                { label: 'Air Sheen (10 kHz)', val: m.airGain, min: -8, max: 8, step: 0.2, fmt: `${m.airGain >= 0 ? '+' : ''}${m.airGain.toFixed(1)} dB`, key: 'airGain' as const },
              ].map((s) => (
                <div key={s.key}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#CBD5E1]">{s.label}</span>
                    <span className="font-mono-tabular text-sky-400">{s.fmt}</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.val}
                    onChange={(e) => onUpdateMastering({ [s.key]: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Module 2: Bus Glue Compressor */}
          <div className="bg-[#23262E] border border-[#363B47] rounded-lg p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-[#323743] pb-2">
              <div>
                <div className="text-xs font-bold text-[#F3F4F6]">2. Bus Glue Comp</div>
                <div className="text-[10px] text-[#9CA3AF]">SSL-Style VCA Cohesion</div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateMastering({ compEnabled: !m.compEnabled })}
                className={`p-1.5 rounded ${
                  m.compEnabled ? 'bg-[#2563EB] text-white' : 'bg-[#181B21] text-[#6B7280]'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-[#14171D] border border-[#2C313D] rounded p-2">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#9CA3AF]">Glue GR</span>
                <span className="font-mono-tabular text-amber-400">-{meters.glueGr.toFixed(1)} dB</span>
              </div>
              <div className="h-2 bg-[#0B0D12] rounded-xs overflow-hidden flex justify-end">
                <div
                  className="h-full bg-amber-400 transition-[width] duration-75"
                  style={{ width: `${Math.min(100, (meters.glueGr / 12) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { label: 'Threshold', val: m.compThreshold, min: -32, max: 0, step: 1, fmt: `${m.compThreshold} dB`, key: 'compThreshold' as const },
                { label: 'Ratio', val: m.compRatio, min: 1.2, max: 8, step: 0.2, fmt: `${m.compRatio.toFixed(1)}:1`, key: 'compRatio' as const },
                { label: 'Attack', val: m.compAttack, min: 0.005, max: 0.1, step: 0.005, fmt: `${Math.round(m.compAttack * 1000)} ms`, key: 'compAttack' as const },
                { label: 'Makeup Gain', val: m.compMakeup, min: 0, max: 12, step: 0.2, fmt: `+${m.compMakeup.toFixed(1)} dB`, key: 'compMakeup' as const },
              ].map((s) => (
                <div key={s.key}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#CBD5E1]">{s.label}</span>
                    <span className="font-mono-tabular text-sky-400">{s.fmt}</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.val}
                    onChange={(e) => onUpdateMastering({ [s.key]: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Module 3: Tape Exciter & Stereo Spread */}
          <div className="bg-[#23262E] border border-[#363B47] rounded-lg p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-[#323743] pb-2">
              <div>
                <div className="text-xs font-bold text-[#F3F4F6]">3. Exciter &amp; Width</div>
                <div className="text-[10px] text-[#9CA3AF]">Analog Color &amp; Mid/Side</div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateMastering({ exciterEnabled: !m.exciterEnabled })}
                className={`p-1.5 rounded ${
                  m.exciterEnabled ? 'bg-[#2563EB] text-white' : 'bg-[#181B21] text-[#6B7280]'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-[#CBD5E1]">Analog Tape Exciter</span>
                  <span className="font-mono-tabular text-amber-400">{m.exciterAmount}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={2}
                  value={m.exciterAmount}
                  onChange={(e) => onUpdateMastering({ exciterAmount: Number(e.target.value) })}
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-[#CBD5E1]">Master Stereo Width</span>
                  <span className="font-mono-tabular text-sky-400">
                    {Math.round(m.stereoWidth * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.6}
                  step={0.04}
                  value={m.stereoWidth}
                  onChange={(e) => onUpdateMastering({ stereoWidth: Number(e.target.value) })}
                  className="studio-slider w-full"
                />
                <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
                  <span>Mono</span>
                  <span>100%</span>
                  <span>Wide 160%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Module 4: Adaptive True-Peak Limiter */}
          <div className="bg-[#23262E] border border-[#363B47] rounded-lg p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-[#323743] pb-2">
              <div>
                <div className="text-xs font-bold text-[#F3F4F6]">4. Adaptive Limiter</div>
                <div className="text-[10px] text-[#9CA3AF]">Final Loudness &amp; Ceiling</div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateMastering({ limiterEnabled: !m.limiterEnabled })}
                className={`p-1.5 rounded ${
                  m.limiterEnabled ? 'bg-[#2563EB] text-white' : 'bg-[#181B21] text-[#6B7280]'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-[#14171D] border border-[#2C313D] rounded p-2">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#9CA3AF]">Limiter GR</span>
                <span className="font-mono-tabular text-red-400">-{meters.limiterGr.toFixed(1)} dB</span>
              </div>
              <div className="h-2 bg-[#0B0D12] rounded-xs overflow-hidden flex justify-end">
                <div
                  className="h-full bg-red-500 transition-[width] duration-75"
                  style={{ width: `${Math.min(100, (meters.limiterGr / 14) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-[#CBD5E1]">Loudness Drive (Gain)</span>
                  <span className="font-mono-tabular text-emerald-400">
                    +{m.limiterDrive.toFixed(1)} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.2}
                  value={m.limiterDrive}
                  onChange={(e) => onUpdateMastering({ limiterDrive: Number(e.target.value) })}
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-[#CBD5E1]">Out Ceiling (True Peak)</span>
                  <span className="font-mono-tabular text-sky-400">
                    {m.limiterCeiling.toFixed(1)} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={-0.1}
                  step={0.1}
                  value={m.limiterCeiling}
                  onChange={(e) => onUpdateMastering({ limiterCeiling: Number(e.target.value) })}
                  className="studio-slider w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
