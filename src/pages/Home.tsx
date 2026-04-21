import { LeagueTable } from '../components/LeagueTable';
import { Player, Match } from '../types';
import { AvailabilityWidget } from '../components/AvailabilityWidget';
import { useAuth } from '../context/AuthContext';
import { getNextWeekStartDate } from '../lib/utils';
import { useMemo } from 'react';
import { Calendar, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Home({ players, matches }: { players: Player[]; matches: Match[] }) {
  const { user } = useAuth();
  const nextWeekStart = getNextWeekStartDate();

  const upcomingMatches = useMemo(() => {
    return matches
      .filter(m => m.status !== 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3); // Show top 3 upcoming
  }, [matches]);

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      {user?.playerId && (
          <AvailabilityWidget playerId={user.playerId} weekStartDate={nextWeekStart} />
      )}

      {upcomingMatches.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Matches
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingMatches.map(match => (
              <div key={match.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{match.date}</span>
                    <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-600 shadow-sm border border-slate-100 capitalize">
                      {match.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <div className="flex-1 text-xs text-slate-700 font-medium truncate">
                      {getPlayerName(match.team1[0])} & {getPlayerName(match.team1[1])}
                    </div>
                    <div className="text-[10px] font-bold text-slate-300">VS</div>
                    <div className="flex-1 text-xs text-slate-700 font-medium text-right truncate">
                      {getPlayerName(match.team2[0])} & {getPlayerName(match.team2[1])}
                    </div>
                  </div>
                </div>
                {(match.time || match.venue) && (
                  <div className="pt-2 border-t border-slate-200/50 flex flex-wrap gap-x-3 gap-y-1">
                    {match.time && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                        <Calendar className="w-3 h-3" />
                        {match.time}
                      </div>
                    )}
                    {match.venue && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                        <HelpCircle className="w-3 h-3" />
                        {match.venue}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link to="/fixtures" className="text-sm font-bold text-primary hover:underline">View All Fixtures →</Link>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">League Standings</h2>
      </div>

      <LeagueTable players={players} />
    </div>
  );
}
