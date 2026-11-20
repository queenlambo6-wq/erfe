import type {
  AbletonMacroRack,
  AbletonSessionState,
  AutomationPoint,
  AutoTuneScale,
  AutoTuneSettings,
  BusSendSlot,
  DrumChannel,
  DrumChannelId,
  EchoBoySettings,
  FabProQSettings,
  FabProRSettings,
  Fet1176Settings,
  FlConvolverSettings,
  FlEq2Settings,
  FlSoundgoodizerSettings,
  La2aSettings,
  MasteringChain,
  MidiNote,
  Neve1073Settings,
  ParametricBand,
  PultecSettings,
  StudioAuxBus,
  StudioProject,
  StudioTrack,
  TrackCompressorSettings,
  TrackDriveSettings,
  TrackEqSettings,
  TrackFxChain,
} from '../types/studio';

export const TRACK_COLORS = [
  '#3B82F6', // Logic Studio Blue
  '#10B981', // Logic Software Instrument Green
  '#8B5CF6', // Logic Synth Violet
  '#F59E0B', // Logic Drum Amber
  '#EC4899', // Logic Lead Magenta
  '#06B6D4', // Logic Audio Cyan
];

export const MUSICAL_KEYS: Record<string, number[]> = {
  'C Minor': [0, 2, 3, 5, 7, 8, 10],
  'C Major': [0, 2, 4, 5, 7, 9, 11],
  'A Minor': [9, 11, 0, 2, 4, 5, 7],
  'F Minor': [5, 7, 8, 10, 0, 1, 3],
  'G Major': [7, 9, 11, 0, 2, 4, 6],
  'D Minor': [2, 4, 5, 7, 9, 10, 0],
};

export const AUTOTUNE_SCALE_INTERVALS: Record<AutoTuneScale, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function quantizeMidiToAutoTune(midi: number, at: AutoTuneSettings): number {
  if (!at.enabled) return midi;
  const transposed = midi + at.transpose;
  const rootPc = Math.max(0, NOTE_NAMES.indexOf(at.key));
  const intervals = AUTOTUNE_SCALE_INTERVALS[at.scale] || AUTOTUNE_SCALE_INTERVALS.Chromatic;
  const allowed = new Set(intervals.map((iv) => (rootPc + iv) % 12));

  const pc = ((transposed % 12) + 12) % 12;
  if (allowed.has(pc)) return transposed;

  // Snap to closest scale degree
  for (let delta = 1; delta <= 6; delta++) {
    if (allowed.has((pc + delta) % 12)) return transposed + delta;
    if (allowed.has((pc - delta + 12) % 12)) return transposed - delta;
  }
  return transposed;
}

export function createEmptySteps(length = 32): number[] {
  return Array.from({ length }, () => 0);
}

export function createDefaultAuxBuses(): StudioAuxBus[] {
  return [
    {
      id: 'bus-1',
      name: 'Drum Glue Bus',
      shortLabel: 'Bus 1 · Drums',
      color: '#F59E0B',
      role: 'submix',
      volume: 0.92,
      pan: 0,
      muted: false,
      solo: false,
      compAmount: 42,
      toneHz: 14000,
      decaySec: 1.0,
      feedback: 0,
      width: 1.06,
    },
    {
      id: 'bus-2',
      name: 'Vocal Submix Bus',
      shortLabel: 'Bus 2 · Vocals',
      color: '#06B6D4',
      role: 'submix',
      volume: 0.95,
      pan: 0,
      muted: false,
      solo: false,
      compAmount: 36,
      toneHz: 16000,
      decaySec: 1.0,
      feedback: 0,
      width: 1.05,
    },
    {
      id: 'bus-3',
      name: 'Aux Space Verb',
      shortLabel: 'Bus 3 · Reverb',
      color: '#8B5CF6',
      role: 'reverb',
      volume: 0.78,
      pan: 0,
      muted: false,
      solo: false,
      compAmount: 0,
      toneHz: 8500,
      decaySec: 2.6,
      feedback: 0,
      width: 1.35,
    },
    {
      id: 'bus-4',
      name: 'Aux Echo Throw',
      shortLabel: 'Bus 4 · Delay',
      color: '#EC4899',
      role: 'delay',
      volume: 0.74,
      pan: 0,
      muted: false,
      solo: false,
      compAmount: 0,
      toneHz: 4200,
      decaySec: 1.0,
      feedback: 44,
      width: 1.4,
    },
  ];
}

export function createDefaultBusSends(reverbSend = 0, delaySend = 0): BusSendSlot[] {
  return [
    { busId: 'bus-1', level: 0, preFader: false, enabled: false },
    { busId: 'bus-2', level: 0, preFader: false, enabled: false },
    { busId: 'bus-3', level: reverbSend, preFader: false, enabled: reverbSend > 0.01 },
    { busId: 'bus-4', level: delaySend, preFader: false, enabled: delaySend > 0.01 },
  ];
}

export function createDefaultMacroRack(): AbletonMacroRack {
  return {
    djFilter: 0,
    filterRes: 22,
    tapeWarmth: 18,
    spaceWash: 0,
    dubEcho: 0,
    stereoWidth: 100,
    ottPunch: 20,
    beatRepeat: 'off',
  };
}

export function createDefaultAbletonSession(): AbletonSessionState {
  return {
    activeSceneId: 'scene-2',
    quantize: '1-bar',
    clipPlayingByTrack: {
      'track-drums': 'scene-2',
      'track-keys': 'scene-2',
      'track-bass': 'scene-2',
      'track-lead': 'scene-2',
      'track-vocal': 'scene-2',
    },
    scenes: [
      {
        id: 'scene-1',
        name: '1 · Intro Chill',
        color: '#38BDF8',
        drumPreset: 'Lo-Fi Chill',
        activeTrackIds: ['track-keys', 'track-vocal'],
      },
      {
        id: 'scene-2',
        name: '2 · Verse Groove',
        color: '#10B981',
        drumPreset: 'Lo-Fi Chill',
        activeTrackIds: ['track-drums', 'track-keys', 'track-bass', 'track-lead', 'track-vocal'],
      },
      {
        id: 'scene-3',
        name: '3 · Chorus Drop',
        color: '#F59E0B',
        drumPreset: 'Trap 808',
        activeTrackIds: ['track-drums', 'track-keys', 'track-bass', 'track-lead', 'track-vocal'],
      },
      {
        id: 'scene-4',
        name: '4 · House Club',
        color: '#EC4899',
        drumPreset: 'House Groove',
        activeTrackIds: ['track-drums', 'track-bass', 'track-lead', 'track-vocal'],
      },
    ],
    macroRack: createDefaultMacroRack(),
  };
}

