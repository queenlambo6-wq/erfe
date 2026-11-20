import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Play, Plus, Search, X } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import {
  FX_PLUGIN_CATALOG,
  getFxPluginMeta,
  getInstrumentInfo,
  INDUSTRY_INSTRUMENTS,
} from '../data/instruments';
import type {
  FxPluginMetadata,
  InstrumentDefinition,
  InstrumentVendor,
  PluginSuiteCategory,
  StudioTrack,
  TrackPluginType,
} from '../types/studio';

export type PluginPickerMode =
  | {
      kind: 'fx';
      track: StudioTrack;
      replacePlugin?: TrackPluginType; // if set, replaces this slot; otherwise appends a new slot
    }
  | {
      kind: 'instrument';
      track?: StudioTrack; // if set, replaces this track's instrument; otherwise adds a new instrument channel
    };

interface PluginPickerModalProps {
  mode: PluginPickerMode;
  onPickFx: (trackId: string, chosen: TrackPluginType, replacePlugin?: TrackPluginType) => void;
  onPickInstrument: (inst: InstrumentDefinition, replaceTrackId?: string) => void;
  onClose: () => void;
}

const FX_SUITE_TABS: { id: 'all' | PluginSuiteCategory; label: string }[] = [
  { id: 'all', label: 'All FX' },
  { id: 'uad-vocal', label: 'UAD & Vocal' },
  { id: 'fl-stock', label: 'FL Studio Stock' },
  { id: 'fabfilter-soundtoys', label: 'FabFilter & Soundtoys' },
  { id: 'logic-fx', label: 'Logic Pro FX' },
];

const INST_VENDOR_TABS: { id: 'all' | InstrumentVendor; label: string }[] = [
  { id: 'all', label: 'All Instruments' },
  { id: 'omnisphere', label: 'Omnisphere 2' },
  { id: 'kontakt', label: 'NI Kontakt 7' },
  { id: 'fl-stock', label: 'FL Studio Stock' },
];

function renderMiniFaceplate(accent: string, id: string) {
  // Subtle geometric hardware thumbnail per plugin type
  if (id.includes('Eq') || id === 'fabProQ' || id === 'eq' || id === 'pultec') {
    return (
      <svg viewBox="0 0 120 36" className="w-full h-9">
        <line x1="0" y1="18" x2="120" y2="18" stroke="#283040" strokeWidth="1" />
        <path
          d="M4,24 Q24,22 38,11 T76,16 T116,9"
          fill="none"
          stroke={accent}
          strokeWidth="2"
        />
        <circle cx="38" cy="11" r="2.8" fill={accent} />
        <circle cx="76" cy="16" r="2.8" fill={accent} />
        <circle cx="108" cy="10" r="2.8" fill={accent} />
      </svg>
    );
  }
  if (id === 'grossBeat') {
    const bars = [0.95, 0.75, 0.5, 0.3, 0.9, 0.7, 0.45, 0.25, 0.95, 0.75, 0.5, 0.3];
    return (
      <svg viewBox="0 0 120 36" className="w-full h-9">
        {bars.map((h, i) => (
          <rect
            key={i}
            x={4 + i * 9.5}
            y={32 - h * 26}
            width="6.5"
            height={h * 26}
            rx="1"
            fill={accent}
            opacity={i % 4 === 0 ? 0.95 : 0.55}
          />
        ))}
      </svg>
    );
  }
  if (id.startsWith('omnisphere')) {
    return (
      <svg viewBox="0 0 120 36" className="w-full h-9">
        <circle cx="24" cy="18" r="12" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.85" />
        <circle cx="24" cy="18" r="5" fill={accent} opacity="0.5" />
        <path d="M46,24 Q64,8 82,20 T114,12" fill="none" stroke={accent} strokeWidth="1.8" />
        <line x1="46" y1="28" x2="114" y2="28" stroke="#2C3445" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id.startsWith('kontakt')) {
    return (
      <svg viewBox="0 0 120 36" className="w-full h-9">
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x={8 + i * 9}
            y={12}
            width="7"
            height="18"
            rx="1"
            fill={i % 3 === 1 ? '#1E2430' : '#CBD5E1'}
            opacity="0.7"
          />
        ))}
        <rect x="8" y="4" width="104" height="4" rx="1" fill={accent} opacity="0.85" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 36" className="w-full h-9">
      <circle cx="26" cy="18" r="9" fill="#171C26" stroke={accent} strokeWidth="1.8" />
      <line x1="26" y1="18" x2="31" y2="12" stroke={accent} strokeWidth="1.8" />
      <circle cx="60" cy="18" r="9" fill="#171C26" stroke={accent} strokeWidth="1.8" />
      <line x1="60" y1="18" x2="60" y2="10" stroke={accent} strokeWidth="1.8" />
      <circle cx="94" cy="18" r="9" fill="#171C26" stroke={accent} strokeWidth="1.8" />
      <line x1="94" y1="18" x2="100" y2="14" stroke={accent} strokeWidth="1.8" />
    </svg>
  );
}

