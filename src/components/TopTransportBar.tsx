import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Disc,
  Download,
  FolderOpen,
  Headphones,
  Info,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  Music,
  Pause,
  Play,
  Repeat,
  SkipBack,
  Sliders,
  Sparkles,
  Square,
  Users,
  Volume2,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { MUSICAL_KEYS } from '../data/presets';
import type { StudioProject, StudioView } from '../types/studio';

interface TopTransportBarProps {
  project: StudioProject;
  roomId: string;
  connected: boolean;
  collaboratorCount: number;
  inVoiceCount: number;
  activeView: StudioView;
  onSelectView: (view: StudioView) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  browserOpen: boolean;
  onToggleBrowser: () => void;
  onOpenShortcuts: () => void;
  isPlaying: boolean;
  isRecording: boolean;
  isLooping: boolean;
  metronomeOn: boolean;
  currentStep: number;
  onTogglePlay: () => void;
  onStop: () => void;
  onRewind: () => void;
  onToggleRecord: () => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onUpdateMeta: (meta: Partial<Pick<StudioProject, 'title' | 'bpm' | 'swing' | 'musicalKey'>>) => void;
  onExportWav: () => void;
  isExporting: boolean;
  collabDockOpen: boolean;
  onToggleCollabDock: () => void;
  onSwitchRoom: (newRoomId: string) => void;
}

