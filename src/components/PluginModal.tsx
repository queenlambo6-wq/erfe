import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Power, X } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import {
  COMPRESSOR_PRESETS,
  createDefaultTrackFx,
  DRIVE_PRESETS,
  EQ_PRESETS,
} from '../data/presets';
import type {
  StudioTrack,
  TrackFxChain,
  TrackPluginType,
} from '../types/studio';
import {
  AutoTunePanel,
  Fet1176Panel,
  La2aPanel,
  Neve1073Panel,
  PultecPanel,
} from './ClassicPluginsUI';
import {
  EchoBoyPanel,
  FabProQPanel,
  FabProRPanel,
  FlConvolverPanel,
  FlEq2Panel,
  FlSoundgoodizerPanel,
} from './ModernPluginsUI';
import {
  FlChorusPanel,
  FlDelay3Panel,
  FlLimiterPanel,
  FlReeverb2Panel,
  FlSoftClipperPanel,
  GrossBeatPanel,
} from './FlStockPluginsUI';

interface PluginModalProps {
  track: StudioTrack;
  bpm: number;
  activePlugin: TrackPluginType;
  onSelectPlugin: (plugin: TrackPluginType) => void;
  onOpenReplacePicker: (track: StudioTrack, currentPlugin: TrackPluginType) => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onClose: () => void;
}

function evaluateEqGainDb(freq: number, eq: TrackFxChain['eq']): number {
  if (!eq.enabled) return 0;
  let db = 0;
  if (freq < eq.hpFreq * 1.4) {
    const ratio = freq / Math.max(20, eq.hpFreq);
    db -= Math.max(0, Math.pow(1 - ratio, 1.3) * 24);
  }
  const lowFactor = 1 / (1 + Math.pow(freq / Math.max(40, eq.lowFreq), 2));
  db += eq.lowGain * lowFactor;

  const logDist = Math.log2(freq / Math.max(100, eq.midFreq));
  const bell = Math.exp(-Math.pow(logDist * eq.midQ * 1.4, 2));
  db += eq.midGain * bell;

  const highFactor = 1 / (1 + Math.pow(Math.max(1000, eq.highFreq) / freq, 2));
  db += eq.highGain * highFactor;

  return Math.max(-18, Math.min(18, db));
}