export function evaluateAutomationAtStep(
  points: AutomationPoint[] | undefined,
  step: number,
  fallback: number
): number {
  if (!points || points.length === 0) return fallback;
  const sorted = [...points].sort((a, b) => a.step - b.step);
  if (step <= sorted[0].step) return sorted[0].value;
  if (step >= sorted[sorted.length - 1].step) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (step >= a.step && step <= b.step) {
      const span = Math.max(0.0001, b.step - a.step);
      const t = (step - a.step) / span;
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

export function createDefaultFlEq2Bands(): ParametricBand[] {
  return [
    { id: 1, freq: 42, gain: 0, q: 0.7, type: 'lowshelf', enabled: true },
    { id: 2, freq: 115, gain: 0, q: 1.0, type: 'peaking', enabled: true },
    { id: 3, freq: 340, gain: 0, q: 1.1, type: 'peaking', enabled: true },
    { id: 4, freq: 980, gain: 0, q: 1.1, type: 'peaking', enabled: true },
    { id: 5, freq: 2600, gain: 0, q: 1.1, type: 'peaking', enabled: true },
    { id: 6, freq: 6200, gain: 0, q: 1.0, type: 'peaking', enabled: true },
    { id: 7, freq: 12000, gain: 0, q: 0.7, type: 'highshelf', enabled: true },
  ];
}

export function createDefaultFabProQBands(): ParametricBand[] {
  return [
    { id: 1, freq: 36, gain: 0, q: 0.7, type: 'highpass', enabled: true },
    { id: 2, freq: 110, gain: 0, q: 0.9, type: 'lowshelf', enabled: true },
    { id: 3, freq: 380, gain: 0, q: 1.3, type: 'peaking', enabled: true },
    { id: 4, freq: 1600, gain: 0, q: 1.2, type: 'peaking', enabled: true },
    { id: 5, freq: 4800, gain: 0, q: 1.4, type: 'peaking', enabled: true },
    { id: 6, freq: 11500, gain: 0, q: 0.7, type: 'highshelf', enabled: true },
  ];
}

export function createDefaultTrackFx(overrides?: Partial<TrackFxChain>): TrackFxChain {
  return {
    autotune: {
      enabled: false,
      key: 'C',
      scale: 'Minor',
      retuneSpeed: 18,
      flexTune: 25,
      humanize: 30,
      formant: 0,
      transpose: 0,
      classicMode: false,
      ...(overrides?.autotune || {}),
    },
    neve1073: {
      enabled: false,
      preampDrive: 18,
      hpFreq: 80,
      lowFreq: 60,
      lowGain: 0,
      midFreq: 1600,
      midGain: 0,
      highGain: 0,
      outputTrim: 0,
      ...(overrides?.neve1073 || {}),
    },
    pultec: {
      enabled: false,
      lowFreq: 60,
      lowBoost: 0,
      lowAtten: 0,
      highFreq: 10000,
      highBoost: 0,
      bandwidth: 5,
      highAtten: 0,
      highAttenFreq: 10000,
      ...(overrides?.pultec || {}),
    },
    la2a: {
      enabled: false,
      mode: 'compress',
      peakReduction: 42,
      gain: 52,
      tubeWarmth: 35,
      ...(overrides?.la2a || {}),
    },
    fet1176: {
      enabled: false,
      input: 45,
      output: 50,
      attack: 4,
      release: 5,
      ratio: 4,
      ...(overrides?.fet1176 || {}),
    },
    flEq2: {
      enabled: false,
      bands: overrides?.flEq2?.bands
        ? overrides.flEq2.bands.map((b) => ({ ...b }))
        : createDefaultFlEq2Bands(),
      heatmap: overrides?.flEq2?.heatmap ?? true,
      outputGain: overrides?.flEq2?.outputGain ?? 0,
      ...(overrides?.flEq2 ? { enabled: overrides.flEq2.enabled } : {}),
    },
    flConvolver: {
      enabled: false,
      impulse: 'cathedral',
      dry: 100,
      wet: 32,
      preDelayMs: 24,
      decaySec: 2.4,
      lowCutHz: 140,
      highCutHz: 9500,
      stereoSep: 1.25,
      ...(overrides?.flConvolver || {}),
    },
    flSoundgoodizer: {
      enabled: false,
      mode: 'A',
      amount: 45,
      mix: 75,
      ...(overrides?.flSoundgoodizer || {}),
    },
    flReeverb2: {
      enabled: false,
      dry: 100,
      wet: 34,
      size: 62,
      decaySec: 2.6,
      lowCutHz: 180,
      highCutHz: 8500,
      preDelayMs: 22,
      stereoSep: 1.25,
      ...(overrides?.flReeverb2 || {}),
    },
    flDelay3: {
      enabled: false,
      division: '1/8D',
      wet: 30,
      feedback: 40,
      toneHz: 4600,
      pingPong: true,
      saturation: 22,
      ...(overrides?.flDelay3 || {}),
    },
    grossBeat: {
      enabled: false,
      preset: 'half-speed',
      mix: 85,
      ...(overrides?.grossBeat || {}),
    },
    flSoftClipper: {
      enabled: false,
      threshold: 64,
      postGain: 1.5,
      ...(overrides?.flSoftClipper || {}),
    },
    flLimiter: {
      enabled: false,
      ceiling: -0.3,
      gain: 3.0,
      attackMs: 2.0,
      releaseMs: 90,
      sat: 12,
      ...(overrides?.flLimiter || {}),
    },
    flChorus: {
      enabled: false,
      depth: 45,
      rateHz: 0.75,
      mix: 40,
      ...(overrides?.flChorus || {}),
    },
    fabProQ: {
      enabled: false,
      bands: overrides?.fabProQ?.bands
        ? overrides.fabProQ.bands.map((b) => ({ ...b }))
        : createDefaultFabProQBands(),
      analyzerMode: overrides?.fabProQ?.analyzerMode ?? 'pre-post',
      outputGain: overrides?.fabProQ?.outputGain ?? 0,
      ...(overrides?.fabProQ ? { enabled: overrides.fabProQ.enabled } : {}),
    },
    fabProR: {
      enabled: false,
      spaceSec: 2.2,
      brightness: 15,
      character: 40,
      distance: 45,
      preDelayMs: 18,
      mix: 26,
      ...(overrides?.fabProR || {}),
    },
    echoBoy: {
      enabled: false,
      style: 'space-echo',
      division: '1/8D',
      mix: 28,
      feedback: 38,
      saturation: 35,
      lowCutHz: 180,
      highCutHz: 5200,
      groove: 6,
      pingPong: true,
      ...(overrides?.echoBoy || {}),
    },
    eq: {
      enabled: true,
      hpFreq: 30,
      lowFreq: 100,
      lowGain: 0,
      midFreq: 1200,
      midGain: 0,
      midQ: 1.0,
      highFreq: 7500,
      highGain: 0,
      ...(overrides?.eq || {}),
    },
    compressor: {
      enabled: false,
      threshold: -18,
      ratio: 3.5,
      attack: 0.012,
      release: 0.16,
      knee: 8,
      makeupGain: 2,
      ...(overrides?.compressor || {}),
    },
    drive: {
      enabled: false,
      drive: 20,
      tone: 9500,
      mix: 0.45,
      ...(overrides?.drive || {}),
    },
    stereo: {
      enabled: true,
      width: 1.0,
      ...(overrides?.stereo || {}),
    },
  };
}

export function createDefaultMasteringChain(): MasteringChain {
  return {
    bypassAll: false,
    eqEnabled: true,
    lowCutHz: 28,
    subGain: 1.2,
    mudGain: -0.8,
    presenceGain: 0.8,
    airGain: 1.5,

    compEnabled: true,
    compThreshold: -14,
    compRatio: 2.2,
    compAttack: 0.02,
    compRelease: 0.18,
    compMakeup: 1.8,

    exciterEnabled: true,
    exciterAmount: 16,
    stereoWidth: 1.08,

    limiterEnabled: true,
    limiterDrive: 2.5,
    limiterCeiling: -0.3,
  };
}

export const AUTOTUNE_PRESETS: Record<string, Partial<AutoTuneSettings>> = {
  'Hard Trap (0ms)': { enabled: true, retuneSpeed: 0, flexTune: 0, humanize: 0, formant: 0, transpose: 0, classicMode: true },
  'Modern Pop Vocal': { enabled: true, retuneSpeed: 16, flexTune: 25, humanize: 35, formant: 1, transpose: 0, classicMode: false },
  'Smooth R&B': { enabled: true, retuneSpeed: 32, flexTune: 45, humanize: 60, formant: 0, transpose: 0, classicMode: false },
  'Deep Formant': { enabled: true, retuneSpeed: 6, flexTune: 10, humanize: 10, formant: -5, transpose: 0, classicMode: true },
};

export const NEVE1073_PRESETS: Record<string, Partial<Neve1073Settings>> = {
  'Silky Lead Vocal': { enabled: true, preampDrive: 22, hpFreq: 80, lowFreq: 110, lowGain: -1.5, midFreq: 3200, midGain: 2.5, highGain: 4.0, outputTrim: 0 },
  'Punchy Drum Bus': { enabled: true, preampDrive: 32, hpFreq: 50, lowFreq: 60, lowGain: 3.5, midFreq: 700, midGain: -1.5, highGain: 2.5, outputTrim: -1 },
  'Fat Analog Bass': { enabled: true, preampDrive: 36, hpFreq: 0, lowFreq: 60, lowGain: 4.5, midFreq: 700, midGain: 2.0, highGain: -2.0, outputTrim: -1.5 },
  'Warm Keys': { enabled: true, preampDrive: 18, hpFreq: 80, lowFreq: 110, lowGain: 1.5, midFreq: 1600, midGain: 1.0, highGain: 2.0, outputTrim: 0 },
};

export const PULTEC_PRESETS: Record<string, Partial<PultecSettings>> = {
  'Low-End Kick Trick': { enabled: true, lowFreq: 60, lowBoost: 5.5, lowAtten: 3.8, highFreq: 8000, highBoost: 3.0, bandwidth: 4, highAtten: 0, highAttenFreq: 10000 },
  'Vocal Air & Sheen': { enabled: true, lowFreq: 100, lowBoost: 1.5, lowAtten: 2.5, highFreq: 12000, highBoost: 5.5, bandwidth: 6, highAtten: 1.0, highAttenFreq: 20000 },
  'Sub Bass Weight': { enabled: true, lowFreq: 30, lowBoost: 6.0, lowAtten: 2.5, highFreq: 5000, highBoost: 1.5, bandwidth: 5, highAtten: 3.5, highAttenFreq: 10000 },
  'Master Smile': { enabled: true, lowFreq: 60, lowBoost: 3.0, lowAtten: 1.8, highFreq: 16000, highBoost: 3.5, bandwidth: 7, highAtten: 0, highAttenFreq: 20000 },
};

export const LA2A_PRESETS: Record<string, Partial<La2aSettings>> = {
  'Classic Vocal Opto': { enabled: true, mode: 'compress', peakReduction: 52, gain: 56, tubeWarmth: 40 },
  'Bass Leveler': { enabled: true, mode: 'limit', peakReduction: 64, gain: 58, tubeWarmth: 50 },
  'Gentle Silk Kiss': { enabled: true, mode: 'compress', peakReduction: 32, gain: 50, tubeWarmth: 28 },
};

export const FET1176_PRESETS: Record<string, Partial<Fet1176Settings>> = {
  'Vocal Bite (4:1)': { enabled: true, input: 52, output: 54, attack: 3, release: 6, ratio: 4 },
  'Drum Room Smash (ALL)': { enabled: true, input: 74, output: 46, attack: 6, release: 7, ratio: 'all' },
  'Snare Snap (8:1)': { enabled: true, input: 62, output: 54, attack: 2, release: 6, ratio: 8 },
  'Aggressive Bass (12:1)': { enabled: true, input: 60, output: 52, attack: 4, release: 5, ratio: 12 },
};

export const FL_EQ2_PRESETS: Record<string, Partial<FlEq2Settings>> = {
  Flat: { enabled: true, outputGain: 0, bands: createDefaultFlEq2Bands() },
  '40Hz Cut + Air': {
    enabled: true,
    outputGain: 0,
    bands: [
      { id: 1, freq: 40, gain: 0, q: 0.8, type: 'highpass', enabled: true },
      { id: 2, freq: 110, gain: 1.5, q: 1.0, type: 'peaking', enabled: true },
      { id: 3, freq: 340, gain: -2.0, q: 1.4, type: 'peaking', enabled: true },
      { id: 4, freq: 980, gain: 0, q: 1.0, type: 'peaking', enabled: true },
      { id: 5, freq: 2800, gain: 1.8, q: 1.1, type: 'peaking', enabled: true },
      { id: 6, freq: 6400, gain: 1.5, q: 1.0, type: 'peaking', enabled: true },
      { id: 7, freq: 11500, gain: 3.5, q: 0.7, type: 'highshelf', enabled: true },
    ],
  },
  'Radio Vocal': {
    enabled: true,
    outputGain: 1.5,
    bands: [
      { id: 1, freq: 340, gain: 0, q: 0.9, type: 'highpass', enabled: true },
      { id: 2, freq: 180, gain: -6, q: 1.0, type: 'lowshelf', enabled: true },
      { id: 3, freq: 520, gain: 2.0, q: 1.2, type: 'peaking', enabled: true },
      { id: 4, freq: 1450, gain: 6.5, q: 1.6, type: 'peaking', enabled: true },
      { id: 5, freq: 2800, gain: 3.0, q: 1.5, type: 'peaking', enabled: true },
      { id: 6, freq: 4200, gain: 0, q: 0.8, type: 'lowpass', enabled: true },
      { id: 7, freq: 9000, gain: -8, q: 0.7, type: 'highshelf', enabled: true },
    ],
  },
  '808 Sub Boost': {
    enabled: true,
    outputGain: -1.0,
    bands: [
      { id: 1, freq: 28, gain: 0, q: 0.7, type: 'highpass', enabled: true },
      { id: 2, freq: 62, gain: 5.5, q: 1.1, type: 'peaking', enabled: true },
      { id: 3, freq: 220, gain: -2.5, q: 1.4, type: 'peaking', enabled: true },
      { id: 4, freq: 820, gain: 2.2, q: 1.2, type: 'peaking', enabled: true },
      { id: 5, freq: 2400, gain: 0, q: 1.0, type: 'peaking', enabled: true },
      { id: 6, freq: 5500, gain: -2.0, q: 0.9, type: 'peaking', enabled: true },
      { id: 7, freq: 8500, gain: -5.0, q: 0.7, type: 'highshelf', enabled: true },
    ],
  },
};

export const FL_CONVOLVER_PRESETS: Record<string, Partial<FlConvolverSettings>> = {
  'Cathedral Vocal': { enabled: true, impulse: 'cathedral', dry: 100, wet: 34, preDelayMs: 28, decaySec: 3.2, lowCutHz: 180, highCutHz: 8500, stereoSep: 1.35 },
  'Concert Plate': { enabled: true, impulse: 'plate', dry: 100, wet: 28, preDelayMs: 14, decaySec: 1.8, lowCutHz: 150, highCutHz: 11500, stereoSep: 1.25 },
  'Vintage Spring': { enabled: true, impulse: 'spring', dry: 100, wet: 30, preDelayMs: 8, decaySec: 1.4, lowCutHz: 240, highCutHz: 6500, stereoSep: 0.9 },
  'Tight Vocal Booth': { enabled: true, impulse: 'vocal-booth', dry: 100, wet: 20, preDelayMs: 6, decaySec: 0.65, lowCutHz: 120, highCutHz: 10000, stereoSep: 1.0 },
  'Dreamy Reverse': { enabled: true, impulse: 'reverse-swell', dry: 90, wet: 46, preDelayMs: 42, decaySec: 2.2, lowCutHz: 220, highCutHz: 9000, stereoSep: 1.6 },
};

export const FL_SOUNDGOODIZER_PRESETS: Record<string, Partial<FlSoundgoodizerSettings>> = {
  'Mode A · Crisp Punch': { enabled: true, mode: 'A', amount: 48, mix: 78 },
  'Mode B · Warm Glue': { enabled: true, mode: 'B', amount: 52, mix: 75 },
  'Mode C · Sub & Sheen': { enabled: true, mode: 'C', amount: 58, mix: 80 },
  'Mode D · Loud Club': { enabled: true, mode: 'D', amount: 65, mix: 85 },
};

export const FAB_PROQ_PRESETS: Record<string, Partial<FabProQSettings>> = {
  Flat: { enabled: true, outputGain: 0, bands: createDefaultFabProQBands() },
  'Vocal De-Mud & Air': {
    enabled: true,
    outputGain: 0.5,
    bands: [
      { id: 1, freq: 85, gain: 0, q: 0.7, type: 'highpass', enabled: true },
      { id: 2, freq: 180, gain: -1.8, q: 1.1, type: 'lowshelf', enabled: true },
      { id: 3, freq: 360, gain: -3.2, q: 2.2, type: 'peaking', enabled: true },
      { id: 4, freq: 2900, gain: 2.4, q: 1.3, type: 'peaking', enabled: true },
      { id: 5, freq: 6800, gain: -2.0, q: 3.4, type: 'peaking', enabled: true },
      { id: 6, freq: 12000, gain: 3.2, q: 0.7, type: 'highshelf', enabled: true },
    ],
  },
  'Mastering Tilt': {
    enabled: true,
    outputGain: 0,
    bands: [
      { id: 1, freq: 30, gain: 0, q: 0.7, type: 'highpass', enabled: true },
      { id: 2, freq: 85, gain: 1.8, q: 0.8, type: 'lowshelf', enabled: true },
      { id: 3, freq: 320, gain: -1.4, q: 1.5, type: 'peaking', enabled: true },
      { id: 4, freq: 1400, gain: 0.5, q: 1.0, type: 'peaking', enabled: true },
      { id: 5, freq: 4500, gain: 1.2, q: 1.1, type: 'peaking', enabled: true },
      { id: 6, freq: 13000, gain: 2.4, q: 0.7, type: 'highshelf', enabled: true },
    ],
  },
  'Drum Bus Sculpt': {
    enabled: true,
    outputGain: 0,
    bands: [
      { id: 1, freq: 32, gain: 0, q: 0.7, type: 'highpass', enabled: true },
      { id: 2, freq: 68, gain: 3.2, q: 1.0, type: 'lowshelf', enabled: true },
      { id: 3, freq: 420, gain: -3.5, q: 1.8, type: 'peaking', enabled: true },
      { id: 4, freq: 2200, gain: 1.8, q: 1.3, type: 'peaking', enabled: true },
      { id: 5, freq: 5800, gain: 2.0, q: 1.4, type: 'peaking', enabled: true },
      { id: 6, freq: 11000, gain: 2.2, q: 0.7, type: 'highshelf', enabled: true },
    ],
  },
};

export const FAB_PROR_PRESETS: Record<string, Partial<FabProRSettings>> = {
  'Bright Vocal Plate': { enabled: true, spaceSec: 1.9, brightness: 45, character: 35, distance: 35, preDelayMs: 22, mix: 28 },
  'Dark Studio Chamber': { enabled: true, spaceSec: 1.5, brightness: -35, character: 25, distance: 55, preDelayMs: 12, mix: 25 },
  'Epic Lush Arena': { enabled: true, spaceSec: 4.8, brightness: 10, character: 65, distance: 70, preDelayMs: 36, mix: 38 },
  'Intimate Wood Room': { enabled: true, spaceSec: 0.75, brightness: -10, character: 15, distance: 20, preDelayMs: 6, mix: 22 },
};

export const ECHOBOY_PRESETS: Record<string, Partial<EchoBoySettings>> = {
  'Dotted 1/8 Space Echo': { enabled: true, style: 'space-echo', division: '1/8D', mix: 28, feedback: 44, saturation: 40, lowCutHz: 220, highCutHz: 4800, groove: 8, pingPong: true },
  'Vocal Slapback Tape': { enabled: true, style: 'master-tape', division: '1/16', mix: 24, feedback: 14, saturation: 35, lowCutHz: 180, highCutHz: 6200, groove: -4, pingPong: false },
  'Warm Echoplex': { enabled: true, style: 'echoplex', division: '1/4', mix: 30, feedback: 52, saturation: 55, lowCutHz: 260, highCutHz: 3900, groove: 12, pingPong: false },
  'DM-2 Dub Throw': { enabled: true, style: 'dm2-analog', division: '1/4D', mix: 36, feedback: 64, saturation: 68, lowCutHz: 320, highCutHz: 2800, groove: 16, pingPong: true },
  'Memory Man Shimmer': { enabled: true, style: 'memory-man', division: '1/8', mix: 32, feedback: 48, saturation: 42, lowCutHz: 160, highCutHz: 7400, groove: 4, pingPong: true },
};

export const EQ_PRESETS: Record<string, Partial<TrackEqSettings>> = {
  Flat: { enabled: true, hpFreq: 20, lowFreq: 100, lowGain: 0, midFreq: 1200, midGain: 0, midQ: 1.0, highFreq: 8000, highGain: 0 },
  'Punchy Drums': { enabled: true, hpFreq: 30, lowFreq: 75, lowGain: 3.5, midFreq: 420, midGain: -2.5, midQ: 1.4, highFreq: 8500, highGain: 2.5 },
  'Vocal Air': { enabled: true, hpFreq: 95, lowFreq: 180, lowGain: -1.5, midFreq: 2600, midGain: 2.5, midQ: 1.2, highFreq: 10000, highGain: 4.0 },
  'Warm Bass': { enabled: true, hpFreq: 28, lowFreq: 65, lowGain: 4.0, midFreq: 700, midGain: 1.8, midQ: 1.1, highFreq: 4500, highGain: -3.5 },
  'Lo-Fi Telephone': { enabled: true, hpFreq: 320, lowFreq: 250, lowGain: -6, midFreq: 1450, midGain: 4.5, midQ: 1.8, highFreq: 3800, highGain: -8 },
};

export const COMPRESSOR_PRESETS: Record<string, Partial<TrackCompressorSettings>> = {
  'Gentle Glue': { enabled: true, threshold: -16, ratio: 2.5, attack: 0.025, release: 0.2, knee: 12, makeupGain: 1.5 },
  'Drum Smash': { enabled: true, threshold: -24, ratio: 6.5, attack: 0.008, release: 0.11, knee: 4, makeupGain: 4.5 },
  'Vocal Leveler': { enabled: true, threshold: -22, ratio: 4.0, attack: 0.01, release: 0.15, knee: 10, makeupGain: 3.5 },
  'Tight Bass': { enabled: true, threshold: -20, ratio: 5.0, attack: 0.015, release: 0.12, knee: 6, makeupGain: 3.0 },
};

export const DRIVE_PRESETS: Record<string, Partial<TrackDriveSettings>> = {
  'Warm Tape': { enabled: true, drive: 22, tone: 10500, mix: 0.45 },
  'Tube Saturation': { enabled: true, drive: 48, tone: 7800, mix: 0.65 },
  '808 Grit': { enabled: true, drive: 72, tone: 4200, mix: 0.7 },
  'Subtle Sheen': { enabled: true, drive: 12, tone: 14000, mix: 0.35 },
};

export const MASTERING_PRESETS: Record<string, MasteringChain> = {
  'Streaming (-14 LUFS)': {
    bypassAll: false,
    eqEnabled: true,
    lowCutHz: 28,
    subGain: 1.2,
    mudGain: -0.8,
    presenceGain: 0.8,
    airGain: 1.5,
    compEnabled: true,
    compThreshold: -14,
    compRatio: 2.2,
    compAttack: 0.02,
    compRelease: 0.18,
    compMakeup: 1.8,
    exciterEnabled: true,
    exciterAmount: 16,
    stereoWidth: 1.08,
    limiterEnabled: true,
    limiterDrive: 2.5,
    limiterCeiling: -0.3,
  },
  'Club Punch': {
    bypassAll: false,
    eqEnabled: true,
    lowCutHz: 32,
    subGain: 3.2,
    mudGain: -1.6,
    presenceGain: 1.4,
    airGain: 2.2,
    compEnabled: true,
    compThreshold: -18,
    compRatio: 3.2,
    compAttack: 0.012,
    compRelease: 0.14,
    compMakeup: 3.0,
    exciterEnabled: true,
    exciterAmount: 28,
    stereoWidth: 1.18,
    limiterEnabled: true,
    limiterDrive: 5.0,
    limiterCeiling: -0.2,
  },
  'Warm Analog Tape': {
    bypassAll: false,
    eqEnabled: true,
    lowCutHz: 26,
    subGain: 2.0,
    mudGain: 0.4,
    presenceGain: -0.4,
    airGain: 0.6,
    compEnabled: true,
    compThreshold: -16,
    compRatio: 2.0,
    compAttack: 0.03,
    compRelease: 0.25,
    compMakeup: 2.0,
    exciterEnabled: true,
    exciterAmount: 38,
    stereoWidth: 1.02,
    limiterEnabled: true,
    limiterDrive: 2.0,
    limiterCeiling: -0.5,
  },
  'Crisp Pop & Hip-Hop': {
    bypassAll: false,
    eqEnabled: true,
    lowCutHz: 30,
    subGain: 2.5,
    mudGain: -2.0,
    presenceGain: 2.0,
    airGain: 3.2,
    compEnabled: true,
    compThreshold: -16,
    compRatio: 2.8,
    compAttack: 0.015,
    compRelease: 0.15,
    compMakeup: 2.6,
    exciterEnabled: true,
    exciterAmount: 22,
    stereoWidth: 1.15,
    limiterEnabled: true,
    limiterDrive: 4.2,
    limiterCeiling: -0.2,
  },
  'Transparent Clean': {
    bypassAll: false,
    eqEnabled: true,
    lowCutHz: 24,
    subGain: 0,
    mudGain: 0,
    presenceGain: 0,
    airGain: 0.4,
    compEnabled: true,
    compThreshold: -10,
    compRatio: 1.5,
    compAttack: 0.03,
    compRelease: 0.22,
    compMakeup: 0.8,
    exciterEnabled: false,
    exciterAmount: 0,
    stereoWidth: 1.0,
    limiterEnabled: true,
    limiterDrive: 1.0,
    limiterCeiling: -1.0,
  },
};

export const DRUM_PATTERNS: Record<string, Record<DrumChannelId, number[]>> = {
  'Lo-Fi Chill': {
    kick:          [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,1,0,0],
    snare:         [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0.5],
    clap:          [0,0,0,0, 0.7,0,0,0, 0,0,0,0, 0.7,0,0,0, 0,0,0,0, 0.7,0,0,0, 0,0,0,0, 0.7,0,0,0],
    'hihat-closed':[0.8,0,0.5,0, 0.8,0,0.5,0, 0.8,0,0.5,0, 0.8,0,0.6,0.4, 0.8,0,0.5,0, 0.8,0,0.5,0, 0.8,0,0.5,0, 0.8,0,0.6,0],
    'hihat-open':  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0.7],
    perc:          [0,0,0,0, 0,0,0.6,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0.6,0, 0,0,0,0.5, 0,0,0,0],
    rim:           [0,0,0,0.5, 0,0,0,0, 0,0,0,0.6, 0,0,0,0, 0,0,0,0.5, 0,0,0,0, 0,0,0,0, 0,0,0.6,0],
    sub808:        [1,0,0,0, 0,0,0,0, 0,0,0.8,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0.8,0, 0,0,0,0],
  },
  'Trap 808': {
    kick:          [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,1, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    snare:         [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    clap:          [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0.5,0],
    'hihat-closed':[1,0,1,0, 1,0,1,1, 1,0,1,0, 1,1,1,1, 1,0,1,0, 1,0,1,0, 1,0,1,1, 1,0,1,0],
    'hihat-open':  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
    perc:          [0,0,0,0, 0,0,0.7,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0.8,0],
    rim:           [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0.6,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    sub808:        [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,1,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
  },
  'House Groove': {
    kick:          [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare:         [0,0,0,0, 0.8,0,0,0, 0,0,0,0, 0.8,0,0,0, 0,0,0,0, 0.8,0,0,0, 0,0,0,0, 0.8,0,0,0],
    clap:          [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    'hihat-closed':[0.5,0,0.8,0, 0.5,0,0.8,0, 0.5,0,0.8,0, 0.5,0,0.8,0, 0.5,0,0.8,0, 0.5,0,0.8,0, 0.5,0,0.8,0, 0.5,0,0.8,0.5],
    'hihat-open':  [0,0,0.8,0, 0,0,0.8,0, 0,0,0.8,0, 0,0,0.8,0, 0,0,0.8,0, 0,0,0.8,0, 0,0,0.8,0, 0,0,0.8,0],
    perc:          [0,0,0,0.6, 0,0,0,0, 0,0,0,0.6, 0,0,0,0, 0,0,0,0.6, 0,0,0,0, 0,0,0.7,0, 0,0,0,0],
    rim:           [0,0,0,0, 0,0,0.5,0, 0,0,0,0, 0,0,0.5,0, 0,0,0,0, 0,0,0.5,0, 0,0,0,0, 0,0,0.5,0],
    sub808:        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  },
  'Boom Bap': {
    kick:          [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,1, 0,1,1,0, 0,0,0,0],
    snare:         [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap:          [0,0,0,0, 0.5,0,0,0, 0,0,0,0, 0.5,0,0,0, 0,0,0,0, 0.5,0,0,0, 0,0,0,0, 0.5,0,0,0],
    'hihat-closed':[0.9,0,0.6,0, 0.9,0,0.6,0, 0.9,0,0.6,0, 0.9,0,0.6,0, 0.9,0,0.6,0, 0.9,0,0.6,0, 0.9,0,0.6,0, 0.9,0,0.6,0],
    'hihat-open':  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0.8,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0.8,0],
    perc:          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0.5, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    rim:           [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0.6, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    sub808:        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  },
  Clear: {
    kick: createEmptySteps(),
    snare: createEmptySteps(),
    clap: createEmptySteps(),
    'hihat-closed': createEmptySteps(),
    'hihat-open': createEmptySteps(),
    perc: createEmptySteps(),
    rim: createEmptySteps(),
    sub808: createEmptySteps(),
  },
};

export function createInitialDrumChannels(): DrumChannel[] {
  const starter = DRUM_PATTERNS['Lo-Fi Chill'];
  return [
    { id: 'kick', name: 'Punch Kick', shortName: 'KCK', color: '#F59E0B', volume: 0.9, pitch: 0, muted: false, steps: [...starter.kick] },
    { id: 'snare', name: 'Studio Snare', shortName: 'SNR', color: '#FB7185', volume: 0.82, pitch: 0, muted: false, steps: [...starter.snare] },
    { id: 'clap', name: 'Analog Clap', shortName: 'CLP', color: '#EC4899', volume: 0.65, pitch: 0, muted: false, steps: [...starter.clap] },
    { id: 'hihat-closed', name: 'Closed Hat', shortName: 'CHH', color: '#38BDF8', volume: 0.55, pitch: 0, muted: false, steps: [...starter['hihat-closed']] },
    { id: 'hihat-open', name: 'Open Hat', shortName: 'OHH', color: '#22D3EE', volume: 0.5, pitch: 0, muted: false, steps: [...starter['hihat-open']] },
    { id: 'perc', name: 'Wood Perc', shortName: 'PRC', color: '#A78BFA', volume: 0.6, pitch: 2, muted: false, steps: [...starter.perc] },
    { id: 'rim', name: 'Rimshot', shortName: 'RIM', color: '#34D399', volume: 0.55, pitch: 0, muted: false, steps: [...starter.rim] },
    { id: 'sub808', name: '808 Sub', shortName: '808', color: '#F97316', volume: 0.78, pitch: 0, muted: false, steps: [...starter.sub808] },
  ];
}

export function createInitialTracks(): StudioTrack[] {
  return [
    {
      id: 'track-drums',
      name: 'Drum Machine Designer',
      type: 'drums',
      color: '#EAB308',
      inputFormat: 'stereo',
      inputSource: 'Stereo Inst',
      outputBus: 'bus-1',
      busSends: createDefaultBusSends(0.12, 0.04),
      automationMode: 'read',
      automationParam: 'volume',
      automationLanes: {},
      volume: 0.88,
      pan: 0,
      reverbSend: 0.12,
      delaySend: 0.04,
      muted: false,
      solo: false,
      armed: false,
      fx: createDefaultTrackFx({
        pultec: { enabled: true, lowFreq: 60, lowBoost: 4.5, lowAtten: 3.0, highFreq: 8000, highBoost: 2.5, bandwidth: 4, highAtten: 0, highAttenFreq: 10000 },
        fet1176: { enabled: true, input: 54, output: 52, attack: 3, release: 6, ratio: 4 },
        eq: { enabled: true, hpFreq: 30, lowFreq: 75, lowGain: 2.0, midFreq: 420, midGain: -1.5, midQ: 1.3, highFreq: 8500, highGain: 1.5 },
      }),
    },
    {
      id: 'track-keys',
      name: 'Kontakt · Scarbee EP',
      type: 'synth',
      preset: 'kontakt-rhodes',
      color: '#10B981',
      inputFormat: 'stereo',
      inputSource: 'Kontakt 7',
      outputBus: 'stereo-out',
      busSends: createDefaultBusSends(0.32, 0.18),
      automationMode: 'read',
      automationParam: 'filterCutoff',
      automationLanes: {
        filterCutoff: [
          { id: 'ap-k1', step: 0, value: 0.62 },
          { id: 'ap-k2', step: 24, value: 0.96 },
          { id: 'ap-k3', step: 48, value: 0.72 },
          { id: 'ap-k4', step: 64, value: 0.9 },
        ],
      },
      volume: 0.74,
      pan: -0.15,
      reverbSend: 0.32,
      delaySend: 0.18,
      muted: false,
      solo: false,
      armed: true,
      fx: createDefaultTrackFx({
        neve1073: { enabled: true, preampDrive: 16, hpFreq: 80, lowFreq: 110, lowGain: 1.2, midFreq: 1600, midGain: 1.0, highGain: 2.0, outputTrim: 0 },
        la2a: { enabled: true, mode: 'compress', peakReduction: 34, gain: 52, tubeWarmth: 30 },
        stereo: { enabled: true, width: 1.25 },
      }),
    },
    {
      id: 'track-bass',
      name: 'FL 3x Osc · Sub Bass',
      type: 'synth',
      preset: 'fl-3xosc',
      color: '#8B5CF6',
      inputFormat: 'mono',
      inputSource: 'FL 3x Osc',
      outputBus: 'stereo-out',
      busSends: createDefaultBusSends(0.04, 0),
      automationMode: 'read',
      automationParam: 'volume',
      automationLanes: {},
      volume: 0.78,
      pan: 0,
      reverbSend: 0.04,
      delaySend: 0,
      muted: false,
      solo: false,
      armed: false,
      fx: createDefaultTrackFx({
        flSoftClipper: { enabled: true, threshold: 58, postGain: 1.0 },
        neve1073: { enabled: true, preampDrive: 28, hpFreq: 0, lowFreq: 60, lowGain: 3.0, midFreq: 700, midGain: 1.5, highGain: -2.0, outputTrim: -1 },
        la2a: { enabled: true, mode: 'limit', peakReduction: 52, gain: 54, tubeWarmth: 42 },
      }),
    },
    {
      id: 'track-lead',
      name: 'Omnisphere · Lotus Bells',
      type: 'synth',
      preset: 'omnisphere-bells',
      color: '#3B82F6',
      inputFormat: 'stereo',
      inputSource: 'Omnisphere 2',
      outputBus: 'stereo-out',
      busSends: createDefaultBusSends(0.36, 0.28),
      automationMode: 'read',
      automationParam: 'pan',
      automationLanes: {
        pan: [
          { id: 'ap-l1', step: 0, value: 0.35 },
          { id: 'ap-l2', step: 32, value: 0.72 },
          { id: 'ap-l3', step: 64, value: 0.42 },
        ],
      },
      volume: 0.66,
      pan: 0.2,
      reverbSend: 0.36,
      delaySend: 0.28,
      muted: false,
      solo: false,
      armed: false,
      fx: createDefaultTrackFx({
        autotune: { enabled: false, key: 'C', scale: 'Minor', retuneSpeed: 12, flexTune: 15, humanize: 20, formant: 0, transpose: 0, classicMode: false },
        echoBoy: { enabled: true, style: 'space-echo', division: '1/8D', mix: 26, feedback: 42, saturation: 38, lowCutHz: 220, highCutHz: 5200, groove: 6, pingPong: true },
        fabProQ: {
          enabled: true,
          analyzerMode: 'pre-post',
          outputGain: 0,
          bands: [
            { id: 1, freq: 160, gain: 0, q: 0.7, type: 'highpass', enabled: true },
            { id: 2, freq: 240, gain: -1.5, q: 1.0, type: 'lowshelf', enabled: true },
            { id: 3, freq: 620, gain: -1.0, q: 1.4, type: 'peaking', enabled: true },
            { id: 4, freq: 2400, gain: 2.0, q: 1.2, type: 'peaking', enabled: true },
            { id: 5, freq: 5600, gain: 1.2, q: 1.3, type: 'peaking', enabled: true },
            { id: 6, freq: 11000, gain: 2.4, q: 0.7, type: 'highshelf', enabled: true },
          ],
        },
        eq: { enabled: false, hpFreq: 180, lowFreq: 220, lowGain: -1.5, midFreq: 2400, midGain: 2.2, midQ: 1.1, highFreq: 10000, highGain: 2.5 },
        stereo: { enabled: true, width: 1.35 },
      }),
    },
    {
      id: 'track-vocal',
      name: 'Lead Vocal · Mic 1',
      type: 'audio',
      color: '#06B6D4',
      inputFormat: 'mono',
      inputSource: 'Input 1 (Mono)',
      outputBus: 'bus-2',
      busSends: createDefaultBusSends(0.24, 0.14),
      automationMode: 'read',
      automationParam: 'volume',
      automationLanes: {
        volume: [
          { id: 'ap-v1', step: 0, value: 0.75 },
          { id: 'ap-v2', step: 32, value: 0.82 },
          { id: 'ap-v3', step: 64, value: 0.75 },
        ],
      },
      volume: 0.9,
      pan: 0,
      reverbSend: 0.24,
      delaySend: 0.14,
      muted: false,
      solo: false,
      armed: false,
      fx: createDefaultTrackFx({
        autotune: { enabled: true, key: 'C', scale: 'Minor', retuneSpeed: 14, flexTune: 20, humanize: 25, formant: 0, transpose: 0, classicMode: false },
        neve1073: { enabled: true, preampDrive: 20, hpFreq: 80, lowFreq: 110, lowGain: -1.5, midFreq: 3200, midGain: 2.2, highGain: 3.5, outputTrim: 0 },
        fet1176: { enabled: true, input: 52, output: 54, attack: 3, release: 6, ratio: 4 },
        la2a: { enabled: true, mode: 'compress', peakReduction: 44, gain: 55, tubeWarmth: 35 },
        flConvolver: { enabled: true, impulse: 'plate', dry: 100, wet: 24, preDelayMs: 18, decaySec: 1.8, lowCutHz: 180, highCutHz: 10000, stereoSep: 1.25 },
        echoBoy: { enabled: true, style: 'master-tape', division: '1/4', mix: 16, feedback: 28, saturation: 30, lowCutHz: 260, highCutHz: 4600, groove: 4, pingPong: true },
      }),
    },
  ];
}

export function createInitialNotes(): MidiNote[] {
  return [
    { id: 'n-k1', trackId: 'track-keys', pitch: 60, startStep: 0, durationSteps: 14, velocity: 0.72 },
    { id: 'n-k2', trackId: 'track-keys', pitch: 63, startStep: 0, durationSteps: 14, velocity: 0.68 },
    { id: 'n-k3', trackId: 'track-keys', pitch: 67, startStep: 0, durationSteps: 14, velocity: 0.7 },
    { id: 'n-k4', trackId: 'track-keys', pitch: 70, startStep: 0, durationSteps: 14, velocity: 0.65 },

    { id: 'n-k5', trackId: 'track-keys', pitch: 56, startStep: 16, durationSteps: 14, velocity: 0.72 },
    { id: 'n-k6', trackId: 'track-keys', pitch: 60, startStep: 16, durationSteps: 14, velocity: 0.68 },
    { id: 'n-k7', trackId: 'track-keys', pitch: 63, startStep: 16, durationSteps: 14, velocity: 0.7 },
    { id: 'n-k8', trackId: 'track-keys', pitch: 67, startStep: 16, durationSteps: 14, velocity: 0.65 },

    { id: 'n-k9', trackId: 'track-keys', pitch: 53, startStep: 32, durationSteps: 14, velocity: 0.72 },
    { id: 'n-k10', trackId: 'track-keys', pitch: 56, startStep: 32, durationSteps: 14, velocity: 0.68 },
    { id: 'n-k11', trackId: 'track-keys', pitch: 60, startStep: 32, durationSteps: 14, velocity: 0.7 },
    { id: 'n-k12', trackId: 'track-keys', pitch: 63, startStep: 32, durationSteps: 14, velocity: 0.65 },

    { id: 'n-k13', trackId: 'track-keys', pitch: 55, startStep: 48, durationSteps: 14, velocity: 0.72 },
    { id: 'n-k14', trackId: 'track-keys', pitch: 59, startStep: 48, durationSteps: 14, velocity: 0.68 },
    { id: 'n-k15', trackId: 'track-keys', pitch: 62, startStep: 48, durationSteps: 14, velocity: 0.7 },
    { id: 'n-k16', trackId: 'track-keys', pitch: 65, startStep: 48, durationSteps: 14, velocity: 0.65 },

    { id: 'n-b1', trackId: 'track-bass', pitch: 48, startStep: 0, durationSteps: 8, velocity: 0.85 },
    { id: 'n-b2', trackId: 'track-bass', pitch: 48, startStep: 10, durationSteps: 6, velocity: 0.75 },
    { id: 'n-b3', trackId: 'track-bass', pitch: 44, startStep: 16, durationSteps: 10, velocity: 0.85 },
    { id: 'n-b4', trackId: 'track-bass', pitch: 46, startStep: 28, durationSteps: 4, velocity: 0.78 },
    { id: 'n-b5', trackId: 'track-bass', pitch: 41, startStep: 32, durationSteps: 10, velocity: 0.85 },
    { id: 'n-b6', trackId: 'track-bass', pitch: 43, startStep: 48, durationSteps: 12, velocity: 0.85 },

    { id: 'n-l1', trackId: 'track-lead', pitch: 72, startStep: 2, durationSteps: 3, velocity: 0.78 },
    { id: 'n-l2', trackId: 'track-lead', pitch: 75, startStep: 6, durationSteps: 4, velocity: 0.82 },
    { id: 'n-l3', trackId: 'track-lead', pitch: 74, startStep: 12, durationSteps: 4, velocity: 0.75 },
    { id: 'n-l4', trackId: 'track-lead', pitch: 72, startStep: 20, durationSteps: 4, velocity: 0.8 },
    { id: 'n-l5', trackId: 'track-lead', pitch: 67, startStep: 26, durationSteps: 6, velocity: 0.72 },
    { id: 'n-l6', trackId: 'track-lead', pitch: 68, startStep: 34, durationSteps: 4, velocity: 0.8 },
    { id: 'n-l7', trackId: 'track-lead', pitch: 72, startStep: 40, durationSteps: 4, velocity: 0.84 },
    { id: 'n-l8', trackId: 'track-lead', pitch: 70, startStep: 50, durationSteps: 6, velocity: 0.78 },
    { id: 'n-l9', trackId: 'track-lead', pitch: 67, startStep: 58, durationSteps: 4, velocity: 0.7 },
  ];
}

export function createInitialProject(roomId: string): StudioProject {
  return {
    roomId,
    title: 'Midnight Groove',
    bpm: 94,
    swing: 0.14,
    musicalKey: 'C Minor',
    totalBars: 4,
    tracks: createInitialTracks(),
    auxBuses: createDefaultAuxBuses(),
    session: createDefaultAbletonSession(),
    drumChannels: createInitialDrumChannels(),
    notes: createInitialNotes(),
    audioClips: [],
    mastering: createDefaultMasteringChain(),
    messages: [
      {
        id: 'sys-welcome',
        senderId: 'system',
        senderName: 'Studio Room',
        senderColor: '#3B82F6',
        text: `Session ${roomId} ready with Mono mic capture, Logic Pro Bus/Aux routing & Automation (press A), Ableton Session View (press Tab), and full plugin suites.`,
        timestamp: Date.now(),
        isSystem: true,
      },
    ],
  };
}
