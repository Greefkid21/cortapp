import { Player, Match } from '../types';
import { cn } from '../lib/utils';
import { Medal, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LeagueTableProps {
  players: Player[];
  matches: Match[];
}

export function LeagueTable({ players, matches }: LeagueTableProps) {
  // Sort players by points (desc), then net sets/games if needed
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    return (b.stats.gameDifference || 0) - (a.stats.gameDifference || 0);
  });

  const getNextMatchDate = (playerId: string) => {
    const playerMatches = matches
      .filter(m => m.status !== 'completed' && (m.team1.includes(playerId) || m.team2.includes(playerId)))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return playerMatches.length > 0 ? playerMatches[0].date : null;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="p-4 text-left font-bold text-slate-500">Player</th>
                <th className="p-4 text-center font-bold text-slate-500">P</th>
                <th className="px-4 py-3 text-center">W</th>
                <th className="px-4 py-3 text-center">D</th>
                <th className="px-4 py-3 text-center">L</th>
                <th className="px-4 py-3 text-center">+/-</th>
                <th className="px-4 py-3 text-center font-bold text-slate-700">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedPlayers.map((player, index) => {
                const isTop3 = index < 3;
                const nextMatchDate = getNextMatchDate(player.id);
                
                return (
                  <tr
                    key={player.id}
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors",
                      isTop3 && "bg-gradient-to-r from-amber-50/10 to-transparent"
                    )}
                  >
                    <td className="px-4 py-3 text-center font-medium text-slate-400">
                      {index + 1}
                    </td>
                    <td className="p-0 relative">
                      <Link 
                        to={`/player/${player.id}`} 
                        className="flex items-center gap-3 hover:bg-slate-50 transition-colors w-full h-full px-4 py-3"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden border",
                          index === 0 ? "border-yellow-400 ring-2 ring-yellow-100" : 
                          index === 1 ? "border-slate-300" : 
                          index === 2 ? "border-amber-600" : "border-slate-100 bg-slate-100 text-slate-500"
                        )}>
                          {player.avatar ? (
                            <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className={cn(
                                index === 0 ? "text-yellow-600 bg-yellow-50 w-full h-full flex items-center justify-center" : 
                                index === 1 ? "text-slate-600 bg-slate-50 w-full h-full flex items-center justify-center" : 
                                index === 2 ? "text-amber-700 bg-amber-50 w-full h-full flex items-center justify-center" : ""
                            )}>
                                {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className={cn("font-medium", index === 0 ? "text-slate-900 font-bold" : "text-slate-700")}>
                                    {player.name}
                                </span>
                                {index === 0 && <Medal className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                            </div>
                            {nextMatchDate && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                    <Calendar className="w-3 h-3" />
                                    <span>Next: {nextMatchDate}</span>
                                </div>
                            )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">{player.stats.matchesPlayed}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{player.stats.wins}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{player.stats.draws}</td>
                    <td className="px-4 py-3 text-center text-red-500">{player.stats.losses}</td>
                    <td className={cn("px-4 py-3 text-center font-medium", 
                        (player.stats.gameDifference || 0) > 0 ? "text-green-600" : 
                        (player.stats.gameDifference || 0) < 0 ? "text-red-500" : "text-slate-400"
                    )}>
                        {(player.stats.gameDifference || 0) > 0 ? '+' : ''}{player.stats.gameDifference || 0}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-primary text-base">{player.stats.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
