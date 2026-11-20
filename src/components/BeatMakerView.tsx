import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  FolderOpen,
  Layers,
  Music,
  Play,
  Plus,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import {
  auditionSampleBankItem,
  getInstrumentInfo,
  INDUSTRY_INSTRUMENTS,
  STUDIO_SAMPLE_BANK,
} from '../data/instruments';
import { DRUM_PATTERNS } from '../data/presets';
import type {
  DrumChannel,
  DrumChannelId,
  InstrumentDefinition,
  InstrumentVendor,
  SampleBankItem,
  SampleCategory,
  StudioProject,
  StudioTrack,
} from '../types/studio';

interface BeatMakerViewProps {
  project: StudioProject;
  currentStep: number;
  isPlaying: boolean;
  browserOpen: boolean;
  onToggleBrowser: () => void;
  onUpdateDrumStep: (channelId: DrumChannelId, stepIndex: number, value: number) => void;
  onUpdateDrumChannel: (
    channelId: DrumChannelId,
    updates: Partial<Pick<DrumChannel, 'volume' | 'pitch' | 'muted'>>
  ) => void;
  onApplyPreset: (presetName: string) => void;
  onUpdateSwing: (swing: number) => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onOpenInstrument: (trackId: string) => void;
  onOpenInstrumentPicker: (replaceTrack?: StudioTrack) => void;
  onOpenPianoRoll: (trackId: string) => void;
  onAddInstrumentChannel: (inst: InstrumentDefinition) => void;
  onDropSample: (item: SampleBankItem) => void;
}

const SAMPLE_CATEGORIES: ('All' | SampleCategory)[] = [
  'All',
  '808 & Sub',
  'Kicks & Snares',
  'Hats & Perc',
  'Omnisphere One-Shots',
  'Kontakt Chords',
  'FX & Vox Chops',
];

