import { Player } from '../types';
import { cn } from '../lib/utils';
import { Medal } from 'lucide-react';

interface LeagueTableProps {
  players: Player[];
}

export function LeagueTable({ players }: LeagueTableProps) {
  // Sort players by points (desc), then net sets/games if needed
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    return (b.stats.gameDifference || 0) - (a.stats.gameDifference || 0);
  });

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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
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
                        <span className={cn("font-medium", index === 0 ? "text-slate-900 font-bold" : "text-slate-700")}>
                            {player.name}
                        </span>
                        {index === 0 && <Medal className="w-4 h-4 text-yellow-400 fill-yellow-400 ml-auto sm:ml-0" />}
                      </div>
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
