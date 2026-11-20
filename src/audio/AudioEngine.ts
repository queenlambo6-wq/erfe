import type {
  AbletonMacroRack,
  AudioClip,
  AuxBusId,
  ConvolverImpulseType,
  DrumChannelId,
  EchoBoyDivision,
  EchoBoyStyle,
  InstrumentSynthParams,
  MasteringChain,
  OutputBusId,
  ParametricBand,
  StudioAuxBus,
  StudioProject,
  StudioTrack,
  SynthPreset,
  TrackFxChain,
} from '../types/studio';
import { createDefaultInstrumentParams } from '../data/instruments';
import {
  createDefaultAuxBuses,
  createDefaultBusSends,
  createDefaultMacroRack,
  createDefaultMasteringChain,
  createDefaultTrackFx,
  evaluateAutomationAtStep,
  midiToNoteName,
  quantizeMidiToAutoTune,
} from '../data/presets';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function createSaturationCurve(amount: number, asymmetric = false): Float32Array<ArrayBuffer> {
  const samples = 512;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = Math.max(0.01, (amount / 100) * 18);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const bias = asymmetric ? 0.08 * (amount / 100) : 0;
    const val = Math.tanh((x + bias) * (1 + k)) / Math.tanh(1 + k);
    curve[i] = Math.max(-1, Math.min(1, val - (asymmetric ? bias * 0.4 : 0)));
  }
  return curve;
}

function createReverbImpulse(ctx: BaseAudioContext, duration = 2.0, decay = 2.4): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function createStyledImpulse(
  ctx: BaseAudioContext,
  type: ConvolverImpulseType,
  decaySec: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const dur = Math.max(0.25, Math.min(6.0, decaySec));
  const length = Math.floor(sampleRate * dur);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lpState = 0;
    const chPhase = ch === 0 ? 1 : 1.09;

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      let sample = 0;

      if (type === 'reverse-swell') {
        const env = Math.pow(t, 2.6) * (1 - Math.pow(t, 16));
        lpState = lpState * 0.68 + white * 0.32;
        sample = lpState * env * 0.9;
      } else if (type === 'plate') {
        const env = Math.pow(1 - t, 1.85);
        const shimmer = 1 + 0.15 * Math.sin(i * 0.045 * chPhase);
        sample = white * env * shimmer * 0.75;
      } else if (type === 'spring') {
        const env = Math.pow(1 - t, 2.3);
        const boing = Math.sin(i * (0.025 + t * 0.015) * chPhase) * 0.35;
        lpState = lpState * 0.55 + (white * 0.65 + boing) * 0.45;
        sample = lpState * env * 0.85;
      } else if (type === 'vocal-booth') {
        const env = Math.pow(1 - t, 3.8);
        const earlyTap = i < sampleRate * 0.04 && i % Math.floor(sampleRate * 0.008) < 12 ? 0.55 : 0;
        lpState = lpState * 0.6 + white * 0.4;
        sample = (lpState + earlyTap * white) * env * 0.72;
      } else if (type === 'blur-pink') {
        const env = Math.sin(Math.min(1, t * 5) * (Math.PI / 2)) * Math.pow(1 - t, 1.65);
        lpState = lpState * 0.82 + white * 0.18;
        sample = lpState * env * 0.95;
      } else {
        // Cathedral Hall
        const env = Math.pow(1 - t, 2.15) * (1 - Math.exp(-t * 28));
        lpState = lpState * 0.58 + white * 0.42;
        sample = lpState * env * 0.82;
      }

      data[i] = Math.max(-1, Math.min(1, sample));
    }
  }
  return buffer;
}

function createProRImpulse(
  ctx: BaseAudioContext,
  spaceSec: number,
  character: number,
  distance: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const dur = Math.max(0.25, Math.min(7.5, spaceSec));
  const length = Math.floor(sampleRate * dur);
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const distNorm = Math.max(0, Math.min(1, distance / 100));
  const charNorm = Math.max(0, Math.min(1, character / 100));

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smooth = 0;
    const modRate = ch === 0 ? 0.0008 : 0.0011;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      const attackShape = 1 - Math.exp(-t * (12 + (1 - distNorm) * 45));
      const decayExp = 1.65 + (1 - distNorm) * 1.4;
      const env = attackShape * Math.pow(1 - t, decayExp);
      const chorus = 1 + charNorm * 0.25 * Math.sin(i * modRate * (1 + charNorm * 2));
      smooth = smooth * (0.45 + distNorm * 0.28) + white * (0.55 - distNorm * 0.28);
      data[i] = Math.max(-1, Math.min(1, smooth * env * chorus * 0.85));
    }
  }
  return buffer;
}

function echoDivisionBeats(div: EchoBoyDivision): number {
  switch (div) {
    case '1/16':
      return 0.25;
    case '1/8':
      return 0.5;
    case '1/8D':
      return 0.75;
    case '1/4':
      return 1.0;
    case '1/4D':
      return 1.5;
    case '1/2':
      return 2.0;
  }
}

function echoStyleCharacter(style: EchoBoyStyle): { satBoost: number; highCap: number; lowFloor: number } {
  switch (style) {
    case 'echoplex':
      return { satBoost: 1.35, highCap: 4400, lowFloor: 210 };
    case 'space-echo':
      return { satBoost: 1.25, highCap: 5400, lowFloor: 170 };
    case 'dm2-analog':
      return { satBoost: 1.5, highCap: 3100, lowFloor: 240 };
    case 'memory-man':
      return { satBoost: 1.15, highCap: 6800, lowFloor: 140 };
    case 'telray':
      return { satBoost: 1.4, highCap: 3600, lowFloor: 280 };
    case 'studio-tape':
      return { satBoost: 1.05, highCap: 9500, lowFloor: 100 };
    case 'ambient':
      return { satBoost: 0.75, highCap: 8200, lowFloor: 150 };
    default:
      return { satBoost: 1.0, highCap: 7200, lowFloor: 130 };
  }
}

function applyParametricBandNode(
  node: BiquadFilterNode,
  band: ParametricBand,
  pluginEnabled: boolean,
  now: number
): void {
  if (!pluginEnabled || !band.enabled) {
    if (node.type !== 'peaking') node.type = 'peaking';
    node.gain.setTargetAtTime(0, now, 0.015);
    return;
  }
  if (node.type !== band.type) {
    node.type = band.type;
  }
  node.frequency.setTargetAtTime(Math.max(20, Math.min(20000, band.freq)), now, 0.015);
  node.Q.setTargetAtTime(Math.max(0.3, Math.min(12, band.q)), now, 0.015);
  if (band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf') {
    node.gain.setTargetAtTime(Math.max(-18, Math.min(18, band.gain)), now, 0.015);
  } else {
    node.gain.setTargetAtTime(0, now, 0.015);
  }
}

function createNoiseBuffer(ctx: BaseAudioContext, duration = 1.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function detectPitchAutocorrelation(buf: Float32Array, sampleRate: number): number {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.015) return -1;

  const minLag = Math.floor(sampleRate / 1100);
  const maxLag = Math.min(Math.floor(sampleRate / 65), Math.floor(size / 2));
  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag < maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < size - lag; i += 2) {
      corr += buf[i] * buf[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < 0.02) return -1;
  return sampleRate / bestLag;
}

export interface TrackPitchTelemetry {
  active: boolean;
  detectedHz: number;
  detectedNote: string;
  targetNote: string;
  centsOffset: number;
}

interface MidSideStage {
  input: GainNode;
  output: GainNode;
  setWidth: (width: number, time: number) => void;
}

function createMidSideStage(ctx: BaseAudioContext): MidSideStage {
  const input = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const output = ctx.createGain();

  const midL = ctx.createGain();
  const midR = ctx.createGain();
  midL.gain.value = 0.5;
  midR.gain.value = 0.5;

  const sideL = ctx.createGain();
  const sideR = ctx.createGain();
  sideL.gain.value = 0.5;
  sideR.gain.value = -0.5;

  const midSum = ctx.createGain();
  const sideSum = ctx.createGain();
  const sideWidthGain = ctx.createGain();
  sideWidthGain.gain.value = 1.0;

  const sideInvert = ctx.createGain();
  sideInvert.gain.value = -1.0;

  input.connect(splitter);
  splitter.connect(midL, 0);
  splitter.connect(midR, 1);
  midL.connect(midSum);
  midR.connect(midSum);

  splitter.connect(sideL, 0);
  splitter.connect(sideR, 1);
  sideL.connect(sideSum);
  sideR.connect(sideSum);
  sideSum.connect(sideWidthGain);
  sideWidthGain.connect(sideInvert);

  midSum.connect(merger, 0, 0);
  sideWidthGain.connect(merger, 0, 0);
  midSum.connect(merger, 0, 1);
  sideInvert.connect(merger, 0, 1);

  merger.connect(output);

  return {
    input,
    output,
    setWidth: (width: number, time: number) => {
      const clamped = Math.max(0, Math.min(2, width));
      sideWidthGain.gain.setTargetAtTime(clamped, time, 0.02);
    },
  };
}

interface TrackAudioNodes {
  input: GainNode;
  monoNode: GainNode;

  // Antares Auto-Tune Formant / Classic Character
  atFormant: BiquadFilterNode;
  atClassicPresence: BiquadFilterNode;

  // UAD Neve 1073 Preamp & EQ
  neveShaper: WaveShaperNode;
  neveDry: GainNode;
  neveWet: GainNode;
  neveSum: GainNode;
  neveHp: BiquadFilterNode;
  neveLow: BiquadFilterNode;
  neveMid: BiquadFilterNode;
  neveHigh: BiquadFilterNode;
  neveTrim: GainNode;
  lastNeveDrive: number;

  // UAD Pultec EQP-1A Tube EQ
  pultecLowBoost: BiquadFilterNode;
  pultecLowAtten: BiquadFilterNode;
  pultecHighBoost: BiquadFilterNode;
  pultecHighAtten: BiquadFilterNode;

  // UAD 1176LN FET Limiter
  fetInput: GainNode;
  fetComp: DynamicsCompressorNode;
  fetGrit: WaveShaperNode;
  fetDry: GainNode;
  fetWet: GainNode;
  fetOutput: GainNode;

  // UAD Teletronix LA-2A Optical Tube Leveler
  la2aComp: DynamicsCompressorNode;
  la2aTube: WaveShaperNode;
  la2aDry: GainNode;
  la2aWet: GainNode;
  la2aGain: GainNode;
  lastLa2aWarmth: number;

  // FL Parametric EQ 2 (7-Band)
  flEq2Bands: BiquadFilterNode[];
  flEq2Gain: GainNode;

  // FabFilter Pro-Q 3 (6-Band)
  fabProQBands: BiquadFilterNode[];
  fabProQGain: GainNode;

  // FL Soundgoodizer (Maximus A/B/C/D Exciter)
  sgDry: GainNode;
  sgLow: BiquadFilterNode;
  sgHigh: BiquadFilterNode;
  sgComp: DynamicsCompressorNode;
  sgShaper: WaveShaperNode;
  sgWet: GainNode;
  sgSum: GainNode;
  lastSgKey: string;

  // Logic Channel EQ + Studio Comp + Phat Drive + Stereo Spread
  hpFilter: BiquadFilterNode;
  lowShelf: BiquadFilterNode;
  midPeak: BiquadFilterNode;
  highShelf: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  compMakeup: GainNode;
  driveDry: GainNode;
  driveWet: GainNode;
  shaper: WaveShaperNode;
  driveTone: BiquadFilterNode;
  driveSum: GainNode;
  midSide: MidSideStage;

  // Soundtoys EchoBoy Analog Stereo Delay
  ebDry: GainNode;
  ebSat: WaveShaperNode;
  ebLowCut: BiquadFilterNode;
  ebHighCut: BiquadFilterNode;
  ebDelayL: DelayNode;
  ebDelayR: DelayNode;
  ebFbL: GainNode;
  ebFbR: GainNode;
  ebFbCrossL: GainNode;
  ebFbCrossR: GainNode;
  ebMerger: ChannelMergerNode;
  ebWet: GainNode;
  ebSum: GainNode;
  lastEbSatKey: string;

  // FL Fruity Convolver (Impulse Response Reverb)
  convDry: GainNode;
  convPreDelay: DelayNode;
  convNode: ConvolverNode;
  convLowCut: BiquadFilterNode;
  convHighCut: BiquadFilterNode;
  convStereo: MidSideStage;
  convWet: GainNode;
  convSum: GainNode;
  lastConvKey: string;

  // FabFilter Pro-R 2 Space Reverb
  proRDry: GainNode;
  proRPreDelay: DelayNode;
  proRConv: ConvolverNode;
  proRBright: BiquadFilterNode;
  proRWet: GainNode;
  proRSum: GainNode;
  lastProRKey: string;

  // FL Stock FX Suite (Soft Clipper, Limiter, Chorus, Delay 3, Reeverb 2, Gross Beat)
  flSoftDry: GainNode;
  flSoftWet: GainNode;
  flSoftShaper: WaveShaperNode;
  flSoftOut: GainNode;
  lastFlSoftKey: string;

  flLimDrive: GainNode;
  flLimComp: DynamicsCompressorNode;
  flLimOut: GainNode;

  flChorusDry: GainNode;
  flChorusWet: GainNode;
  flChorusDelay: DelayNode;
  flChorusLfo: OscillatorNode;
  flChorusLfoGain: GainNode;
  flChorusSum: GainNode;

  flDel3Dry: GainNode;
  flDel3Delay: DelayNode;
  flDel3Tone: BiquadFilterNode;
  flDel3Fb: GainNode;
  flDel3Wet: GainNode;
  flDel3Sum: GainNode;

  flRev2Dry: GainNode;
  flRev2PreDelay: DelayNode;
  flRev2Conv: ConvolverNode;
  flRev2HighCut: BiquadFilterNode;
  flRev2Wet: GainNode;
  flRev2Sum: GainNode;
  lastFlRev2Key: string;

  grossBeatGain: GainNode;

  automationFilter: BiquadFilterNode;
  fader: GainNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  currentOutputBus: OutputBusId;
  preSendGains: Record<AuxBusId, GainNode>;
  postSendGains: Record<AuxBusId, GainNode>;
  lastDriveVal: number;
}

interface AuxBusAudioNodes {
  id: AuxBusId;
  input: GainNode;
  comp?: DynamicsCompressorNode;
  convolver?: ConvolverNode;
  delay?: DelayNode;
  delayFb?: GainNode;
  tone: BiquadFilterNode;
  midSide: MidSideStage;
  fader: GainNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  lastDecaySec: number;
}

interface MasterBusNodes {
  input: GainNode;

  // Ableton Live Performance Macro Rack & Beat Repeat
  djFilter: BiquadFilterNode;
  macroTapeDry: GainNode;
  macroTapeWet: GainNode;
  macroTapeShaper: WaveShaperNode;
  macroTapeSum: GainNode;
  macroOttDry: GainNode;
  macroOttWet: GainNode;
  macroOttComp: DynamicsCompressorNode;
  macroOttSum: GainNode;
  macroRepeatDry: GainNode;
  macroRepeatWet: GainNode;
  macroRepeatDelay: DelayNode;
  macroRepeatFb: GainNode;
  macroRepeatSum: GainNode;
  macroSpaceSend: GainNode;
  macroEchoSend: GainNode;
  lastMacroTape: number;

  // Mastering Chain
  lowCut: BiquadFilterNode;
  subShelf: BiquadFilterNode;
  mudPeak: BiquadFilterNode;
  presencePeak: BiquadFilterNode;
  airShelf: BiquadFilterNode;
  glueComp: DynamicsCompressorNode;
  glueMakeup: GainNode;
  exciterDry: GainNode;
  exciterWet: GainNode;
  exciterShaper: WaveShaperNode;
  exciterSum: GainNode;
  midSide: MidSideStage;
  limiterDrive: GainNode;
  limiter: DynamicsCompressorNode;
  limiterCeiling: GainNode;
  masterGain: GainNode;
  analyserFFT: AnalyserNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;
  lastExciterAmount: number;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterBus: MasterBusNodes | null = null;
  private auxNodes = new Map<AuxBusId, AuxBusAudioNodes>();
  private noiseBuffer: AudioBuffer | null = null;

  private trackNodes = new Map<string, TrackAudioNodes>();
  private decodedClips = new Map<string, AudioBuffer>();
  private activeClipSources = new Set<AudioBufferSourceNode>();
  private trackActivity = new Map<string, number>();

