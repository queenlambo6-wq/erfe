import type {
  AudioClip,
  FxPluginMetadata,
  InstrumentDefinition,
  InstrumentSynthParams,
  SampleBankItem,
  StudioTrack,
  SynthPreset,
  TrackPluginType,
} from '../types/studio';

export const INDUSTRY_INSTRUMENTS: InstrumentDefinition[] = [
  // Spectrasonics Omnisphere 2
  {
    preset: 'omnisphere-celestial',
    vendor: 'omnisphere',
    pluginName: 'Omnisphere 2',
    patchName: 'Celestial Glass Pad',
    category: 'Pads & Atmos',
    accent: '#38BDF8',
    description: 'Lush 3-oscillator shimmering atmospheric pad with slow analog filter drift.',
  },
  {
    preset: 'omnisphere-bells',
    vendor: 'omnisphere',
    pluginName: 'Omnisphere 2',
    patchName: 'Lotus Crystal Bells',
    category: 'Bells & Plucks',
    accent: '#0EA5E9',
    description: 'Iconic trap/R&B FM crystalline bell pluck with metallic sparkle.',
  },
  {
    preset: 'omnisphere-dark-arp',
    vendor: 'omnisphere',
    pluginName: 'Omnisphere 2',
    patchName: 'Moog Noir Arp Pluck',
    category: 'Arps & Leads',
    accent: '#6366F1',
    description: 'Dark resonant analog Moog-style pluck built for Metro/Mike Dean melodies.',
  },
  {
    preset: 'omnisphere-brass',
    vendor: 'omnisphere',
    pluginName: 'Omnisphere 2',
    patchName: 'Cinema Analog Brass',
    category: 'Synth Brass',
    accent: '#818CF8',
    description: 'Wide detuned polyphonic synth brass swell with warm low-mid weight.',
  },

  // Native Instruments Kontakt 7
  {
    preset: 'kontakt-noir-piano',
    vendor: 'kontakt',
    pluginName: 'Kontakt 7',
    patchName: 'Noire Felt Grand',
    category: 'Acoustic Keys',
    accent: '#F59E0B',
    description: 'Intimate felt-damped concert grand piano with warm hammer transient.',
  },
  {
    preset: 'kontakt-strings',
    vendor: 'kontakt',
    pluginName: 'Kontakt 7',
    patchName: 'Session Strings Pro',
    category: 'Orchestral',
    accent: '#D97706',
    description: 'Rich 4-voice chamber string ensemble with silky bow attack and vibrato.',
  },
  {
    preset: 'kontakt-nylon',
    vendor: 'kontakt',
    pluginName: 'Kontakt 7',
    patchName: 'Strummed Nylon Guitar',
    category: 'Guitars',
    accent: '#EAB308',
    description: 'Warm fingerpicked nylon string acoustic guitar with natural body resonance.',
  },
  {
    preset: 'kontakt-rhodes',
    vendor: 'kontakt',
    pluginName: 'Kontakt 7',
    patchName: 'Scarbee Mark I EP',
    category: 'Electric Piano',
    accent: '#FB923C',
    description: 'Classic vintage electric piano tines with bell attack and stereo warmth.',
  },
  {
    preset: 'kontakt-choir',
    vendor: 'kontakt',
    pluginName: 'Kontakt 7',
    patchName: 'Omnia Vocal Choir',
    category: 'Vocals & Choir',
    accent: '#FBBF24',
    description: 'Formant-sculpted cathedral vocal choir ensemble for dark cinematic hooks.',
  },

  // FL Studio Stock Instruments
  {
    preset: 'fl-sytrus',
    vendor: 'fl-stock',
    pluginName: 'FL Sytrus',
    patchName: 'FM Acid Bell Pluck',
    category: 'FM Synth',
    accent: '#F97316',
    description: 'Image-Line 6-operator style FM pluck with crisp harmonic decay.',
  },
  {
    preset: 'fl-flex',
    vendor: 'fl-stock',
    pluginName: 'FL FLEX',
    patchName: 'Essential Hybrid Lead',
    category: 'Production Synth',
    accent: '#10B981',
    description: 'Ready-to-mix modern poly synth lead with glossy top-end presence.',
  },
  {
    preset: 'fl-3xosc',
    vendor: 'fl-stock',
    pluginName: 'FL 3x Osc',
    patchName: 'Pure Sub & Saw Stack',
    category: 'Bass & Sub',
    accent: '#22C55E',
    description: 'Classic FL Studio 3-oscillator sub bass & detuned saw generator.',
  },
  {
    preset: 'fl-harmor',
    vendor: 'fl-stock',
    pluginName: 'FL Harmor',
    patchName: 'Additive Prism Synth',
    category: 'Additive Synth',
    accent: '#14B8A6',
    description: 'Bright phaser-swept additive synth texture for hyperpop & EDM.',
  },
  {
    preset: 'fl-keys',
    vendor: 'fl-stock',
    pluginName: 'FL Keys',
    patchName: 'Grand Studio Piano',
    category: 'Keys',
    accent: '#FB7185',
    description: 'Lightweight, punchy FL Studio piano that cuts cleanly through beats.',
  },
  {
    preset: 'fl-sakura',
    vendor: 'fl-stock',
    pluginName: 'FL Sakura',
    patchName: 'Eastern Koto Pluck',
    category: 'String Modeling',
    accent: '#F43F5E',
    description: 'Physical string modeling instrument inspired by traditional Eastern plucks.',
  },
  {
    preset: 'fl-gms',
    vendor: 'fl-stock',
    pluginName: 'FL GMS',
    patchName: 'Groove Machine Reese',
    category: 'Bass & EDM',
    accent: '#A855F7',
    description: 'Fat detuned analog bass & club lead from Groove Machine Synth.',
  },
  // Classic TrackRoom built-ins
  {
    preset: 'warm-keys',
    vendor: 'fl-stock',
    pluginName: 'Vintage EP',
    patchName: 'Warm Rhodes Keys',
    category: 'Electric Piano',
    accent: '#10B981',
    description: 'Smooth lo-fi & neo-soul electric piano.',
  },
  {
    preset: 'sub-bass',
    vendor: 'fl-stock',
    pluginName: 'Retro Sub',
    patchName: 'Analog Sub Bass',
    category: 'Bass & Sub',
    accent: '#3B82F6',
    description: 'Deep sine-saw low-end foundation.',
  },
  {
    preset: 'pluck-lead',
    vendor: 'fl-stock',
    pluginName: 'Alchemy Pluck',
    patchName: 'Crisp Synth Pluck',
    category: 'Plucks',
    accent: '#A855F7',
    description: 'Tight percussive melodic synth pluck.',
  },
  {
    preset: 'lush-pad',
    vendor: 'fl-stock',
    pluginName: 'Studio Pad',
    patchName: 'Lush Analog Pad',
    category: 'Pads',
    accent: '#EC4899',
    description: 'Warm swelling stereo chord pad.',
  },
];

