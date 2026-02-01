import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Player, Match } from '../types';
import { Send, MessageSquare } from 'lucide-react';

export function Chat({ matches, players }: { matches: Match[]; players: Player[] }) {
  const [params] = useSearchParams();
  const matchId = params.get('matchId') || '';
  const { getThread, sendMessage } = useChat();
  const { user, isAdmin } = useAuth();
  const [text, setText] = useState('');

  const match = useMemo(() => matches.find(m => m.id === matchId), [matches, matchId]);
  const thread = getThread(matchId);

  const participants = useMemo(() => {
    if (!match) return [];
    return [...match.team1, ...match.team2];
  }, [match]);

  const canPost = !!user && (isAdmin || (user.playerId && participants.includes(user.playerId)));

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  const handleSend = async () => {
    if (!user || !text.trim() || !canPost) return;
    try {
        await sendMessage(matchId, text.trim(), user);
        setText('');
    } catch (error: any) {
        alert('Failed to send message: ' + (error.message || error));
    }
  };

  if (!match) {
    return <div className="p-6">Match not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold text-slate-900">Match Chat</h2>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="text-sm text-slate-600 mb-3">
          {getPlayerName(match.team1[0])}/{getPlayerName(match.team1[1])} vs{' '}
          {getPlayerName(match.team2[0])}/{getPlayerName(match.team2[1])}
        </div>
        <div className="h-[40vh] overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
          {thread.length === 0 ? (
            <div className="text-center text-slate-400">No messages yet</div>
          ) : (
            thread.map(m => {
              const mine = user?.id === m.senderUserId;
              const senderName = m.senderName || getPlayerName(m.senderUserId) || 'User';
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    mine
                      ? 'ml-auto bg-primary text-white'
                      : 'mr-auto bg-white text-slate-800 border border-slate-200'
                  }`}
                >
                  <div className="opacity-70 text-xs mb-1">
                    {mine ? 'You' : senderName}
                  </div>
                  <div>{m.text}</div>
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
            placeholder={
              canPost
                ? 'Type a message...'
                : 'Only participants and admins can post'
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