export const PluginModal: React.FC<PluginModalProps> = ({
  track,
  bpm,
  activePlugin,
  onSelectPlugin,
  onOpenReplacePicker,
  onUpdateTrack,
  onClose,
}) => {
  const fx = createDefaultTrackFx(track.fx);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compGr, setCompGr] = useState(0);

  const updateFx = (next: TrackFxChain) => {
    onUpdateTrack(track.id, { fx: next });
  };

  useEffect(() => {
    if (activePlugin !== 'eq') return;
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = '#0F131A';
          ctx.fillRect(0, 0, w, h);

          const markers = [50, 100, 250, 500, 1000, 2000, 5000, 10000];
          ctx.strokeStyle = '#1E2533';
          ctx.lineWidth = 1;
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillStyle = '#64748B';
          for (const hz of markers) {
            const t = Math.log10(hz / 20) / 3;
            const x = t * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, x + 3, h - 6);
          }

          for (const db of [-12, -6, 0, 6, 12]) {
            const y = h / 2 - (db / 18) * (h / 2 - 12);
            ctx.strokeStyle = db === 0 ? '#334155' : '#1A202D';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          const fft = audioEngine.getTrackFrequencyData(track.id);
          if (fft.length > 0) {
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x < w; x += 3) {
              const t = x / w;
              const freq = 20 * Math.pow(1000, t);
              const bin = Math.min(fft.length - 1, Math.floor((freq / 22050) * fft.length));
              const mag = fft[bin] / 255;
              ctx.lineTo(x, h - mag * (h * 0.78));
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
            ctx.fill();
          }

          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const t = x / w;
            const freq = 20 * Math.pow(1000, t);
            const db = evaluateEqGainDb(freq, fx.eq);
            const y = h / 2 - (db / 18) * (h / 2 - 12);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = fx.eq.enabled ? '#38BDF8' : '#64748B';
          ctx.lineWidth = 2.4;
          ctx.stroke();

          if (fx.eq.enabled) {
            const handles = [
              { hz: fx.eq.hpFreq, db: -3, color: '#EF4444' },
              { hz: fx.eq.lowFreq, db: fx.eq.lowGain, color: '#F59E0B' },
              { hz: fx.eq.midFreq, db: fx.eq.midGain, color: '#10B981' },
              { hz: fx.eq.highFreq, db: fx.eq.highGain, color: '#A78BFA' },
            ];
            for (const b of handles) {
              const t = Math.max(0, Math.min(1, Math.log10(b.hz / 20) / 3));
              const x = t * w;
              const y = h / 2 - (b.db / 18) * (h / 2 - 12);
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fillStyle = b.color;
              ctx.fill();
              ctx.strokeStyle = '#0F131A';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [activePlugin, fx.eq, track.id]);

  useEffect(() => {
    if (activePlugin !== 'compressor') return;
    let raf = 0;
    const poll = () => {
      setCompGr(audioEngine.getTrackCompressorReduction(track.id));
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [activePlugin, track.id]);

  const currentEnabled = fx[activePlugin].enabled;

  const toggleCurrentEnabled = () => {
    updateFx({
      ...fx,
      [activePlugin]: { ...fx[activePlugin], enabled: !currentEnabled },
    });
  };

  const buildDriveCurvePath = () => {
    const k = Math.max(0.01, (fx.drive.drive / 100) * 18);
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const xNorm = (i / 40) * 2 - 1;
      const yNorm = fx.drive.enabled ? Math.tanh(xNorm * (1 + k)) / Math.tanh(1 + k) : xNorm;
      const x = (i / 40) * 220;
      const y = 70 - yNorm * 58;
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const classicTabs: { id: TrackPluginType; name: string; active: boolean }[] = [
    { id: 'autotune', name: 'Auto-Tune Pro', active: fx.autotune.enabled },
    { id: 'neve1073', name: 'Neve 1073', active: fx.neve1073.enabled },
    { id: 'pultec', name: 'Pultec EQP-1A', active: fx.pultec.enabled },
    { id: 'fet1176', name: '1176LN', active: fx.fet1176.enabled },
    { id: 'la2a', name: 'LA-2A', active: fx.la2a.enabled },
  ];

  const flTabs: { id: TrackPluginType; name: string; active: boolean }[] = [
    { id: 'flEq2', name: 'FL EQ 2', active: fx.flEq2.enabled },
    { id: 'flConvolver', name: 'Convolver', active: fx.flConvolver.enabled },
    { id: 'flSoundgoodizer', name: 'Soundgoodizer', active: fx.flSoundgoodizer.enabled },
    { id: 'flReeverb2', name: 'Reeverb 2', active: fx.flReeverb2.enabled },
    { id: 'flDelay3', name: 'Delay 3', active: fx.flDelay3.enabled },
    { id: 'grossBeat', name: 'Gross Beat', active: fx.grossBeat.enabled },
    { id: 'flSoftClipper', name: 'Soft Clipper', active: fx.flSoftClipper.enabled },
    { id: 'flLimiter', name: 'Fruity Limiter', active: fx.flLimiter.enabled },
    { id: 'flChorus', name: 'Fruity Chorus', active: fx.flChorus.enabled },
  ];

  const modernTabs: { id: TrackPluginType; name: string; active: boolean }[] = [
    { id: 'fabProQ', name: 'FabFilter Pro-Q 3', active: fx.fabProQ.enabled },
    { id: 'fabProR', name: 'FabFilter Pro-R 2', active: fx.fabProR.enabled },
    { id: 'echoBoy', name: 'EchoBoy', active: fx.echoBoy.enabled },
  ];

  const logicTabs: { id: TrackPluginType; name: string; active: boolean }[] = [
    { id: 'eq', name: 'Channel EQ', active: fx.eq.enabled },
    { id: 'compressor', name: 'Logic Comp', active: fx.compressor.enabled },
    { id: 'drive', name: 'Phat Drive', active: fx.drive.enabled },
    { id: 'stereo', name: 'Stereo', active: fx.stereo.enabled },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-[#252830] border border-[#444A58] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Logic Pro Plugin Window Top Bar */}
        <div className="logic-toolbar-bg px-4 py-2.5 border-b border-[#14161A] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close plugin window"
              className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:brightness-110 flex items-center justify-center text-[#5A0E0B]"
            >
              <X className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={toggleCurrentEnabled}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                currentEnabled
                  ? 'bg-[#2563EB] border-sky-400/60 text-white'
                  : 'bg-[#1C1F26] border-[#383E4A] text-[#9CA3AF]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{currentEnabled ? 'Inserted (On)' : 'Bypassed'}</span>
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: track.color }}
              />
              <span className="font-semibold text-[#F3F4F6]">{track.name}</span>
              <span className="text-[#6B7280]">·</span>
              <span className="text-[#9CA3AF]">Studio Plugin Rack</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenReplacePicker(track, activePlugin)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-semibold text-amber-200 transition-colors whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Replace Plugin</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#9CA3AF] hover:text-white px-2.5 py-1 rounded bg-[#1D2027] border border-[#353A46]"
            >
              Done (Esc)
            </button>
          </div>
        </div>

        {/* Multi-Suite Plugin Selector Rack */}
        <div className="px-4 py-2 bg-[#1A1D24] border-b border-[#2C313D] space-y-1.5">
          <div className="flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-semibold text-amber-400/90 mr-1 whitespace-nowrap">
                UAD &amp; Vocal:
              </span>
              {classicTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectPlugin(tab.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePlugin === tab.id
                      ? 'bg-[#2B629B] text-white'
                      : 'bg-[#232732] text-[#B5BCC9] hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.active ? 'bg-emerald-400' : 'bg-[#4B5563]'}`} />
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-semibold text-orange-400/90 mr-1 whitespace-nowrap">
                FL Studio:
              </span>
              {flTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectPlugin(tab.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePlugin === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-[#232732] text-[#B5BCC9] hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.active ? 'bg-orange-400' : 'bg-[#4B5563]'}`} />
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-semibold text-teal-400/90 mr-1 whitespace-nowrap">
                FabFilter &amp; Soundtoys:
              </span>
              {modernTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectPlugin(tab.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePlugin === tab.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-[#232732] text-[#B5BCC9] hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.active ? 'bg-teal-300' : 'bg-[#4B5563]'}`} />
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-semibold text-sky-400/90 mr-1 whitespace-nowrap">
                Logic FX:
              </span>
              {logicTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectPlugin(tab.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePlugin === tab.id
                      ? 'bg-[#2B629B] text-white'
                      : 'bg-[#232732] text-[#B5BCC9] hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.active ? 'bg-sky-400' : 'bg-[#4B5563]'}`} />
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active Plugin Faceplate */}
        <div className="p-5 bg-[#1C1F26] overflow-y-auto">
          {activePlugin === 'autotune' && (
            <AutoTunePanel
              trackId={track.id}
              settings={fx.autotune}
              onChange={(autotune) => updateFx({ ...fx, autotune })}
            />
          )}

          {activePlugin === 'neve1073' && (
            <Neve1073Panel
              settings={fx.neve1073}
              onChange={(neve1073) => updateFx({ ...fx, neve1073 })}
            />
          )}

          {activePlugin === 'pultec' && (
            <PultecPanel
              settings={fx.pultec}
              onChange={(pultec) => updateFx({ ...fx, pultec })}
            />
          )}

          {activePlugin === 'fet1176' && (
            <Fet1176Panel
              trackId={track.id}
              settings={fx.fet1176}
              onChange={(fet1176) => updateFx({ ...fx, fet1176 })}
            />
          )}

          {activePlugin === 'la2a' && (
            <La2aPanel
              trackId={track.id}
              settings={fx.la2a}
              onChange={(la2a) => updateFx({ ...fx, la2a })}
            />
          )}

          {activePlugin === 'flEq2' && (
            <FlEq2Panel
              trackId={track.id}
              settings={fx.flEq2}
              onChange={(flEq2) => updateFx({ ...fx, flEq2 })}
            />
          )}

          {activePlugin === 'flConvolver' && (
            <FlConvolverPanel
              settings={fx.flConvolver}
              onChange={(flConvolver) => updateFx({ ...fx, flConvolver })}
            />
          )}

          {activePlugin === 'flSoundgoodizer' && (
            <FlSoundgoodizerPanel
              settings={fx.flSoundgoodizer}
              onChange={(flSoundgoodizer) => updateFx({ ...fx, flSoundgoodizer })}
            />
          )}

          {activePlugin === 'flReeverb2' && (
            <FlReeverb2Panel
              settings={fx.flReeverb2}
              onChange={(flReeverb2) => updateFx({ ...fx, flReeverb2 })}
            />
          )}

          {activePlugin === 'flDelay3' && (
            <FlDelay3Panel
              bpm={bpm}
              settings={fx.flDelay3}
              onChange={(flDelay3) => updateFx({ ...fx, flDelay3 })}
            />
          )}

          {activePlugin === 'grossBeat' && (
            <GrossBeatPanel
              settings={fx.grossBeat}
              onChange={(grossBeat) => updateFx({ ...fx, grossBeat })}
            />
          )}

          {activePlugin === 'flSoftClipper' && (
            <FlSoftClipperPanel
              settings={fx.flSoftClipper}
              onChange={(flSoftClipper) => updateFx({ ...fx, flSoftClipper })}
            />
          )}

          {activePlugin === 'flLimiter' && (
            <FlLimiterPanel
              settings={fx.flLimiter}
              onChange={(flLimiter) => updateFx({ ...fx, flLimiter })}
            />
          )}

          {activePlugin === 'flChorus' && (
            <FlChorusPanel
              settings={fx.flChorus}
              onChange={(flChorus) => updateFx({ ...fx, flChorus })}
            />
          )}

          {activePlugin === 'fabProQ' && (
            <FabProQPanel
              trackId={track.id}
              settings={fx.fabProQ}
              onChange={(fabProQ) => updateFx({ ...fx, fabProQ })}
            />
          )}

          {activePlugin === 'fabProR' && (
            <FabProRPanel
              settings={fx.fabProR}
              onChange={(fabProR) => updateFx({ ...fx, fabProR })}
            />
          )}

          {activePlugin === 'echoBoy' && (
            <EchoBoyPanel
              bpm={bpm}
              settings={fx.echoBoy}
              onChange={(echoBoy) => updateFx({ ...fx, echoBoy })}
            />
          )}

          {/* LOGIC CHANNEL EQ */}
          {activePlugin === 'eq' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-[#9CA3AF]">
                  4-Band Parametric Equalizer + Real-Time FFT Analyzer
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#9CA3AF]">Preset:</span>
                  {Object.entries(EQ_PRESETS).map(([name, vals]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateFx({ ...fx, eq: { ...fx.eq, ...vals } })}
                      className="px-2 py-1 rounded bg-[#272B35] hover:bg-[#333947] border border-[#3A404E] text-[11px] text-[#E5E7EB] transition-colors whitespace-nowrap"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#313744] overflow-hidden">
                <canvas ref={canvasRef} width={760} height={190} className="w-full h-48 block" />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-400">Low Cut (HPF)</span>
                    <span className="font-mono-tabular text-[11px] text-[#E5E7EB]">{fx.eq.hpFreq} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={400}
                    step={5}
                    value={fx.eq.hpFreq}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, hpFreq: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">Low Shelf</span>
                    <span className="font-mono-tabular text-[11px] text-[#E5E7EB]">
                      {fx.eq.lowGain >= 0 ? `+${fx.eq.lowGain.toFixed(1)}` : fx.eq.lowGain.toFixed(1)} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={0.5}
                    value={fx.eq.lowGain}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, lowGain: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                  <input
                    type="range"
                    min={40}
                    max={300}
                    step={5}
                    value={fx.eq.lowFreq}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, lowFreq: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">Mid Bell</span>
                    <span className="font-mono-tabular text-[11px] text-[#E5E7EB]">
                      {fx.eq.midGain >= 0 ? `+${fx.eq.midGain.toFixed(1)}` : fx.eq.midGain.toFixed(1)} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={0.5}
                    value={fx.eq.midGain}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, midGain: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                  <input
                    type="range"
                    min={300}
                    max={4000}
                    step={25}
                    value={fx.eq.midFreq}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, midFreq: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                  <input
                    type="range"
                    min={0.4}
                    max={4}
                    step={0.1}
                    value={fx.eq.midQ}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, midQ: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-400">High Shelf</span>
                    <span className="font-mono-tabular text-[11px] text-[#E5E7EB]">
                      {fx.eq.highGain >= 0 ? `+${fx.eq.highGain.toFixed(1)}` : fx.eq.highGain.toFixed(1)} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={0.5}
                    value={fx.eq.highGain}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, highGain: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                  <input
                    type="range"
                    min={3500}
                    max={14000}
                    step={250}
                    value={fx.eq.highFreq}
                    onChange={(e) => updateFx({ ...fx, eq: { ...fx.eq, highFreq: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LOGIC STUDIO COMPRESSOR */}
          {activePlugin === 'compressor' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#9CA3AF]">Logic Studio VCA Dynamics Processor</div>
                <div className="flex items-center gap-1.5">
                  {Object.entries(COMPRESSOR_PRESETS).map(([name, vals]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateFx({ ...fx, compressor: { ...fx.compressor, ...vals } })}
                      className="px-2 py-1 rounded bg-[#272B35] hover:bg-[#333947] border border-[#3A404E] text-[11px] text-[#E5E7EB]"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#13161C] border border-[#2F3543] rounded-lg p-4 flex items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] mb-2">
                    <span>Gain Reduction (GR)</span>
                    <span className="font-mono-tabular font-semibold text-amber-400">
                      -{compGr.toFixed(1)} dB
                    </span>
                  </div>
                  <div className="h-5 bg-[#0B0D12] border border-[#2B303C] rounded overflow-hidden flex justify-end p-0.5">
                    <div
                      className="h-full bg-gradient-to-l from-amber-500 to-red-500 rounded-xs transition-[width] duration-75"
                      style={{ width: `${Math.min(100, (compGr / 20) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-36 text-right border-l border-[#282D3A] pl-4">
                  <div className="font-mono-tabular text-lg font-bold text-[#F3F4F6]">
                    {fx.compressor.ratio.toFixed(1)}:1
                  </div>
                  <div className="font-mono-tabular text-xs text-sky-400">
                    +{fx.compressor.makeupGain.toFixed(1)} dB Out
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Threshold', value: fx.compressor.threshold, display: `${fx.compressor.threshold.toFixed(0)} dB`, min: -48, max: 0, step: 1, onChange: (v: number) => updateFx({ ...fx, compressor: { ...fx.compressor, threshold: v } }) },
                  { label: 'Ratio', value: fx.compressor.ratio, display: `${fx.compressor.ratio.toFixed(1)} : 1`, min: 1, max: 20, step: 0.5, onChange: (v: number) => updateFx({ ...fx, compressor: { ...fx.compressor, ratio: v } }) },
                  { label: 'Makeup Gain', value: fx.compressor.makeupGain, display: `+${fx.compressor.makeupGain.toFixed(1)} dB`, min: 0, max: 18, step: 0.5, onChange: (v: number) => updateFx({ ...fx, compressor: { ...fx.compressor, makeupGain: v } }) },
                  { label: 'Attack', value: fx.compressor.attack, display: `${Math.round(fx.compressor.attack * 1000)} ms`, min: 0.001, max: 0.2, step: 0.002, onChange: (v: number) => updateFx({ ...fx, compressor: { ...fx.compressor, attack: v } }) },
                  { label: 'Release', value: fx.compressor.release, display: `${Math.round(fx.compressor.release * 1000)} ms`, min: 0.03, max: 0.8, step: 0.01, onChange: (v: number) => updateFx({ ...fx, compressor: { ...fx.compressor, release: v } }) },
                  { label: 'Knee', value: fx.compressor.knee, display: `${fx.compressor.knee.toFixed(0)} dB`, min: 0, max: 30, step: 1, onChange: (v: number) => updateFx({ ...fx, compressor: { ...fx.compressor, knee: v } }) },
                ].map((ctrl) => (
                  <div key={ctrl.label} className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs mb-2">
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
          )}

          {/* LOGIC PHAT FX DRIVE */}
          {activePlugin === 'drive' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#9CA3AF]">Analog Harmonic Distortion &amp; Warm Tape Saturation</div>
                <div className="flex items-center gap-1.5">
                  {Object.entries(DRIVE_PRESETS).map(([name, vals]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateFx({ ...fx, drive: { ...fx.drive, ...vals } })}
                      className="px-2 py-1 rounded bg-[#272B35] hover:bg-[#333947] border border-[#3A404E] text-[11px] text-[#E5E7EB]"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 items-center">
                <div className="col-span-2 bg-[#11141B] border border-[#2E3442] rounded-lg p-3 flex flex-col items-center">
                  <span className="text-[10px] text-[#9CA3AF] self-start mb-1">Harmonic Transfer Curve</span>
                  <svg viewBox="0 0 220 140" className="w-full h-36">
                    <line x1="0" y1="70" x2="220" y2="70" stroke="#232936" strokeWidth="1" />
                    <line x1="110" y1="0" x2="110" y2="140" stroke="#232936" strokeWidth="1" />
                    <path d={buildDriveCurvePath()} fill="none" stroke={fx.drive.enabled ? '#F59E0B' : '#64748B'} strokeWidth="2.5" />
                  </svg>
                </div>

                <div className="col-span-3 space-y-3">
                  <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-medium text-[#E5E7EB]">Drive Intensity</span>
                      <span className="font-mono-tabular text-amber-400">{fx.drive.drive}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={fx.drive.drive}
                      onChange={(e) => updateFx({ ...fx, drive: { ...fx.drive, drive: Number(e.target.value) } })}
                      className="studio-slider w-full"
                    />
                  </div>
                  <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-medium text-[#E5E7EB]">Analog Tone Filter</span>
                      <span className="font-mono-tabular text-sky-400">{(fx.drive.tone / 1000).toFixed(1)} kHz</span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={16000}
                      step={250}
                      value={fx.drive.tone}
                      onChange={(e) => updateFx({ ...fx, drive: { ...fx.drive, tone: Number(e.target.value) } })}
                      className="studio-slider w-full"
                    />
                  </div>
                  <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-3.5">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-medium text-[#E5E7EB]">Dry / Wet Mix</span>
                      <span className="font-mono-tabular text-emerald-400">{Math.round(fx.drive.mix * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={fx.drive.mix}
                      onChange={(e) => updateFx({ ...fx, drive: { ...fx.drive, mix: Number(e.target.value) } })}
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGIC STEREO SPREAD & SENDS */}
          {activePlugin === 'stereo' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-4 space-y-4">
                <div className="text-xs font-semibold text-[#F3F4F6]">Mid/Side Stereo Imager</div>
                <div className="h-24 bg-[#0E1117] border border-[#29303E] rounded flex items-center justify-center">
                  <div
                    className="h-14 rounded-full bg-sky-500/20 border border-sky-400/60 transition-all duration-150 flex items-center justify-center font-mono-tabular text-xs font-semibold text-sky-300"
                    style={{ width: `${Math.max(14, Math.min(92, fx.stereo.width * 45))}%` }}
                  >
                    {Math.round(fx.stereo.width * 100)}%
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#CBD5E1]">Stereo Width</span>
                    <span className="font-mono-tabular text-sky-400">
                      {fx.stereo.width === 0 ? 'Mono' : `${Math.round(fx.stereo.width * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={fx.stereo.width}
                    onChange={(e) => updateFx({ ...fx, stereo: { ...fx.stereo, width: Number(e.target.value) } })}
                    className="studio-slider w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#CBD5E1]">Stereo Pan</span>
                    <span className="font-mono-tabular text-[#E5E7EB]">
                      {Math.abs(track.pan) < 0.04 ? 'Center' : track.pan < 0 ? `${Math.round(Math.abs(track.pan) * 100)}% L` : `${Math.round(track.pan * 100)}% R`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={track.pan}
                    onChange={(e) => onUpdateTrack(track.id, { pan: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              </div>

              <div className="bg-[#15181E] border border-[#2D323E] rounded-lg p-4 space-y-5">
                <div className="text-xs font-semibold text-[#F3F4F6]">Aux Bus Space Sends</div>
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#E5E7EB] font-medium">Bus 1 · ChromaVerb Space</span>
                      <span className="font-mono-tabular text-sky-400">{Math.round(track.reverbSend * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={track.reverbSend}
                      onChange={(e) => onUpdateTrack(track.id, { reverbSend: Number(e.target.value) })}
                      className="studio-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#E5E7EB] font-medium">Bus 2 · Stereo Tape Delay</span>
                      <span className="font-mono-tabular text-amber-400">{Math.round(track.delaySend * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={track.delaySend}
                      onChange={(e) => onUpdateTrack(track.id, { delaySend: Number(e.target.value) })}
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
