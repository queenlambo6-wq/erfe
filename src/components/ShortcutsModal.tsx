import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_GROUPS: {
  title: string;
  accent: string;
  items: { keys: string; desc: string }[];
}[] = [
  {
    title: 'FL Studio Window Navigation',
    accent: 'text-orange-400',
    items: [
      { keys: 'F5', desc: 'Playlist / Tracks Arrangement View' },
      { keys: 'F6', desc: 'Channel Rack & Step Sequencer' },
      { keys: 'F7', desc: 'Piano Roll MIDI Editor' },
      { keys: 'F8', desc: 'Toggle Sample Bank & VST Plugin Browser' },
      { keys: 'F9', desc: 'Mixer Console & Aux Buses (Bus 1–4)' },
      { keys: 'F10', desc: 'Mastering Assistant Suite' },
      { keys: 'F1 / ?', desc: 'Open / Close Keyboard Shortcuts Cheatsheet' },
    ],
  },
  {
    title: 'Transport & Recording (FL + Logic)',
    accent: 'text-sky-400',
    items: [
      { keys: 'Space', desc: 'Play / Pause Playback' },
      { keys: 'R', desc: 'Start / Stop Mono Mic Recording' },
      { keys: 'L', desc: 'Toggle Loop / Pattern Cycle Mode' },
      { keys: 'Ctrl + M', desc: 'Toggle Metronome Click' },
      { keys: 'Ctrl + B', desc: 'Bounce / Export Mastered WAV' },
      { keys: 'Home / 0', desc: 'Return Playhead to Bar 1' },
    ],
  },
  {
    title: 'Logic Pro & Ableton Live Workflows',
    accent: 'text-emerald-400',
    items: [
      { keys: 'Tab', desc: 'Toggle Ableton Session View ↔ Tracks' },
      { keys: 'A', desc: 'Show / Hide Logic Track Automation Lanes' },
      { keys: 'I', desc: 'Toggle Left Logic Channel Strip Inspector' },
      { keys: 'Shift + Click', desc: 'Channel Rack Ghost Note (Soft Velocity)' },
      { keys: 'Right-Click', desc: 'Erase Step Pad in Channel Rack' },
      { keys: 'A – K Keys', desc: 'Play Live Chords & Notes in Piano Roll' },
    ],
  },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-[#1E2129] border border-[#434A5B] rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="logic-toolbar-bg px-4 py-2.5 border-b border-[#13151A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-[#F3F4F6]">
              FL Studio · Logic Pro · Ableton Keyboard Shortcuts
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#2E3442] text-[#9CA3AF] hover:text-white"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div
              key={group.title}
              className="bg-[#151820] border border-[#2A303E] rounded-lg p-3.5 space-y-2.5"
            >
              <h3 className={`text-xs font-bold tracking-tight ${group.accent}`}>
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-start justify-between gap-2 text-[11px]"
                  >
                    <kbd className="px-1.5 py-0.5 rounded bg-[#232836] border border-[#3B4355] font-mono-tabular text-[10px] font-semibold text-[#F3F4F6] whitespace-nowrap shrink-0">
                      {item.keys}
                    </kbd>
                    <span className="text-[#CBD5E1] text-right leading-snug">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-2.5 bg-[#161921] border-t border-[#282E3B] flex items-center justify-between text-[11px] text-[#9CA3AF]">
          <span>Tip: Press F8 anytime to open the Sample Bank, Omnisphere 2, Kontakt 7 &amp; FL Stock Browser.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#2563EB] hover:bg-[#3B82F6] text-white font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