export function getInstrumentInfo(preset?: SynthPreset): InstrumentDefinition {
  return (
    INDUSTRY_INSTRUMENTS.find((i) => i.preset === preset) || INDUSTRY_INSTRUMENTS[0]
  );
}

export function createDefaultInstrumentParams(preset?: SynthPreset): InstrumentSynthParams {
  const base: InstrumentSynthParams = {
    oscAWave: 'triangle',
    oscBWave: 'sine',
    oscBMix: 0.35,
    oscBOctave: 0,
    detuneCents: 6,
    fmAmount: 10,
    cutoffHz: 4200,
    resonance: 1.4,
    envDepth: 45,
    attackMs: 12,
    decayMs: 280,
    sustain: 0.65,
    releaseMs: 320,
    drive: 8,
    shimmer: 18,
    transpose: 0,
    fineCents: 0,
    xyX: 50,
    xyY: 50,
  };

  switch (preset) {
    case 'omnisphere-bells':
      return { ...base, oscAWave: 'sine', oscBWave: 'triangle', oscBMix: 0.42, oscBOctave: 1, detuneCents: 8, fmAmount: 62, cutoffHz: 7800, resonance: 2.0, envDepth: 65, attackMs: 4, decayMs: 420, sustain: 0.25, releaseMs: 650, drive: 6, shimmer: 55, xyX: 64, xyY: 72 };
    case 'omnisphere-celestial':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'sine', oscBMix: 0.5, oscBOctave: 1, detuneCents: 18, fmAmount: 14, cutoffHz: 3400, resonance: 2.2, envDepth: 52, attackMs: 210, decayMs: 620, sustain: 0.82, releaseMs: 950, drive: 8, shimmer: 74, xyX: 55, xyY: 60 };
    case 'omnisphere-dark-arp':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'square', oscBMix: 0.36, oscBOctave: -1, detuneCents: 11, fmAmount: 18, cutoffHz: 2600, resonance: 4.5, envDepth: 78, attackMs: 5, decayMs: 220, sustain: 0.28, releaseMs: 240, drive: 26, shimmer: 10, xyX: 42, xyY: 68 };
    case 'omnisphere-brass':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'sawtooth', oscBMix: 0.65, oscBOctave: 0, detuneCents: 16, fmAmount: 8, cutoffHz: 3200, resonance: 1.8, envDepth: 60, attackMs: 62, decayMs: 360, sustain: 0.78, releaseMs: 360, drive: 22, shimmer: 15, xyX: 60, xyY: 45 };
    case 'kontakt-noir-piano':
      return { ...base, oscAWave: 'triangle', oscBWave: 'sine', oscBMix: 0.38, oscBOctave: 1, detuneCents: 4, fmAmount: 16, cutoffHz: 2900, resonance: 1.0, envDepth: 48, attackMs: 8, decayMs: 520, sustain: 0.42, releaseMs: 540, drive: 6, shimmer: 12, xyX: 40, xyY: 45 };
    case 'kontakt-rhodes':
      return { ...base, oscAWave: 'sine', oscBWave: 'triangle', oscBMix: 0.28, oscBOctave: 1, detuneCents: 5, fmAmount: 32, cutoffHz: 4400, resonance: 1.2, envDepth: 40, attackMs: 6, decayMs: 460, sustain: 0.48, releaseMs: 460, drive: 12, shimmer: 24, xyX: 52, xyY: 50 };
    case 'kontakt-strings':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'triangle', oscBMix: 0.48, oscBOctave: 0, detuneCents: 14, fmAmount: 6, cutoffHz: 3100, resonance: 1.2, envDepth: 35, attackMs: 185, decayMs: 500, sustain: 0.88, releaseMs: 760, drive: 4, shimmer: 28, xyX: 50, xyY: 55 };
    case 'kontakt-nylon':
      return { ...base, oscAWave: 'triangle', oscBWave: 'sine', oscBMix: 0.3, oscBOctave: 1, detuneCents: 3, fmAmount: 22, cutoffHz: 3400, resonance: 1.8, envDepth: 55, attackMs: 4, decayMs: 380, sustain: 0.22, releaseMs: 420, drive: 5, shimmer: 10, xyX: 46, xyY: 42 };
    case 'kontakt-choir':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'sine', oscBMix: 0.45, oscBOctave: 0, detuneCents: 13, fmAmount: 12, cutoffHz: 1850, resonance: 3.4, envDepth: 30, attackMs: 220, decayMs: 560, sustain: 0.85, releaseMs: 820, drive: 6, shimmer: 48, xyX: 48, xyY: 62 };
    case 'fl-sytrus':
      return { ...base, oscAWave: 'sine', oscBWave: 'sawtooth', oscBMix: 0.32, oscBOctave: 1, detuneCents: 7, fmAmount: 76, cutoffHz: 6800, resonance: 2.6, envDepth: 72, attackMs: 4, decayMs: 310, sustain: 0.3, releaseMs: 420, drive: 18, shimmer: 32, xyX: 68, xyY: 76 };
    case 'fl-flex':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'triangle', oscBMix: 0.46, oscBOctave: 0, detuneCents: 12, fmAmount: 20, cutoffHz: 5800, resonance: 2.1, envDepth: 62, attackMs: 8, decayMs: 290, sustain: 0.55, releaseMs: 320, drive: 20, shimmer: 36, xyX: 60, xyY: 58 };
    case 'fl-3xosc':
    case 'sub-bass':
      return { ...base, oscAWave: 'sine', oscBWave: 'sawtooth', oscBMix: 0.38, oscBOctave: -1, detuneCents: 6, fmAmount: 4, cutoffHz: 780, resonance: 2.4, envDepth: 48, attackMs: 8, decayMs: 260, sustain: 0.85, releaseMs: 140, drive: 24, shimmer: 0, xyX: 35, xyY: 30 };
    case 'fl-harmor':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'square', oscBMix: 0.44, oscBOctave: 1, detuneCents: 19, fmAmount: 38, cutoffHz: 7600, resonance: 3.4, envDepth: 68, attackMs: 10, decayMs: 320, sustain: 0.62, releaseMs: 380, drive: 22, shimmer: 62, xyX: 72, xyY: 66 };
    case 'fl-keys':
      return { ...base, oscAWave: 'triangle', oscBWave: 'sawtooth', oscBMix: 0.34, oscBOctave: 0, detuneCents: 4, fmAmount: 18, cutoffHz: 5600, resonance: 1.1, envDepth: 54, attackMs: 5, decayMs: 410, sustain: 0.38, releaseMs: 360, drive: 10, shimmer: 12, xyX: 54, xyY: 48 };
    case 'fl-sakura':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'triangle', oscBMix: 0.32, oscBOctave: 1, detuneCents: 5, fmAmount: 44, cutoffHz: 5200, resonance: 2.8, envDepth: 74, attackMs: 3, decayMs: 320, sustain: 0.18, releaseMs: 420, drive: 14, shimmer: 26, xyX: 58, xyY: 64 };
    case 'fl-gms':
      return { ...base, oscAWave: 'sawtooth', oscBWave: 'sawtooth', oscBMix: 0.72, oscBOctave: 0, detuneCents: 24, fmAmount: 15, cutoffHz: 1450, resonance: 3.8, envDepth: 66, attackMs: 10, decayMs: 280, sustain: 0.78, releaseMs: 210, drive: 38, shimmer: 8, xyX: 48, xyY: 62 };
    default:
      return base;
  }
}

