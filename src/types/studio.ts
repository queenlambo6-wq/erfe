export type TrackType = 'drums' | 'synth' | 'audio';

export type SynthPreset =
  | 'warm-keys'
  | 'sub-bass'
  | 'pluck-lead'
  | 'lush-pad'
  // Spectrasonics Omnisphere 2
  | 'omnisphere-celestial'
  | 'omnisphere-bells'
  | 'omnisphere-dark-arp'
  | 'omnisphere-brass'
  // Native Instruments Kontakt 7
  | 'kontakt-noir-piano'
  | 'kontakt-strings'
  | 'kontakt-nylon'
  | 'kontakt-rhodes'
  | 'kontakt-choir'
  // FL Studio Stock Instruments
  | 'fl-sytrus'
  | 'fl-flex'
  | 'fl-3xosc'
  | 'fl-harmor'
  | 'fl-keys'
  | 'fl-sakura'
  | 'fl-gms';

export type InstrumentVendor = 'omnisphere' | 'kontakt' | 'fl-stock';

export type SynthWaveform = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface InstrumentSynthParams {
  oscAWave: SynthWaveform;
  oscBWave: SynthWaveform;
  oscBMix: number; // 0..1
  oscBOctave: number; // -2..2
  detuneCents: number; // 0..45
  fmAmount: number; // 0..100
  cutoffHz: number; // 180..16000
  resonance: number; // 0.5..14
  envDepth: number; // 0..100
  attackMs: number; // 2..600
  decayMs: number; // 40..1200
  sustain: number; // 0.05..1
  releaseMs: number; // 40..1800
  drive: number; // 0..100
  shimmer: number; // 0..100
  transpose: number; // -24..24
  fineCents: number; // -50..50
  xyX: number; // 0..100 (Sytrus / Omnisphere Orb X)
  xyY: number; // 0..100 (Sytrus / Omnisphere Orb Y)
}

export interface InstrumentDefinition {
  preset: SynthPreset;
  vendor: InstrumentVendor;
  pluginName: string;
  patchName: string;
  category: string;
  accent: string;
  description: string;
}

export type PluginSuiteCategory =
  | 'uad-vocal'
  | 'fl-stock'
  | 'fabfilter-soundtoys'
  | 'logic-fx';

export interface FxPluginMetadata {
  id: TrackPluginType;
  name: string;
  shortName: string;
  vendor: string;
  suite: PluginSuiteCategory;
  role: string;
  accent: string;
  description: string;
}

export type SampleCategory =
  | '808 & Sub'
  | 'Kicks & Snares'
  | 'Hats & Perc'
  | 'Omnisphere One-Shots'
  | 'Kontakt Chords'
  | 'FX & Vox Chops';

export interface SampleBankItem {
  id: string;
  name: string;
  pack: string;
  category: SampleCategory;
  bpm?: number;
  key?: string;
  durationSec: number;
  color: string;
  synthKind:
    | '808-spinz'
    | '808-zay'
    | '808-sub-glide'
    | 'kick-punch'
    | 'kick-boom'
    | 'snare-trap'
    | 'snare-lofi'
    | 'clap-metro'
    | 'hat-crispy'
    | 'perc-rim'
    | 'perc-bongo'
    | 'oneshot-omni-bell'
    | 'oneshot-omni-pad'
    | 'oneshot-omni-arp'
    | 'oneshot-omni-flute'
    | 'chord-kontakt-minor'
    | 'chord-kontakt-maj9'
    | 'chord-kontakt-strings'
    | 'chord-kontakt-guitar'
    | 'fx-riser'
    | 'fx-downlifter'
    | 'fx-vox-chop'
    | 'fx-tape-stop';
  midiPitch?: number;
}

export type DrumChannelId =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hihat-closed'
  | 'hihat-open'
  | 'perc'
  | 'rim'
  | 'sub808';

export type StudioView = 'arrangement' | 'session' | 'beats' | 'pianoroll' | 'mixer' | 'mastering';

export type ChannelFormat = 'mono' | 'stereo';

export type OutputBusId = 'stereo-out' | 'bus-1' | 'bus-2' | 'bus-3' | 'bus-4';
export type AuxBusId = 'bus-1' | 'bus-2' | 'bus-3' | 'bus-4';

export type AutomationMode = 'off' | 'read' | 'touch' | 'latch' | 'write';
export type AutomationParam = 'volume' | 'pan' | 'filterCutoff' | 'reverbSend' | 'delaySend';

export interface AutomationPoint {
  id: string;
  step: number; // 0..totalSteps (can be fractional)
  value: number; // normalized 0..1
}

