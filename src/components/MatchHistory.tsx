import { useState } from 'react';
import { Match, Player } from '../types';
import { cn } from '../lib/utils';
import { Calendar, Pencil, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MatchForm } from './MatchForm';

interface MatchHistoryProps {
  matches: Match[];
  players: Player[];
  onEditResult?: (match: Match) => void;
}

export function MatchHistory({ matches, players, onEditResult }: MatchHistoryProps) {
  const { user } = useAuth();
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  const handleSave = (data: any) => {
      if (!editingMatch) return;
      
      const updatedMatch: Match = {
          ...editingMatch,
          team1: data.team1,
          team2: data.team2,
          sets: data.sets.map((s: any) => ({ team1: s.t1, team2: s.t2 })),
          tieBreaker: data.tieBreaker,
          // winner/status will be recalculated in App.tsx
      };
      
      onEditResult?.(updatedMatch);
      setEditingMatch(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Recent Matches
      </h2>
      
      {editingMatch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                      <h3 className="font-bold text-lg">Edit Match Result</h3>
                      <button onClick={() => setEditingMatch(null)} className="p-2 hover:bg-slate-100 rounded-full">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-4">
                      <MatchForm 
                        players={players} 
                        initialData={editingMatch}
                        onSubmit={handleSave}
                      />
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-3">
        {matches.map(match => {
          const scoreDisplay = match.sets.map(s => `${s.team1}-${s.team2}`).join(', ');
          
          return (
            <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3 relative group">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>{match.date}</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">Finished</span>
              </div>
              
              {user?.role === 'admin' && onEditResult && (
                  <button 
                    onClick={() => setEditingMatch(match)}
                    className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-white"
                    title="Edit Result"
                  >
                      <Pencil className="w-4 h-4" />
                  </button>
              )}
              
              <div className="flex justify-between items-center">
                {/* Team 1 */}
                <div className={cn("flex-1 flex flex-col gap-1", match.winner === 'team1' && "font-bold text-slate-900")}>
                  <span className="text-sm">{getPlayerName(match.team1[0])}</span>
                  <span className="text-sm">{getPlayerName(match.team1[1])}</span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center px-4">
                   <div className="text-lg font-bold tracking-wider text-slate-800 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                     {scoreDisplay}
                   </div>
                </div>

                {/* Team 2 */}
                <div className={cn("flex-1 flex flex-col gap-1 text-right", match.winner === 'team2' && "font-bold text-slate-900")}>
                  <span className="text-sm">{getPlayerName(match.team2[0])}</span>
                  <span className="text-sm">{getPlayerName(match.team2[1])}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
