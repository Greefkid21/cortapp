import { useEffect, useMemo, useState } from 'react';
import { Player } from '../types';
import { cn } from '../lib/utils';
import { Medal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LeagueTableProps {
  players: Player[];
}

export function LeagueTable({ players }: LeagueTableProps) {
  const { buildPath } = useAuth();
  const divisions = useMemo(() => {
    const uniqueDivisions = Array.from(
      new Set(players.filter(p => p.in_league !== false).map(p => p.division || 1))
    ).sort((a, b) => a - b);

    return uniqueDivisions.length > 0 ? uniqueDivisions : [1];
  }, [players]);

  const [selectedDivision, setSelectedDivision] = useState<number>(divisions[0]);

  useEffect(() => {
    if (!divisions.includes(selectedDivision)) {
      setSelectedDivision(divisions[0]);
    }
  }, [divisions, selectedDivision]);
  
  // Filter players by division
  const divisionPlayers = players.filter(p => (p.in_league !== false) && (p.division || 1) === selectedDivision);

  // Sort players by points (desc), then net sets/games if needed
  const sortedPlayers = [...divisionPlayers].sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    return (b.stats.gameDifference || 0) - (a.stats.gameDifference || 0);
  });

  return (
    <div className="space-y-4">
      {/* Division Selector */}
      {divisions.length > 1 && (
        <div className="flex flex-wrap p-1.5 bg-primary rounded-2xl w-fit gap-1 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)]">
        {divisions.map(div => (
          <button
            key={div}
            onClick={() => setSelectedDivision(div)}
            className={cn(
              "px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all",
              selectedDivision === div 
                ? "bg-accent text-black shadow-sm" 
                : "text-white/70 hover:text-white"
            )}
          >
            Division {div}
          </button>
        ))}
        </div>
      )}

      <div className="brand-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-primary px-4 sm:px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-accent font-black">Standings</div>
            <div className="text-sm sm:text-base font-black text-white">Division {selectedDivision}</div>
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-white/60">
            Screenshot-ready view
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs sm:text-sm text-left">
            <thead className="bg-[#f7f5ec] text-slate-500 font-medium border-b border-black/5">
              <tr>
                <th className="px-2 sm:px-4 py-3 w-8 sm:w-12 text-center">#</th>
                <th className="px-2 sm:px-4 py-3 text-left font-bold text-slate-500 w-[38%] sm:w-[42%]">Player</th>
                <th className="px-1 sm:px-4 py-3 text-center font-bold text-slate-500 w-8 sm:w-14">P</th>
                <th className="px-1 sm:px-4 py-3 text-center w-8 sm:w-14">W</th>
                <th className="px-1 sm:px-4 py-3 text-center w-8 sm:w-14">D</th>
                <th className="px-1 sm:px-4 py-3 text-center w-8 sm:w-14">L</th>
                <th className="px-1 sm:px-4 py-3 text-center w-10 sm:w-16">+/-</th>
                <th className="px-2 sm:px-4 py-3 text-center font-bold text-slate-700 w-10 sm:w-16">Pts</th>
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
                      isTop3 && "bg-gradient-to-r from-yellow-50/50 to-transparent"
                    )}
                  >
                    <td className="px-2 sm:px-4 py-3 text-center font-medium text-slate-400">
                      {index + 1}
                    </td>
                    <td className="p-0 relative">
                      <Link 
                        to={buildPath(`/player/${player.id}`)} 
                        className="flex items-center gap-2 sm:gap-3 hover:bg-slate-50 transition-colors w-full h-full px-2 sm:px-4 py-3 min-w-0"
                      >
                        <div className={cn(
                          "hidden sm:flex w-8 h-8 rounded-full items-center justify-center font-bold text-xs overflow-hidden border flex-shrink-0",
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
                        <div className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
                            <span className={cn("block flex-1 truncate font-medium", index === 0 ? "text-slate-900 font-bold" : "text-slate-700")}>
                                {player.name}
                            </span>
                            {index === 0 && <Medal className="hidden sm:block w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                        </div>
                      </Link>
                    </td>
                    <td className="px-1 sm:px-4 py-3 text-center text-slate-500">{player.stats.matchesPlayed}</td>
                    <td className="px-1 sm:px-4 py-3 text-center text-green-600 font-medium">{player.stats.wins}</td>
                    <td className="px-1 sm:px-4 py-3 text-center text-slate-500">{player.stats.draws}</td>
                    <td className="px-1 sm:px-4 py-3 text-center text-red-500">{player.stats.losses}</td>
                    <td className={cn("px-1 sm:px-4 py-3 text-center font-medium", 
                        (player.stats.gameDifference || 0) > 0 ? "text-green-600" : 
                        (player.stats.gameDifference || 0) < 0 ? "text-red-500" : "text-slate-400"
                    )}>
                        {(player.stats.gameDifference || 0) > 0 ? '+' : ''}{player.stats.gameDifference || 0}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center font-black text-primary text-sm sm:text-base">{player.stats.points}</td>
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