export const PluginPickerModal: React.FC<PluginPickerModalProps> = ({
  mode,
  onPickFx,
  onPickInstrument,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [fxSuite, setFxSuite] = useState<'all' | PluginSuiteCategory>('all');
  const [instVendor, setInstVendor] = useState<'all' | InstrumentVendor>('all');

  const isFx = mode.kind === 'fx';
  const isReplace = isFx ? Boolean(mode.replacePlugin) : Boolean(mode.track);

  const filteredFx: FxPluginMetadata[] = useMemo(() => {
    if (!isFx) return [];
    const q = search.trim().toLowerCase();
    return FX_PLUGIN_CATALOG.filter((p) => {
      if (fxSuite !== 'all' && p.suite !== fxSuite) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [fxSuite, isFx, search]);

  const filteredInstruments: InstrumentDefinition[] = useMemo(() => {
    if (isFx) return [];
    const q = search.trim().toLowerCase();
    return INDUSTRY_INSTRUMENTS.filter((inst) => {
      if (instVendor !== 'all' && inst.vendor !== instVendor) return false;
      if (!q) return true;
      return (
        inst.pluginName.toLowerCase().includes(q) ||
        inst.patchName.toLowerCase().includes(q) ||
        inst.category.toLowerCase().includes(q) ||
        inst.description.toLowerCase().includes(q)
      );
    });
  }, [instVendor, isFx, search]);

  const headingTitle = isFx
    ? mode.replacePlugin
      ? `Replace ${getFxPluginMeta(mode.replacePlugin).shortName}`
      : `Insert Audio FX Plugin`
    : mode.track
      ? `Replace Instrument on ${mode.track.name}`
      : `Add Instrument Plugin`;

  const headingSub = isFx
    ? `${mode.track.name} · Pick any UAD, FL Studio, FabFilter, Soundtoys, or Logic plugin`
    : mode.track
      ? `Swaps the VST generator while keeping all MIDI notes, mixer sends & FX intact`
      : `Choose an Omnisphere 2, Kontakt 7, or FL Studio Stock synth to open in the Channel Rack`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-[#1C1F27] border border-[#434B5D] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Top Picker Header */}
        <div className="logic-toolbar-bg px-5 py-3 border-b border-[#13151B] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close plugin picker"
              className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:brightness-110 flex items-center justify-center text-[#5A0E0B] shrink-0"
            >
              <X className="w-2.5 h-2.5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isReplace ? (
                  <ArrowLeftRight className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-sky-400 shrink-0" />
                )}
                <h2 className="text-sm font-bold text-[#F3F4F6] truncate">{headingTitle}</h2>
              </div>
              <p className="text-[11px] text-[#9CA3AF] truncate">{headingSub}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#181B22] hover:bg-[#262B36] border border-[#383F4F] text-xs font-medium text-[#CBD5E1] shrink-0 whitespace-nowrap"
          >
            Cancel
          </button>
        </div>

        {/* Search & Suite Filter Toolbar */}
        <div className="px-5 py-3 bg-[#151820] border-b border-[#29303E] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-[#0F1218] p-1 rounded-lg border border-[#2A3140] overflow-x-auto">
            {isFx
              ? FX_SUITE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFxSuite(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      fxSuite === tab.id
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))
              : INST_VENDOR_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInstVendor(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      instVendor === tab.id
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isFx ? 'Search EQ, Reverb, Auto-Tune, Gross Beat...' : 'Search Omnisphere, Kontakt, Sytrus...'}
              className="w-full bg-[#0F1218] border border-[#30384A] focus:border-sky-500 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#64748B] outline-none"
            />
          </div>
        </div>

        {/* Visual Plugin Grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#181B23]">
          {isFx ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredFx.map((plugin) => {
                const isCurrentSlot = mode.replacePlugin === plugin.id;
                const alreadyActive = mode.track.fx?.[plugin.id]?.enabled;
                return (
                  <button
                    key={plugin.id}
                    type="button"
                    onClick={() => {
                      onPickFx(mode.track.id, plugin.id, mode.replacePlugin);
                      onClose();
                    }}
                    className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-2.5 group ${
                      isCurrentSlot
                        ? 'bg-[#222B3B] border-sky-400/75'
                        : 'bg-[#1D212B] border-[#2E3545] hover:border-sky-400/60 hover:bg-[#232936]'
                    }`}
                  >
                    <div className="space-y-2 w-full">
                      <div className="bg-[#11141C] border border-[#262D3B] rounded-md px-2 py-1">
                        {renderMiniFaceplate(plugin.accent, plugin.id)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F3F4F6] group-hover:text-white truncate">
                          {plugin.name}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                          {plugin.vendor} · {plugin.role}
                          {alreadyActive ? ' · Active on Track' : ''}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8E98A8] leading-snug line-clamp-2">
                        {plugin.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-[#2A303E] text-[11px] font-semibold">
                      <span className="text-[#94A3B8]">
                        {isCurrentSlot ? 'Loaded in Slot' : mode.replacePlugin ? 'Click to Replace' : 'Click to Insert'}
                      </span>
                      <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform">
                        {mode.replacePlugin ? 'Replace →' : 'Open →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInstruments.map((inst) => {
                const isLoaded = mode.track && getInstrumentInfo(mode.track.preset).preset === inst.preset;
                return (
                  <div
                    key={inst.preset}
                    onClick={() => {
                      onPickInstrument(inst, mode.track?.id);
                      onClose();
                    }}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between gap-2.5 group ${
                      isLoaded
                        ? 'bg-[#222B3B] border-sky-400/75'
                        : 'bg-[#1D212B] border-[#2E3545] hover:border-sky-400/60 hover:bg-[#232936]'
                    }`}
                  >
                    <div className="space-y-2 w-full">
                      <div className="bg-[#11141C] border border-[#262D3B] rounded-md px-2 py-1">
                        {renderMiniFaceplate(inst.accent, inst.preset)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F3F4F6] group-hover:text-white truncate">
                          {inst.pluginName} — {inst.patchName}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                          {inst.category}
                          {isLoaded ? ' · Currently Loaded' : ''}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8E98A8] leading-snug line-clamp-2">
                        {inst.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-[#2A303E]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          audioEngine.triggerPresetPreview(inst.preset, 60, 0.7);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#262C3A] hover:bg-[#343C4F] text-[11px] font-medium text-sky-300 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Audition</span>
                      </button>
                      <span className="text-[11px] font-semibold text-sky-400">
                        {mode.track ? 'Replace & Open →' : 'Insert & Open →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
