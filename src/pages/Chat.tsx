import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useChat, ChatMessage } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useAvailability } from '../context/AvailabilityContext';
import { AvailabilityWidget } from '../components/AvailabilityWidget';
import { getWeekStartDate } from '../lib/utils';
import { Player, Match } from '../types';
import { Send, MessageSquare, Edit2, Trash2, X, Check, ArrowLeft, Calendar, HelpCircle } from 'lucide-react';

export function Chat({ matches, players }: { matches: Match[]; players: Player[] }) {
  const [params] = useSearchParams();
  const matchId = params.get('matchId') || '';
  const { getThread, sendMessage, editMessage, deleteMessage, markAsRead, messages } = useChat();
  const { user, isAdmin } = useAuth();
  const { getAvailability } = useAvailability();
  const [text, setText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const match = useMemo(() => matches.find(m => m.id === matchId), [matches, matchId]);
  const thread = getThread(matchId);

  // Mark as read when entering or when new messages arrive
  useEffect(() => {
    if (matchId && user) {
        markAsRead(matchId);
    }
  }, [matchId, user, messages.length]); // Re-run when message count changes

  const canPost = !!user;

  // Ensure robust player name lookup

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  const matchParticipants = useMemo(() => {
    if (!match) return [];
    return [...match.team1, ...match.team2].map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
  }, [match, players]);

  const weekStart = useMemo(() => match ? getWeekStartDate(new Date(match.date)) : '', [match]);

  const isParticipant = useMemo(() => {
    if (!match || !user?.playerId) return false;
    return [...match.team1, ...match.team2].includes(user.playerId);
  }, [match, user]);

  const handleSend = async () => {
    if (!user || !text.trim() || !canPost) return;
    try {
        await sendMessage(matchId, text.trim(), user);
        setText('');
    } catch (error: any) {
        alert('Failed to send message: ' + (error.message || error));
    }
  };

  const handleEditStart = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditText(msg.text);
  };

  const handleEditSave = async () => {
    if (!editingMessageId || !editText.trim()) return;
    try {
      await editMessage(editingMessageId, editText.trim());
      setEditingMessageId(null);
      setEditText('');
    } catch (err: any) {
      alert('Failed to update message: ' + err.message);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await deleteMessage(messageId);
    } catch (err: any) {
      alert('Failed to delete message: ' + err.message);
    }
  };

  if (!match) {
    return <div className="p-6">Match not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold text-slate-900">Match Chat</h2>
        </div>
        <Link 
          to="/fixtures" 
          className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Fixtures
        </Link>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="text-sm text-slate-600 mb-3">
          {getPlayerName(match.team1[0])}/{getPlayerName(match.team1[1])} vs{' '}
          {getPlayerName(match.team2[0])}/{getPlayerName(match.team2[1])}
        </div>

        {isParticipant && user?.playerId && (
            <div className="mb-6">
                <AvailabilityWidget 
                    playerId={user.playerId} 
                    weekStartDate={weekStart} 
                    title="Update Your Availability" 
                />
            </div>
        )}

        {/* Availability Summary */}
        <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Player Availability for Match Week
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {matchParticipants.map(p => {
                    const avail = getAvailability(p.id, weekStart);
                    return (
                        <div key={p.id} className="bg-white p-2 rounded border border-slate-100">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-700">{p.name}</span>
                                {avail ? (
                                    avail.isAvailable ? (
                                        <span className="text-green-600 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> {avail.daysAvailable.length > 0 ? avail.daysAvailable.join(', ') : 'Available'}
                                        </span>
                                    ) : (
                                        <span className="text-red-500 flex items-center gap-1">
                                            <X className="w-3 h-3" /> Unavailable
                                        </span>
                                    )
                                ) : (
                                    <span className="text-slate-400 flex items-center gap-1">
                                        <HelpCircle className="w-3 h-3" /> Unknown
                                    </span>
                                )}
                            </div>
                            {avail?.note && (
                                <div className="text-[10px] text-slate-500 mt-1 italic pl-2 border-l-2 border-slate-200">
                                    "{avail.note}"
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="h-[40vh] overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
          {thread.length === 0 ? (
            <div className="text-center text-slate-400">No messages yet</div>
          ) : (
            thread.map(m => {
              const mine = user?.id === m.senderUserId;
              const senderName = m.senderName || getPlayerName(m.senderUserId) || 'User';
              const canEdit = mine || isAdmin;
              const isEditing = editingMessageId === m.id;

              return (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'} group relative`}
                  title={`Sender: ${m.senderUserId} | You: ${user?.id}`}
                >
                  <div className="opacity-70 text-xs mb-1 flex justify-between items-center gap-2">
                    <span>{mine ? 'You' : senderName}</span>
                    {canEdit && !isEditing && (
                        <div className="flex gap-2 bg-white/80 dark:bg-slate-800/80 rounded px-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleEditStart(m); }} 
                                className="text-slate-400 hover:text-yellow-600 p-1" 
                                title="Edit"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} 
                                className="text-slate-400 hover:text-red-600 p-1" 
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                  </div>
                  
                  {isEditing ? (
                      <div className="flex gap-1 items-center mt-1">
                          <input 
                            value={editText} 
                            onChange={e => setEditText(e.target.value)}
                            className="text-slate-900 px-2 py-1 rounded text-xs flex-1 w-full outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                          />
                          <button onClick={handleEditSave} className="p-1 hover:bg-white/20 rounded"><Check size={14} /></button>
                          <button onClick={() => setEditingMessageId(null)} className="p-1 hover:bg-white/20 rounded"><X size={14} /></button>
                      </div>
                  ) : (
                      <div>{m.text}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            }}
            placeholder={
              canPost
                ? 'Type a message...'
                : 'Login to post'
            }
            disabled={!canPost}
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!canPost || !text.trim()}
            className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