export interface BusSendSlot {
  busId: AuxBusId;
  level: number; // 0..1
  preFader: boolean;
  enabled: boolean;
}

export interface StudioAuxBus {
  id: AuxBusId;
  name: string;
  shortLabel: string;
  color: string;
  role: 'submix' | 'reverb' | 'delay';
  volume: number; // 0..1.2
  pan: number; // -1..1
  muted: boolean;
  solo: boolean;
  compAmount: number; // 0..100 (Bus Glue for submix)
  toneHz: number; // Lowpass / Air filter frequency
  decaySec: number; // Reverb decay (for reverb aux)
  feedback: number; // Delay feedback 0..85 (for delay aux)
  width: number; // 0..2 stereo width
}

export interface AbletonScene {
  id: string;
  name: string;
  color: string;
  drumPreset: string;
  activeTrackIds: string[];
  bpmOffset?: number;
}

export interface AbletonMacroRack {
  djFilter: number; // -100 (LP) .. 0 (Off) .. +100 (HP)
  filterRes: number; // 0..100
  tapeWarmth: number; // 0..100
  spaceWash: number; // 0..100
  dubEcho: number; // 0..100
  stereoWidth: number; // 0..200 (%)
  ottPunch: number; // 0..100
  beatRepeat: 'off' | '1/4' | '1/8' | '1/16' | '1/32';
}

export interface AbletonSessionState {
  activeSceneId: string;
  quantize: '1-bar' | 'half-bar' | 'instant';
  clipPlayingByTrack: Record<string, string | null>; // trackId -> sceneId | null
  scenes: AbletonScene[];
  macroRack: AbletonMacroRack;
}

export type TrackPluginType =
  | 'autotune'
  | 'neve1073'
  | 'pultec'
  | 'la2a'
  | 'fet1176'
  | 'flEq2'
  | 'flConvolver'
  | 'flSoundgoodizer'
  | 'flReeverb2'
  | 'flDelay3'
  | 'grossBeat'
  | 'flSoftClipper'
  | 'flLimiter'
  | 'flChorus'
  | 'fabProQ'
  | 'fabProR'
  | 'echoBoy'
  | 'eq'
  | 'compressor'
  | 'drive'
  | 'stereo';

export type AutoTuneScale = 'Minor' | 'Major' | 'Chromatic' | 'Pentatonic Minor' | 'Dorian';

export interface AutoTuneSettings {
  enabled: boolean;
  key: string; // 'C', 'C#', 'D', ...
  scale: AutoTuneScale;
  retuneSpeed: number; // 0 (hard snap) .. 400 (natural ms)
  flexTune: number; // 0..100
  humanize: number; // 0..100
  formant: number; // -12..+12 throat/formant shift
  transpose: number; // -12..+12 semitones
  classicMode: boolean; // Auto-Tune 5 crisp formant character
}

export interface Neve1073Settings {
  enabled: boolean;
  preampDrive: number; // 0..60 dB transformer saturation
  hpFreq: 0 | 50 | 80 | 160 | 300;
  lowFreq: 35 | 60 | 110 | 220;
  lowGain: number; // -16..+16 dB
  midFreq: 360 | 700 | 1600 | 3200 | 4800 | 7200;
  midGain: number; // -18..+18 dB
  highGain: number; // -16..+16 dB (fixed 12 kHz Neve air shelf)
  outputTrim: number; // -12..+12 dB
}

export interface PultecSettings {
  enabled: boolean;
  lowFreq: 20 | 30 | 60 | 100;
  lowBoost: number; // 0..10
  lowAtten: number; // 0..10
  highFreq: 3000 | 4000 | 5000 | 8000 | 10000 | 12000 | 16000;
  highBoost: number; // 0..10
  bandwidth: number; // 0 (sharp) .. 10 (broad)
  highAtten: number; // 0..10
  highAttenFreq: 5000 | 10000 | 20000;
}

export interface La2aSettings {
  enabled: boolean;
  mode: 'compress' | 'limit';
  peakReduction: number; // 0..100
  gain: number; // 0..100
  tubeWarmth: number; // 0..100
}

export type Fet1176Ratio = 4 | 8 | 12 | 20 | 'all';

export interface Fet1176Settings {
  enabled: boolean;
  input: number; // 0..100
  output: number; // 0..100
  attack: number; // 1 (slow) .. 7 (fastest 20us)
  release: number; // 1 (slow) .. 7 (fastest 50ms)
  ratio: Fet1176Ratio;
}

