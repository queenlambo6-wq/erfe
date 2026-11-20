import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Trash2 } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { INDUSTRY_INSTRUMENTS } from '../data/instruments';
import { isBlackKey, midiToNoteName, MUSICAL_KEYS } from '../data/presets';
import type { MidiNote, StudioProject, StudioTrack, SynthPreset } from '../types/studio';

interface PianoRollViewProps {
  project: StudioProject;
  selectedTrackId: string;
  currentStep: number;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, updates: Partial<StudioTrack>) => void;
  onOpenInstrument: (trackId: string) => void;
  onAddNote: (note: MidiNote) => void;
  onUpdateNote: (noteId: string, updates: Partial<MidiNote>) => void;
  onDeleteNote: (noteId: string) => void;
  onClearTrackNotes: (trackId: string) => void;
}

const MIN_PITCH = 36; // C2
const MAX_PITCH = 83; // B5
const ROW_HEIGHT = 22;
const STEP_WIDTH = 24;

// Computer keyboard mapping (A-K = C4-C5)
const KEY_TO_MIDI: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
  o: 73,
  l: 74,
};

export const PianoRollView: React.FC<PianoRollViewProps> = ({
  project,
  selectedTrackId,
  currentStep,
  isPlaying,
  onSelectTrack,
  onUpdateTrack,
  onOpenInstrument,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onClearTrackNotes,
}) => {
  const synthTracks = useMemo(
    () => project.tracks.filter((t) => t.type === 'synth'),
    [project.tracks]
  );

  const activeTrack =
    synthTracks.find((t) => t.id === selectedTrackId) || synthTracks[0] || null;

  const [noteLength, setNoteLength] = useState<number>(4); // default quarter note (4 x 16ths)
  const [highlightScale, setHighlightScale] = useState<boolean>(true);
  const [activeKeyPitch, setActiveKeyPitch] = useState<number | null>(null);
  const [resizingNote, setResizingNote] = useState<{
    noteId: string;
    startX: number;
    initialDur: number;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSteps = project.totalBars * 16;

  const pitches = useMemo(() => {
    const arr: number[] = [];
    for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
      arr.push(p);
    }
    return arr;
  }, []);

  const scalePitchClasses = useMemo(
    () => new Set(MUSICAL_KEYS[project.musicalKey] || MUSICAL_KEYS['C Minor']),
    [project.musicalKey]
  );

  const trackNotes = useMemo(
    () => (activeTrack ? project.notes.filter((n) => n.trackId === activeTrack.id) : []),
    [activeTrack, project.notes]
  );

  // Scroll to middle C4 area on initial mount
  useEffect(() => {
    if (scrollRef.current) {
      const c4Index = MAX_PITCH - 68;
      scrollRef.current.scrollTop = Math.max(0, c4Index * ROW_HEIGHT);
    }
  }, []);

  // Computer keyboard live jamming
  useEffect(() => {
    if (!activeTrack) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const pitch = KEY_TO_MIDI[e.key.toLowerCase()];
      if (pitch !== undefined) {
        audioEngine.triggerNoteLive(activeTrack, pitch, 0.35, 0.8);
        setActiveKeyPitch(pitch);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const pitch = KEY_TO_MIDI[e.key.toLowerCase()];
      if (pitch !== undefined) {
        setActiveKeyPitch((prev) => (prev === pitch ? null : prev));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTrack]);

  // Note resize drag handling
  useEffect(() => {
    if (!resizingNote) return;
    const handleMove = (e: MouseEvent) => {
      const deltaSteps = Math.round((e.clientX - resizingNote.startX) / STEP_WIDTH);
      const nextDur = Math.max(1, Math.min(32, resizingNote.initialDur + deltaSteps));
      onUpdateNote(resizingNote.noteId, { durationSteps: nextDur });
    };
    const handleUp = () => {
      setResizingNote(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [onUpdateNote, resizingNote]);

  if (!activeTrack) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#94A3B8]">
        Add an Instrument track in Arrangement view to compose MIDI melodies.
      </div>
    );
  }

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, pitch: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const step = Math.floor((e.clientX - rect.left) / STEP_WIDTH);
    if (step < 0 || step >= totalSteps) return;

    // Check if clicking an existing note cell -> delete it
    const existing = trackNotes.find(
      (n) => n.pitch === pitch && step >= n.startStep && step < n.startStep + n.durationSteps
    );
    if (existing) {
      onDeleteNote(existing.id);
      return;
    }

    const clampedDuration = Math.min(noteLength, totalSteps - step);
    const newNote: MidiNote = {
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      trackId: activeTrack.id,
      pitch,
      startStep: step,
      durationSteps: clampedDuration,
      velocity: 0.78,
    };
    onAddNote(newNote);
    audioEngine.triggerNoteLive(activeTrack, pitch, 0.28, 0.8);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1B1D22]">
      {/* Piano Roll Toolbar */}
      <div className="h-10 px-4 bg-[#252830] border-b border-[#14161A] flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          {/* Track Selector */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: activeTrack.color }}
            />
            <select
              value={activeTrack.id}
              onChange={(e) => onSelectTrack(e.target.value)}
              className="bg-[#0F1218] border border-[#2C3444] rounded px-2 py-1 text-xs font-semibold text-[#F1F3F7] outline-none cursor-pointer"
            >
              {synthTracks.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#161A22]">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Synth Sound Preset (Omnisphere 2 / Kontakt 7 / FL Stock) */}
          <select
            value={activeTrack.preset || 'kontakt-rhodes'}
            onChange={(e) =>
              onUpdateTrack(activeTrack.id, { preset: e.target.value as SynthPreset })
            }
            className="bg-[#0F1218] border border-[#2C3444] rounded px-2 py-1 text-xs text-[#CBD5E1] outline-none cursor-pointer max-w-[200px]"
          >
            {INDUSTRY_INSTRUMENTS.map((inst) => (
              <option key={inst.preset} value={inst.preset} className="bg-[#161A22]">
                {inst.pluginName} · {inst.patchName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onOpenInstrument(activeTrack.id)}
            className="px-2 py-1 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/45 text-[11px] font-semibold text-sky-200 whitespace-nowrap"
          >
            Open VST
          </button>

          <span className="text-[#3A4152]" aria-hidden="true">|</span>

          {/* Note Length Selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#7C8698] mr-1">Note:</span>
            {[
              { steps: 1, label: '1/16' },
              { steps: 2, label: '1/8' },
              { steps: 4, label: '1/4' },
              { steps: 8, label: '1/2' },
            ].map((opt) => (
              <button
                key={opt.steps}
                type="button"
                onClick={() => setNoteLength(opt.steps)}
                className={`px-2 py-1 rounded text-xs font-mono-tabular transition-colors ${
                  noteLength === opt.steps
                    ? 'bg-amber-500 text-[#111317] font-semibold'
                    : 'bg-[#202633] text-[#94A3B8] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHighlightScale((v) => !v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
              highlightScale
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'bg-[#1D222C] border-[#2C3444] text-[#8E98A8]'
            }`}
          >
            Scale Guide: {project.musicalKey}
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#7C8698]">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Keys A–K play live</span>
          </div>
          <button
            type="button"
            onClick={() => onClearTrackNotes(activeTrack.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#212734] hover:bg-red-600/20 border border-[#2F3748] text-xs font-medium text-[#CBD5E1] hover:text-red-300 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Track</span>
          </button>
        </div>
      </div>

      {/* Scrollable Piano + Grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <div className="flex" style={{ width: `${88 + totalSteps * STEP_WIDTH}px` }}>
          {/* Sticky Bar Header Row */}
          <div className="sticky top-0 z-30 flex w-full">
            <div className="sticky left-0 z-40 w-[88px] h-7 bg-[#151820] border-r border-b border-[#262C38] flex items-center justify-center text-[10px] font-mono-tabular text-[#64748B] shrink-0">
              PITCH
            </div>
            <div
              className="flex h-7 bg-[#151820] border-b border-[#262C38] relative"
              style={{ width: `${totalSteps * STEP_WIDTH}px` }}
            >
              {Array.from({ length: project.totalBars * 4 }).map((_, beatIdx) => {
                const isBar = beatIdx % 4 === 0;
                const barNum = Math.floor(beatIdx / 4) + 1;
                const beatNum = (beatIdx % 4) + 1;
                return (
                  <div
                    key={beatIdx}
                    style={{ width: `${STEP_WIDTH * 4}px` }}
                    className={`border-l ${
                      isBar ? 'border-[#3A4356]' : 'border-[#222834]'
                    } pl-1.5 flex items-center font-mono-tabular text-[11px] ${
                      isBar ? 'text-[#E6E9EF] font-semibold' : 'text-[#5C6678]'
                    }`}
                  >
                    {isBar ? `Bar ${barNum}` : `${barNum}.${beatNum}`}
                  </div>
                );
              })}
              {/* Playhead marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none"
                style={{ left: `${currentStep * STEP_WIDTH}px` }}
              />
            </div>
          </div>
        </div>

        {/* Main Pitch Rows */}
        <div className="flex relative" style={{ width: `${88 + totalSteps * STEP_WIDTH}px` }}>
          {/* Sticky Left Piano Keyboard */}
          <div className="sticky left-0 z-20 w-[88px] shrink-0 bg-[#12151C] border-r border-[#262C38]">
            {pitches.map((pitch) => {
              const black = isBlackKey(pitch);
              const inScale = scalePitchClasses.has(pitch % 12);
              const isC = pitch % 12 === 0;
              const isActiveKey = activeKeyPitch === pitch;
              return (
                <button
                  key={pitch}
                  type="button"
                  onMouseDown={() => {
                    setActiveKeyPitch(pitch);
                    audioEngine.triggerNoteLive(activeTrack, pitch, 0.35, 0.82);
                  }}
                  onMouseUp={() => setActiveKeyPitch(null)}
                  onMouseLeave={() => setActiveKeyPitch(null)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={`w-full px-2 flex items-center justify-between border-b border-[#222733] text-[10px] font-mono-tabular transition-colors ${
                    isActiveKey
                      ? 'bg-amber-500 text-[#111317] font-bold'
                      : black
                        ? 'bg-[#171B23] text-[#7C8698] hover:bg-[#232938]'
                        : 'bg-[#262C3A] text-[#E2E8F0] hover:bg-[#323A4C]'
                  }`}
                >
                  <span className={isC ? 'font-bold text-amber-300' : ''}>
                    {midiToNoteName(pitch)}
                  </span>
                  {highlightScale && inScale && !isActiveKey && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400/70" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Interactive MIDI Note Grid */}
          <div className="relative" style={{ width: `${totalSteps * STEP_WIDTH}px` }}>
            {pitches.map((pitch) => {
              const black = isBlackKey(pitch);
              const inScale = scalePitchClasses.has(pitch % 12);
              const rowNotes = trackNotes.filter((n) => n.pitch === pitch);

              return (
                <div
                  key={pitch}
                  onClick={(e) => handleGridClick(e, pitch)}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    backgroundSize: `${STEP_WIDTH * 4}px ${ROW_HEIGHT}px`,
                  }}
                  className={`relative border-b border-[#1D222D] cursor-crosshair ${
                    highlightScale && inScale
                      ? black
                        ? 'bg-[#181D27]'
                        : 'bg-[#1C222E]'
                      : black
                        ? 'bg-[#11141B]'
                        : 'bg-[#141821]'
                  }`}
                >
                  {/* Subtle vertical grid lines */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(58,67,86,0.45) 1px, transparent 1px), linear-gradient(to right, rgba(35,41,54,0.6) 1px, transparent 1px)`,
                      backgroundSize: `${STEP_WIDTH * 16}px 100%, ${STEP_WIDTH * 4}px 100%`,
                    }}
                  />

                  {/* Rendered Notes in Row */}
                  {rowNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      title={`${midiToNoteName(note.pitch)} · Click to delete, drag right edge to resize`}
                      style={{
                        left: `${note.startStep * STEP_WIDTH + 1}px`,
                        width: `${Math.max(STEP_WIDTH - 2, note.durationSteps * STEP_WIDTH - 2)}px`,
                        backgroundColor: activeTrack.color,
                      }}
                      className="absolute top-[2px] bottom-[2px] rounded-[3px] px-1.5 flex items-center justify-between text-[10px] font-mono-tabular font-semibold text-[#111317] shadow-xs hover:brightness-110 cursor-pointer select-none z-10 group"
                    >
                      <span className="truncate pointer-events-none">
                        {note.durationSteps >= 2 ? midiToNoteName(note.pitch) : ''}
                      </span>
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingNote({
                            noteId: note.id,
                            startX: e.clientX,
                            initialDur: note.durationSteps,
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-2 h-full cursor-ew-resize absolute right-0 top-0 bottom-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-r-[3px]"
                      />
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Playhead Overlay Line */}
            <div
              className={`absolute top-0 bottom-0 w-0.5 pointer-events-none z-20 ${
                isPlaying ? 'bg-amber-400' : 'bg-amber-400/50'
              }`}
              style={{ left: `${currentStep * STEP_WIDTH}px` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