  private projectRef: StudioProject | null = null;
  private isPlaying = false;
  private isLooping = true;
  private metronomeEnabled = false;
  private currentStep = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;
  private onStepChange: ((step: number) => void) | null = null;
  private onPlaybackStop: (() => void) | null = null;

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterBus = this.buildMasterBus(this.ctx);
      this.buildAuxBuses(this.ctx);
      const bus3 = this.auxNodes.get('bus-3');
      const bus4 = this.auxNodes.get('bus-4');
      if (bus3) this.masterBus.macroSpaceSend.connect(bus3.input);
      if (bus4) this.masterBus.macroEchoSend.connect(bus4.input);
      this.noiseBuffer = createNoiseBuffer(this.ctx, 1.0);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private buildAuxBuses(ctx: AudioContext): void {
    const defaults = createDefaultAuxBuses();
    for (const bus of defaults) {
      const input = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = bus.toneHz;
      const midSide = createMidSideStage(ctx);
      midSide.setWidth(bus.width, 0);
      const fader = ctx.createGain();
      fader.gain.value = bus.volume;
      const panner = ctx.createStereoPanner();
      panner.pan.value = bus.pan;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;

      const entry: AuxBusAudioNodes = {
        id: bus.id,
        input,
        tone,
        midSide,
        fader,
        panner,
        analyser,
        lastDecaySec: bus.decaySec,
      };

      if (bus.role === 'submix') {
        const comp = ctx.createDynamicsCompressor();
        comp.attack.value = 0.01;
        comp.release.value = 0.14;
        comp.knee.value = 8;
        comp.threshold.value = -16;
        comp.ratio.value = 3.0;
        input.connect(comp);
        comp.connect(tone);
        entry.comp = comp;
      } else if (bus.role === 'reverb') {
        const convolver = ctx.createConvolver();
        convolver.buffer = createReverbImpulse(ctx, Math.max(0.4, bus.decaySec), 2.3);
        input.connect(convolver);
        convolver.connect(tone);
        entry.convolver = convolver;
      } else {
        const delay = ctx.createDelay(2.0);
        delay.delayTime.value = 0.375;
        const delayFb = ctx.createGain();
        delayFb.gain.value = Math.min(0.85, bus.feedback / 100);
        input.connect(delay);
        delay.connect(tone);
        tone.connect(delayFb);
        delayFb.connect(delay);
        entry.delay = delay;
        entry.delayFb = delayFb;
      }

      tone.connect(midSide.input);
      midSide.output.connect(fader);
      fader.connect(panner);
      panner.connect(analyser);
      panner.connect(this.masterBus!.input);
      this.auxNodes.set(bus.id, entry);
    }
  }

  private buildMasterBus(ctx: AudioContext): MasterBusNodes {
    const input = ctx.createGain();

    // Ableton Live Performance Macro Rack (pre-mastering)
    const djFilter = ctx.createBiquadFilter();
    djFilter.type = 'allpass';
    djFilter.frequency.value = 1000;
    djFilter.Q.value = 1.0;

    const macroTapeDry = ctx.createGain();
    const macroTapeWet = ctx.createGain();
    macroTapeWet.gain.value = 0;
    const macroTapeShaper = ctx.createWaveShaper();
    macroTapeShaper.oversample = '2x';
    macroTapeShaper.curve = createSaturationCurve(18, true);
    const macroTapeSum = ctx.createGain();

    const macroOttDry = ctx.createGain();
    const macroOttWet = ctx.createGain();
    macroOttWet.gain.value = 0;
    const macroOttComp = ctx.createDynamicsCompressor();
    macroOttComp.threshold.value = -28;
    macroOttComp.ratio.value = 8;
    macroOttComp.attack.value = 0.004;
    macroOttComp.release.value = 0.085;
    macroOttComp.knee.value = 4;
    const macroOttSum = ctx.createGain();

    const macroRepeatDry = ctx.createGain();
    const macroRepeatWet = ctx.createGain();
    macroRepeatWet.gain.value = 0;
    const macroRepeatDelay = ctx.createDelay(2.0);
    macroRepeatDelay.delayTime.value = 0.16;
    const macroRepeatFb = ctx.createGain();
    macroRepeatFb.gain.value = 0;
    const macroRepeatSum = ctx.createGain();

    const macroSpaceSend = ctx.createGain();
    macroSpaceSend.gain.value = 0;
    const macroEchoSend = ctx.createGain();
    macroEchoSend.gain.value = 0;

    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 28;
    lowCut.Q.value = 0.7;

    const subShelf = ctx.createBiquadFilter();
    subShelf.type = 'lowshelf';
    subShelf.frequency.value = 65;

    const mudPeak = ctx.createBiquadFilter();
    mudPeak.type = 'peaking';
    mudPeak.frequency.value = 320;
    mudPeak.Q.value = 1.1;

    const presencePeak = ctx.createBiquadFilter();
    presencePeak.type = 'peaking';
    presencePeak.frequency.value = 2800;
    presencePeak.Q.value = 0.9;

    const airShelf = ctx.createBiquadFilter();
    airShelf.type = 'highshelf';
    airShelf.frequency.value = 10000;

    const glueComp = ctx.createDynamicsCompressor();
    glueComp.knee.value = 10;
    const glueMakeup = ctx.createGain();

    const exciterDry = ctx.createGain();
    const exciterWet = ctx.createGain();
    const exciterShaper = ctx.createWaveShaper();
    exciterShaper.oversample = '2x';
    exciterShaper.curve = createSaturationCurve(16);
    const exciterSum = ctx.createGain();

    const midSide = createMidSideStage(ctx);

    const limiterDrive = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.knee.value = 1;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    const limiterCeiling = ctx.createGain();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;

    const analyserFFT = ctx.createAnalyser();
    analyserFFT.fftSize = 1024;
    analyserFFT.smoothingTimeConstant = 0.8;

    const splitter = ctx.createChannelSplitter(2);
    const analyserL = ctx.createAnalyser();
    const analyserR = ctx.createAnalyser();
    analyserL.fftSize = 256;
    analyserR.fftSize = 256;
    analyserL.smoothingTimeConstant = 0.78;
    analyserR.smoothingTimeConstant = 0.78;

    // Wire Ableton Macro Rack -> Mastering Chain
    input.connect(djFilter);
    djFilter.connect(macroTapeDry);
    djFilter.connect(macroTapeShaper);
    macroTapeShaper.connect(macroTapeWet);
    macroTapeDry.connect(macroTapeSum);
    macroTapeWet.connect(macroTapeSum);

    macroTapeSum.connect(macroOttDry);
    macroTapeSum.connect(macroOttComp);
    macroOttComp.connect(macroOttWet);
    macroOttDry.connect(macroOttSum);
    macroOttWet.connect(macroOttSum);

    macroOttSum.connect(macroSpaceSend);
    macroOttSum.connect(macroEchoSend);

    macroOttSum.connect(macroRepeatDry);
    macroOttSum.connect(macroRepeatDelay);
    macroRepeatDelay.connect(macroRepeatFb);
    macroRepeatFb.connect(macroRepeatDelay);
    macroRepeatDelay.connect(macroRepeatWet);
    macroRepeatDry.connect(macroRepeatSum);
    macroRepeatWet.connect(macroRepeatSum);

    macroRepeatSum.connect(lowCut);
    lowCut.connect(subShelf);
    subShelf.connect(mudPeak);
    mudPeak.connect(presencePeak);
    presencePeak.connect(airShelf);
    airShelf.connect(glueComp);
    glueComp.connect(glueMakeup);

    glueMakeup.connect(exciterDry);
    glueMakeup.connect(exciterShaper);
    exciterShaper.connect(exciterWet);
    exciterDry.connect(exciterSum);
    exciterWet.connect(exciterSum);

    exciterSum.connect(midSide.input);
    midSide.output.connect(limiterDrive);
    limiterDrive.connect(limiter);
    limiter.connect(limiterCeiling);
    limiterCeiling.connect(masterGain);

    masterGain.connect(analyserFFT);
    masterGain.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    masterGain.connect(ctx.destination);

    return {
      input,
      djFilter,
      macroTapeDry,
      macroTapeWet,
      macroTapeShaper,
      macroTapeSum,
      macroOttDry,
      macroOttWet,
      macroOttComp,
      macroOttSum,
      macroRepeatDry,
      macroRepeatWet,
      macroRepeatDelay,
      macroRepeatFb,
      macroRepeatSum,
      macroSpaceSend,
      macroEchoSend,
      lastMacroTape: 18,
      lowCut,
      subShelf,
      mudPeak,
      presencePeak,
      airShelf,
      glueComp,
      glueMakeup,
      exciterDry,
      exciterWet,
      exciterShaper,
      exciterSum,
      midSide,
      limiterDrive,
      limiter,
      limiterCeiling,
      masterGain,
      analyserFFT,
      analyserL,
      analyserR,
      lastExciterAmount: 16,
    };
  }

  private applyTrackFx(nodes: TrackAudioNodes, fxRaw?: TrackFxChain): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fx = createDefaultTrackFx(fxRaw);

    // 0. Auto-Tune Formant / Classic Mode Vocal Character
    if (fx.autotune.enabled) {
      const formantShiftHz = 1150 * Math.pow(2, fx.autotune.formant / 16);
      nodes.atFormant.frequency.setTargetAtTime(Math.max(320, Math.min(3600, formantShiftHz)), now, 0.02);
      nodes.atFormant.gain.setTargetAtTime(fx.autotune.formant === 0 ? 0 : Math.min(7, Math.abs(fx.autotune.formant) * 0.65), now, 0.02);
      nodes.atClassicPresence.gain.setTargetAtTime(fx.autotune.classicMode ? 3.5 : 0.8, now, 0.02);
    } else {
      nodes.atFormant.gain.setTargetAtTime(0, now, 0.02);
      nodes.atClassicPresence.gain.setTargetAtTime(0, now, 0.02);
    }

    // 1. UAD Neve 1073 Preamp & Inductor EQ
    if (fx.neve1073.enabled) {
      const drivePct = Math.min(100, (fx.neve1073.preampDrive / 60) * 100);
      if (Math.abs(nodes.lastNeveDrive - drivePct) > 1) {
        nodes.neveShaper.curve = createSaturationCurve(drivePct * 0.75, true);
        nodes.lastNeveDrive = drivePct;
      }
      const wet = Math.min(0.6, (fx.neve1073.preampDrive / 60) * 0.55);
      nodes.neveDry.gain.setTargetAtTime(1 - wet * 0.45, now, 0.02);
      nodes.neveWet.gain.setTargetAtTime(wet, now, 0.02);

      nodes.neveHp.frequency.setTargetAtTime(fx.neve1073.hpFreq > 0 ? fx.neve1073.hpFreq : 15, now, 0.02);
      nodes.neveLow.frequency.setTargetAtTime(fx.neve1073.lowFreq, now, 0.02);
      nodes.neveLow.gain.setTargetAtTime(fx.neve1073.lowGain, now, 0.02);
      nodes.neveMid.frequency.setTargetAtTime(fx.neve1073.midFreq, now, 0.02);
      nodes.neveMid.gain.setTargetAtTime(fx.neve1073.midGain, now, 0.02);
      nodes.neveHigh.gain.setTargetAtTime(fx.neve1073.highGain, now, 0.02);
      nodes.neveTrim.gain.setTargetAtTime(dbToGain(fx.neve1073.outputTrim), now, 0.02);
    } else {
      nodes.neveDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.neveWet.gain.setTargetAtTime(0, now, 0.02);
      nodes.neveHp.frequency.setTargetAtTime(15, now, 0.02);
      nodes.neveLow.gain.setTargetAtTime(0, now, 0.02);
      nodes.neveMid.gain.setTargetAtTime(0, now, 0.02);
      nodes.neveHigh.gain.setTargetAtTime(0, now, 0.02);
      nodes.neveTrim.gain.setTargetAtTime(1, now, 0.02);
    }

    // 2. UAD Pultec EQP-1A Tube Equalizer (including the Low Boost + Atten Pultec Trick)
    if (fx.pultec.enabled) {
      nodes.pultecLowBoost.frequency.setTargetAtTime(fx.pultec.lowFreq, now, 0.02);
      nodes.pultecLowBoost.gain.setTargetAtTime(fx.pultec.lowBoost * 1.35, now, 0.02);
      nodes.pultecLowAtten.frequency.setTargetAtTime(fx.pultec.lowFreq * 1.48, now, 0.02);
      nodes.pultecLowAtten.gain.setTargetAtTime(-fx.pultec.lowAtten * 1.15, now, 0.02);

      nodes.pultecHighBoost.frequency.setTargetAtTime(fx.pultec.highFreq, now, 0.02);
      nodes.pultecHighBoost.Q.setTargetAtTime(Math.max(0.35, 2.4 - fx.pultec.bandwidth * 0.2), now, 0.02);
      nodes.pultecHighBoost.gain.setTargetAtTime(fx.pultec.highBoost * 1.4, now, 0.02);

      nodes.pultecHighAtten.frequency.setTargetAtTime(fx.pultec.highAttenFreq, now, 0.02);
      nodes.pultecHighAtten.gain.setTargetAtTime(-fx.pultec.highAtten * 1.3, now, 0.02);
    } else {
      nodes.pultecLowBoost.gain.setTargetAtTime(0, now, 0.02);
      nodes.pultecLowAtten.gain.setTargetAtTime(0, now, 0.02);
      nodes.pultecHighBoost.gain.setTargetAtTime(0, now, 0.02);
      nodes.pultecHighAtten.gain.setTargetAtTime(0, now, 0.02);
    }

    // 3. UAD 1176LN Rev E FET Limiting Amplifier
    if (fx.fet1176.enabled) {
      const inputGainDb = (fx.fet1176.input - 45) * 0.35;
      const outputGainDb = (fx.fet1176.output - 50) * 0.32;
      const isAllButtons = fx.fet1176.ratio === 'all';
      const ratioVal: number = fx.fet1176.ratio === 'all' ? 20 : fx.fet1176.ratio;
      // 1176 controls: 1 = slowest, 7 = fastest
      const attackSec = 0.0004 + ((7 - fx.fet1176.attack) / 6) * 0.008;
      const releaseSec = 0.05 + ((7 - fx.fet1176.release) / 6) * 0.55;

      nodes.fetInput.gain.setTargetAtTime(dbToGain(inputGainDb), now, 0.015);
      nodes.fetComp.threshold.setTargetAtTime(isAllButtons ? -28 : -22, now, 0.015);
      nodes.fetComp.ratio.setTargetAtTime(ratioVal, now, 0.015);
      nodes.fetComp.attack.setTargetAtTime(attackSec, now, 0.015);
      nodes.fetComp.release.setTargetAtTime(releaseSec, now, 0.015);
      nodes.fetComp.knee.setTargetAtTime(isAllButtons ? 1 : 4, now, 0.015);

      const gritWet = isAllButtons ? 0.36 : 0.1;
      nodes.fetDry.gain.setTargetAtTime(1 - gritWet * 0.5, now, 0.02);
      nodes.fetWet.gain.setTargetAtTime(gritWet, now, 0.02);
      nodes.fetOutput.gain.setTargetAtTime(dbToGain(outputGainDb + (isAllButtons ? 3.5 : 1.5)), now, 0.015);
    } else {
      nodes.fetInput.gain.setTargetAtTime(1, now, 0.015);
      nodes.fetComp.threshold.setTargetAtTime(0, now, 0.015);
      nodes.fetComp.ratio.setTargetAtTime(1, now, 0.015);
      nodes.fetDry.gain.setTargetAtTime(1, now, 0.015);
      nodes.fetWet.gain.setTargetAtTime(0, now, 0.015);
      nodes.fetOutput.gain.setTargetAtTime(1, now, 0.015);
    }

    // 4. UAD Teletronix LA-2A Optical Tube Leveler
    if (fx.la2a.enabled) {
      const thresh = -4 - (fx.la2a.peakReduction / 100) * 34;
      const ratio = fx.la2a.mode === 'limit' ? 10 : 3.2;
      const makeupDb = (fx.la2a.gain - 48) * 0.32;

      nodes.la2aComp.threshold.setTargetAtTime(thresh, now, 0.02);
      nodes.la2aComp.ratio.setTargetAtTime(ratio, now, 0.02);
      nodes.la2aComp.attack.setTargetAtTime(0.012, now, 0.02);
      nodes.la2aComp.release.setTargetAtTime(0.36, now, 0.02);
      nodes.la2aComp.knee.setTargetAtTime(18, now, 0.02);

      if (Math.abs(nodes.lastLa2aWarmth - fx.la2a.tubeWarmth) > 1) {
        nodes.la2aTube.curve = createSaturationCurve(fx.la2a.tubeWarmth * 0.55, true);
        nodes.lastLa2aWarmth = fx.la2a.tubeWarmth;
      }
      const tubeWet = (fx.la2a.tubeWarmth / 100) * 0.32;
      nodes.la2aDry.gain.setTargetAtTime(1 - tubeWet * 0.5, now, 0.02);
      nodes.la2aWet.gain.setTargetAtTime(tubeWet, now, 0.02);
      nodes.la2aGain.gain.setTargetAtTime(dbToGain(makeupDb), now, 0.02);
    } else {
      nodes.la2aComp.threshold.setTargetAtTime(0, now, 0.02);
      nodes.la2aComp.ratio.setTargetAtTime(1, now, 0.02);
      nodes.la2aDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.la2aWet.gain.setTargetAtTime(0, now, 0.02);
      nodes.la2aGain.gain.setTargetAtTime(1, now, 0.02);
    }

    // 4b. FL Parametric EQ 2 (7-Band)
    for (let i = 0; i < nodes.flEq2Bands.length; i++) {
      const band = fx.flEq2.bands[i];
      if (band) {
        applyParametricBandNode(nodes.flEq2Bands[i], band, fx.flEq2.enabled, now);
      }
    }
    nodes.flEq2Gain.gain.setTargetAtTime(
      fx.flEq2.enabled ? dbToGain(fx.flEq2.outputGain) : 1,
      now,
      0.015
    );

    // 4c. FabFilter Pro-Q 3 (6-Band Precision EQ)
    for (let i = 0; i < nodes.fabProQBands.length; i++) {
      const band = fx.fabProQ.bands[i];
      if (band) {
        applyParametricBandNode(nodes.fabProQBands[i], band, fx.fabProQ.enabled, now);
      }
    }
    nodes.fabProQGain.gain.setTargetAtTime(
      fx.fabProQ.enabled ? dbToGain(fx.fabProQ.outputGain) : 1,
      now,
      0.015
    );