export const BeatMakerView: React.FC<BeatMakerViewProps> = ({
  project,
  currentStep,
  isPlaying,
  browserOpen,
  onToggleBrowser,
  onUpdateDrumStep,
  onUpdateDrumChannel,
  onApplyPreset,
  onUpdateSwing,
  onUpdateTrack,
  onOpenInstrument,
  onOpenInstrumentPicker,
  onOpenPianoRoll,
  onAddInstrumentChannel,
  onDropSample,
}) => {
  const [browserTab, setBrowserTab] = useState<'samples' | 'instruments'>('samples');
  const [sampleCat, setSampleCat] = useState<'All' | SampleCategory>('All');
  const [vendorFilter, setVendorFilter] = useState<'all' | InstrumentVendor>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [auditioningId, setAuditioningId] = useState<string | null>(null);

  const activeDrumStep = currentStep % 32;
  const synthTracks = useMemo(
    () => project.tracks.filter((t) => t.type === 'synth'),
    [project.tracks]
  );

  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return STUDIO_SAMPLE_BANK.filter((item) => {
      if (sampleCat !== 'All' && item.category !== sampleCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.pack.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [sampleCat, searchQuery]);

  const filteredInstruments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return INDUSTRY_INSTRUMENTS.filter((inst) => {
      if (vendorFilter !== 'all' && inst.vendor !== vendorFilter) return false;
      if (!q) return true;
      return (
        inst.pluginName.toLowerCase().includes(q) ||
        inst.patchName.toLowerCase().includes(q) ||
        inst.category.toLowerCase().includes(q)
      );
    });
  }, [vendorFilter, searchQuery]);

  const handlePadClick = (e: React.MouseEvent, channel: DrumChannel, stepIndex: number) => {
    const current = channel.steps[stepIndex] || 0;
    let nextVal = 0;
    if (e.shiftKey) {
      nextVal = current === 0.45 ? 0 : 0.45;
    } else {
      nextVal = current > 0 ? 0 : 1;
    }
    onUpdateDrumStep(channel.id, stepIndex, nextVal);
    if (nextVal > 0 && !isPlaying) {
      audioEngine.triggerDrumLive(channel.id, nextVal * channel.volume, channel.pitch);
    }
  };

  const handlePadRightClick = (e: React.MouseEvent, channel: DrumChannel, stepIndex: number) => {
    e.preventDefault();
    if ((channel.steps[stepIndex] || 0) > 0) {
      onUpdateDrumStep(channel.id, stepIndex, 0);
    }
  };

  const fillEveryNSteps = (channel: DrumChannel, interval: number) => {
    for (let i = 0; i < 32; i++) {
      const targetVal = interval > 0 && i % interval === 0 ? 1 : 0;
      if ((channel.steps[i] || 0) !== targetVal) {
        onUpdateDrumStep(channel.id, i, targetVal);
      }
    }
  };

  const handleAuditionSample = (item: SampleBankItem) => {
    setAuditioningId(item.id);
    auditionSampleBankItem(item);
    window.setTimeout(() => {
      setAuditioningId((prev) => (prev === item.id ? null : prev));
    }, Math.min(1200, Math.round(item.durationSec * 650)));
  };

  const quickAddInstruments: InstrumentDefinition[] = [
    INDUSTRY_INSTRUMENTS.find((i) => i.preset === 'omnisphere-bells')!,
    INDUSTRY_INSTRUMENTS.find((i) => i.preset === 'kontakt-noir-piano')!,
    INDUSTRY_INSTRUMENTS.find((i) => i.preset === 'fl-sytrus')!,
    INDUSTRY_INSTRUMENTS.find((i) => i.preset === 'fl-flex')!,
    INDUSTRY_INSTRUMENTS.find((i) => i.preset === 'fl-3xosc')!,
  ].filter(Boolean);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1B1D22]">
      {/* FL Studio Channel Rack Top Toolbar */}
      <div className="h-10 px-3 bg-[#252830] border-b border-[#14161A] flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleBrowser}
            title="Toggle Sample Bank & VST Browser (F8)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-colors whitespace-nowrap ${
              browserOpen
                ? 'bg-orange-600/25 border-orange-400/60 text-orange-200'
                : 'bg-[#1D2028] border-[#363D4D] text-[#CBD5E1] hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
            <span>Browser (F8)</span>
          </button>

          <span className="text-xs font-semibold text-[#F3F4F6] whitespace-nowrap">
            FL Channel Rack (F6)
          </span>
          <span className="text-[#3A4152]" aria-hidden="true">|</span>
          <div className="flex items-center gap-1">
            {Object.keys(DRUM_PATTERNS).map((presetName) => (
              <button
                key={presetName}
                type="button"
                onClick={() => onApplyPreset(presetName)}
                className="px-2 py-1 rounded text-[11px] font-medium bg-[#1F2430] hover:bg-[#2B3344] text-[#D1D6E0] hover:text-white border border-[#30384A] transition-colors whitespace-nowrap"
              >
                {presetName}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94A3B8] whitespace-nowrap">Swing</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.02}
              value={project.swing}
              onChange={(e) => onUpdateSwing(parseFloat(e.target.value))}
              className="studio-slider w-20"
              aria-label="Channel Rack Groove Swing"
            />
            <span className="font-mono-tabular text-xs text-[#D1D6E0] w-8 text-right">
              {Math.round(project.swing * 100)}%
            </span>
          </div>
          <span className="hidden 2xl:inline text-[11px] text-[#7C8698] whitespace-nowrap">
            Right-Click erase · Shift+Click ghost
          </span>
        </div>
      </div>

      {/* Main Split: Collapsible FL Sample/Plugin Browser + Channel Rack */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {browserOpen && (
          <aside className="w-72 shrink-0 bg-[#161920] border-r border-[#2A303E] flex flex-col min-h-0">
            {/* Browser Mode Switcher */}
            <div className="p-2 border-b border-[#252B37] space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-1 bg-[#101318] p-0.5 rounded border border-[#282F3D]">
                <button
                  type="button"
                  onClick={() => setBrowserTab('samples')}
                  className={`py-1 rounded text-[11px] font-semibold transition-colors ${
                    browserTab === 'samples'
                      ? 'bg-orange-600 text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Sample Bank ({STUDIO_SAMPLE_BANK.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserTab('instruments')}
                  className={`py-1 rounded text-[11px] font-semibold transition-colors ${
                    browserTab === 'instruments'
                      ? 'bg-sky-600 text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  VST Synths ({INDUSTRY_INSTRUMENTS.length})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    browserTab === 'samples'
                      ? 'Search 808s, Kontakt, Omnisphere...'
                      : 'Search Omnisphere, Kontakt, FL...'
                  }
                  className="w-full bg-[#0F1218] border border-[#2C3343] rounded pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-[#64748B] outline-none focus:border-orange-400/70"
                />
              </div>

              {browserTab === 'samples' ? (
                <select
                  value={sampleCat}
                  onChange={(e) => setSampleCat(e.target.value as 'All' | SampleCategory)}
                  className="w-full bg-[#0F1218] border border-[#2C3343] rounded px-2 py-1 text-[11px] font-medium text-[#D1D5DB] outline-none cursor-pointer"
                >
                  {SAMPLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#161A22]">
                      Pack: {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'omnisphere', label: 'Omni' },
                    { id: 'kontakt', label: 'Kontakt' },
                    { id: 'fl-stock', label: 'FL' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVendorFilter(v.id as 'all' | InstrumentVendor)}
                      className={`py-1 rounded text-[10px] font-semibold transition-colors ${
                        vendorFilter === v.id
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-[#1D222D] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Browser Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {browserTab === 'samples'
                ? filteredSamples.map((item) => {
                    const active = auditioningId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleAuditionSample(item)}
                        className={`p-2 rounded border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-orange-500/15 border-orange-400/60'
                            : 'bg-[#1C2029] border-[#282F3E] hover:border-[#3E475C]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-6 rounded-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-[#F3F4F6] truncate">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-[#8E98A8] truncate">
                              {item.pack} · {item.durationSec.toFixed(1)}s
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDropSample(item);
                          }}
                          title="Render WAV & drop onto Playlist Audio Track"
                          className="px-2 py-1 rounded bg-[#272D3B] hover:bg-orange-600 text-[10px] font-semibold text-[#E5E7EB] hover:text-white transition-colors shrink-0 whitespace-nowrap"
                        >
                          + Drop
                        </button>
                      </div>
                    );
                  })
                : filteredInstruments.map((inst) => (
                    <div
                      key={inst.preset}
                      onClick={() => audioEngine.triggerPresetPreview(inst.preset, 60, 0.7)}
                      className="p-2 rounded bg-[#1C2029] border border-[#282F3E] hover:border-sky-400/50 cursor-pointer transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-6 rounded-xs shrink-0"
                          style={{ backgroundColor: inst.accent }}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-[#F3F4F6] truncate">
                            {inst.patchName}
                          </div>
                          <div className="text-[10px] text-[#8E98A8] truncate">
                            {inst.pluginName} · {inst.category}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            audioEngine.triggerPresetPreview(inst.preset, 60, 0.7);
                          }}
                          title="Audition VST patch"
                          className="w-6 h-6 rounded bg-[#242A37] hover:bg-[#323A4C] text-sky-300 flex items-center justify-center"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddInstrumentChannel(inst);
                          }}
                          title="Add to Channel Rack"
                          className="px-2 py-1 rounded bg-[#2563EB] hover:bg-[#3B82F6] text-[10px] font-semibold text-white whitespace-nowrap"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </aside>
        )}

        {/* FL Studio Channel Rack Main Panel */}
        <div className="flex-1 overflow-auto p-3.5">
          <div className="min-w-[980px] bg-[#161921] border border-[#2C3342] rounded-lg overflow-hidden">
            {/* Step Ruler Header */}
            <div className="flex items-center border-b border-[#2A3140] bg-[#11141B] h-8">
              <div className="w-[330px] shrink-0 px-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#8C96A8] border-r border-[#2A3140] h-full">
                <span>On · Vol · Channel / VST</span>
                <span>Fill / Tune</span>
              </div>
              <div className="flex-1 grid grid-cols-32 gap-1 px-2">
                {Array.from({ length: 32 }).map((_, stepIdx) => {
                  const isBeatStart = stepIdx % 4 === 0;
                  const isCurrent = isPlaying && activeDrumStep === stepIdx;
                  return (
                    <div
                      key={stepIdx}
                      className={`text-center font-mono-tabular text-[10px] py-0.5 rounded-xs ${
                        isCurrent
                          ? 'bg-orange-500 text-[#111317] font-bold'
                          : isBeatStart
                            ? 'text-[#E2E8F0] font-semibold'
                            : 'text-[#525B6E]'
                      }`}
                    >
                      {isBeatStart ? `${Math.floor(stepIdx / 4) + 1}` : '·'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 1: 8 FL DRUM SAMPLER CHANNELS */}
            {project.drumChannels.map((channel) => (
              <div
                key={channel.id}
                className={`flex items-center border-b border-[#222836] h-13 transition-opacity ${
                  channel.muted ? 'opacity-45' : ''
                }`}
              >
                {/* FL Channel Strip Control Column */}
                <div className="w-[330px] shrink-0 h-full px-2.5 border-r border-[#2A3140] flex items-center justify-between gap-2 bg-[#1A1E28]">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Classic FL Green LED Mute Switch */}
                    <button
                      type="button"
                      onClick={() => onUpdateDrumChannel(channel.id, { muted: !channel.muted })}
                      title={channel.muted ? 'Unmute Channel' : 'Mute Channel'}
                      className={`w-3.5 h-6 rounded-xs border shrink-0 transition-colors ${
                        channel.muted
                          ? 'bg-[#1D222C] border-[#343C4D]'
                          : 'bg-emerald-400 border-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
                      }`}
                    />

                    {/* Volume mini slider */}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={channel.volume}
                      onChange={(e) =>
                        onUpdateDrumChannel(channel.id, { volume: parseFloat(e.target.value) })
                      }
                      className="studio-slider w-12 shrink-0"
                      title={`Volume: ${Math.round(channel.volume * 100)}%`}
                    />

                    {/* FL Rectangular Channel Button */}
                    <button
                      type="button"
                      onClick={() => audioEngine.triggerDrumLive(channel.id, channel.volume, channel.pitch)}
                      title={`Click to audition ${channel.name}`}
                      className="h-8 px-2.5 rounded bg-[#262C39] hover:bg-[#313849] border border-[#3C4457] flex items-center gap-2 min-w-[116px] max-w-[126px] active:scale-[0.98] transition-all"
                    >
                      <span
                        className="w-2 h-4 rounded-xs shrink-0"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span className="text-[11px] font-semibold text-[#F1F5F9] truncate">
                        {channel.name}
                      </span>
                    </button>
                  </div>

                  {/* Quick FL Fill Each 2/4/8 + Pitch Tune */}
                  <div className="flex items-center gap-1 shrink-0">
                    {[
                      { label: '2', n: 2, title: 'Fill each 2 steps' },
                      { label: '4', n: 4, title: 'Fill each 4 steps' },
                      { label: '8', n: 8, title: 'Fill each 8 steps' },
                      { label: '×', n: 0, title: 'Clear row' },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => fillEveryNSteps(channel, btn.n)}
                        title={btn.title}
                        className="w-5 h-5 rounded bg-[#141821] hover:bg-orange-500/25 border border-[#2C3445] text-[9px] font-mono-tabular font-semibold text-[#9CA3AF] hover:text-orange-300"
                      >
                        {btn.label}
                      </button>
                    ))}

                    <select
                      value={channel.pitch}
                      onChange={(e) =>
                        onUpdateDrumChannel(channel.id, { pitch: parseInt(e.target.value, 10) })
                      }
                      title="Pitch Tune (Semitones)"
                      className="bg-[#0F1218] border border-[#2C3445] rounded px-1 py-0.5 font-mono-tabular text-[9px] text-[#CBD5E1] outline-none"
                    >
                      {[-7, -5, -3, -2, -1, 0, 1, 2, 3, 5, 7].map((st) => (
                        <option key={st} value={st} className="bg-[#161A22]">
                          {st > 0 ? `+${st}` : `${st}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Classic FL Studio Grey / Maroon 4-Step Grouped Step Sequencer Pads */}
                <div className="flex-1 grid grid-cols-32 gap-1 px-2 h-full items-center bg-[#151820]">
                  {channel.steps.map((vel, stepIdx) => {
                    const beatGroupEven = Math.floor(stepIdx / 4) % 2 === 0;
                    const isActive = vel > 0;
                    const isGhost = vel > 0 && vel < 0.7;
                    const isPlayhead = isPlaying && activeDrumStep === stepIdx;

                    return (
                      <button
                        key={stepIdx}
                        type="button"
                        onClick={(e) => handlePadClick(e, channel, stepIdx)}
                        onContextMenu={(e) => handlePadRightClick(e, channel, stepIdx)}
                        aria-label={`${channel.name} step ${stepIdx + 1}`}
                        className={`h-8 rounded-[3px] border transition-all relative overflow-hidden ${
                          isPlayhead
                            ? 'ring-1 ring-orange-400 border-orange-300'
                            : isActive
                              ? 'border-white/40'
                              : beatGroupEven
                                ? 'bg-[#2C323E] border-[#3C4454] hover:bg-[#384050]'
                                : 'bg-[#3C282D] border-[#52363D] hover:bg-[#4D333A]'
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: channel.color,
                                opacity: isGhost ? 0.5 : 0.96,
                              }
                            : undefined
                        }
                      >
                        {isActive && (
                          <span
                            className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded-full bg-white/60"
                            style={{ opacity: isGhost ? 0.35 : 0.9 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* SECTION 2: SOFTWARE INSTRUMENT CHANNELS (OMNISPHERE 2, KONTAKT 7, FL STOCK) */}
            <div className="px-3 py-1.5 bg-[#12151C] border-b border-[#2A3140] flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-sky-400">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Instrument Channels · Omnisphere 2 · Kontakt 7 · FL Stock Synths</span>
              </div>
              <span className="text-[#8E98A8] normal-case font-normal">
                Click VST button to change patch · Click MIDI strip to edit Piano Roll (F7)
              </span>
            </div>

            {synthTracks.map((track) => {
              const info = getInstrumentInfo(track.preset);
              const trackNotes = project.notes.filter((n) => n.trackId === track.id);
              const busLabel =
                track.outputBus && track.outputBus !== 'stereo-out'
                  ? track.outputBus.replace('bus-', 'B')
                  : 'M';

              return (
                <div
                  key={track.id}
                  className={`flex items-center border-b border-[#222836] h-13 transition-opacity ${
                    track.muted ? 'opacity-45' : ''
                  }`}
                >
                  <div className="w-[330px] shrink-0 h-full px-2.5 border-r border-[#2A3140] flex items-center justify-between gap-2 bg-[#1A1E28]">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* FL Green LED Mute */}
                      <button
                        type="button"
                        onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                        title={track.muted ? 'Unmute Instrument' : 'Mute Instrument'}
                        className={`w-3.5 h-6 rounded-xs border shrink-0 transition-colors ${
                          track.muted
                            ? 'bg-[#1D222C] border-[#343C4D]'
                            : 'bg-emerald-400 border-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
                        }`}
                      />

                      {/* Volume Slider */}
                      <input
                        type="range"
                        min={0}
                        max={1.2}
                        step={0.02}
                        value={track.volume}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })
                        }
                        className="studio-slider w-12 shrink-0"
                        title={`Volume: ${Math.round(track.volume * 100)}%`}
                      />

                      {/* Clickable VST Instrument Channel Button */}
                      <button
                        type="button"
                        onClick={() => onOpenInstrument(track.id)}
                        title={`Open ${info.pluginName} (${info.patchName})`}
                        className="h-8 px-2.5 rounded bg-[#232A38] hover:bg-[#2F384C] border border-[#3F4A61] flex items-center gap-2 min-w-[162px] max-w-[175px] transition-colors text-left"
                      >
                        <span
                          className="w-2 h-4 rounded-xs shrink-0"
                          style={{ backgroundColor: track.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-white truncate leading-tight">
                            {info.pluginName}
                          </div>
                          <div className="text-[9px] text-[#94A3B8] truncate leading-tight">
                            {info.patchName}
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenInstrumentPicker(track)}
                        title="Replace VST Instrument (keeps MIDI notes & FX)"
                        className="w-6 h-6 rounded bg-[#222836] hover:bg-amber-600/30 border border-[#343C4F] text-amber-300 flex items-center justify-center"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                      </button>
                      {/* Mixer Routing Box */}
                      <span
                        title={`Routed to Mixer ${busLabel === 'M' ? 'Master' : `Bus ${busLabel.slice(1)}`}`}
                        className="w-6 h-6 rounded bg-[#0F1218] border border-[#303748] font-mono-tabular text-[10px] font-bold text-amber-300 flex items-center justify-center"
                      >
                        {busLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => audioEngine.triggerNoteLive(track, 60, 0.5, 0.8)}
                        title="Audition C4"
                        className="w-6 h-6 rounded bg-[#222836] hover:bg-[#313A4D] text-sky-300 flex items-center justify-center"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* FL Piano Roll Mini MIDI Preview Strip */}
                  <button
                    type="button"
                    onClick={() => onOpenPianoRoll(track.id)}
                    title="Open in Piano Roll (F7)"
                    className="flex-1 h-full px-2 py-1.5 bg-[#131720] hover:bg-[#181E2B] transition-colors relative text-left"
                  >
                    <div className="w-full h-full rounded bg-[#0E1118] border border-[#283040] relative overflow-hidden">
                      {/* Vertical beat guides */}
                      <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                        {Array.from({ length: 8 }).map((_, b) => (
                          <div key={b} className="border-r border-[#1C2230] last:border-r-0" />
                        ))}
                      </div>

                      {/* Playhead bar */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-orange-400/80 pointer-events-none z-10"
                        style={{ left: `${((currentStep % (project.totalBars * 16)) / (project.totalBars * 16)) * 100}%` }}
                      />

                      {trackNotes.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-[10px] text-[#64748B]">
                          <Music className="w-3 h-3" />
                          <span>Click to compose {info.pluginName} notes in Piano Roll (F7)</span>
                        </div>
                      ) : (
                        trackNotes.map((note) => {
                          const totalSteps = project.totalBars * 16;
                          const leftPct = (note.startStep / totalSteps) * 100;
                          const widthPct = Math.max(1.2, (note.durationSteps / totalSteps) * 100);
                          const topPct = Math.max(8, Math.min(82, ((84 - note.pitch) / 48) * 100));
                          return (
                            <span
                              key={note.id}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                top: `${topPct}%`,
                                backgroundColor: track.color,
                              }}
                              className="absolute h-1.5 rounded-[1px]"
                            />
                          );
                        })
                      )}
                    </div>
                  </button>
                </div>
              );
            })}

            {/* FL Studio Bottom "+" Add Channel Bar */}
            <div className="p-2.5 bg-[#12151C] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-[#9CA3AF] mr-1 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-orange-400" />
                  Add Channel:
                </span>
                {quickAddInstruments.map((inst) => (
                  <button
                    key={inst.preset}
                    type="button"
                    onClick={() => onAddInstrumentChannel(inst)}
                    className="px-2.5 py-1 rounded bg-[#1E232F] hover:bg-[#2B3345] border border-[#343D52] text-[11px] font-medium text-[#E2E8F0] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: inst.accent }}
                    />
                    <span>{inst.pluginName}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onOpenInstrumentPicker()}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/50 text-[11px] font-semibold text-sky-200 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>Open Instrument Picker</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
