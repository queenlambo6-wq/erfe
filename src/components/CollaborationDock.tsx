import React, { useEffect, useRef, useState } from 'react';
import {
  Headphones,
  HeadphoneOff,
  MapPin,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  User,
  X,
} from 'lucide-react';
import type { ChatMessage, Collaborator } from '../types/studio';

interface CollaborationDockProps {
  collaborators: Collaborator[];
  selfId: string;
  userName: string;
  onChangeUserName: (name: string) => void;
  messages: ChatMessage[];
  currentStep: number;
  onSendMessage: (text: string, barMarker?: number) => void;
  onJumpToBar: (barMarker: number) => void;
  // Voice room props
  inCall: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  micLevel: number;
  voiceError: string | null;
  connectedPeerCount: number;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onClearVoiceError: () => void;
}

const VIEW_LABELS: Record<string, string> = {
  arrangement: 'Tracks',
  beats: 'Step Sequencer',
  pianoroll: 'Piano Roll',
  mixer: 'Mixer',
  mastering: 'Mastering',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const CollaborationDock: React.FC<CollaborationDockProps> = ({
  collaborators,
  selfId,
  userName,
  onChangeUserName,
  messages,
  currentStep,
  onSendMessage,
  onJumpToBar,
  inCall,
  isMuted,
  isDeafened,
  micLevel,
  voiceError,
  connectedPeerCount,
  onJoinCall,
  onLeaveCall,
  onToggleMute,
  onToggleDeafen,
  onClearVoiceError,
}) => {
  const [draft, setDraft] = useState('');
  const [pinBar, setPinBar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(userName);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNameDraft(userName);
  }, [userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const currentBarDecimal = Number(
    (Math.floor(currentStep / 16) + 1 + Math.floor((currentStep % 16) / 4) * 0.1 + 0.1).toFixed(1)
  );

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned) return;
    onSendMessage(cleaned, pinBar ? currentBarDecimal : undefined);
    setDraft('');
    setPinBar(false);
  };

  const commitName = () => {
    setEditingName(false);
    if (nameDraft.trim()) {
      onChangeUserName(nameDraft.trim());
    } else {
      setNameDraft(userName);
    }
  };

  const voiceParticipants = collaborators.filter((c) => c.inVoice);

  return (
    <aside className="w-80 shrink-0 bg-[#15181F] border-l border-[#262C38] flex flex-col min-h-0">
      {/* Voice Communication Studio Panel (Zoom-style) */}
      <div className="p-4 border-b border-[#262C38] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold text-[#F1F3F7]">Studio Voice Call</h2>
            <p className="text-[11px] text-[#7C8698]">
              {voiceParticipants.length > 0
                ? `${voiceParticipants.length} in live audio room`
                : 'Talk live with bandmates while producing'}
            </p>
          </div>
          {inCall && (
            <span className="font-mono-tabular text-[11px] font-medium text-emerald-400">
              {connectedPeerCount > 0 ? `${connectedPeerCount} peer${connectedPeerCount > 1 ? 's' : ''}` : 'Live'}
            </span>
          )}
        </div>

        {/* Voice Action Controls */}
        {!inCall ? (
          <button
            type="button"
            onClick={onJoinCall}
            className="w-full py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Join Live Audio Call</span>
          </button>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={onToggleMute}
                className={`py-2 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  isMuted
                    ? 'bg-red-600/20 border-red-500/50 text-red-300'
                    : 'bg-[#202633] border-[#2E3648] text-[#E6E9EF] hover:bg-[#2A3242]'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleDeafen}
                className={`py-2 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  isDeafened
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-[#202633] border-[#2E3648] text-[#E6E9EF] hover:bg-[#2A3242]'
                }`}
              >
                {isDeafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                <span>{isDeafened ? 'Deaf' : 'Audio'}</span>
              </button>

              <button
                type="button"
                onClick={onLeaveCall}
                className="py-2 px-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            </div>

            {/* Live Microphone Input Bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#7C8698] shrink-0">Mic Level</span>
              <div className="flex-1 h-1.5 bg-[#0D0F14] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-[width] duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {voiceError && (
          <div className="mt-2.5 p-2 rounded bg-red-950/60 border border-red-500/40 text-[11px] text-red-200 flex items-start justify-between gap-2">
            <span>{voiceError}</span>
            <button type="button" onClick={onClearVoiceError} className="text-red-300 hover:text-white shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Musicians List */}
        <div className="mt-3 pt-3 border-t border-[#222734]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#8E98A8]">
              In Studio · {collaborators.length}
            </span>
            {editingName ? (
              <input
                type="text"
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') {
                    setNameDraft(userName);
                    setEditingName(false);
                  }
                }}
                className="bg-[#0D1016] border border-amber-500/60 rounded px-1.5 py-0.5 text-[11px] text-[#F1F3F7] w-28 outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1 text-[11px] text-[#7C8698] hover:text-amber-400 transition-colors"
              >
                <User className="w-3 h-3" />
                <span>Edit Name</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {collaborators.map((member) => {
              const isSelf = member.id === selfId;
              const speaking = member.inVoice && !member.isMuted && member.isSpeaking;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-[#1B1F29]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-[#111317] shrink-0 transition-shadow ${
                        speaking ? 'ring-2 ring-emerald-400' : ''
                      }`}
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#E6E9EF] truncate">
                        {member.name} {isSelf && <span className="text-[#7C8698]">(You)</span>}
                      </div>
                      <div className="text-[10px] text-[#7C8698] truncate">
                        {member.inVoice
                          ? member.isMuted
                            ? 'Voice muted'
                            : speaking
                              ? 'Speaking now'
                              : 'In voice call'
                          : VIEW_LABELS[member.activeView] || 'Studio'}
                      </div>
                    </div>
                  </div>

                  {member.inVoice && (
                    <span className="shrink-0">
                      {member.isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Mic
                          className={`w-3.5 h-3.5 ${
                            speaking ? 'text-emerald-400' : 'text-[#8E98A8]'
                          }`}
                        />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Session Chat & Idea Feed */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2.5 border-b border-[#222734] flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-[#F1F3F7]">Session Chat &amp; Ideas</span>
          <span className="text-[11px] text-[#7C8698] font-mono-tabular">
            {messages.length} msg
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-[11px] text-[#7C8698] leading-relaxed px-1">
                  {msg.text}
                </div>
              );
            }

            const isMine = msg.senderId === selfId;
            return (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className="font-semibold truncate"
                    style={{ color: isMine ? '#F59E0B' : msg.senderColor }}
                  >
                    {msg.senderName}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-[#64748B] shrink-0">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="bg-[#1B1F29] border border-[#262D3B] rounded-md px-2.5 py-2 text-xs text-[#E2E8F0] leading-relaxed">
                  {typeof msg.barMarker === 'number' && (
                    <button
                      type="button"
                      onClick={() => onJumpToBar(msg.barMarker!)}
                      className="inline-flex items-center gap-1 mr-1.5 text-amber-400 hover:text-amber-300 font-mono-tabular text-[11px] font-semibold underline decoration-amber-500/40"
                    >
                      <MapPin className="w-3 h-3" />
                      Bar {msg.barMarker.toFixed(1)}
                    </button>
                  )}
                  <span className="break-words">{msg.text}</span>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Composer with Bar Pinning */}
        <form onSubmit={handleSubmitChat} className="p-3 border-t border-[#262C38] bg-[#13161D] shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPinBar((v) => !v)}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                pinBar ? 'text-amber-400' : 'text-[#7C8698] hover:text-[#CBD5E1]'
              }`}
            >
              <MapPin className="w-3 h-3" />
              <span>
                {pinBar
                  ? `Tagging Bar ${currentBarDecimal.toFixed(1)}`
                  : `Tag current bar (${currentBarDecimal.toFixed(1)})`}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share an idea, chord, or mix note..."
              className="flex-1 bg-[#0C0E12] border border-[#29303E] focus:border-amber-500/60 rounded-md px-2.5 py-2 text-xs text-[#F1F3F7] placeholder:text-[#64748B] outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="h-8 w-8 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-[#111317] flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
};