export type EqBandShape = 'highpass' | 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass' | 'notch';

export interface ParametricBand {
  id: number;
  freq: number; // 20..20000 Hz
  gain: number; // -18..+18 dB
  q: number; // 0.3..10
  type: EqBandShape;
  enabled: boolean;
}

export interface FlEq2Settings {
  enabled: boolean;
  bands: ParametricBand[]; // 7 FL Parametric EQ 2 bands
  heatmap: boolean;
  outputGain: number; // -12..+12 dB
}

export type ConvolverImpulseType =
  | 'cathedral'
  | 'plate'
  | 'spring'
  | 'vocal-booth'
  | 'blur-pink'
  | 'reverse-swell';

export interface FlConvolverSettings {
  enabled: boolean;
  impulse: ConvolverImpulseType;
  dry: number; // 0..100
  wet: number; // 0..100
  preDelayMs: number; // 0..160 ms
  decaySec: number; // 0.3..5.0 s
  lowCutHz: number; // 20..800 Hz
  highCutHz: number; // 1200..18000 Hz
  stereoSep: number; // 0 (mono) .. 2 (wide)
}

export type SoundgoodizerMode = 'A' | 'B' | 'C' | 'D';

export interface FlSoundgoodizerSettings {
  enabled: boolean;
  mode: SoundgoodizerMode;
  amount: number; // 0..100
  mix: number; // 0..100
}

export interface FabProQSettings {
  enabled: boolean;
  bands: ParametricBand[]; // 6 FabFilter Pro-Q 3 bands
  analyzerMode: 'pre-post' | 'post' | 'off';
  outputGain: number; // -12..+12 dB
}

export interface FabProRSettings {
  enabled: boolean;
  spaceSec: number; // 0.2..8.0 s
  brightness: number; // -100..+100
  character: number; // 0..100
  distance: number; // 0..100
  preDelayMs: number; // 0..120 ms
  mix: number; // 0..100
}

export type EchoBoyStyle =
  | 'master-tape'
  | 'echoplex'
  | 'space-echo'
  | 'memory-man'
  | 'dm2-analog'
  | 'studio-tape'
  | 'telray'
  | 'ambient';

export type EchoBoyDivision = '1/16' | '1/8' | '1/8D' | '1/4' | '1/4D' | '1/2';

export interface EchoBoySettings {
  enabled: boolean;
  style: EchoBoyStyle;
  division: EchoBoyDivision;
  mix: number; // 0..100
  feedback: number; // 0..92
  saturation: number; // 0..100
  lowCutHz: number; // 20..1200 Hz
  highCutHz: number; // 1000..16000 Hz
  groove: number; // -50 (rush) .. +50 (drag)
  pingPong: boolean;
}

export interface TrackEqSettings {
  enabled: boolean;
  hpFreq: number; // 20..400 Hz
  lowFreq: number; // 40..300 Hz
  lowGain: number; // -15..+15 dB
  midFreq: number; // 300..4000 Hz
  midGain: number; // -15..+15 dB
  midQ: number; // 0.4..4.0
  highFreq: number; // 3500..14000 Hz
  highGain: number; // -15..+15 dB
}

export interface TrackCompressorSettings {
  enabled: boolean;
  threshold: number; // -48..0 dB
  ratio: number; // 1..20
  attack: number; // 0.001..0.2 sec
  release: number; // 0.03..0.8 sec
  knee: number; // 0..30 dB
  makeupGain: number; // 0..18 dB
}

export interface TrackDriveSettings {
  enabled: boolean;
  drive: number; // 0..100 %
  tone: number; // 1000..16000 Hz
  mix: number; // 0..1
}

export interface TrackStereoSettings {
  enabled: boolean;
  width: number; // 0 (mono)..2 (200% wide), 1 = normal
}

export interface FlReeverb2Settings {
  enabled: boolean;
  dry: number; // 0..100
  wet: number; // 0..100
  size: number; // 10..100
  decaySec: number; // 0.3..8.0
  lowCutHz: number; // 20..800
  highCutHz: number; // 1500..18000
  preDelayMs: number; // 0..150
  stereoSep: number; // 0..2
}

export interface FlDelay3Settings {
  enabled: boolean;
  division: EchoBoyDivision;
  wet: number; // 0..100
  feedback: number; // 0..90
  toneHz: number; // 600..16000
  pingPong: boolean;
  saturation: number; // 0..100
}

export type GrossBeatPreset =
  | 'half-speed'
  | 'trance-gate'
  | 'triplet-stutter'
  | 'vinyl-pump'
  | 'sidechain'
  | 'basic-chop';