export const TopTransportBar: React.FC<TopTransportBarProps> = ({
  project,
  roomId,
  connected,
  collaboratorCount,
  inVoiceCount,
  activeView,
  onSelectView,
  inspectorOpen,
  onToggleInspector,
  browserOpen,
  onToggleBrowser,
  onOpenShortcuts,
  isPlaying,
  isRecording,
  isLooping,
  metronomeOn,
  currentStep,
  onTogglePlay,
  onStop,
  onRewind,
  onToggleRecord,
  onToggleLoop,
  onToggleMetronome,
  onUpdateMeta,
  onExportWav,
  isExporting,
  collabDockOpen,
  onToggleCollabDock,
  onSwitchRoom,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [vuLevels, setVuLevels] = useState({ left: 0, right: 0 });
  const inviteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleDraft(project.title);
  }, [project.title]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = audioEngine.getMasterStereoLevels();
      setVuLevels({ left: s.left, right: s.right });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!inviteOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) {
        setInviteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inviteOpen]);

  const bar = Math.floor(currentStep / 16) + 1;
  const beat = Math.floor((currentStep % 16) / 4) + 1;
  const sub = (currentStep % 4) + 1;

  const commitTitle = () => {
    setEditingTitle(false);
    const cleaned = titleDraft.trim();
    if (cleaned && cleaned !== project.title) {
      onUpdateMeta({ title: cleaned });
    } else {
      setTitleDraft(project.title);
    }
  };

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  const handleCreateNewRoom = () => {
    const randomId = `STUDIO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    onSwitchRoom(randomId);
    setInviteOpen(false);
  };

  const handleJoinCustomRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) return;
    onSwitchRoom(cleaned);
    setJoinCode('');
    setInviteOpen(false);
  };

  const viewTabs: { id: StudioView; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'arrangement', label: 'Tracks', shortcut: 'F5', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'session', label: 'Session', shortcut: 'Tab', icon: <LayoutGrid className="w-3.5 h-3.5 text-emerald-300" /> },
    { id: 'beats', label: 'Rack', shortcut: 'F6', icon: <Disc className="w-3.5 h-3.5 text-orange-400" /> },
    { id: 'pianoroll', label: 'Piano Roll', shortcut: 'F7', icon: <Music className="w-3.5 h-3.5" /> },
    { id: 'mixer', label: 'Mixer', shortcut: 'F9', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'mastering', label: 'Master', shortcut: 'F10', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-14 logic-toolbar-bg border-b border-[#14161A] px-3.5 flex items-center justify-between gap-3 shrink-0 z-30">
      {/* Left Zone: Logic Inspector Toggle + FL Browser Toggle + Brand + Project Title + Room */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleInspector}
          title="Toggle Channel Strip Inspector (I)"
          className={`w-7 h-7 rounded flex items-center justify-center border transition-colors shrink-0 ${
            inspectorOpen
              ? 'bg-[#2563EB] border-sky-400/60 text-white'
              : 'bg-[#1F2228] border-[#3A3F4B] text-[#9CA3AF] hover:text-white'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onToggleBrowser}
          title="Sample Bank & VST Instrument Browser (F8)"
          className={`w-7 h-7 rounded flex items-center justify-center border transition-colors shrink-0 ${
            browserOpen && activeView === 'beats'
              ? 'bg-orange-600 border-orange-400/60 text-white'
              : 'bg-[#1F2228] border-[#3A3F4B] text-orange-400 hover:text-orange-300'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-gradient-to-b from-sky-400 to-blue-600 text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
            TR
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#F3F4F6] whitespace-nowrap">
            TrackRoom
          </span>
        </div>

        <span className="text-[#4B5563] select-none" aria-hidden="true">/</span>

        {editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setTitleDraft(project.title);
                setEditingTitle(false);
              }
            }}
            className="bg-[#11141A] border border-sky-500/70 rounded px-2 py-0.5 text-xs font-medium text-white w-36 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            title="Rename project"
            className="text-xs font-medium text-[#D1D5DB] hover:text-white truncate max-w-[130px] text-left transition-colors"
          >
            {project.title}
          </button>
        )}

        <div className="relative" ref={inviteRef}>
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1E2128] hover:bg-[#2A2E38] border border-[#3C414E] text-[11px] font-medium text-[#E5E7EB] transition-colors whitespace-nowrap shrink-0"
          >
            <Link2 className="w-3 h-3 text-sky-400" />
            <span className="font-mono-tabular">{roomId}</span>
          </button>

          {inviteOpen && (
            <div className="absolute left-0 top-9 w-80 bg-[#23262E] border border-[#424856] rounded-lg shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">Live Studio Collaboration</h3>
                <span className="text-xs text-[#9CA3AF]">
                  {connected ? `${collaboratorCount} online` : 'Reconnecting...'}
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed mb-3">
                Share this room link so bandmates can edit tracks, dial mixing &amp; mastering plugins, record vocals, and talk live.
              </p>

              <button
                type="button"
                onClick={handleCopyInvite}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-[#2563EB] hover:bg-[#3B82F6] text-white text-xs font-semibold transition-colors mb-3"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Invite Link Copied' : 'Copy Session Invite Link'}
              </button>

              <div className="border-t border-[#353A46] pt-3 mt-1">
                <form onSubmit={handleJoinCustomRoom} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Enter room code..."
                    className="flex-1 bg-[#14171D] border border-[#383E4C] rounded px-2.5 py-1.5 text-xs text-white placeholder:text-[#6B7280] outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-[#343946] hover:bg-[#414757] text-xs font-medium text-white whitespace-nowrap"
                  >
                    Join
                  </button>
                </form>
                <button
                  type="button"
                  onClick={handleCreateNewRoom}
                  className="w-full py-1 text-xs text-[#9CA3AF] hover:text-sky-400 text-left transition-colors"
                >
                  + Start a fresh private room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Zone: Authentic Logic Pro Transport & Dark-Glass LCD */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Logic Transport Cluster */}
        <div className="flex items-center bg-[#1D2026] border border-[#3A3F4B] rounded-md p-0.5 shadow-inner">
          <button
            type="button"
            onClick={onRewind}
            title="Return to Bar 1"
            className="w-7 h-7 flex items-center justify-center rounded text-[#B4BCC8] hover:text-white hover:bg-[#2F3440] transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onStop}
            title="Stop"
            className="w-7 h-7 flex items-center justify-center rounded text-[#B4BCC8] hover:text-white hover:bg-[#2F3440] transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors ${
              isPlaying
                ? 'bg-emerald-500/25 text-emerald-400'
                : 'text-[#E5E7EB] hover:text-white hover:bg-[#2F3440]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={onToggleRecord}
            title={isRecording ? 'Stop Recording' : 'Record Mic onto Armed Audio Track'}
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors ${
              isRecording
                ? 'bg-red-600 text-white'
                : 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
            }`}
          >
            <Disc className={`w-3.5 h-3.5 ${isRecording ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            title="Cycle Loop"
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              isLooping
                ? 'bg-amber-500/25 text-amber-400'
                : 'text-[#9CA3AF] hover:text-white hover:bg-[#2F3440]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Logic Pro Dark-Glass LCD Display */}
        <div className="hidden lg:flex items-center gap-3.5 logic-lcd border border-[#3E4452] rounded-md px-3.5 h-9">
          <div className="flex flex-col leading-none">
            <span className="text-[9px] text-[#6B7280] font-medium">BAR · BEAT</span>
            <span className="font-mono-tabular text-sm font-semibold text-sky-400 tracking-wider">
              {String(bar).padStart(2, '0')} {beat} {sub}
            </span>
          </div>

          <div className="w-px h-5 bg-[#262D3B]" />

          <div className="flex flex-col leading-none">
            <span className="text-[9px] text-[#6B7280] font-medium">TEMPO</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onUpdateMeta({ bpm: Math.max(50, project.bpm - 1) })}
                className="text-[#6B7280] hover:text-white text-xs px-0.5"
                aria-label="Decrease BPM"
              >
                -
              </button>
              <input
                type="number"
                min={50}
                max={200}
                value={project.bpm}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) onUpdateMeta({ bpm: Math.max(50, Math.min(200, val)) });
                }}
                className="w-10 bg-transparent text-center font-mono-tabular text-sm font-semibold text-[#F3F4F6] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => onUpdateMeta({ bpm: Math.min(200, project.bpm + 1) })}
                className="text-[#6B7280] hover:text-white text-xs px-0.5"
                aria-label="Increase BPM"
              >
                +
              </button>
            </div>
          </div>

          <div className="w-px h-5 bg-[#262D3B]" />

          <div className="flex flex-col leading-none">
            <span className="text-[9px] text-[#6B7280] font-medium">KEY · 4/4</span>
            <select
              value={project.musicalKey}
              onChange={(e) => onUpdateMeta({ musicalKey: e.target.value })}
              className="bg-transparent text-xs font-semibold text-[#E5E7EB] outline-none cursor-pointer -ml-0.5"
            >
              {Object.keys(MUSICAL_KEYS).map((k) => (
                <option key={k} value={k} className="bg-[#1D2027] text-white">
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-[#262D3B]" />

          {/* Stereo Out Mini Meter inside LCD */}
          <div className="flex flex-col gap-1 w-14" title="Stereo Out Level">
            <div className="h-1.5 bg-[#1B2230] rounded-xs overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75"
                style={{ width: `${Math.round(vuLevels.left * 100)}%` }}
              />
            </div>
            <div className="h-1.5 bg-[#1B2230] rounded-xs overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-[width] duration-75"
                style={{ width: `${Math.round(vuLevels.right * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Logic Metronome Button (Purple active) */}
        <button
          type="button"
          onClick={onToggleMetronome}
          title="Metronome Click"
          className={`h-8 px-2 rounded-md border text-xs font-medium flex items-center gap-1 transition-colors ${
            metronomeOn
              ? 'bg-violet-600/30 border-violet-400/60 text-violet-300'
              : 'bg-[#1E2128] border-[#3A3F4B] text-[#9CA3AF] hover:text-white'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Zone: Workspace Switcher + Bounce WAV + Call & Chat */}
      <div className="flex items-center gap-2 shrink-0">
        <nav
          aria-label="Logic Pro workspace views"
          className="flex items-center bg-[#1B1E24] border border-[#3A3F4B] rounded-md p-0.5"
        >
          {viewTabs.map((tab) => {
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                title={`${tab.label} (${tab.shortcut})`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="hidden xl:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onOpenShortcuts}
          title="FL Studio & Logic Keyboard Shortcuts (F1)"
          className="w-7 h-7 rounded-md bg-[#1E2128] hover:bg-[#2B303B] border border-[#3C414E] text-[#CBD5E1] hover:text-orange-300 flex items-center justify-center transition-colors shrink-0"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onExportWav}
          disabled={isExporting}
          title="Bounce Mastered Stereo WAV (Ctrl+B)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1E2128] hover:bg-[#2B303B] border border-[#3C414E] text-xs font-medium text-[#E5E7EB] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden 2xl:inline">{isExporting ? 'Bouncing...' : 'Bounce WAV'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleCollabDock}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            collabDockOpen
              ? 'bg-[#2563EB] text-white border-sky-400/60'
              : 'bg-[#1E2128] text-[#E5E7EB] border-[#3C414E] hover:bg-[#2B303B]'
          }`}
        >
          {inVoiceCount > 0 ? <Headphones className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
          <span>Call &amp; Chat</span>
          <span className="font-mono-tabular opacity-85">({collaboratorCount})</span>
        </button>
      </div>
    </header>
  );
};