    // 4d. FL Soundgoodizer (Maximus A/B/C/D Multiband Exciter)
    if (fx.flSoundgoodizer.enabled && fx.flSoundgoodizer.amount > 0 && fx.flSoundgoodizer.mix > 0) {
      const amt = fx.flSoundgoodizer.amount / 100;
      const wet = (fx.flSoundgoodizer.mix / 100) * 0.72 * amt;
      const modeProfile = {
        A: { lowHz: 90, lowDb: 3.8 * amt, highHz: 7500, highDb: 4.5 * amt, sat: 30 * amt, thresh: -20, ratio: 4.5 },
        B: { lowHz: 120, lowDb: 4.6 * amt, highHz: 5200, highDb: 2.2 * amt, sat: 42 * amt, thresh: -22, ratio: 3.5 },
        C: { lowHz: 68, lowDb: 5.4 * amt, highHz: 9500, highDb: 5.2 * amt, sat: 36 * amt, thresh: -24, ratio: 5.5 },
        D: { lowHz: 82, lowDb: 4.2 * amt, highHz: 8000, highDb: 4.0 * amt, sat: 54 * amt, thresh: -27, ratio: 7.0 },
      }[fx.flSoundgoodizer.mode];

      nodes.sgLow.frequency.setTargetAtTime(modeProfile.lowHz, now, 0.02);
      nodes.sgLow.gain.setTargetAtTime(modeProfile.lowDb, now, 0.02);
      nodes.sgHigh.frequency.setTargetAtTime(modeProfile.highHz, now, 0.02);
      nodes.sgHigh.gain.setTargetAtTime(modeProfile.highDb, now, 0.02);
      nodes.sgComp.threshold.setTargetAtTime(modeProfile.thresh, now, 0.02);
      nodes.sgComp.ratio.setTargetAtTime(modeProfile.ratio, now, 0.02);

      const sgKey = `${fx.flSoundgoodizer.mode}-${Math.round(modeProfile.sat)}`;
      if (nodes.lastSgKey !== sgKey) {
        nodes.sgShaper.curve = createSaturationCurve(modeProfile.sat, fx.flSoundgoodizer.mode === 'B');
        nodes.lastSgKey = sgKey;
      }
      nodes.sgDry.gain.setTargetAtTime(1 - wet * 0.42, now, 0.02);
      nodes.sgWet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      nodes.sgDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.sgWet.gain.setTargetAtTime(0, now, 0.02);
    }

    // 5. Logic Channel EQ
    if (fx.eq.enabled) {
      nodes.hpFilter.frequency.setTargetAtTime(Math.max(20, fx.eq.hpFreq), now, 0.015);
      nodes.lowShelf.frequency.setTargetAtTime(fx.eq.lowFreq, now, 0.015);
      nodes.lowShelf.gain.setTargetAtTime(fx.eq.lowGain, now, 0.015);
      nodes.midPeak.frequency.setTargetAtTime(fx.eq.midFreq, now, 0.015);
      nodes.midPeak.Q.setTargetAtTime(fx.eq.midQ, now, 0.015);
      nodes.midPeak.gain.setTargetAtTime(fx.eq.midGain, now, 0.015);
      nodes.highShelf.frequency.setTargetAtTime(fx.eq.highFreq, now, 0.015);
      nodes.highShelf.gain.setTargetAtTime(fx.eq.highGain, now, 0.015);
    } else {
      nodes.hpFilter.frequency.setTargetAtTime(15, now, 0.015);
      nodes.lowShelf.gain.setTargetAtTime(0, now, 0.015);
      nodes.midPeak.gain.setTargetAtTime(0, now, 0.015);
      nodes.highShelf.gain.setTargetAtTime(0, now, 0.015);
    }

    // 6. Logic Studio Compressor
    if (fx.compressor.enabled) {
      nodes.compressor.threshold.setTargetAtTime(fx.compressor.threshold, now, 0.015);
      nodes.compressor.ratio.setTargetAtTime(Math.max(1, fx.compressor.ratio), now, 0.015);
      nodes.compressor.attack.setTargetAtTime(fx.compressor.attack, now, 0.015);
      nodes.compressor.release.setTargetAtTime(fx.compressor.release, now, 0.015);
      nodes.compressor.knee.setTargetAtTime(fx.compressor.knee, now, 0.015);
      nodes.compMakeup.gain.setTargetAtTime(dbToGain(fx.compressor.makeupGain), now, 0.015);
    } else {
      nodes.compressor.threshold.setTargetAtTime(0, now, 0.015);
      nodes.compressor.ratio.setTargetAtTime(1, now, 0.015);
      nodes.compMakeup.gain.setTargetAtTime(1, now, 0.015);
    }

    // 7. Phat FX Drive
    if (fx.drive.enabled && fx.drive.mix > 0.01) {
      if (Math.abs(nodes.lastDriveVal - fx.drive.drive) > 0.5) {
        nodes.shaper.curve = createSaturationCurve(fx.drive.drive);
        nodes.lastDriveVal = fx.drive.drive;
      }
      nodes.driveTone.frequency.setTargetAtTime(fx.drive.tone, now, 0.015);
      nodes.driveDry.gain.setTargetAtTime(1 - fx.drive.mix * 0.75, now, 0.015);
      nodes.driveWet.gain.setTargetAtTime(fx.drive.mix, now, 0.015);
    } else {
      nodes.driveDry.gain.setTargetAtTime(1, now, 0.015);
      nodes.driveWet.gain.setTargetAtTime(0, now, 0.015);
    }

    // 8. Stereo Spread
    nodes.midSide.setWidth(fx.stereo.enabled ? fx.stereo.width : 1.0, now);

    // 9. Soundtoys EchoBoy Analog Stereo / Ping-Pong Delay
    const bpm = this.projectRef?.bpm || 94;
    if (fx.echoBoy.enabled && fx.echoBoy.mix > 0) {
      const styleChar = echoStyleCharacter(fx.echoBoy.style);
      const beatSec = 60 / bpm;
      const grooveMult = 1 + (fx.echoBoy.groove / 50) * 0.16;
      const baseTime = Math.max(0.03, Math.min(1.9, beatSec * echoDivisionBeats(fx.echoBoy.division) * grooveMult));
      const rightTime = fx.echoBoy.pingPong
        ? Math.max(0.03, Math.min(1.95, baseTime * 0.5))
        : Math.max(0.03, Math.min(1.95, baseTime * 1.015));

      nodes.ebDelayL.delayTime.setTargetAtTime(baseTime, now, 0.03);
      nodes.ebDelayR.delayTime.setTargetAtTime(rightTime, now, 0.03);

      const fb = Math.max(0, Math.min(0.88, fx.echoBoy.feedback / 100));
      if (fx.echoBoy.pingPong) {
        nodes.ebFbL.gain.setTargetAtTime(fb * 0.12, now, 0.02);
        nodes.ebFbR.gain.setTargetAtTime(fb * 0.12, now, 0.02);
        nodes.ebFbCrossL.gain.setTargetAtTime(fb * 0.88, now, 0.02);
        nodes.ebFbCrossR.gain.setTargetAtTime(fb * 0.88, now, 0.02);
      } else {
        nodes.ebFbL.gain.setTargetAtTime(fb, now, 0.02);
        nodes.ebFbR.gain.setTargetAtTime(fb, now, 0.02);
        nodes.ebFbCrossL.gain.setTargetAtTime(0, now, 0.02);
        nodes.ebFbCrossR.gain.setTargetAtTime(0, now, 0.02);
      }

      nodes.ebLowCut.frequency.setTargetAtTime(Math.max(styleChar.lowFloor, fx.echoBoy.lowCutHz), now, 0.02);
      nodes.ebHighCut.frequency.setTargetAtTime(Math.min(styleChar.highCap, fx.echoBoy.highCutHz), now, 0.02);

      const satAmt = Math.min(100, fx.echoBoy.saturation * styleChar.satBoost);
      const satKey = `${fx.echoBoy.style}-${Math.round(satAmt / 2)}`;
      if (nodes.lastEbSatKey !== satKey) {
        nodes.ebSat.curve = createSaturationCurve(satAmt * 0.65, true);
        nodes.lastEbSatKey = satKey;
      }

      const wet = (fx.echoBoy.mix / 100) * 0.85;
      nodes.ebDry.gain.setTargetAtTime(1 - wet * 0.35, now, 0.02);
      nodes.ebWet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      nodes.ebDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.ebWet.gain.setTargetAtTime(0, now, 0.02);
      nodes.ebFbL.gain.setTargetAtTime(0, now, 0.02);
      nodes.ebFbR.gain.setTargetAtTime(0, now, 0.02);
      nodes.ebFbCrossL.gain.setTargetAtTime(0, now, 0.02);
      nodes.ebFbCrossR.gain.setTargetAtTime(0, now, 0.02);
    }

    // 10. FL Fruity Convolver (Impulse Response Reverb)
    if (fx.flConvolver.enabled && fx.flConvolver.wet > 0) {
      const convKey = `${fx.flConvolver.impulse}-${fx.flConvolver.decaySec.toFixed(2)}`;
      if (nodes.lastConvKey !== convKey) {
        nodes.convNode.buffer = createStyledImpulse(
          this.ctx,
          fx.flConvolver.impulse,
          fx.flConvolver.decaySec
        );
        nodes.lastConvKey = convKey;
      }
      nodes.convPreDelay.delayTime.setTargetAtTime(fx.flConvolver.preDelayMs / 1000, now, 0.02);
      nodes.convLowCut.frequency.setTargetAtTime(fx.flConvolver.lowCutHz, now, 0.02);
      nodes.convHighCut.frequency.setTargetAtTime(fx.flConvolver.highCutHz, now, 0.02);
      nodes.convStereo.setWidth(fx.flConvolver.stereoSep, now);
      nodes.convDry.gain.setTargetAtTime(fx.flConvolver.dry / 100, now, 0.02);
      nodes.convWet.gain.setTargetAtTime((fx.flConvolver.wet / 100) * 0.85, now, 0.02);
    } else {
      nodes.convDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.convWet.gain.setTargetAtTime(0, now, 0.02);
    }

    // 11. FabFilter Pro-R 2 Space Reverb
    if (fx.fabProR.enabled && fx.fabProR.mix > 0) {
      const proRKey = `${fx.fabProR.spaceSec.toFixed(2)}-${Math.round(fx.fabProR.character / 5)}-${Math.round(fx.fabProR.distance / 5)}`;
      if (nodes.lastProRKey !== proRKey) {
        nodes.proRConv.buffer = createProRImpulse(
          this.ctx,
          fx.fabProR.spaceSec,
          fx.fabProR.character,
          fx.fabProR.distance
        );
        nodes.lastProRKey = proRKey;
      }
      nodes.proRPreDelay.delayTime.setTargetAtTime(fx.fabProR.preDelayMs / 1000, now, 0.02);
      nodes.proRBright.gain.setTargetAtTime((fx.fabProR.brightness / 100) * 9, now, 0.02);
      const wet = (fx.fabProR.mix / 100) * 0.85;
      nodes.proRDry.gain.setTargetAtTime(1 - wet * 0.4, now, 0.02);
      nodes.proRWet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      nodes.proRDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.proRWet.gain.setTargetAtTime(0, now, 0.02);
    }

    // 12. FL Fruity Soft Clipper
    if (fx.flSoftClipper.enabled) {
      const threshKey = `${Math.round(fx.flSoftClipper.threshold)}`;
      if (nodes.lastFlSoftKey !== threshKey) {
        nodes.flSoftShaper.curve = createSaturationCurve(Math.max(10, fx.flSoftClipper.threshold * 0.95), false);
        nodes.lastFlSoftKey = threshKey;
      }
      nodes.flSoftDry.gain.setTargetAtTime(0.15, now, 0.015);
      nodes.flSoftWet.gain.setTargetAtTime(0.92, now, 0.015);
      nodes.flSoftOut.gain.setTargetAtTime(dbToGain(fx.flSoftClipper.postGain), now, 0.015);
    } else {
      nodes.flSoftDry.gain.setTargetAtTime(1, now, 0.015);
      nodes.flSoftWet.gain.setTargetAtTime(0, now, 0.015);
      nodes.flSoftOut.gain.setTargetAtTime(1, now, 0.015);
    }

    // 13. FL Fruity Limiter
    if (fx.flLimiter.enabled) {
      nodes.flLimDrive.gain.setTargetAtTime(dbToGain(fx.flLimiter.gain), now, 0.015);
      nodes.flLimComp.threshold.setTargetAtTime(fx.flLimiter.ceiling, now, 0.015);
      nodes.flLimComp.ratio.setTargetAtTime(20, now, 0.015);
      nodes.flLimComp.attack.setTargetAtTime(Math.max(0.0005, fx.flLimiter.attackMs / 1000), now, 0.015);
      nodes.flLimComp.release.setTargetAtTime(Math.max(0.02, fx.flLimiter.releaseMs / 1000), now, 0.015);
      nodes.flLimOut.gain.setTargetAtTime(dbToGain(fx.flLimiter.ceiling), now, 0.015);
    } else {
      nodes.flLimDrive.gain.setTargetAtTime(1, now, 0.015);
      nodes.flLimComp.threshold.setTargetAtTime(0, now, 0.015);
      nodes.flLimComp.ratio.setTargetAtTime(1, now, 0.015);
      nodes.flLimOut.gain.setTargetAtTime(1, now, 0.015);
    }

    // 14. FL Fruity Chorus
    if (fx.flChorus.enabled && fx.flChorus.mix > 0) {
      const wet = (fx.flChorus.mix / 100) * 0.7;
      nodes.flChorusLfo.frequency.setTargetAtTime(Math.max(0.1, fx.flChorus.rateHz), now, 0.02);
      nodes.flChorusLfoGain.gain.setTargetAtTime((fx.flChorus.depth / 100) * 0.006, now, 0.02);
      nodes.flChorusDry.gain.setTargetAtTime(1 - wet * 0.35, now, 0.02);
      nodes.flChorusWet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      nodes.flChorusDry.gain.setTargetAtTime(1, now, 0.02);
      nodes.flChorusWet.gain.setTargetAtTime(0, now, 0.02);
    }

    // 15. FL Fruity Delay 3
    if (fx.flDelay3.enabled && fx.flDelay3.wet > 0) {
      const beatSec = 60 / bpm;
      const dTime = Math.max(0.03, Math.min(1.9, beatSec * echoDivisionBeats(fx.flDelay3.division)));
      nodes.flDel3Delay.delayTime.setTargetAtTime(dTime, now, 0.025);
      nodes.flDel3Fb.gain.setTargetAtTime(Math.min(0.88, fx.flDelay3.feedback / 100), now, 0.02);
      nodes.flDel3Tone.frequency.setTargetAtTime(Math.max(400, fx.flDelay3.toneHz), now, 0.02);
      const wet = (fx.flDelay3.wet / 100) * 0.85;
      nodes.flDel3Dry.gain.setTargetAtTime(1 - wet * 0.3, now, 0.02);
      nodes.flDel3Wet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      nodes.flDel3Dry.gain.setTargetAtTime(1, now, 0.02);
      nodes.flDel3Wet.gain.setTargetAtTime(0, now, 0.02);
      nodes.flDel3Fb.gain.setTargetAtTime(0, now, 0.02);
    }

    // 16. FL Fruity Reeverb 2
    if (fx.flReeverb2.enabled && fx.flReeverb2.wet > 0) {
      const revKey = `${fx.flReeverb2.decaySec.toFixed(1)}-${Math.round(fx.flReeverb2.size / 10)}`;
      if (nodes.lastFlRev2Key !== revKey) {
        nodes.flRev2Conv.buffer = createReverbImpulse(
          this.ctx,
          Math.max(0.3, Math.min(7, fx.flReeverb2.decaySec)),
          1.6 + (1 - fx.flReeverb2.size / 100) * 1.8
        );
        nodes.lastFlRev2Key = revKey;
      }
      nodes.flRev2PreDelay.delayTime.setTargetAtTime(fx.flReeverb2.preDelayMs / 1000, now, 0.02);
      nodes.flRev2HighCut.frequency.setTargetAtTime(fx.flReeverb2.highCutHz, now, 0.02);
      nodes.flRev2Dry.gain.setTargetAtTime(fx.flReeverb2.dry / 100, now, 0.02);
      nodes.flRev2Wet.gain.setTargetAtTime((fx.flReeverb2.wet / 100) * 0.85, now, 0.02);
    } else {
      nodes.flRev2Dry.gain.setTargetAtTime(1, now, 0.02);
      nodes.flRev2Wet.gain.setTargetAtTime(0, now, 0.02);
    }

