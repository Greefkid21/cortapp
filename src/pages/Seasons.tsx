import { useState } from 'react';
import { useSeason } from '../context/SeasonContext';
import { useAuth } from '../context/AuthContext';
import { Player, Match } from '../types';
import { Archive, CalendarDays } from 'lucide-react';

export function Seasons({ players, matches, onReset }: { players: Player[]; matches: Match[]; onReset: () => void }) {
  const { currentSeasonName, currentSeasonStart, archives, archiveAndStart } = useSeason();
  const { isAdmin } = useAuth();
  const [newSeasonName, setNewSeasonName] = useState('');

  if (!isAdmin) {
    return <div className="p-8 text-center">You do not have permission to view this page.</div>;
  }

  const handleArchiveAndStart = () => {
    const name = newSeasonName.trim() || `Season ${archives.length + 2}`;
    archiveAndStart(name, players, matches);
    onReset();
    setNewSeasonName('');
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold text-slate-900">Seasons</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Current Season</div>
            <div className="text-lg font-bold text-slate-900">{currentSeasonName}</div>
            <div className="text-xs text-slate-500">Started {currentSeasonStart}</div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <input
            type="text"
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            placeholder="New season name (e.g. Spring 2026)"
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          <button
            onClick={handleArchiveAndStart}
            className="px-4 py-3 bg-primary text-white font-bold rounded-xl hover:bg-teal-700 flex items-center gap-2"
          >
            <Archive className="w-5 h-5" /> Archive & Start New
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Archiving preserves all player stats and matches from the current season and resets the table for the new season.
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-700">Archived Seasons</div>
        {archives.length === 0 ? (
          <div className="p-6 text-slate-400 text-center">No archived seasons yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {archives.map(a => (
              <div key={a.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{a.name}</div>
                  <div className="text-xs text-slate-500">From {a.startDate} to {a.endDate}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {a.players.length} players • {a.matches.length} matches
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