export const FX_PLUGIN_CATALOG: FxPluginMetadata[] = [
  // UAD Classics & Vocal
  { id: 'autotune', name: 'Antares Auto-Tune Pro', shortName: 'Auto-Tune Pro', vendor: 'Antares', suite: 'uad-vocal', role: 'Pitch Correction', accent: '#38BDF8', description: 'Real-time key/scale vocal pitch lock, Retune Speed, Flex-Tune & Formant control.' },
  { id: 'neve1073', name: 'UAD Neve 1073 Preamp & EQ', shortName: 'UAD Neve 1073', vendor: 'Universal Audio', suite: 'uad-vocal', role: 'Analog Console Preamp', accent: '#60A5FA', description: 'Class-A British preamp harmonic saturation with classic 3-band musical EQ.' },
  { id: 'pultec', name: 'UAD Pultec EQP-1A', shortName: 'Pultec EQP-1A', vendor: 'Universal Audio', suite: 'uad-vocal', role: 'Tube Program EQ', accent: '#818CF8', description: 'Iconic simultaneous low-end boost/attenuation trick and silky tube top air.' },
  { id: 'fet1176', name: 'UAD 1176LN Classic FET', shortName: 'UAD 1176LN', vendor: 'Universal Audio', suite: 'uad-vocal', role: 'FET Compressor', accent: '#F59E0B', description: 'Ultra-fast punchy FET limiting with All-Buttons-In mode for drums & vocals.' },
  { id: 'la2a', name: 'UAD Teletronix LA-2A', shortName: 'UAD LA-2A', vendor: 'Universal Audio', suite: 'uad-vocal', role: 'Optical Tube Leveler', accent: '#CBD5E1', description: 'Smooth T4 optical tube compression that glues vocals and bass effortlessly.' },

  // FL Studio Stock FX
  { id: 'flEq2', name: 'Fruity Parametric EQ 2', shortName: 'FL Param EQ 2', vendor: 'FL Studio', suite: 'fl-stock', role: '7-Band Heatmap EQ', accent: '#F97316', description: 'Interactive 7-band parametric EQ with real-time orange spectral heatmap.' },
  { id: 'flConvolver', name: 'Fruity Convolver', shortName: 'FL Convolver', vendor: 'FL Studio', suite: 'fl-stock', role: 'Impulse Reverb', accent: '#FB923C', description: 'Convolution acoustic space engine with Cathedral, Studio, Plate & Hall IRs.' },
  { id: 'flSoundgoodizer', name: 'FL Soundgoodizer', shortName: 'Soundgoodizer', vendor: 'FL Studio', suite: 'fl-stock', role: 'Maximus Enhancer', accent: '#F59E0B', description: 'One-knob multiband A/B/C/D saturation & loudness maximizer.' },
  { id: 'flReeverb2', name: 'Fruity Reeverb 2', shortName: 'FL Reeverb 2', vendor: 'FL Studio', suite: 'fl-stock', role: 'Algorithmic Reverb', accent: '#EA580C', description: 'Classic FL Studio room size, decay, damping & stereo separation reverb.' },
  { id: 'flDelay3', name: 'Fruity Delay 3', shortName: 'FL Delay 3', vendor: 'FL Studio', suite: 'fl-stock', role: 'Tempo Sync Delay', accent: '#FBBF24', description: 'Beat-synced stereo & ping-pong echo with tone filter and analog saturation.' },
  { id: 'grossBeat', name: 'FL Gross Beat', shortName: 'Gross Beat', vendor: 'FL Studio', suite: 'fl-stock', role: 'Time & Volume Gate', accent: '#10B981', description: 'Half-Speed trap grooves, sidechain pumping, trance gates & beat chops.' },
  { id: 'flSoftClipper', name: 'Fruity Soft Clipper', shortName: 'Soft Clipper', vendor: 'FL Studio', suite: 'fl-stock', role: '808 Soft Clipper', accent: '#F97316', description: 'Signature FL Studio soft-knee saturation clipper for hard-hitting 808s.' },
  { id: 'flLimiter', name: 'Fruity Limiter', shortName: 'Fruity Limiter', vendor: 'FL Studio', suite: 'fl-stock', role: 'Peak Limiter', accent: '#38BDF8', description: 'Transparent ceiling limiter with input push, attack/release & saturation.' },
  { id: 'flChorus', name: 'Fruity Chorus', shortName: 'Fruity Chorus', vendor: 'FL Studio', suite: 'fl-stock', role: 'Stereo Chorus', accent: '#A855F7', description: 'LFO-modulated stereo detune ensemble for lush guitars, keys & vocals.' },

  // FabFilter & Soundtoys
  { id: 'fabProQ', name: 'FabFilter Pro-Q 3', shortName: 'FabFilter Pro-Q 3', vendor: 'FabFilter', suite: 'fabfilter-soundtoys', role: 'Surgical 6-Band EQ', accent: '#FACC15', description: 'High-precision interactive EQ with live spectrum analyzer and dynamic curves.' },
  { id: 'fabProR', name: 'FabFilter Pro-R 2', shortName: 'FabFilter Pro-R 2', vendor: 'FabFilter', suite: 'fabfilter-soundtoys', role: 'Algorithmic Space', accent: '#14B8A6', description: 'Musical algorithmic reverb with Space, Brightness, Character & Distance.' },
  { id: 'echoBoy', name: 'Soundtoys EchoBoy', shortName: 'EchoBoy', vendor: 'Soundtoys', suite: 'fabfilter-soundtoys', role: 'Analog Tape Echo', accent: '#D97706', description: 'Studio Tape, Space Echo, Memory Man & Lo-Fi rhythm-synced vintage echo.' },

  // Logic Pro FX
  { id: 'eq', name: 'Logic Channel EQ', shortName: 'Channel EQ', vendor: 'Logic Pro', suite: 'logic-fx', role: 'Channel Strip EQ', accent: '#38BDF8', description: 'Clean 4-band Logic Pro Channel EQ with real-time FFT analyzer.' },
  { id: 'compressor', name: 'Logic Studio Compressor', shortName: 'Logic Comp', vendor: 'Logic Pro', suite: 'logic-fx', role: 'VCA Dynamics', accent: '#60A5FA', description: 'Transparent studio VCA compressor with live gain reduction metering.' },
  { id: 'drive', name: 'Logic Phat FX Drive', shortName: 'Phat Drive', vendor: 'Logic Pro', suite: 'logic-fx', role: 'Harmonic Saturation', accent: '#F59E0B', description: 'Warm analog harmonic distortion with interactive transfer curve.' },
  { id: 'stereo', name: 'Logic Stereo Imager', shortName: 'Stereo Spread', vendor: 'Logic Pro', suite: 'logic-fx', role: 'Mid/Side Width', accent: '#34D399', description: 'Mid/Side stereo width shaping and quick aux space sends.' },
];