    if (!fx.grossBeat.enabled) {
      nodes.grossBeatGain.gain.setTargetAtTime(1, now, 0.015);
    }
  }

  private applyMastering(masteringRaw?: MasteringChain): void {
    if (!this.ctx || !this.masterBus) return;
    const now = this.ctx.currentTime;
    const m = masteringRaw || createDefaultMasteringChain();
    const mb = this.masterBus;

    if (m.bypassAll) {
      mb.lowCut.frequency.setTargetAtTime(15, now, 0.02);
      mb.subShelf.gain.setTargetAtTime(0, now, 0.02);
      mb.mudPeak.gain.setTargetAtTime(0, now, 0.02);
      mb.presencePeak.gain.setTargetAtTime(0, now, 0.02);
      mb.airShelf.gain.setTargetAtTime(0, now, 0.02);
      mb.glueComp.threshold.setTargetAtTime(0, now, 0.02);
      mb.glueComp.ratio.setTargetAtTime(1, now, 0.02);
      mb.glueMakeup.gain.setTargetAtTime(1, now, 0.02);
      mb.exciterDry.gain.setTargetAtTime(1, now, 0.02);
      mb.exciterWet.gain.setTargetAtTime(0, now, 0.02);
      mb.midSide.setWidth(1.0, now);
      mb.limiterDrive.gain.setTargetAtTime(1, now, 0.02);
      mb.limiter.threshold.setTargetAtTime(-0.5, now, 0.02);
      mb.limiterCeiling.gain.setTargetAtTime(1, now, 0.02);
      return;
    }

    if (m.eqEnabled) {
      mb.lowCut.frequency.setTargetAtTime(m.lowCutHz, now, 0.02);
      mb.subShelf.gain.setTargetAtTime(m.subGain, now, 0.02);
      mb.mudPeak.gain.setTargetAtTime(m.mudGain, now, 0.02);
      mb.presencePeak.gain.setTargetAtTime(m.presenceGain, now, 0.02);
      mb.airShelf.gain.setTargetAtTime(m.airGain, now, 0.02);
    } else {
      mb.lowCut.frequency.setTargetAtTime(15, now, 0.02);
      mb.subShelf.gain.setTargetAtTime(0, now, 0.02);
      mb.mudPeak.gain.setTargetAtTime(0, now, 0.02);
      mb.presencePeak.gain.setTargetAtTime(0, now, 0.02);
      mb.airShelf.gain.setTargetAtTime(0, now, 0.02);
    }

    if (m.compEnabled) {
      mb.glueComp.threshold.setTargetAtTime(m.compThreshold, now, 0.02);
      mb.glueComp.ratio.setTargetAtTime(Math.max(1, m.compRatio), now, 0.02);
      mb.glueComp.attack.setTargetAtTime(m.compAttack, now, 0.02);
      mb.glueComp.release.setTargetAtTime(m.compRelease, now, 0.02);
      mb.glueMakeup.gain.setTargetAtTime(dbToGain(m.compMakeup), now, 0.02);
    } else {
      mb.glueComp.threshold.setTargetAtTime(0, now, 0.02);
      mb.glueComp.ratio.setTargetAtTime(1, now, 0.02);
      mb.glueMakeup.gain.setTargetAtTime(1, now, 0.02);
    }

    if (m.exciterEnabled && m.exciterAmount > 0) {
      if (Math.abs(mb.lastExciterAmount - m.exciterAmount) > 0.5) {
        mb.exciterShaper.curve = createSaturationCurve(m.exciterAmount * 0.65);
        mb.lastExciterAmount = m.exciterAmount;
      }
      const wet = Math.min(0.45, (m.exciterAmount / 100) * 0.45);
      mb.exciterDry.gain.setTargetAtTime(1 - wet * 0.5, now, 0.02);
      mb.exciterWet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      mb.exciterDry.gain.setTargetAtTime(1, now, 0.02);
      mb.exciterWet.gain.setTargetAtTime(0, now, 0.02);
    }
    mb.midSide.setWidth(m.stereoWidth, now);

    if (m.limiterEnabled) {
      mb.limiterDrive.gain.setTargetAtTime(dbToGain(m.limiterDrive), now, 0.02);
      mb.limiter.threshold.setTargetAtTime(m.limiterCeiling, now, 0.02);
      mb.limiterCeiling.gain.setTargetAtTime(dbToGain(m.limiterCeiling), now, 0.02);
    } else {
      mb.limiterDrive.gain.setTargetAtTime(1, now, 0.02);
      mb.limiter.threshold.setTargetAtTime(-0.5, now, 0.02);
      mb.limiterCeiling.gain.setTargetAtTime(1, now, 0.02);
    }
  }

  private applyAuxBuses(auxList?: StudioAuxBus[], bpm = 94): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const buses = auxList && auxList.length > 0 ? auxList : createDefaultAuxBuses();
    const anyAuxSolo = buses.some((b) => b.solo);
    const dottedEighth = Math.min(1.85, (60 / bpm) * 0.75);

    for (const bus of buses) {
      const nodes = this.auxNodes.get(bus.id);
      if (!nodes) continue;
      const audible = anyAuxSolo ? bus.solo : !bus.muted;
      nodes.fader.gain.setTargetAtTime(audible ? bus.volume : 0, now, 0.02);
      nodes.panner.pan.setTargetAtTime(bus.pan, now, 0.02);
      nodes.tone.frequency.setTargetAtTime(Math.max(400, Math.min(20000, bus.toneHz)), now, 0.02);
      nodes.midSide.setWidth(bus.width, now);

      if (nodes.comp) {
        const amt = Math.max(0, Math.min(100, bus.compAmount));
        nodes.comp.threshold.setTargetAtTime(-4 - (amt / 100) * 28, now, 0.02);
        nodes.comp.ratio.setTargetAtTime(1 + (amt / 100) * 6, now, 0.02);
      }
      if (nodes.convolver && Math.abs(nodes.lastDecaySec - bus.decaySec) > 0.15) {
        nodes.convolver.buffer = createReverbImpulse(this.ctx, Math.max(0.4, Math.min(6, bus.decaySec)), 2.3);
        nodes.lastDecaySec = bus.decaySec;
      }
      if (nodes.delay && nodes.delayFb) {
        nodes.delay.delayTime.setTargetAtTime(dottedEighth, now, 0.03);
        nodes.delayFb.gain.setTargetAtTime(Math.max(0, Math.min(0.85, bus.feedback / 100)), now, 0.02);
      }
    }
  }

  private applyMacroRack(macroRaw?: AbletonMacroRack, masteringRaw?: MasteringChain, bpm = 94): void {
    if (!this.ctx || !this.masterBus) return;
    const now = this.ctx.currentTime;
    const mb = this.masterBus;
    const macro = macroRaw || createDefaultMacroRack();
    const m = masteringRaw || createDefaultMasteringChain();

    // 1. DJ Bipolar Filter (-100 LP .. 0 Off .. +100 HP)
    const qVal = 0.7 + (macro.filterRes / 100) * 9;
    if (macro.djFilter < -2) {
      if (mb.djFilter.type !== 'lowpass') mb.djFilter.type = 'lowpass';
      const norm = 1 - Math.abs(macro.djFilter) / 100; // 1 -> 0
      const cutoff = 140 * Math.pow(18000 / 140, norm);
      mb.djFilter.frequency.setTargetAtTime(cutoff, now, 0.02);
      mb.djFilter.Q.setTargetAtTime(qVal, now, 0.02);
    } else if (macro.djFilter > 2) {
      if (mb.djFilter.type !== 'highpass') mb.djFilter.type = 'highpass';
      const norm = macro.djFilter / 100; // 0 -> 1
      const cutoff = 28 * Math.pow(6200 / 28, norm);
      mb.djFilter.frequency.setTargetAtTime(cutoff, now, 0.02);
      mb.djFilter.Q.setTargetAtTime(qVal, now, 0.02);
    } else {
      if (mb.djFilter.type !== 'allpass') mb.djFilter.type = 'allpass';
      mb.djFilter.Q.setTargetAtTime(0.7, now, 0.02);
    }

    // 2. Tape Warmth
    if (macro.tapeWarmth > 1) {
      if (Math.abs(mb.lastMacroTape - macro.tapeWarmth) > 2) {
        mb.macroTapeShaper.curve = createSaturationCurve(macro.tapeWarmth * 0.85, true);
        mb.lastMacroTape = macro.tapeWarmth;
      }
      const wet = Math.min(0.6, (macro.tapeWarmth / 100) * 0.55);
      mb.macroTapeDry.gain.setTargetAtTime(1 - wet * 0.45, now, 0.02);
      mb.macroTapeWet.gain.setTargetAtTime(wet, now, 0.02);
    } else {
      mb.macroTapeDry.gain.setTargetAtTime(1, now, 0.02);
      mb.macroTapeWet.gain.setTargetAtTime(0, now, 0.02);
    }

    // 3. OTT Punch parallel upward-feel compression
    const ottWet = Math.max(0, Math.min(0.75, (macro.ottPunch / 100) * 0.72));
    mb.macroOttDry.gain.setTargetAtTime(1 - ottWet * 0.35, now, 0.02);
    mb.macroOttWet.gain.setTargetAtTime(ottWet, now, 0.02);

    // 4. Master Space Wash (Bus 3) & Dub Echo (Bus 4)
    mb.macroSpaceSend.gain.setTargetAtTime((macro.spaceWash / 100) * 0.65, now, 0.025);
    mb.macroEchoSend.gain.setTargetAtTime((macro.dubEcho / 100) * 0.65, now, 0.025);

    // 5. Combined Stereo Width (Mastering x Macro Rack)
    const baseWidth = m.bypassAll ? 1.0 : m.stereoWidth;
    const macroWidthMult = Math.max(0, Math.min(2, macro.stereoWidth / 100));
    mb.midSide.setWidth(Math.min(2, baseWidth * macroWidthMult), now);

    // 6. Ableton Beat Repeat / Stutter Loop
    if (macro.beatRepeat !== 'off') {
      const beatSec = 60 / bpm;
      const divMap: Record<Exclude<AbletonMacroRack['beatRepeat'], 'off'>, number> = {
        '1/4': 1.0,
        '1/8': 0.5,
        '1/16': 0.25,
        '1/32': 0.125,
      };
      const sliceSec = Math.max(0.03, Math.min(1.5, beatSec * divMap[macro.beatRepeat]));
      mb.macroRepeatDelay.delayTime.setTargetAtTime(sliceSec, now, 0.015);
      mb.macroRepeatFb.gain.setTargetAtTime(0.78, now, 0.015);
      mb.macroRepeatDry.gain.setTargetAtTime(0.25, now, 0.015);
      mb.macroRepeatWet.gain.setTargetAtTime(0.9, now, 0.015);
    } else {
      mb.macroRepeatFb.gain.setTargetAtTime(0, now, 0.015);
      mb.macroRepeatDry.gain.setTargetAtTime(1, now, 0.015);
      mb.macroRepeatWet.gain.setTargetAtTime(0, now, 0.015);
    }
  }

  public syncProject(project: StudioProject): void {
    this.projectRef = project;

    if (this.ctx && this.masterBus) {
      const now = this.ctx.currentTime;
      this.applyMastering(project.mastering);
      this.applyAuxBuses(project.auxBuses, project.bpm);
      this.applyMacroRack(project.session?.macroRack, project.mastering, project.bpm);

      const anySolo = project.tracks.some((t) => t.solo);
      for (const track of project.tracks) {
        const nodes = this.getOrCreateTrackNodes(track.id);
        this.applyTrackFx(nodes, track.fx);

        // Apply Logic Pro Mono / Stereo channel input format
        const format = track.inputFormat || (track.type === 'audio' ? 'mono' : 'stereo');
        if (format === 'mono') {
          nodes.monoNode.channelCount = 1;
          nodes.monoNode.channelCountMode = 'explicit';
          nodes.monoNode.channelInterpretation = 'speakers';
        } else {
          nodes.monoNode.channelCount = 2;
          nodes.monoNode.channelCountMode = 'max';
          nodes.monoNode.channelInterpretation = 'speakers';
        }

        // Dynamic Logic Pro Output Bus routing (Stereo Out vs Aux Bus 1..4)
        const targetBus: OutputBusId = track.outputBus || 'stereo-out';
        if (nodes.currentOutputBus !== targetBus) {
          try {
            nodes.panner.disconnect();
          } catch {
            // already disconnected
          }
          nodes.panner.connect(nodes.analyser);
          const destNode =
            targetBus === 'stereo-out'
              ? this.masterBus.input
              : this.auxNodes.get(targetBus)?.input || this.masterBus.input;
          nodes.panner.connect(destNode);
          nodes.currentOutputBus = targetBus;
        }

        const audible = anySolo ? track.solo : !track.muted;
        const autoActive = (track.automationMode || 'read') !== 'off';
        const hasVolAuto = autoActive && (track.automationLanes?.volume?.length || 0) > 0;
        const hasPanAuto = autoActive && (track.automationLanes?.pan?.length || 0) > 0;
        const hasFilterAuto = autoActive && (track.automationLanes?.filterCutoff?.length || 0) > 0;

        if (!this.isPlaying || !hasVolAuto) {
          nodes.fader.gain.setTargetAtTime(audible ? track.volume : 0, now, 0.015);
        }
        if (!this.isPlaying || !hasPanAuto) {
          nodes.panner.pan.setTargetAtTime(track.pan, now, 0.015);
        }
        if (!this.isPlaying || !hasFilterAuto) {
          nodes.automationFilter.frequency.setTargetAtTime(20000, now, 0.02);
        }

        // Apply Logic Pro Bus Sends (Pre-Fader vs Post-Fader)
        const sends =
          track.busSends && track.busSends.length > 0
            ? track.busSends
            : createDefaultBusSends(track.reverbSend, track.delaySend);

        for (const send of sends) {
          const preGain = nodes.preSendGains[send.busId];
          const postGain = nodes.postSendGains[send.busId];
          if (!preGain || !postGain) continue;
          const sendLvl = audible && send.enabled ? send.level : 0;
          if (send.preFader) {
            preGain.gain.setTargetAtTime(sendLvl, now, 0.02);
            postGain.gain.setTargetAtTime(0, now, 0.02);
          } else {
            preGain.gain.setTargetAtTime(0, now, 0.02);
            postGain.gain.setTargetAtTime(sendLvl, now, 0.02);
          }
        }
      }
    }

    for (const clip of project.audioClips) {
      if (!this.decodedClips.has(clip.id)) {
        void this.decodeAudioClip(clip);
      }
    }
  }

  public async decodeAudioClip(clip: AudioClip): Promise<AudioBuffer | null> {
    try {
      const ctx = this.ensureContext();
      const res = await fetch(clip.audioDataUrl);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.decodedClips.set(clip.id, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  private getOrCreateTrackNodes(trackId: string): TrackAudioNodes {
    const existing = this.trackNodes.get(trackId);
    if (existing) return existing;

    const ctx = this.ensureContext();
    const input = ctx.createGain();
    const monoNode = ctx.createGain();
    monoNode.channelCount = 2;
    monoNode.channelCountMode = 'max';

    // 0. Auto-Tune Formant & Classic Presence
    const atFormant = ctx.createBiquadFilter();
    atFormant.type = 'peaking';
    atFormant.frequency.value = 1150;
    atFormant.Q.value = 1.6;
    const atClassicPresence = ctx.createBiquadFilter();
    atClassicPresence.type = 'peaking';
    atClassicPresence.frequency.value = 4200;
    atClassicPresence.Q.value = 1.2;

    // 1. Neve 1073 Stage
    const neveShaper = ctx.createWaveShaper();
    neveShaper.oversample = '2x';
    neveShaper.curve = createSaturationCurve(20, true);
    const neveDry = ctx.createGain();
    const neveWet = ctx.createGain();
    neveWet.gain.value = 0;
    const neveSum = ctx.createGain();
    const neveHp = ctx.createBiquadFilter();
    neveHp.type = 'highpass';
    neveHp.frequency.value = 15;
    const neveLow = ctx.createBiquadFilter();
    neveLow.type = 'lowshelf';
    neveLow.frequency.value = 60;
    const neveMid = ctx.createBiquadFilter();
    neveMid.type = 'peaking';
    neveMid.frequency.value = 1600;
    neveMid.Q.value = 0.85;
    const neveHigh = ctx.createBiquadFilter();
    neveHigh.type = 'highshelf';
    neveHigh.frequency.value = 12000;
    const neveTrim = ctx.createGain();

    // 2. Pultec EQP-1A Stage
    const pultecLowBoost = ctx.createBiquadFilter();
    pultecLowBoost.type = 'lowshelf';
    pultecLowBoost.frequency.value = 60;
    const pultecLowAtten = ctx.createBiquadFilter();
    pultecLowAtten.type = 'peaking';
    pultecLowAtten.frequency.value = 90;
    pultecLowAtten.Q.value = 0.8;
    const pultecHighBoost = ctx.createBiquadFilter();
    pultecHighBoost.type = 'peaking';
    pultecHighBoost.frequency.value = 10000;
    pultecHighBoost.Q.value = 1.2;
    const pultecHighAtten = ctx.createBiquadFilter();
    pultecHighAtten.type = 'highshelf';
    pultecHighAtten.frequency.value = 10000;

    // 3. 1176LN FET Stage
    const fetInput = ctx.createGain();
    const fetComp = ctx.createDynamicsCompressor();
    const fetGrit = ctx.createWaveShaper();
    fetGrit.curve = createSaturationCurve(38, true);
    const fetDry = ctx.createGain();
    const fetWet = ctx.createGain();
    fetWet.gain.value = 0;
    const fetOutput = ctx.createGain();

    // 4. LA-2A Optical Tube Stage
    const la2aComp = ctx.createDynamicsCompressor();
    const la2aTube = ctx.createWaveShaper();
    la2aTube.curve = createSaturationCurve(22, true);
    const la2aDry = ctx.createGain();
    const la2aWet = ctx.createGain();
    la2aWet.gain.value = 0;
    const la2aGain = ctx.createGain();

    // 4b. FL Parametric EQ 2 (7 Bands)
    const flEq2Bands: BiquadFilterNode[] = Array.from({ length: 7 }, () => {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.gain.value = 0;
      return f;
    });
    const flEq2Gain = ctx.createGain();

    // 4c. FabFilter Pro-Q 3 (6 Bands)
    const fabProQBands: BiquadFilterNode[] = Array.from({ length: 6 }, () => {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.gain.value = 0;
      return f;
    });
    const fabProQGain = ctx.createGain();

    // 4d. FL Soundgoodizer
    const sgDry = ctx.createGain();
    const sgLow = ctx.createBiquadFilter();
    sgLow.type = 'lowshelf';
    sgLow.frequency.value = 90;
    const sgHigh = ctx.createBiquadFilter();
    sgHigh.type = 'highshelf';
    sgHigh.frequency.value = 7500;
    const sgComp = ctx.createDynamicsCompressor();
    sgComp.attack.value = 0.006;
    sgComp.release.value = 0.11;
    sgComp.knee.value = 8;
    const sgShaper = ctx.createWaveShaper();
    sgShaper.oversample = '2x';
    sgShaper.curve = createSaturationCurve(18);
    const sgWet = ctx.createGain();
    sgWet.gain.value = 0;
    const sgSum = ctx.createGain();

    // 5. Logic Channel EQ
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 30;
    hpFilter.Q.value = 0.7;

    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 100;

    const midPeak = ctx.createBiquadFilter();
    midPeak.type = 'peaking';
    midPeak.frequency.value = 1200;
    midPeak.Q.value = 1.0;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 7500;

    // 6. Logic Studio Compressor + Phat Drive + Mid/Side
    const compressor = ctx.createDynamicsCompressor();
    const compMakeup = ctx.createGain();

    const driveDry = ctx.createGain();
    const driveWet = ctx.createGain();
    driveWet.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '2x';
    shaper.curve = createSaturationCurve(20);
    const driveTone = ctx.createBiquadFilter();
    driveTone.type = 'lowpass';
    driveTone.frequency.value = 9500;
    const driveSum = ctx.createGain();

    const midSide = createMidSideStage(ctx);

    // 9. Soundtoys EchoBoy Analog Delay
    const ebDry = ctx.createGain();
    const ebSat = ctx.createWaveShaper();
    ebSat.oversample = '2x';
    ebSat.curve = createSaturationCurve(24, true);
    const ebLowCut = ctx.createBiquadFilter();
    ebLowCut.type = 'highpass';
    ebLowCut.frequency.value = 180;
    const ebHighCut = ctx.createBiquadFilter();
    ebHighCut.type = 'lowpass';
    ebHighCut.frequency.value = 5200;
    const ebDelayL = ctx.createDelay(2.0);
    const ebDelayR = ctx.createDelay(2.0);
    ebDelayL.delayTime.value = 0.375;
    ebDelayR.delayTime.value = 0.1875;
    const ebFbL = ctx.createGain();
    const ebFbR = ctx.createGain();
    const ebFbCrossL = ctx.createGain();
    const ebFbCrossR = ctx.createGain();
    ebFbL.gain.value = 0;
    ebFbR.gain.value = 0;
    ebFbCrossL.gain.value = 0;
    ebFbCrossR.gain.value = 0;
    const ebMerger = ctx.createChannelMerger(2);
    const ebWet = ctx.createGain();
    ebWet.gain.value = 0;
    const ebSum = ctx.createGain();

    // 10. FL Fruity Convolver
    const convDry = ctx.createGain();
    const convPreDelay = ctx.createDelay(0.5);
    const convNode = ctx.createConvolver();
    convNode.buffer = createStyledImpulse(ctx, 'cathedral', 2.2);
    const convLowCut = ctx.createBiquadFilter();
    convLowCut.type = 'highpass';
    convLowCut.frequency.value = 140;
    const convHighCut = ctx.createBiquadFilter();
    convHighCut.type = 'lowpass';
    convHighCut.frequency.value = 9500;
    const convStereo = createMidSideStage(ctx);
    const convWet = ctx.createGain();
    convWet.gain.value = 0;
    const convSum = ctx.createGain();

    // 11. FabFilter Pro-R 2
    const proRDry = ctx.createGain();
    const proRPreDelay = ctx.createDelay(0.5);
    const proRConv = ctx.createConvolver();
    proRConv.buffer = createProRImpulse(ctx, 2.2, 40, 45);
    const proRBright = ctx.createBiquadFilter();
    proRBright.type = 'highshelf';
    proRBright.frequency.value = 4200;
    const proRWet = ctx.createGain();
    proRWet.gain.value = 0;
    const proRSum = ctx.createGain();

    // 12-17. FL Stock FX Suite (Soft Clipper, Limiter, Chorus, Delay 3, Reeverb 2, Gross Beat)
    const flSoftDry = ctx.createGain();
    const flSoftWet = ctx.createGain();
    flSoftWet.gain.value = 0;
    const flSoftShaper = ctx.createWaveShaper();
    flSoftShaper.oversample = '2x';
    flSoftShaper.curve = createSaturationCurve(60, false);
    const flSoftOut = ctx.createGain();

    const flLimDrive = ctx.createGain();
    const flLimComp = ctx.createDynamicsCompressor();
    flLimComp.knee.value = 1;
    const flLimOut = ctx.createGain();

    const flChorusDry = ctx.createGain();
    const flChorusWet = ctx.createGain();
    flChorusWet.gain.value = 0;
    const flChorusDelay = ctx.createDelay(0.1);
    flChorusDelay.delayTime.value = 0.016;
    const flChorusLfo = ctx.createOscillator();
    flChorusLfo.type = 'sine';
    flChorusLfo.frequency.value = 0.75;
    const flChorusLfoGain = ctx.createGain();
    flChorusLfoGain.gain.value = 0.003;
    flChorusLfo.connect(flChorusLfoGain);
    flChorusLfoGain.connect(flChorusDelay.delayTime);
    flChorusLfo.start();
    const flChorusSum = ctx.createGain();

    const flDel3Dry = ctx.createGain();
    const flDel3Delay = ctx.createDelay(2.0);
    flDel3Delay.delayTime.value = 0.375;
    const flDel3Tone = ctx.createBiquadFilter();
    flDel3Tone.type = 'lowpass';
    flDel3Tone.frequency.value = 4600;
    const flDel3Fb = ctx.createGain();
    flDel3Fb.gain.value = 0;
    const flDel3Wet = ctx.createGain();
    flDel3Wet.gain.value = 0;
    const flDel3Sum = ctx.createGain();

    const flRev2Dry = ctx.createGain();
    const flRev2PreDelay = ctx.createDelay(0.5);
    const flRev2Conv = ctx.createConvolver();
    flRev2Conv.buffer = createReverbImpulse(ctx, 2.5, 2.1);
    const flRev2HighCut = ctx.createBiquadFilter();
    flRev2HighCut.type = 'lowpass';
    flRev2HighCut.frequency.value = 8500;
    const flRev2Wet = ctx.createGain();
    flRev2Wet.gain.value = 0;
    const flRev2Sum = ctx.createGain();

    const grossBeatGain = ctx.createGain();
    grossBeatGain.gain.value = 1;

    const automationFilter = ctx.createBiquadFilter();
    automationFilter.type = 'lowpass';
    automationFilter.frequency.value = 20000;
    automationFilter.Q.value = 1.2;

    const fader = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;

    const auxIds: AuxBusId[] = ['bus-1', 'bus-2', 'bus-3', 'bus-4'];
    const preSendGains = {} as Record<AuxBusId, GainNode>;
    const postSendGains = {} as Record<AuxBusId, GainNode>;
    for (const busId of auxIds) {
      const pre = ctx.createGain();
      pre.gain.value = 0;
      const post = ctx.createGain();
      post.gain.value = 0;
      preSendGains[busId] = pre;
      postSendGains[busId] = post;
    }

    // Full Serial Studio Signal Flow:
    input.connect(monoNode);
    monoNode.connect(atFormant);
    atFormant.connect(atClassicPresence);

    atClassicPresence.connect(neveDry);
    atClassicPresence.connect(neveShaper);
    neveShaper.connect(neveWet);
    neveDry.connect(neveSum);
    neveWet.connect(neveSum);
    neveSum.connect(neveHp);
    neveHp.connect(neveLow);
    neveLow.connect(neveMid);
    neveMid.connect(neveHigh);
    neveHigh.connect(neveTrim);

    neveTrim.connect(pultecLowBoost);
    pultecLowBoost.connect(pultecLowAtten);
    pultecLowAtten.connect(pultecHighBoost);
    pultecHighBoost.connect(pultecHighAtten);

    pultecHighAtten.connect(fetInput);
    fetInput.connect(fetComp);
    fetComp.connect(fetDry);
    fetComp.connect(fetGrit);
    fetGrit.connect(fetWet);
    fetDry.connect(fetOutput);
    fetWet.connect(fetOutput);

    fetOutput.connect(la2aComp);
    la2aComp.connect(la2aDry);
    la2aComp.connect(la2aTube);
    la2aTube.connect(la2aWet);
    la2aDry.connect(la2aGain);
    la2aWet.connect(la2aGain);

    // Connect FL Parametric EQ 2 chain
    la2aGain.connect(flEq2Bands[0]);
    for (let i = 0; i < flEq2Bands.length - 1; i++) {
      flEq2Bands[i].connect(flEq2Bands[i + 1]);
    }
    flEq2Bands[flEq2Bands.length - 1].connect(flEq2Gain);

    // Connect FabFilter Pro-Q 3 chain
    flEq2Gain.connect(fabProQBands[0]);
    for (let i = 0; i < fabProQBands.length - 1; i++) {
      fabProQBands[i].connect(fabProQBands[i + 1]);
    }
    fabProQBands[fabProQBands.length - 1].connect(fabProQGain);

    // Connect FL Soundgoodizer parallel exciter
    fabProQGain.connect(sgDry);
    fabProQGain.connect(sgLow);
    sgLow.connect(sgHigh);
    sgHigh.connect(sgComp);
    sgComp.connect(sgShaper);
    sgShaper.connect(sgWet);
    sgDry.connect(sgSum);
    sgWet.connect(sgSum);

    // Logic Channel EQ + Comp + Phat Drive + Stereo Spread
    sgSum.connect(hpFilter);
    hpFilter.connect(lowShelf);
    lowShelf.connect(midPeak);
    midPeak.connect(highShelf);
    highShelf.connect(compressor);
    compressor.connect(compMakeup);

    compMakeup.connect(driveDry);
    compMakeup.connect(shaper);
    shaper.connect(driveTone);
    driveTone.connect(driveWet);
    driveDry.connect(driveSum);
    driveWet.connect(driveSum);

    driveSum.connect(midSide.input);

    // EchoBoy Stereo / Ping-Pong Delay
    midSide.output.connect(ebDry);
    midSide.output.connect(ebLowCut);
    ebLowCut.connect(ebHighCut);
    ebHighCut.connect(ebSat);
    ebSat.connect(ebDelayL);
    ebSat.connect(ebDelayR);
    ebDelayL.connect(ebFbL);
    ebFbL.connect(ebDelayL);
    ebDelayR.connect(ebFbR);
    ebFbR.connect(ebDelayR);
    ebDelayL.connect(ebFbCrossL);
    ebFbCrossL.connect(ebDelayR);
    ebDelayR.connect(ebFbCrossR);
    ebFbCrossR.connect(ebDelayL);
    ebDelayL.connect(ebMerger, 0, 0);
    ebDelayR.connect(ebMerger, 0, 1);
    ebMerger.connect(ebWet);
    ebDry.connect(ebSum);
    ebWet.connect(ebSum);

    // FL Fruity Convolver
    ebSum.connect(convDry);
    ebSum.connect(convPreDelay);
    convPreDelay.connect(convNode);
    convNode.connect(convLowCut);
    convLowCut.connect(convHighCut);
    convHighCut.connect(convStereo.input);
    convStereo.output.connect(convWet);
    convDry.connect(convSum);
    convWet.connect(convSum);

    // FabFilter Pro-R 2
    convSum.connect(proRDry);
    convSum.connect(proRPreDelay);
    proRPreDelay.connect(proRConv);
    proRConv.connect(proRBright);
    proRBright.connect(proRWet);
    proRDry.connect(proRSum);
    proRWet.connect(proRSum);

    // Wire FL Stock FX Suite after Pro-R 2
    proRSum.connect(flSoftDry);
    proRSum.connect(flSoftShaper);
    flSoftShaper.connect(flSoftWet);
    flSoftDry.connect(flSoftOut);
    flSoftWet.connect(flSoftOut);

    flSoftOut.connect(flLimDrive);
    flLimDrive.connect(flLimComp);
    flLimComp.connect(flLimOut);

    flLimOut.connect(flChorusDry);
    flLimOut.connect(flChorusDelay);
    flChorusDelay.connect(flChorusWet);
    flChorusDry.connect(flChorusSum);
    flChorusWet.connect(flChorusSum);

    flChorusSum.connect(flDel3Dry);
    flChorusSum.connect(flDel3Delay);
    flDel3Delay.connect(flDel3Tone);
    flDel3Tone.connect(flDel3Fb);
    flDel3Fb.connect(flDel3Delay);
    flDel3Tone.connect(flDel3Wet);
    flDel3Dry.connect(flDel3Sum);
    flDel3Wet.connect(flDel3Sum);

    flDel3Sum.connect(flRev2Dry);
    flDel3Sum.connect(flRev2PreDelay);
    flRev2PreDelay.connect(flRev2Conv);
    flRev2Conv.connect(flRev2HighCut);
    flRev2HighCut.connect(flRev2Wet);
    flRev2Dry.connect(flRev2Sum);
    flRev2Wet.connect(flRev2Sum);

    flRev2Sum.connect(grossBeatGain);
    grossBeatGain.connect(automationFilter);
    automationFilter.connect(fader);
    fader.connect(panner);
    panner.connect(analyser);
    panner.connect(this.masterBus!.input);

    for (const busId of auxIds) {
      const auxDest = this.auxNodes.get(busId)?.input;
      if (!auxDest) continue;
      automationFilter.connect(preSendGains[busId]);
      preSendGains[busId].connect(auxDest);
      fader.connect(postSendGains[busId]);
      postSendGains[busId].connect(auxDest);
    }

    const nodes: TrackAudioNodes = {
      input,
      monoNode,
      atFormant,
      atClassicPresence,
      neveShaper,
      neveDry,
      neveWet,
      neveSum,
      neveHp,
      neveLow,
      neveMid,
      neveHigh,
      neveTrim,
      lastNeveDrive: 20,
      pultecLowBoost,
      pultecLowAtten,
      pultecHighBoost,
      pultecHighAtten,
      fetInput,
      fetComp,
      fetGrit,
      fetDry,
      fetWet,
      fetOutput,
      la2aComp,
      la2aTube,
      la2aDry,
      la2aWet,
      la2aGain,
      lastLa2aWarmth: 35,
      flEq2Bands,
      flEq2Gain,
      fabProQBands,
      fabProQGain,
      sgDry,
      sgLow,
      sgHigh,
      sgComp,
      sgShaper,
      sgWet,
      sgSum,
      lastSgKey: '',
      hpFilter,
      lowShelf,
      midPeak,
      highShelf,
      compressor,
      compMakeup,
      driveDry,
      driveWet,
      shaper,
      driveTone,
      driveSum,
      midSide,
      ebDry,
      ebSat,
      ebLowCut,
      ebHighCut,
      ebDelayL,
      ebDelayR,
      ebFbL,
      ebFbR,
      ebFbCrossL,
      ebFbCrossR,
      ebMerger,
      ebWet,
      ebSum,
      lastEbSatKey: '',
      convDry,
      convPreDelay,
      convNode,
      convLowCut,
      convHighCut,
      convStereo,
      convWet,
      convSum,
      lastConvKey: 'cathedral-2.20',
      proRDry,
      proRPreDelay,
      proRConv,
      proRBright,
      proRWet,
      proRSum,
      lastProRKey: '2.20-8-9',
      flSoftDry,
      flSoftWet,
      flSoftShaper,
      flSoftOut,
      lastFlSoftKey: '60',
      flLimDrive,
      flLimComp,
      flLimOut,
      flChorusDry,
      flChorusWet,
      flChorusDelay,
      flChorusLfo,
      flChorusLfoGain,
      flChorusSum,
      flDel3Dry,
      flDel3Delay,
      flDel3Tone,
      flDel3Fb,
      flDel3Wet,
      flDel3Sum,
      flRev2Dry,
      flRev2PreDelay,
      flRev2Conv,
      flRev2HighCut,
      flRev2Wet,
      flRev2Sum,
      lastFlRev2Key: '2.5-6',
      grossBeatGain,
      automationFilter,
      fader,
      panner,
      analyser,
      currentOutputBus: 'stereo-out',
      preSendGains,
      postSendGains,
      lastDriveVal: 20,
    };
    this.trackNodes.set(trackId, nodes);
    return nodes;
  }

  public getAuxBusLevels(): Record<AuxBusId, number> {
    const out: Record<AuxBusId, number> = { 'bus-1': 0, 'bus-2': 0, 'bus-3': 0, 'bus-4': 0 };
    for (const [busId, nodes] of this.auxNodes.entries()) {
      const data = new Uint8Array(nodes.analyser.frequencyBinCount);
      nodes.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      out[busId] = Math.min(1, Math.sqrt(sum / data.length) * 3.1);
    }
    return out;
  }

  public getTrackCompressorReduction(trackId: string): number {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return 0;
    return Math.abs(nodes.compressor.reduction || 0);
  }

  public getTrackHardwareMeters(trackId: string): {
    la2aGr: number;
    fet1176Gr: number;
    compGr: number;
  } {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return { la2aGr: 0, fet1176Gr: 0, compGr: 0 };
    return {
      la2aGr: Math.abs(nodes.la2aComp.reduction || 0),
      fet1176Gr: Math.abs(nodes.fetComp.reduction || 0),
      compGr: Math.abs(nodes.compressor.reduction || 0),
    };
  }

  public getTrackPitchInfo(trackId: string): TrackPitchTelemetry {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes || !this.ctx) {
      return { active: false, detectedHz: 0, detectedNote: '--', targetNote: '--', centsOffset: 0 };
    }
    const buf = new Float32Array(nodes.analyser.fftSize);
    nodes.analyser.getFloatTimeDomainData(buf);
    const hz = detectPitchAutocorrelation(buf, this.ctx.sampleRate);
    if (hz <= 0) {
      return { active: false, detectedHz: 0, detectedNote: '--', targetNote: '--', centsOffset: 0 };
    }
    const exactMidi = 69 + 12 * Math.log2(hz / 440);
    const roundedMidi = Math.round(exactMidi);
    const cents = Math.round((exactMidi - roundedMidi) * 100);
    const track = this.projectRef?.tracks.find((t) => t.id === trackId);
    const at = track?.fx?.autotune;
    const quantizedMidi = at && at.enabled ? quantizeMidiToAutoTune(roundedMidi, at) : roundedMidi;

    return {
      active: true,
      detectedHz: hz,
      detectedNote: midiToNoteName(roundedMidi),
      targetNote: midiToNoteName(quantizedMidi),
      centsOffset: Math.max(-50, Math.min(50, cents)),
    };
  }

  public getMasterCompressorReduction(): { glueGr: number; limiterGr: number } {
    if (!this.masterBus) return { glueGr: 0, limiterGr: 0 };
    return {
      glueGr: Math.abs(this.masterBus.glueComp.reduction || 0),
      limiterGr: Math.abs(this.masterBus.limiter.reduction || 0),
    };
  }

  public getTrackFrequencyData(trackId: string): Uint8Array {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return new Uint8Array(64);
    const data = new Uint8Array(nodes.analyser.frequencyBinCount);
    nodes.analyser.getByteFrequencyData(data);
    return data;
  }

  public getMasterFrequencyData(): Uint8Array {
    if (!this.masterBus) return new Uint8Array(64);
    const data = new Uint8Array(this.masterBus.analyserFFT.frequencyBinCount);
    this.masterBus.analyserFFT.getByteFrequencyData(data);
    return data;
  }

  public setCallbacks(onStepChange: (step: number) => void, onPlaybackStop?: () => void): void {
    this.onStepChange = onStepChange;
    this.onPlaybackStop = onPlaybackStop || null;
  }

  public setLooping(enabled: boolean): void {
    this.isLooping = enabled;
  }

  public setMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
  }

  public setMasterVolume(vol: number): void {
    if (this.ctx && this.masterBus) {
      this.masterBus.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1.2, vol)),
        this.ctx.currentTime,
        0.015
      );
    }
  }

  public setCurrentStep(step: number): void {
    const totalSteps = (this.projectRef?.totalBars || 4) * 16;
    this.currentStep = ((step % totalSteps) + totalSteps) % totalSteps;
    this.onStepChange?.(this.currentStep);
  }

  public start(fromStep?: number): void {
    const ctx = this.ensureContext();
    if (this.projectRef) {
      this.syncProject(this.projectRef);
    }
    if (typeof fromStep === 'number') {
      this.currentStep = fromStep;
    }
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.timerId = window.setInterval(() => this.scheduler(), 25);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.stopActiveAudioClips();
  }

  public stop(): void {
    this.pause();
    this.currentStep = 0;
    this.onStepChange?.(0);
  }

  private stopActiveAudioClips(): void {
    for (const src of this.activeClipSources) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    this.activeClipSources.clear();
  }

  private scheduler(): void {
    if (!this.ctx || !this.projectRef || !this.isPlaying) return;
    const scheduleAheadTime = 0.1;

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      const stepToSchedule = this.currentStep;
      const stepDuration = 60 / this.projectRef.bpm / 4;
      const swingOffset = stepToSchedule % 2 === 1 ? stepDuration * this.projectRef.swing * 0.55 : 0;
      const playTime = this.nextNoteTime + swingOffset;

      this.scheduleStep(stepToSchedule, playTime, stepDuration);

      const uiDelayMs = Math.max(0, (playTime - this.ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isPlaying) {
          this.onStepChange?.(stepToSchedule);
        }
      }, uiDelayMs);

      this.nextNoteTime += stepDuration;
      const totalSteps = this.projectRef.totalBars * 16;
      this.currentStep += 1;

      if (this.currentStep >= totalSteps) {
        if (this.isLooping) {
          this.currentStep = 0;
        } else {
          this.stop();
          this.onPlaybackStop?.();
          return;
        }
      }
    }
  }

  private scheduleStep(step: number, time: number, stepDuration: number): void {
    const project = this.projectRef;
    if (!project || !this.ctx || !this.masterBus) return;

    if (this.metronomeEnabled && step % 4 === 0) {
      this.triggerMetronome(this.ctx, this.masterBus.masterGain, time, step % 16 === 0);
    }

    // Execute Logic Pro Track Automation curves at sample-accurate step time
    const anySolo = project.tracks.some((t) => t.solo);
    for (const track of project.tracks) {
      if ((track.automationMode || 'read') === 'off') continue;
      const lanes = track.automationLanes;
      if (!lanes) continue;
      const nodes = this.getOrCreateTrackNodes(track.id);
      const audible = anySolo ? track.solo : !track.muted;

      if (lanes.volume && lanes.volume.length > 0) {
        const norm = evaluateAutomationAtStep(lanes.volume, step, track.volume / 1.2);
        nodes.fader.gain.setTargetAtTime(audible ? Math.max(0, Math.min(1.2, norm * 1.2)) : 0, time, 0.025);
      }
      if (lanes.pan && lanes.pan.length > 0) {
        const norm = evaluateAutomationAtStep(lanes.pan, step, (track.pan + 1) / 2);
        nodes.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, norm * 2 - 1)), time, 0.025);
      }
      if (lanes.filterCutoff && lanes.filterCutoff.length > 0) {
        const norm = evaluateAutomationAtStep(lanes.filterCutoff, step, 1);
        const freq = 140 * Math.pow(20000 / 140, Math.max(0, Math.min(1, norm)));
        nodes.automationFilter.frequency.setTargetAtTime(freq, time, 0.025);
      }
      if (lanes.reverbSend && lanes.reverbSend.length > 0) {
        const norm = evaluateAutomationAtStep(lanes.reverbSend, step, track.reverbSend);
        const bus3Slot = track.busSends?.find((s) => s.busId === 'bus-3');
        const val = audible ? Math.max(0, Math.min(1, norm)) : 0;
        if (bus3Slot?.preFader) {
          nodes.preSendGains['bus-3'].gain.setTargetAtTime(val, time, 0.025);
          nodes.postSendGains['bus-3'].gain.setTargetAtTime(0, time, 0.025);
        } else {
          nodes.preSendGains['bus-3'].gain.setTargetAtTime(0, time, 0.025);
          nodes.postSendGains['bus-3'].gain.setTargetAtTime(val, time, 0.025);
        }
      }
      if (lanes.delaySend && lanes.delaySend.length > 0) {
        const norm = evaluateAutomationAtStep(lanes.delaySend, step, track.delaySend);
        const bus4Slot = track.busSends?.find((s) => s.busId === 'bus-4');
        const val = audible ? Math.max(0, Math.min(1, norm)) : 0;
        if (bus4Slot?.preFader) {
          nodes.preSendGains['bus-4'].gain.setTargetAtTime(val, time, 0.025);
          nodes.postSendGains['bus-4'].gain.setTargetAtTime(0, time, 0.025);
        } else {
          nodes.preSendGains['bus-4'].gain.setTargetAtTime(0, time, 0.025);
          nodes.postSendGains['bus-4'].gain.setTargetAtTime(val, time, 0.025);
        }
      }
    }

    // Execute FL Gross Beat rhythmic gating / pump / stutter envelopes per step
    for (const track of project.tracks) {
      const gb = track.fx?.grossBeat;
      if (!gb?.enabled || gb.mix <= 0) continue;
      const nodes = this.getOrCreateTrackNodes(track.id);
      const mix = gb.mix / 100;
      const s16 = step % 16;
      let env = 1;
      if (gb.preset === 'trance-gate') {
        const pattern = [1, 0.1, 1, 0.1, 1, 1, 0.1, 1, 1, 0.1, 1, 0.1, 1, 0.2, 1, 0.1];
        env = pattern[s16];
      } else if (gb.preset === 'sidechain' || gb.preset === 'vinyl-pump') {
        const beatPos = s16 % 4;
        env = beatPos === 0 ? 0.12 : beatPos === 1 ? 0.65 : beatPos === 2 ? 0.96 : 1.0;
      } else if (gb.preset === 'triplet-stutter') {
        env = s16 % 3 === 0 ? 1.0 : s16 % 3 === 1 ? 0.25 : 0.85;
      } else if (gb.preset === 'basic-chop') {
        env = s16 % 2 === 0 ? 1.0 : 0.15;
      } else if (gb.preset === 'half-speed') {
        env = s16 % 4 < 2 ? 1.0 : 0.52;
      }
      const target = 1 - mix + mix * env;
      nodes.grossBeatGain.gain.setTargetAtTime(target, time, 0.012);
    }

    const drumTrack = project.tracks.find((t) => t.type === 'drums');
    if (drumTrack) {
      const drumNodes = this.getOrCreateTrackNodes(drumTrack.id);
      const drumStep = step % 32;
      let drumHitEnergy = 0;
      for (const channel of project.drumChannels) {
        if (channel.muted) continue;
        const vel = channel.steps[drumStep] || 0;
        if (vel > 0) {
          this.triggerDrumSound(
            this.ctx,
            drumNodes.input,
            this.noiseBuffer!,
            channel.id,
            time,
            vel * channel.volume,
            channel.pitch
          );
          drumHitEnergy = Math.max(drumHitEnergy, vel * channel.volume);
        }
      }
      if (drumHitEnergy > 0) {
        this.bumpTrackActivity(drumTrack.id, drumHitEnergy * drumTrack.volume);
      }
    }

    for (const note of project.notes) {
      if (note.startStep !== step) continue;
      const track = project.tracks.find((t) => t.id === note.trackId);
      if (!track) continue;
      const nodes = this.getOrCreateTrackNodes(track.id);
      const durationSec = Math.max(0.08, note.durationSteps * stepDuration);
      const pitch = track.fx?.autotune?.enabled
        ? quantizeMidiToAutoTune(note.pitch, track.fx.autotune)
        : note.pitch;
      this.triggerSynthSound(
        this.ctx,
        nodes.input,
        track.preset || 'warm-keys',
        pitch,
        time,
        durationSec,
        note.velocity,
        track.instrumentParams
      );
      this.bumpTrackActivity(track.id, note.velocity * track.volume);
    }

    for (const clip of project.audioClips) {
      if (clip.startStep !== step) continue;
      const track = project.tracks.find((t) => t.id === clip.trackId);
      const buffer = this.decodedClips.get(clip.id);
      if (!track || !buffer) continue;
      const nodes = this.getOrCreateTrackNodes(track.id);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      if (track.fx?.autotune?.enabled && track.fx.autotune.transpose !== 0) {
        src.playbackRate.value = Math.pow(2, track.fx.autotune.transpose / 12);
      }
      src.connect(nodes.input);
      src.start(time);
      this.activeClipSources.add(src);
      src.onended = () => {
        this.activeClipSources.delete(src);
      };
      this.bumpTrackActivity(track.id, 0.85 * track.volume);
    }
  }

  private bumpTrackActivity(trackId: string, level: number): void {
    const prev = this.trackActivity.get(trackId) || 0;
    this.trackActivity.set(trackId, Math.min(1, Math.max(prev, level)));
  }

  public getTrackLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    for (const [id, val] of this.trackActivity.entries()) {
      levels[id] = val;
      const decayed = val * 0.86;
      if (decayed < 0.01) {
        this.trackActivity.delete(id);
      } else {
        this.trackActivity.set(id, decayed);
      }
    }
    return levels;
  }

  public getMasterStereoLevels(): { left: number; right: number; lufsApprox: number } {
    if (!this.masterBus) return { left: 0, right: 0, lufsApprox: -60 };
    const computeRms = (analyser: AnalyserNode) => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / data.length);
    };
    const rmsL = computeRms(this.masterBus.analyserL);
    const rmsR = computeRms(this.masterBus.analyserR);
    const avgRms = (rmsL + rmsR) / 2;
    const lufsApprox = avgRms > 0.0005 ? Math.max(-60, Math.min(0, 20 * Math.log10(avgRms) - 1.5)) : -60;
    return {
      left: Math.min(1, rmsL * 2.8),
      right: Math.min(1, rmsR * 2.8),
      lufsApprox,
    };
  }

  public triggerDrumLive(channelId: DrumChannelId, volume = 0.85, pitch = 0): void {
    const ctx = this.ensureContext();
    if (this.projectRef) this.syncProject(this.projectRef);
    const drumTrack = this.projectRef?.tracks.find((t) => t.type === 'drums');
    const dest = drumTrack ? this.getOrCreateTrackNodes(drumTrack.id).input : this.masterBus!.input;
    this.triggerDrumSound(ctx, dest, this.noiseBuffer!, channelId, ctx.currentTime, volume, pitch);
    if (drumTrack) this.bumpTrackActivity(drumTrack.id, volume);
  }

  public triggerNoteLive(track: StudioTrack, pitch: number, durationSec = 0.35, velocity = 0.8): void {
    const ctx = this.ensureContext();
    if (this.projectRef) this.syncProject(this.projectRef);
    const nodes = this.getOrCreateTrackNodes(track.id);
    const effectivePitch = track.fx?.autotune?.enabled
      ? quantizeMidiToAutoTune(pitch, track.fx.autotune)
      : pitch;
    this.triggerSynthSound(
      ctx,
      nodes.input,
      track.preset || 'warm-keys',
      effectivePitch,
      ctx.currentTime,
      durationSec,
      velocity,
      track.instrumentParams
    );
    this.bumpTrackActivity(track.id, velocity * track.volume);
  }

  public triggerPresetPreview(
    preset: SynthPreset,
    pitch = 60,
    durationSec = 0.55,
    params?: InstrumentSynthParams
  ): void {
    const ctx = this.ensureContext();
    this.triggerSynthSound(
      ctx,
      this.masterBus!.input,
      preset,
      pitch,
      ctx.currentTime + 0.005,
      durationSec,
      0.85,
      params
    );
  }

  private triggerMetronome(ctx: BaseAudioContext, dest: AudioNode, time: number, accent: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private triggerDrumSound(
    ctx: BaseAudioContext,
    dest: AudioNode,
    noiseBuffer: AudioBuffer,
    id: DrumChannelId,
    time: number,
    velocity: number,
    pitchSemitones: number
  ): void {
    const pitchMult = Math.pow(2, pitchSemitones / 12);
    const vel = Math.max(0.05, Math.min(1.2, velocity));

    if (id === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155 * pitchMult, time);
      osc.frequency.exponentialRampToValueAtTime(44 * pitchMult, time + 0.085);
      osc.frequency.exponentialRampToValueAtTime(32 * pitchMult, time + 0.28);

      gain.gain.setValueAtTime(vel * 0.95, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(900 * pitchMult, time);
      clickOsc.frequency.exponentialRampToValueAtTime(120, time + 0.018);
      clickGain.gain.setValueAtTime(vel * 0.35, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      osc.connect(gain);
      gain.connect(dest);
      clickOsc.connect(clickGain);
      clickGain.connect(dest);

      osc.start(time);
      osc.stop(time + 0.34);
      clickOsc.start(time);
      clickOsc.stop(time + 0.025);
      return;
    }

    if (id === 'snare') {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1100 * pitchMult;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vel * 0.62, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);

      const osc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210 * pitchMult, time);
      osc.frequency.exponentialRampToValueAtTime(110 * pitchMult, time + 0.08);
      bodyGain.gain.setValueAtTime(vel * 0.55, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(bodyGain);
      bodyGain.connect(dest);

      noise.start(time);
      noise.stop(time + 0.21);
      osc.start(time);
      osc.stop(time + 0.13);
      return;
    }

    if (id === 'clap') {
      const bursts = [0, 0.011, 0.022];
      bursts.forEach((offset, idx) => {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1350 * pitchMult;
        bp.Q.value = 1.6;
        const g = ctx.createGain();
        const isLast = idx === bursts.length - 1;
        g.gain.setValueAtTime(vel * (isLast ? 0.65 : 0.45), time + offset);
        g.gain.exponentialRampToValueAtTime(0.001, time + offset + (isLast ? 0.18 : 0.025));
        noise.connect(bp);
        bp.connect(g);
        g.connect(dest);
        noise.start(time + offset);
        noise.stop(time + offset + (isLast ? 0.2 : 0.03));
      });
      return;
    }

    if (id === 'hihat-closed' || id === 'hihat-open') {
      const decay = id === 'hihat-open' ? 0.34 : 0.055;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6800 * pitchMult;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 9500 * pitchMult;
      bp.Q.value = 0.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.48, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      noise.connect(hp);
      hp.connect(bp);
      bp.connect(gain);
      gain.connect(dest);

      noise.start(time);
      noise.stop(time + decay + 0.02);
      return;
    }

    if (id === 'perc') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 * pitchMult, time);
      osc.frequency.exponentialRampToValueAtTime(240 * pitchMult, time + 0.075);
      gain.gain.setValueAtTime(vel * 0.55, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + 0.1);
      return;
    }

    if (id === 'rim') {
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(780 * pitchMult, time);
      bp.type = 'bandpass';
      bp.frequency.value = 1750 * pitchMult;
      bp.Q.value = 3.2;
      gain.gain.setValueAtTime(vel * 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.042);
      osc.connect(bp);
      bp.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + 0.05);
      return;
    }

    if (id === 'sub808') {
      const osc = ctx.createOscillator();
      const sat = ctx.createWaveShaper();
      sat.curve = createSaturationCurve(18);
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(68 * pitchMult, time);
      osc.frequency.exponentialRampToValueAtTime(48 * pitchMult, time + 0.09);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.85, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.52);

      osc.connect(sat);
      sat.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + 0.55);
    }
  }

  private triggerSynthSound(
    ctx: BaseAudioContext,
    dest: AudioNode,
    preset: SynthPreset,
    midiPitch: number,
    time: number,
    duration: number,
    velocity: number,
    customParams?: InstrumentSynthParams
  ): void {
    const p: InstrumentSynthParams = customParams
      ? { ...createDefaultInstrumentParams(preset), ...customParams }
      : createDefaultInstrumentParams(preset);

    const tunedMidi = midiPitch + (p.transpose || 0) + (p.fineCents || 0) / 100;
    const freq = midiToFreq(tunedMidi);
    const vel = Math.max(0.05, Math.min(1, velocity));

    // When customParams are actively sculpted in the VST instrument UI, run the unified live synth engine
    // with full oscillator, unison, FM, XY pad, filter envelope, ADSR, drive, and shimmer modulation!
    if (customParams) {
      const xyBrightness = 0.5 + (p.xyX / 100) * 1.1; // 0.5x .. 1.6x cutoff
      const xyFmBoost = 0.5 + (p.xyY / 100) * 1.1;
      const baseCut = Math.max(160, Math.min(18000, p.cutoffHz * xyBrightness));
      const peakCut = Math.max(baseCut, Math.min(18500, baseCut + (p.envDepth / 100) * 7500));

      const atk = Math.max(0.002, p.attackMs / 1000);
      const dec = Math.max(0.04, p.decayMs / 1000);
      const rel = Math.max(0.04, p.releaseMs / 1000);
      const sus = Math.max(0.04, Math.min(1, p.sustain));
      const noteEnd = time + Math.max(duration, atk + 0.02);
      const stopTime = noteEnd + rel + 0.05;

      const oscA = ctx.createOscillator();
      const oscADet = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = p.oscAWave;
      oscADet.type = p.oscAWave;
      oscB.type = p.oscBWave;

      oscA.frequency.setValueAtTime(freq, time);
      oscADet.frequency.setValueAtTime(freq, time);
      oscA.detune.value = -p.detuneCents * 0.5;
      oscADet.detune.value = p.detuneCents * 0.5;

      const oscBFreq = freq * Math.pow(2, p.oscBOctave || 0);
      oscB.frequency.setValueAtTime(oscBFreq, time);
      oscB.detune.value = p.detuneCents * 0.35;

      const mixA = ctx.createGain();
      const mixB = ctx.createGain();
      mixA.gain.value = 0.52;
      mixB.gain.value = Math.max(0, Math.min(1, p.oscBMix)) * 0.55;

      // Optional FM Operator (Omnisphere Bells / Sytrus / Rhodes Tines)
      let fmOsc: OscillatorNode | null = null;
      const effectiveFm = p.fmAmount * xyFmBoost;
      if (effectiveFm > 2) {
        fmOsc = ctx.createOscillator();
        const fmGain = ctx.createGain();
        fmOsc.type = 'sine';
        const fmRatio = preset === 'omnisphere-bells' ? 2.756 : preset === 'fl-sytrus' ? 3.0 : 2.0;
        fmOsc.frequency.setValueAtTime(freq * fmRatio, time);
        const modDepthHz = freq * (effectiveFm / 100) * 3.2;
        fmGain.gain.setValueAtTime(modDepthHz, time);
        fmGain.gain.exponentialRampToValueAtTime(Math.max(1, modDepthHz * 0.12), time + Math.min(0.65, dec + 0.15));
        fmOsc.connect(fmGain);
        fmGain.connect(oscA.frequency);
        fmOsc.start(time);
        fmOsc.stop(stopTime);
      }

      // Optional Shimmer Layer (Octave-up crystalline air)
      let shimOsc: OscillatorNode | null = null;
      if (p.shimmer > 4) {
        shimOsc = ctx.createOscillator();
        const shimGain = ctx.createGain();
        shimOsc.type = 'sine';
        shimOsc.frequency.setValueAtTime(freq * 2, time);
        shimGain.gain.value = (p.shimmer / 100) * 0.24;
        shimOsc.connect(shimGain);
        shimGain.connect(mixA);
        shimOsc.start(time);
        shimOsc.stop(stopTime);
      }

      // Resonant Filter + Envelope
      const filter = ctx.createBiquadFilter();
      filter.type = preset === 'kontakt-choir' ? 'bandpass' : 'lowpass';
      filter.Q.value = Math.max(0.5, Math.min(15, p.resonance));
      filter.frequency.setValueAtTime(peakCut, time);
      filter.frequency.exponentialRampToValueAtTime(baseCut, time + dec);

      // Optional Analog Drive / Warmth
      const amp = ctx.createGain();
      const peakGain = vel * 0.34;
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(peakGain, time + atk);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain * sus), time + atk + dec);
      amp.gain.setValueAtTime(Math.max(0.001, peakGain * sus), noteEnd);
      amp.gain.exponentialRampToValueAtTime(0.0001, noteEnd + rel);

      oscA.connect(mixA);
      oscADet.connect(mixA);
      oscB.connect(mixB);
      mixA.connect(filter);
      mixB.connect(filter);

      if (p.drive > 6) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = createSaturationCurve(p.drive * 0.85, false);
        filter.connect(shaper);
        shaper.connect(amp);
      } else {
        filter.connect(amp);
      }
      amp.connect(dest);

      oscA.start(time);
      oscADet.start(time);
      oscB.start(time);
      oscA.stop(stopTime);
      oscADet.stop(stopTime);
      oscB.stop(stopTime);
      return;
    }

    // Spectrasonics Omnisphere 2 · Lotus Crystal Bells & FL Sytrus FM Pluck
    if (preset === 'omnisphere-bells' || preset === 'fl-sytrus') {
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const shimmer = ctx.createOscillator();
      const shimGain = ctx.createGain();
      const gain = ctx.createGain();

      carrier.type = 'sine';
      mod.type = 'sine';
      shimmer.type = 'triangle';
      carrier.frequency.setValueAtTime(freq, time);
      const ratio = preset === 'omnisphere-bells' ? 2.756 : 3.0;
      mod.frequency.setValueAtTime(freq * ratio, time);
      shimmer.frequency.setValueAtTime(freq * 2, time);
      shimGain.gain.value = preset === 'omnisphere-bells' ? 0.18 : 0.1;

      modGain.gain.setValueAtTime(freq * (preset === 'omnisphere-bells' ? 2.4 : 3.4), time);
      modGain.gain.exponentialRampToValueAtTime(2, time + Math.min(0.45, duration + 0.25));

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.34, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.42);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(gain);
      shimmer.connect(shimGain);
      shimGain.connect(gain);
      gain.connect(dest);

      carrier.start(time);
      mod.start(time);
      shimmer.start(time);
      carrier.stop(time + duration + 0.45);
      mod.stop(time + duration + 0.45);
      shimmer.stop(time + duration + 0.45);
      return;
    }

    // Spectrasonics Omnisphere 2 · Celestial Glass Pad & Kontakt Strings Ensemble
    if (preset === 'omnisphere-celestial' || preset === 'kontakt-strings') {
      const detunes = preset === 'omnisphere-celestial' ? [-11, 0, 11, 1200] : [-7, 0, 7, -3];
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset === 'omnisphere-celestial' ? 900 : 1200, time);
      filter.frequency.linearRampToValueAtTime(
        preset === 'omnisphere-celestial' ? 4200 : 3200,
        time + Math.min(0.55, duration * 0.7)
      );
      filter.Q.value = preset === 'omnisphere-celestial' ? 2.4 : 1.1;

      const gain = ctx.createGain();
      const atk = Math.min(0.26, duration * 0.45);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.24, time + atk);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.65);

      filter.connect(gain);
      gain.connect(dest);

      detunes.forEach((dt, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 3 && preset === 'omnisphere-celestial' ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.value = dt;
        const vg = ctx.createGain();
        vg.gain.value = idx === 3 && preset === 'omnisphere-celestial' ? 0.14 : 0.28;
        osc.connect(vg);
        vg.connect(filter);
        osc.start(time);
        osc.stop(time + duration + 0.7);
      });
      return;
    }

    // Spectrasonics Omnisphere 2 · Cinema Analog Brass & Moog Noir Arp
    if (preset === 'omnisphere-brass' || preset === 'omnisphere-dark-arp') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.006, time);
      filter.type = 'lowpass';
      if (preset === 'omnisphere-brass') {
        filter.frequency.setValueAtTime(360, time);
        filter.frequency.linearRampToValueAtTime(3600, time + Math.min(0.18, duration * 0.6));
        filter.frequency.exponentialRampToValueAtTime(1100, time + duration + 0.25);
        filter.Q.value = 1.6;
      } else {
        filter.frequency.setValueAtTime(4800, time);
        filter.frequency.exponentialRampToValueAtTime(420, time + Math.min(0.24, duration + 0.06));
        filter.Q.value = 4.2;
      }
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.28, time + (preset === 'omnisphere-brass' ? 0.055 : 0.006));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.25);
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.28);
      osc2.stop(time + duration + 0.28);
      return;
    }

    // Native Instruments Kontakt 7 · Noire Felt Grand / Scarbee Mark I / FL Keys
    if (preset === 'kontakt-noir-piano' || preset === 'kontakt-rhodes' || preset === 'fl-keys' || preset === 'warm-keys') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const tine = ctx.createOscillator();
      const tineGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = preset === 'kontakt-rhodes' ? 'sine' : 'triangle';
      osc2.type = preset === 'kontakt-noir-piano' ? 'triangle' : 'sawtooth';
      tine.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * (preset === 'kontakt-noir-piano' ? 2.0 : 1.0025), time);
      tine.frequency.setValueAtTime(freq * (preset === 'kontakt-rhodes' ? 4.0 : 3.0), time);

      const osc2Mix = ctx.createGain();
      osc2Mix.gain.value = preset === 'kontakt-rhodes' ? 0.14 : preset === 'fl-keys' ? 0.34 : 0.24;

      tineGain.gain.setValueAtTime(preset === 'kontakt-rhodes' ? vel * 0.22 : vel * 0.12, time);
      tineGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);

      filter.type = 'lowpass';
      const bright = preset === 'fl-keys' ? 6200 : preset === 'kontakt-noir-piano' ? 2800 : 4200;
      filter.frequency.setValueAtTime(Math.min(bright, freq * 6.5), time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 1.9), time + duration + 0.22);
      filter.Q.value = 1.2;

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.32, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(vel * 0.16, time + Math.min(0.32, duration + 0.08));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.32);

      osc1.connect(filter);
      osc2.connect(osc2Mix);
      osc2Mix.connect(filter);
      tine.connect(tineGain);
      tineGain.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc1.start(time);
      osc2.start(time);
      tine.start(time);
      osc1.stop(time + duration + 0.36);
      osc2.stop(time + duration + 0.36);
      tine.stop(time + 0.14);
      return;
    }

    // Native Instruments Kontakt 7 · Omnia Vocal Choir
    if (preset === 'kontakt-choir') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.005, time);

      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 680;
      f1.Q.value = 3.5;

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1280;
      f2.Q.value = 4.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.42, time + Math.min(0.22, duration * 0.45));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.5);

      osc1.connect(f1);
      osc2.connect(f1);
      osc1.connect(f2);
      osc2.connect(f2);
      f1.connect(gain);
      f2.connect(gain);
      gain.connect(dest);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.55);
      osc2.stop(time + duration + 0.55);
      return;
    }

    // Kontakt Nylon Guitar & FL Sakura Plucked String
    if (preset === 'kontakt-nylon' || preset === 'fl-sakura') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const body = ctx.createBiquadFilter();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = preset === 'fl-sakura' ? 'sawtooth' : 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 2, time);

      body.type = 'peaking';
      body.frequency.value = preset === 'fl-sakura' ? 1450 : 280;
      body.Q.value = 2.2;
      body.gain.value = 5.5;

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(preset === 'fl-sakura' ? 5400 : 3200, time);
      lp.frequency.exponentialRampToValueAtTime(520, time + Math.min(0.45, duration + 0.2));

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.34, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.35);

      const g2 = ctx.createGain();
      g2.gain.value = 0.22;
      osc1.connect(body);
      osc2.connect(g2);
      g2.connect(body);
      body.connect(lp);
      lp.connect(gain);
      gain.connect(dest);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.38);
      osc2.stop(time + duration + 0.38);
      return;
    }

    // Bass Engines: Retro Sub, FL 3x Osc, FL GMS Reese
    if (preset === 'sub-bass' || preset === 'fl-3xosc' || preset === 'fl-gms') {
      const sub = ctx.createOscillator();
      const saw = ctx.createOscillator();
      const saw2 = ctx.createOscillator();
      const sawGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      sub.type = 'sine';
      saw.type = 'sawtooth';
      saw2.type = preset === 'fl-gms' ? 'sawtooth' : 'triangle';
      sub.frequency.setValueAtTime(freq, time);
      saw.frequency.setValueAtTime(freq, time);
      saw2.frequency.setValueAtTime(freq * (preset === 'fl-gms' ? 1.009 : 0.5), time);
      sawGain.gain.value = preset === 'fl-3xosc' ? 0.32 : 0.48;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset === 'fl-gms' ? 1400 : 720, time);
      filter.frequency.exponentialRampToValueAtTime(preset === 'fl-gms' ? 340 : 210, time + Math.min(0.32, duration));
      filter.Q.value = preset === 'fl-gms' ? 3.8 : 2.6;

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.46, time + 0.01);
      gain.gain.setValueAtTime(vel * 0.38, time + Math.max(0.02, duration - 0.02));
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);

      sub.connect(filter);
      saw.connect(sawGain);
      saw2.connect(sawGain);
      sawGain.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      sub.start(time);
      saw.start(time);
      saw2.start(time);
      sub.stop(time + duration + 0.13);
      saw.stop(time + duration + 0.13);
      saw2.stop(time + duration + 0.13);
      return;
    }

    // Modern Leads & Additive: FL FLEX, FL Harmor, Alchemy Pluck
    if (preset === 'pluck-lead' || preset === 'fl-flex' || preset === 'fl-harmor') {
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      subOsc.type = preset === 'fl-harmor' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      subOsc.frequency.setValueAtTime(freq * (preset === 'fl-flex' ? 1.007 : 2), time);

      const subGain = ctx.createGain();
      subGain.gain.value = preset === 'fl-flex' ? 0.36 : 0.18;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset === 'fl-harmor' ? 7800 : 5400, time);
      filter.frequency.exponentialRampToValueAtTime(750, time + Math.min(0.32, duration + 0.1));
      filter.Q.value = preset === 'fl-harmor' ? 3.5 : 2.0;

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vel * 0.26, time + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.18);

      osc.connect(filter);
      subOsc.connect(subGain);
      subGain.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(time);
      subOsc.start(time);
      osc.stop(time + duration + 0.22);
      subOsc.stop(time + duration + 0.22);
      return;
    }

    // Lush Pad fallback
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freq * 0.996, time);
    oscB.frequency.setValueAtTime(freq * 1.005, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.Q.value = 0.8;

    const attack = Math.min(0.18, duration * 0.45);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vel * 0.2, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.45);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    oscA.start(time);
    oscB.start(time);
    oscA.stop(time + duration + 0.5);
    oscB.stop(time + duration + 0.5);
  }

  public async exportProjectToWav(project: StudioProject): Promise<Blob> {
    const sampleRate = 44100;
    const stepDuration = 60 / project.bpm / 4;
    const totalSteps = project.totalBars * 16;
    const totalSeconds = totalSteps * stepDuration + 1.5;

    const offline = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);
    const m = project.mastering || createDefaultMasteringChain();

    const masterIn = offline.createGain();
    const lowCut = offline.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = !m.bypassAll && m.eqEnabled ? m.lowCutHz : 15;

    const subShelf = offline.createBiquadFilter();
    subShelf.type = 'lowshelf';
    subShelf.frequency.value = 65;
    subShelf.gain.value = !m.bypassAll && m.eqEnabled ? m.subGain : 0;

    const mudPeak = offline.createBiquadFilter();
    mudPeak.type = 'peaking';
    mudPeak.frequency.value = 320;
    mudPeak.Q.value = 1.1;
    mudPeak.gain.value = !m.bypassAll && m.eqEnabled ? m.mudGain : 0;

    const presPeak = offline.createBiquadFilter();
    presPeak.type = 'peaking';
    presPeak.frequency.value = 2800;
    presPeak.Q.value = 0.9;
    presPeak.gain.value = !m.bypassAll && m.eqEnabled ? m.presenceGain : 0;

    const airShelf = offline.createBiquadFilter();
    airShelf.type = 'highshelf';
    airShelf.frequency.value = 10000;
    airShelf.gain.value = !m.bypassAll && m.eqEnabled ? m.airGain : 0;

    const glue = offline.createDynamicsCompressor();
    glue.threshold.value = !m.bypassAll && m.compEnabled ? m.compThreshold : 0;
    glue.ratio.value = !m.bypassAll && m.compEnabled ? Math.max(1, m.compRatio) : 1;
    glue.attack.value = m.compAttack;
    glue.release.value = m.compRelease;
    const glueMakeup = offline.createGain();
    glueMakeup.gain.value = !m.bypassAll && m.compEnabled ? dbToGain(m.compMakeup) : 1;

    const masterMS = createMidSideStage(offline);
    masterMS.setWidth(!m.bypassAll ? m.stereoWidth : 1.0, 0);

    const limDrive = offline.createGain();
    limDrive.gain.value = !m.bypassAll && m.limiterEnabled ? dbToGain(m.limiterDrive) : 1;
    const limiter = offline.createDynamicsCompressor();
    limiter.threshold.value = !m.bypassAll && m.limiterEnabled ? m.limiterCeiling : -0.5;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    const limCeiling = offline.createGain();
    limCeiling.gain.value = !m.bypassAll && m.limiterEnabled ? dbToGain(m.limiterCeiling) : 1;

    masterIn.connect(lowCut);
    lowCut.connect(subShelf);
    subShelf.connect(mudPeak);
    mudPeak.connect(presPeak);
    presPeak.connect(airShelf);
    airShelf.connect(glue);
    glue.connect(glueMakeup);
    glueMakeup.connect(masterMS.input);
    masterMS.output.connect(limDrive);
    limDrive.connect(limiter);
    limiter.connect(limCeiling);
    limCeiling.connect(offline.destination);

    // Build offline Aux Buses (Bus 1..4) matching Logic Pro routing
    const auxConfigs = project.auxBuses && project.auxBuses.length > 0 ? project.auxBuses : createDefaultAuxBuses();
    const anyAuxSolo = auxConfigs.some((b) => b.solo);
    const offlineAux = new Map<AuxBusId, GainNode>();
    for (const bus of auxConfigs) {
      const aIn = offline.createGain();
      const aTone = offline.createBiquadFilter();
      aTone.type = 'lowpass';
      aTone.frequency.value = bus.toneHz;
      const aMs = createMidSideStage(offline);
      aMs.setWidth(bus.width, 0);
      const aFader = offline.createGain();
      const busAudible = anyAuxSolo ? bus.solo : !bus.muted;
      aFader.gain.value = busAudible ? bus.volume : 0;
      const aPan = offline.createStereoPanner();
      aPan.pan.value = bus.pan;

      if (bus.role === 'submix') {
        const c = offline.createDynamicsCompressor();
        c.threshold.value = -4 - (bus.compAmount / 100) * 28;
        c.ratio.value = 1 + (bus.compAmount / 100) * 6;
        aIn.connect(c);
        c.connect(aTone);
      } else if (bus.role === 'reverb') {
        const conv = offline.createConvolver();
        conv.buffer = createReverbImpulse(offline, Math.max(0.4, bus.decaySec), 2.3);
        aIn.connect(conv);
        conv.connect(aTone);
      } else {
        const del = offline.createDelay(2.0);
        del.delayTime.value = Math.min(1.85, (60 / project.bpm) * 0.75);
        const fb = offline.createGain();
        fb.gain.value = Math.min(0.85, bus.feedback / 100);
        aIn.connect(del);
        del.connect(aTone);
        aTone.connect(fb);
        fb.connect(del);
      }

      aTone.connect(aMs.input);
      aMs.output.connect(aFader);
      aFader.connect(aPan);
      aPan.connect(masterIn);
      offlineAux.set(bus.id, aIn);
    }

    const noise = createNoiseBuffer(offline, 1.0);
    const anySolo = project.tracks.some((t) => t.solo);

    const offlineTracks = new Map<string, GainNode>();
    for (const track of project.tracks) {
      const fx = createDefaultTrackFx(track.fx);
      const trkIn = offline.createGain();
      const format = track.inputFormat || (track.type === 'audio' ? 'mono' : 'stereo');
      if (format === 'mono') {
        trkIn.channelCount = 1;
        trkIn.channelCountMode = 'explicit';
        trkIn.channelInterpretation = 'speakers';
      }

      // Neve 1073 Offline
      const nHp = offline.createBiquadFilter();
      nHp.type = 'highpass';
      nHp.frequency.value = fx.neve1073.enabled && fx.neve1073.hpFreq > 0 ? fx.neve1073.hpFreq : 15;
      const nLow = offline.createBiquadFilter();
      nLow.type = 'lowshelf';
      nLow.frequency.value = fx.neve1073.lowFreq;
      nLow.gain.value = fx.neve1073.enabled ? fx.neve1073.lowGain : 0;
      const nMid = offline.createBiquadFilter();
      nMid.type = 'peaking';
      nMid.frequency.value = fx.neve1073.midFreq;
      nMid.gain.value = fx.neve1073.enabled ? fx.neve1073.midGain : 0;
      const nHigh = offline.createBiquadFilter();
      nHigh.type = 'highshelf';
      nHigh.frequency.value = 12000;
      nHigh.gain.value = fx.neve1073.enabled ? fx.neve1073.highGain : 0;

      // Pultec Offline
      const pLB = offline.createBiquadFilter();
      pLB.type = 'lowshelf';
      pLB.frequency.value = fx.pultec.lowFreq;
      pLB.gain.value = fx.pultec.enabled ? fx.pultec.lowBoost * 1.35 : 0;
      const pLA = offline.createBiquadFilter();
      pLA.type = 'peaking';
      pLA.frequency.value = fx.pultec.lowFreq * 1.48;
      pLA.gain.value = fx.pultec.enabled ? -fx.pultec.lowAtten * 1.15 : 0;
      const pHB = offline.createBiquadFilter();
      pHB.type = 'peaking';
      pHB.frequency.value = fx.pultec.highFreq;
      pHB.gain.value = fx.pultec.enabled ? fx.pultec.highBoost * 1.4 : 0;

      // 1176 + LA-2A Offline
      const fet = offline.createDynamicsCompressor();
      fet.threshold.value = fx.fet1176.enabled ? (fx.fet1176.ratio === 'all' ? -28 : -22) : 0;
      fet.ratio.value = fx.fet1176.enabled ? (fx.fet1176.ratio === 'all' ? 20 : fx.fet1176.ratio) : 1;
      const la2a = offline.createDynamicsCompressor();
      la2a.threshold.value = fx.la2a.enabled ? -4 - (fx.la2a.peakReduction / 100) * 34 : 0;
      la2a.ratio.value = fx.la2a.enabled ? (fx.la2a.mode === 'limit' ? 10 : 3.2) : 1;

      // Channel EQ Offline
      const hp = offline.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = fx.eq.enabled ? fx.eq.hpFreq : 15;
      const ls = offline.createBiquadFilter();
      ls.type = 'lowshelf';
      ls.frequency.value = fx.eq.lowFreq;
      ls.gain.value = fx.eq.enabled ? fx.eq.lowGain : 0;
      const mp = offline.createBiquadFilter();
      mp.type = 'peaking';
      mp.frequency.value = fx.eq.midFreq;
      mp.Q.value = fx.eq.midQ;
      mp.gain.value = fx.eq.enabled ? fx.eq.midGain : 0;
      const hs = offline.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.value = fx.eq.highFreq;
      hs.gain.value = fx.eq.enabled ? fx.eq.highGain : 0;

      const comp = offline.createDynamicsCompressor();
      comp.threshold.value = fx.compressor.enabled ? fx.compressor.threshold : 0;
      comp.ratio.value = fx.compressor.enabled ? Math.max(1, fx.compressor.ratio) : 1;
      const compGain = offline.createGain();
      compGain.gain.value = fx.compressor.enabled ? dbToGain(fx.compressor.makeupGain) : 1;

      // FL Parametric EQ 2 + FabFilter Pro-Q 3 Offline
      let eqTail: AudioNode = la2a;
      if (fx.flEq2.enabled) {
        for (const band of fx.flEq2.bands) {
          if (!band.enabled) continue;
          const b = offline.createBiquadFilter();
          b.type = band.type;
          b.frequency.value = Math.max(20, Math.min(20000, band.freq));
          b.Q.value = Math.max(0.3, Math.min(12, band.q));
          if (band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf') {
            b.gain.value = band.gain;
          }
          eqTail.connect(b);
          eqTail = b;
        }
        const flOut = offline.createGain();
        flOut.gain.value = dbToGain(fx.flEq2.outputGain);
        eqTail.connect(flOut);
        eqTail = flOut;
      }

      if (fx.fabProQ.enabled) {
        for (const band of fx.fabProQ.bands) {
          if (!band.enabled) continue;
          const b = offline.createBiquadFilter();
          b.type = band.type;
          b.frequency.value = Math.max(20, Math.min(20000, band.freq));
          b.Q.value = Math.max(0.3, Math.min(12, band.q));
          if (band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf') {
            b.gain.value = band.gain;
          }
          eqTail.connect(b);
          eqTail = b;
        }
        const proQOut = offline.createGain();
        proQOut.gain.value = dbToGain(fx.fabProQ.outputGain);
        eqTail.connect(proQOut);
        eqTail = proQOut;
      }

      const ms = createMidSideStage(offline);
      ms.setWidth(fx.stereo.enabled ? fx.stereo.width : 1.0, 0);

      let spaceTail: AudioNode = ms.output;

      // Soundtoys EchoBoy Offline
      if (fx.echoBoy.enabled && fx.echoBoy.mix > 0) {
        const ebDry = offline.createGain();
        const ebWet = offline.createGain();
        const ebSum = offline.createGain();
        const wet = (fx.echoBoy.mix / 100) * 0.85;
        ebDry.gain.value = 1 - wet * 0.35;
        ebWet.gain.value = wet;
        const beatSec = 60 / project.bpm;
        const ebDel = offline.createDelay(2.0);
        ebDel.delayTime.value = Math.max(0.03, Math.min(1.9, beatSec * echoDivisionBeats(fx.echoBoy.division)));
        const ebFb = offline.createGain();
        ebFb.gain.value = Math.min(0.85, fx.echoBoy.feedback / 100);
        const ebLp = offline.createBiquadFilter();
        ebLp.type = 'lowpass';
        ebLp.frequency.value = fx.echoBoy.highCutHz;
        spaceTail.connect(ebDry);
        spaceTail.connect(ebDel);
        ebDel.connect(ebLp);
        ebLp.connect(ebFb);
        ebFb.connect(ebDel);
        ebLp.connect(ebWet);
        ebDry.connect(ebSum);
        ebWet.connect(ebSum);
        spaceTail = ebSum;
      }

      // FL Fruity Convolver Offline
      if (fx.flConvolver.enabled && fx.flConvolver.wet > 0) {
        const cDry = offline.createGain();
        const cWet = offline.createGain();
        const cSum = offline.createGain();
        cDry.gain.value = fx.flConvolver.dry / 100;
        cWet.gain.value = (fx.flConvolver.wet / 100) * 0.82;
        const cNode = offline.createConvolver();
        cNode.buffer = createStyledImpulse(offline, fx.flConvolver.impulse, fx.flConvolver.decaySec);
        spaceTail.connect(cDry);
        spaceTail.connect(cNode);
        cNode.connect(cWet);
        cDry.connect(cSum);
        cWet.connect(cSum);
        spaceTail = cSum;
      }

      // FabFilter Pro-R 2 Offline
      if (fx.fabProR.enabled && fx.fabProR.mix > 0) {
        const rDry = offline.createGain();
        const rWet = offline.createGain();
        const rSum = offline.createGain();
        const wet = (fx.fabProR.mix / 100) * 0.82;
        rDry.gain.value = 1 - wet * 0.4;
        rWet.gain.value = wet;
        const rNode = offline.createConvolver();
        rNode.buffer = createProRImpulse(offline, fx.fabProR.spaceSec, fx.fabProR.character, fx.fabProR.distance);
        spaceTail.connect(rDry);
        spaceTail.connect(rNode);
        rNode.connect(rWet);
        rDry.connect(rSum);
        rWet.connect(rSum);
        spaceTail = rSum;
      }

      const autoFilter = offline.createBiquadFilter();
      autoFilter.type = 'lowpass';
      autoFilter.frequency.value = 20000;
      autoFilter.Q.value = 1.2;

      const fader = offline.createGain();
      const audible = anySolo ? track.solo : !track.muted;
      fader.gain.value = audible ? track.volume : 0;
      const pan = offline.createStereoPanner();
      pan.pan.value = track.pan;

      trkIn.connect(nHp);
      nHp.connect(nLow);
      nLow.connect(nMid);
      nMid.connect(nHigh);
      nHigh.connect(pLB);
      pLB.connect(pLA);
      pLA.connect(pHB);
      pHB.connect(fet);
      fet.connect(la2a);
      eqTail.connect(hp);
      hp.connect(ls);
      ls.connect(mp);
      mp.connect(hs);
      hs.connect(comp);
      comp.connect(compGain);
      compGain.connect(ms.input);
      spaceTail.connect(autoFilter);
      autoFilter.connect(fader);
      fader.connect(pan);

      const outBus = track.outputBus || 'stereo-out';
      const outDest = outBus === 'stereo-out' ? masterIn : offlineAux.get(outBus) || masterIn;
      pan.connect(outDest);

      const sends =
        track.busSends && track.busSends.length > 0
          ? track.busSends
          : createDefaultBusSends(track.reverbSend, track.delaySend);
      const offlineSendGains = new Map<AuxBusId, GainNode>();
      for (const s of sends) {
        const dest = offlineAux.get(s.busId);
        if (!dest) continue;
        const g = offline.createGain();
        g.gain.value = audible && s.enabled ? s.level : 0;
        (s.preFader ? autoFilter : fader).connect(g);
        g.connect(dest);
        offlineSendGains.set(s.busId, g);
      }

      // Schedule offline Track Automation curves
      if ((track.automationMode || 'read') !== 'off' && track.automationLanes) {
        const lanes = track.automationLanes;
        for (let step = 0; step <= totalSteps; step++) {
          const t = step * stepDuration;
          if (lanes.volume && lanes.volume.length > 0) {
            const v = evaluateAutomationAtStep(lanes.volume, step, track.volume / 1.2);
            fader.gain.linearRampToValueAtTime(audible ? Math.max(0, Math.min(1.2, v * 1.2)) : 0, t);
          }
          if (lanes.pan && lanes.pan.length > 0) {
            const p = evaluateAutomationAtStep(lanes.pan, step, (track.pan + 1) / 2);
            pan.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, p * 2 - 1)), t);
          }
          if (lanes.filterCutoff && lanes.filterCutoff.length > 0) {
            const fNorm = evaluateAutomationAtStep(lanes.filterCutoff, step, 1);
            autoFilter.frequency.linearRampToValueAtTime(140 * Math.pow(20000 / 140, Math.max(0, Math.min(1, fNorm))), t);
          }
          if (lanes.reverbSend && lanes.reverbSend.length > 0) {
            const g3 = offlineSendGains.get('bus-3');
            if (g3) {
              const rVal = evaluateAutomationAtStep(lanes.reverbSend, step, track.reverbSend);
              g3.gain.linearRampToValueAtTime(audible ? Math.max(0, Math.min(1, rVal)) : 0, t);
            }
          }
          if (lanes.delaySend && lanes.delaySend.length > 0) {
            const g4 = offlineSendGains.get('bus-4');
            if (g4) {
              const dVal = evaluateAutomationAtStep(lanes.delaySend, step, track.delaySend);
              g4.gain.linearRampToValueAtTime(audible ? Math.max(0, Math.min(1, dVal)) : 0, t);
            }
          }
        }
      }

      offlineTracks.set(track.id, trkIn);
    }

    const drumTrack = project.tracks.find((t) => t.type === 'drums');
    const drumDest = drumTrack ? offlineTracks.get(drumTrack.id) : null;
    if (drumDest) {
      for (let step = 0; step < totalSteps; step++) {
        const swingOffset = step % 2 === 1 ? stepDuration * project.swing * 0.55 : 0;
        const time = step * stepDuration + swingOffset;
        const drumStep = step % 32;
        for (const ch of project.drumChannels) {
          if (ch.muted) continue;
          const vel = ch.steps[drumStep] || 0;
          if (vel > 0) {
            this.triggerDrumSound(offline, drumDest, noise, ch.id, time, vel * ch.volume, ch.pitch);
          }
        }
      }
    }

    for (const note of project.notes) {
      const track = project.tracks.find((t) => t.id === note.trackId);
      const dest = track ? offlineTracks.get(track.id) : null;
      if (!track || !dest) continue;
      const swingOffset = note.startStep % 2 === 1 ? stepDuration * project.swing * 0.55 : 0;
      const time = note.startStep * stepDuration + swingOffset;
      const dur = Math.max(0.08, note.durationSteps * stepDuration);
      const pitch = track.fx?.autotune?.enabled
        ? quantizeMidiToAutoTune(note.pitch, track.fx.autotune)
        : note.pitch;
      this.triggerSynthSound(
        offline,
        dest,
        track.preset || 'warm-keys',
        pitch,
        time,
        dur,
        note.velocity,
        track.instrumentParams
      );
    }

    for (const clip of project.audioClips) {
      const track = project.tracks.find((t) => t.id === clip.trackId);
      const dest = offlineTracks.get(clip.trackId);
      if (!dest) continue;
      try {
        const res = await fetch(clip.audioDataUrl);
        const ab = await res.arrayBuffer();
        const buf = await offline.decodeAudioData(ab);
        const src = offline.createBufferSource();
        src.buffer = buf;
        if (track?.fx?.autotune?.enabled && track.fx.autotune.transpose !== 0) {
          src.playbackRate.value = Math.pow(2, track.fx.autotune.transpose / 12);
        }
        src.connect(dest);
        src.start(clip.startStep * stepDuration);
      } catch {
        // skip undecodable clip
      }
    }

    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const length = buffer.length * numChannels * (bitDepth / 8);
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, length, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const audioEngine = new StudioAudioEngine();
