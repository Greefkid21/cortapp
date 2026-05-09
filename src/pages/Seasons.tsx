import { useState, useEffect } from 'react';
import { useSeason } from '../context/SeasonContext';
import { useAuth } from '../context/AuthContext';
import { Player, Match, SeasonArchive, Season } from '../types';
import { Archive, CalendarDays, Trash2, ChevronRight, ArrowLeft } from 'lucide-react';
import { LeagueTable } from '../components/LeagueTable';
import { MatchHistory } from '../components/MatchHistory';

export function Seasons({ players, matches, onReset }: { players: Player[]; matches: Match[]; onReset: () => void }) {
  const { currentSeasonName, currentSeasonStart, archives, archiveAndStart, deleteArchive, createDraftSeason, getDraftSeason, updateDraftSeason } = useSeason();
  const { isAdmin } = useAuth();
  const [newSeasonName, setNewSeasonName] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<SeasonArchive | null>(null);
  const [draftSeason, setDraftSeason] = useState<Season | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      getDraftSeason().then(setDraftSeason);
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="p-8 text-center">You do not have permission to view this page.</div>;
  }

  const handleStartPlanning = async () => {
    setIsPreparing(true);
    const id = await createDraftSeason(`Next Season (Draft)`);
    if (id) {
        const draft = await getDraftSeason();
        setDraftSeason(draft);
    }
    setIsPreparing(false);
  };

  const handleSaveDraft = async () => {
    if (draftSeason) {
        await updateDraftSeason(draftSeason.id, draftSeason);
        alert('Draft saved!');
    }
  };

  const handleArchiveAndStart = () => {
    const name = newSeasonName.trim() || `Season ${archives.length + 2}`;
    archiveAndStart(name, players, matches);
    onReset();
    setNewSeasonName('');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this archived season? This cannot be undone.')) {
      await deleteArchive(id);
      if (selectedSeason?.id === id) {
        setSelectedSeason(null);
      }
    }
  };

  if (selectedSeason) {
    return (
      <div className="space-y-6 pb-20">
        <button 
          onClick={() => setSelectedSeason(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Seasons
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedSeason.name}</h2>
            <div className="text-sm text-slate-500">
              {selectedSeason.startDate} - {selectedSeason.endDate}
            </div>
          </div>
        </div>

        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Final Standings</h3>
                <LeagueTable players={selectedSeason.players} />
            </div>

            <div>
                <MatchHistory matches={selectedSeason.matches} players={selectedSeason.players} />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold text-slate-900">Seasons</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Plan Next Season</h3>
            <p className="text-sm text-slate-500">Prepare divisions and fixtures for the upcoming season without affecting current data.</p>
          </div>
          {!draftSeason && (
            <button
              onClick={handleStartPlanning}
              disabled={isPreparing}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Start Planning
            </button>
          )}
        </div>

        {draftSeason && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={draftSeason.name}
                onChange={(e) => setDraftSeason({ ...draftSeason, name: e.target.value })}
                placeholder="Season Name (e.g. Season 2)"
                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
              <button
                onClick={handleSaveDraft}
                className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors"
              >
                Save Draft
              </button>
            </div>
            
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm text-amber-800 font-medium">
                    <strong>Divisions & Fixtures:</strong> To set up next season:
                </p>
                <ol className="text-xs text-amber-700 mt-2 list-decimal ml-4 space-y-1">
                    <li>Go to the <strong>Players</strong> page and assign everyone to Division 1 or 2.</li>
                    <li>Come back here when the current season ends to "Archive & Start New".</li>
                    <li>The new season will automatically respect the divisions you've set!</li>
                </ol>
            </div>
          </div>
        )}
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
              <div 
                key={a.id} 
                onClick={() => setSelectedSeason(a)}
                className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer group transition-colors"
              >
                <div>
                  <div className="font-bold text-slate-900 group-hover:text-primary transition-colors">{a.name}</div>
                  <div className="text-xs text-slate-500">From {a.startDate} to {a.endDate}</div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-500 text-right">
                    {a.players.length} players • {a.matches.length} matches
                    </div>
                    <button
                        onClick={(e) => handleDelete(a.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Archive"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