export interface GrossBeatSettings {
  enabled: boolean;
  preset: GrossBeatPreset;
  mix: number; // 0..100
}

export interface FlSoftClipperSettings {
  enabled: boolean;
  threshold: number; // 0..100 (soft clip drive/ceiling)
  postGain: number; // -6..+12 dB
}

export interface FlLimiterSettings {
  enabled: boolean;
  ceiling: number; // -6..0 dB
  gain: number; // 0..18 dB
  attackMs: number; // 0.5..40 ms
  releaseMs: number; // 20..400 ms
  sat: number; // 0..100
}

export interface FlChorusSettings {
  enabled: boolean;
  depth: number; // 0..100
  rateHz: number; // 0.1..5.0
  mix: number; // 0..100
}

export interface TrackFxChain {
  autotune: AutoTuneSettings;
  neve1073: Neve1073Settings;
  pultec: PultecSettings;
  la2a: La2aSettings;
  fet1176: Fet1176Settings;
  flEq2: FlEq2Settings;
  flConvolver: FlConvolverSettings;
  flSoundgoodizer: FlSoundgoodizerSettings;
  flReeverb2: FlReeverb2Settings;
  flDelay3: FlDelay3Settings;
  grossBeat: GrossBeatSettings;
  flSoftClipper: FlSoftClipperSettings;
  flLimiter: FlLimiterSettings;
  flChorus: FlChorusSettings;
  fabProQ: FabProQSettings;
  fabProR: FabProRSettings;
  echoBoy: EchoBoySettings;
  eq: TrackEqSettings;
  compressor: TrackCompressorSettings;
  drive: TrackDriveSettings;
  stereo: TrackStereoSettings;
}

export interface MasteringChain {
  bypassAll: boolean;
  eqEnabled: boolean;
  lowCutHz: number; // 20..100 Hz
  subGain: number; // -8..+8 dB (60 Hz)
  mudGain: number; // -8..+8 dB (320 Hz)
  presenceGain: number; // -8..+8 dB (2800 Hz)
  airGain: number; // -8..+8 dB (10000 Hz)

  compEnabled: boolean;
  compThreshold: number; // -32..0 dB
  compRatio: number; // 1.2..8
  compAttack: number; // 0.005..0.1 sec
  compRelease: number; // 0.05..0.6 sec
  compMakeup: number; // 0..12 dB

  exciterEnabled: boolean;
  exciterAmount: number; // 0..100 %
  stereoWidth: number; // 0..1.6 (1 = 100%)

  limiterEnabled: boolean;
  limiterDrive: number; // 0..12 dB
  limiterCeiling: number; // -3..-0.1 dB
}

export interface DrumChannel {
  id: DrumChannelId;
  name: string;
  shortName: string;
  color: string;
  volume: number;
  pitch: number;
  muted: boolean;
  steps: number[];
}

export interface MidiNote {
  id: string;
  trackId: string;
  pitch: number;
  startStep: number;
  durationSteps: number;
  velocity: number;
}

export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  startStep: number;
  durationSeconds: number;
  audioDataUrl: string;
  peaks: number[];
  recordedBy: string;
  createdAt: number;
  channelFormat?: ChannelFormat;
}

export interface StudioTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  preset?: SynthPreset;
  instrumentParams?: InstrumentSynthParams;
  fxSlots?: TrackPluginType[];
  inputFormat?: ChannelFormat;
  inputSource?: string;
  outputBus?: OutputBusId;
  busSends?: BusSendSlot[];
  automationMode?: AutomationMode;
  automationParam?: AutomationParam;
  automationLanes?: Partial<Record<AutomationParam, AutomationPoint[]>>;
  volume: number;
  pan: number;
  reverbSend: number;
  delaySend: number;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  fx: TrackFxChain;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  barMarker?: number;
  isSystem?: boolean;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  activeView: StudioView;
  inVoice: boolean;
  isMuted: boolean;
  isSpeaking?: boolean;
  joinedAt: number;
}

export interface StudioProject {
  roomId: string;
  title: string;
  bpm: number;
  swing: number;
  musicalKey: string;
  totalBars: number;
  tracks: StudioTrack[];
  auxBuses?: StudioAuxBus[];
  session?: AbletonSessionState;
  drumChannels: DrumChannel[];
  notes: MidiNote[];
  audioClips: AudioClip[];
  messages: ChatMessage[];
  mastering: MasteringChain;
}

export interface VoiceSignalPayload {
  targetId: string;
  fromId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