export function getFxPluginMeta(id: TrackPluginType): FxPluginMetadata {
  return FX_PLUGIN_CATALOG.find((p) => p.id === id) || FX_PLUGIN_CATALOG[0];
}

export function getTrackFxSlots(track: StudioTrack): TrackPluginType[] {
  if (track.fxSlots && track.fxSlots.length > 0) {
    return track.fxSlots;
  }
  const enabledKeys = FX_PLUGIN_CATALOG.map((p) => p.id).filter(
    (id) => track.fx?.[id]?.enabled
  );
  const starter: TrackPluginType[] =
    track.type === 'audio'
      ? ['autotune', 'neve1073', 'la2a', 'fabProQ']
      : track.type === 'drums'
        ? ['flEq2', 'fet1176', 'flSoftClipper']
        : ['flEq2', 'grossBeat', 'flReeverb2'];

  const merged: TrackPluginType[] = [...enabledKeys];
  for (const id of starter) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

export const STUDIO_SAMPLE_BANK: SampleBankItem[] = [
  // 808 & Sub
  { id: 'smp-808-spinz', name: 'Spinz 808 Punch (C)', pack: 'FL Trap Vault', category: '808 & Sub', key: 'C', durationSec: 1.4, color: '#EF4444', synthKind: '808-spinz', midiPitch: 36 },
  { id: 'smp-808-zay', name: 'Zay 808 Short Thump (C)', pack: 'FL Trap Vault', category: '808 & Sub', key: 'C', durationSec: 0.85, color: '#F97316', synthKind: '808-zay', midiPitch: 38 },
  { id: 'smp-808-glide', name: 'Drill Sub Glide (F)', pack: 'UK Drill Kit', category: '808 & Sub', key: 'F', durationSec: 1.8, color: '#DC2626', synthKind: '808-sub-glide', midiPitch: 41 },

  // Kicks & Snares
  { id: 'smp-kick-punch', name: 'Rack Kick Punchy', pack: 'FL Stock Drums', category: 'Kicks & Snares', durationSec: 0.45, color: '#F59E0B', synthKind: 'kick-punch' },
  { id: 'smp-kick-boom', name: 'Boom Bap Dusty Kick', pack: 'MPC Gold', category: 'Kicks & Snares', durationSec: 0.5, color: '#D97706', synthKind: 'kick-boom' },
  { id: 'smp-snare-trap', name: 'Metro Crisp Snare', pack: 'FL Trap Vault', category: 'Kicks & Snares', durationSec: 0.35, color: '#38BDF8', synthKind: 'snare-trap' },
  { id: 'smp-snare-lofi', name: 'Vinyl Snap Snare', pack: 'Lo-Fi Tape', category: 'Kicks & Snares', durationSec: 0.38, color: '#0EA5E9', synthKind: 'snare-lofi' },
  { id: 'smp-clap-metro', name: 'Lex Layered Clap', pack: 'FL Trap Vault', category: 'Kicks & Snares', durationSec: 0.35, color: '#A855F7', synthKind: 'clap-metro' },

  // Hats & Perc
  { id: 'smp-hat-crispy', name: 'Hit1 Crispy Closed Hat', pack: 'FL Trap Vault', category: 'Hats & Perc', durationSec: 0.18, color: '#10B981', synthKind: 'hat-crispy' },
  { id: 'smp-perc-rim', name: 'Afro Wood Rimshot', pack: 'Afrobeat Essentials', category: 'Hats & Perc', durationSec: 0.2, color: '#14B8A6', synthKind: 'perc-rim' },
  { id: 'smp-perc-bongo', name: 'Warm Conga Tap', pack: 'Afrobeat Essentials', category: 'Hats & Perc', durationSec: 0.32, color: '#22C55E', synthKind: 'perc-bongo' },

  // Omnisphere One-Shots
  { id: 'smp-omni-bell', name: 'Omnisphere Lotus Bell (C5)', pack: 'Omnisphere Bank', category: 'Omnisphere One-Shots', key: 'C', durationSec: 1.9, color: '#38BDF8', synthKind: 'oneshot-omni-bell', midiPitch: 72 },
  { id: 'smp-omni-pad', name: 'Omnisphere Celestial Wash (Cm)', pack: 'Omnisphere Bank', category: 'Omnisphere One-Shots', key: 'Cm', durationSec: 2.6, color: '#6366F1', synthKind: 'oneshot-omni-pad', midiPitch: 60 },
  { id: 'smp-omni-arp', name: 'Omnisphere Moog Dark Pluck (G)', pack: 'Omnisphere Bank', category: 'Omnisphere One-Shots', key: 'G', durationSec: 1.2, color: '#818CF8', synthKind: 'oneshot-omni-arp', midiPitch: 67 },
  { id: 'smp-omni-flute', name: 'Omnisphere Lotus Flute (C5)', pack: 'Omnisphere Bank', category: 'Omnisphere One-Shots', key: 'C', durationSec: 1.7, color: '#06B6D4', synthKind: 'oneshot-omni-flute', midiPitch: 72 },

  // Kontakt Chords
  { id: 'smp-kon-min', name: 'Noire Piano Cm9 Chord', pack: 'Kontakt Factory', category: 'Kontakt Chords', key: 'Cm9', durationSec: 2.4, color: '#F59E0B', synthKind: 'chord-kontakt-minor', midiPitch: 60 },
  { id: 'smp-kon-maj9', name: 'Scarbee Rhodes AbMaj9', pack: 'Kontakt Factory', category: 'Kontakt Chords', key: 'AbMaj9', durationSec: 2.4, color: '#FB923C', synthKind: 'chord-kontakt-maj9', midiPitch: 56 },
  { id: 'smp-kon-str', name: 'Session Strings Drama Swell', pack: 'Kontakt Factory', category: 'Kontakt Chords', key: 'Cm', durationSec: 2.8, color: '#D97706', synthKind: 'chord-kontakt-strings', midiPitch: 60 },
  { id: 'smp-kon-gtr', name: 'Nylon Guitar Minor Arp', pack: 'Kontakt Factory', category: 'Kontakt Chords', key: 'Cm', durationSec: 2.1, color: '#EAB308', synthKind: 'chord-kontakt-guitar', midiPitch: 60 },

  // FX & Vox Chops
  { id: 'smp-fx-riser', name: 'White Noise Tension Riser', pack: 'FL Stock FX', category: 'FX & Vox Chops', durationSec: 2.2, color: '#EC4899', synthKind: 'fx-riser' },
  { id: 'smp-fx-down', name: 'Sub Impact Downlifter', pack: 'FL Stock FX', category: 'FX & Vox Chops', durationSec: 1.8, color: '#F43F5E', synthKind: 'fx-downlifter' },
  { id: 'smp-fx-vox', name: 'Formant Vocal Chop (Cm)', pack: 'Kontakt Exhale', category: 'FX & Vox Chops', key: 'Cm', durationSec: 1.5, color: '#C084FC', synthKind: 'fx-vox-chop', midiPitch: 63 },
  { id: 'smp-fx-tape', name: 'Gross Beat Tape Stop FX', pack: 'FL Stock FX', category: 'FX & Vox Chops', durationSec: 1.1, color: '#FB7185', synthKind: 'fx-tape-stop' },
];

function renderSampleIntoContext(
  ctx: BaseAudioContext,
  dest: AudioNode,
  item: SampleBankItem,
  startTime: number
): void {
  const dur = item.durationSec;
  const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const rootHz = midiToHz(item.midiPitch || 60);

  const makeNoise = (lenSec: number) => {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * lenSec)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  };

  if (item.synthKind === '808-spinz' || item.synthKind === '808-zay' || item.synthKind === '808-sub-glide') {
    const osc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(new ArrayBuffer(256 * 4));
    const drive = item.synthKind === '808-zay' ? 5.2 : 3.0;
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = Math.tanh(x * drive);
    }
    shaper.curve = curve;
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(rootHz * 2.2, startTime);
    osc.frequency.exponentialRampToValueAtTime(rootHz, startTime + 0.055);
    if (item.synthKind === '808-sub-glide') {
      osc.frequency.setValueAtTime(rootHz, startTime + dur * 0.45);
      osc.frequency.exponentialRampToValueAtTime(rootHz * 1.498, startTime + dur * 0.72);
      osc.frequency.exponentialRampToValueAtTime(rootHz, startTime + dur * 0.92);
    }
    g.gain.setValueAtTime(0.001, startTime);
    g.gain.linearRampToValueAtTime(0.9, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(shaper);
    shaper.connect(g);
    g.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    return;
  }

  if (item.synthKind === 'kick-punch' || item.synthKind === 'kick-boom') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(item.synthKind === 'kick-punch' ? 185 : 135, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.08);
    g.gain.setValueAtTime(0.95, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    return;
  }

  if (item.synthKind === 'snare-trap' || item.synthKind === 'snare-lofi' || item.synthKind === 'clap-metro') {
    const n = makeNoise(dur);
    const f = ctx.createBiquadFilter();
    f.type = item.synthKind === 'clap-metro' ? 'bandpass' : 'highpass';
    f.frequency.value = item.synthKind === 'snare-lofi' ? 950 : 1450;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.75, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.start(startTime);
    n.stop(startTime + dur);

    if (item.synthKind !== 'clap-metro') {
      const body = ctx.createOscillator();
      const bg = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(220, startTime);
      body.frequency.exponentialRampToValueAtTime(110, startTime + 0.09);
      bg.gain.setValueAtTime(0.55, startTime);
      bg.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);
      body.connect(bg);
      bg.connect(dest);
      body.start(startTime);
      body.stop(startTime + 0.15);
    }
    return;
  }

  if (item.synthKind === 'hat-crispy' || item.synthKind === 'perc-rim' || item.synthKind === 'perc-bongo') {
    if (item.synthKind === 'hat-crispy') {
      const n = makeNoise(dur);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.55, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      n.connect(hp);
      hp.connect(g);
      g.connect(dest);
      n.start(startTime);
      n.stop(startTime + dur);
    } else {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = item.synthKind === 'perc-rim' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(item.synthKind === 'perc-rim' ? 880 : 390, startTime);
      osc.frequency.exponentialRampToValueAtTime(item.synthKind === 'perc-rim' ? 420 : 190, startTime + dur * 0.7);
      g.gain.setValueAtTime(0.55, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + dur);
    }
    return;
  }

  if (item.synthKind === 'oneshot-omni-bell' || item.synthKind === 'oneshot-omni-flute') {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    carrier.type = 'sine';
    mod.type = 'sine';
    carrier.frequency.setValueAtTime(rootHz, startTime);
    mod.frequency.setValueAtTime(rootHz * (item.synthKind === 'oneshot-omni-bell' ? 2.756 : 2.0), startTime);
    modGain.gain.setValueAtTime(item.synthKind === 'oneshot-omni-bell' ? rootHz * 1.8 : rootHz * 0.35, startTime);
    modGain.gain.exponentialRampToValueAtTime(1, startTime + dur * 0.7);
    g.gain.setValueAtTime(0.001, startTime);
    g.gain.linearRampToValueAtTime(0.45, startTime + (item.synthKind === 'oneshot-omni-flute' ? 0.08 : 0.008));
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    g.connect(dest);
    carrier.start(startTime);
    mod.start(startTime);
    carrier.stop(startTime + dur);
    mod.stop(startTime + dur);
    return;
  }

  if (
    item.synthKind === 'oneshot-omni-pad' ||
    item.synthKind === 'oneshot-omni-arp' ||
    item.synthKind.startsWith('chord-kontakt-')
  ) {
    const intervals =
      item.synthKind === 'chord-kontakt-maj9'
        ? [0, 4, 7, 11, 14]
        : item.synthKind === 'oneshot-omni-arp'
          ? [0, 7, 12]
          : [0, 3, 7, 10, 14];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(item.synthKind === 'oneshot-omni-arp' ? 4200 : 2800, startTime);
    lp.frequency.exponentialRampToValueAtTime(650, startTime + dur);
    lp.Q.value = 1.6;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, startTime);
    master.gain.linearRampToValueAtTime(0.42, startTime + (item.synthKind === 'chord-kontakt-strings' ? 0.45 : 0.03));
    master.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    lp.connect(master);
    master.connect(dest);

    intervals.forEach((semi, idx) => {
      const osc = ctx.createOscillator();
      osc.type = item.synthKind === 'chord-kontakt-strings' || item.synthKind === 'oneshot-omni-pad' ? 'sawtooth' : 'triangle';
      const offset = item.synthKind === 'chord-kontakt-guitar' ? idx * 0.045 : 0;
      osc.frequency.setValueAtTime(midiToHz((item.midiPitch || 60) + semi), startTime + offset);
      osc.detune.value = (idx - 2) * 5;
      const vg = ctx.createGain();
      vg.gain.value = 1 / intervals.length;
      osc.connect(vg);
      vg.connect(lp);
      osc.start(startTime + offset);
      osc.stop(startTime + dur);
    });
    return;
  }

  if (item.synthKind === 'fx-riser' || item.synthKind === 'fx-downlifter') {
    const n = makeNoise(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.2;
    bp.frequency.setValueAtTime(item.synthKind === 'fx-riser' ? 180 : 4800, startTime);
    bp.frequency.exponentialRampToValueAtTime(item.synthKind === 'fx-riser' ? 5400 : 120, startTime + dur);
    const g = ctx.createGain();
    if (item.synthKind === 'fx-riser') {
      g.gain.setValueAtTime(0.01, startTime);
      g.gain.linearRampToValueAtTime(0.55, startTime + dur * 0.92);
      g.gain.linearRampToValueAtTime(0.001, startTime + dur);
    } else {
      g.gain.setValueAtTime(0.65, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    }
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    n.start(startTime);
    n.stop(startTime + dur);
    return;
  }

  // fx-vox-chop or fx-tape-stop
  const osc = ctx.createOscillator();
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 920;
  f1.Q.value = 4.2;
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(rootHz, startTime);
  if (item.synthKind === 'fx-tape-stop') {
    osc.frequency.exponentialRampToValueAtTime(36, startTime + dur * 0.9);
  } else {
    osc.frequency.setValueAtTime(rootHz * 1.189, startTime + dur * 0.35);
    osc.frequency.setValueAtTime(rootHz, startTime + dur * 0.65);
  }
  g.gain.setValueAtTime(0.001, startTime);
  g.gain.linearRampToValueAtTime(0.5, startTime + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
  osc.connect(f1);
  f1.connect(g);
  g.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + dur);
}

let previewCtx: AudioContext | null = null;

export function auditionSampleBankItem(item: SampleBankItem): void {
  if (!previewCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    previewCtx = new Ctx();
  }
  if (previewCtx.state === 'suspended') {
    void previewCtx.resume();
  }
  renderSampleIntoContext(previewCtx, previewCtx.destination, item, previewCtx.currentTime + 0.01);
}

export async function renderSampleToAudioClip(
  item: SampleBankItem,
  trackId: string,
  startStep: number,
  userName: string
): Promise<AudioClip> {
  const sampleRate = 44100;
  const frames = Math.ceil((item.durationSec + 0.08) * sampleRate);
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  renderSampleIntoContext(offline, offline.destination, item, 0.005);
  const buffer = await offline.startRendering();
  const mono = buffer.getChannelData(0);

  // Compute waveform peaks
  const numBars = 48;
  const peaks: number[] = [];
  const step = Math.max(1, Math.floor(mono.length / numBars));
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    const start = i * step;
    const end = Math.min(mono.length, start + step);
    for (let j = start; j < end; j++) {
      const a = Math.abs(mono[j]);
      if (a > max) max = a;
    }
    peaks.push(Math.min(1, max));
  }

  // Encode Mono 16-bit PCM WAV data URL
  const dataBytes = mono.length * 2;
  const ab = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  let off = 44;
  for (let i = 0; i < mono.length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  const blob = new Blob([ab], { type: 'audio/wav' });
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });

  return {
    id: `clip-smp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    trackId,
    name: item.name,
    startStep,
    durationSeconds: item.durationSec,
    audioDataUrl: dataUrl,
    peaks,
    recordedBy: userName,
    createdAt: Date.now(),
    channelFormat: 'mono',
  };
}
