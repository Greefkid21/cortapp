import { useParams, Link } from 'react-router-dom';
import { Player, Match } from '../types';
import { Trophy, TrendingUp, ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';

interface PlayerProfileProps {
  players: Player[];
  matches: Match[];
}

export function PlayerProfile({ players, matches }: PlayerProfileProps) {
  const { id } = useParams<{ id: string }>();
  const player = players.find(p => p.id === id);

  // 1. Get all matches involving this player
  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter(m => 
        m.status === 'completed' && 
        (m.team1.includes(player.id) || m.team2.includes(player.id))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, player]);

  // 2. Calculate Recent Form (Last 5 matches)
  const recentForm = useMemo(() => {
    return playerMatches.slice(0, 5).map(m => {
      const isTeam1 = m.team1.includes(player!.id);
      const isWinner = (isTeam1 && m.winner === 'team1') || (!isTeam1 && m.winner === 'team2');
      const isDraw = m.winner === 'draw';
      return { id: m.id, result: isDraw ? 'draw' : (isWinner ? 'win' : 'loss') };
    });
  }, [playerMatches, player]);

  // 3. Head-to-Head Stats
  const headToHead = useMemo(() => {
    if (!player) return [];
    const stats: Record<string, { wins: number; losses: number; draws: number; total: number }> = {};

    playerMatches.forEach(m => {
      const isTeam1 = m.team1.includes(player.id);
      const opponents = isTeam1 ? m.team2 : m.team1;
      const isWinner = (isTeam1 && m.winner === 'team1') || (!isTeam1 && m.winner === 'team2');
      const isDraw = m.winner === 'draw';

      opponents.forEach(oppId => {
        if (!stats[oppId]) stats[oppId] = { wins: 0, losses: 0, draws: 0, total: 0 };
        stats[oppId].total++;
        if (isDraw) stats[oppId].draws++;
        else if (isWinner) stats[oppId].wins++;
        else stats[oppId].losses++;
      });
    });

    return Object.entries(stats)
      .map(([oppId, stat]) => ({
        opponent: players.find(p => p.id === oppId),
        ...stat
      }))
      .filter(item => item.opponent) // Filter out unknown players
      .sort((a, b) => b.total - a.total); // Sort by most games played
  }, [playerMatches, player, players]);

  if (!player) {
    return <div className="p-8 text-center">Player not found</div>;
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <Link to="/" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to League
      </Link>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-3xl overflow-hidden border-4 border-slate-50">
          {player.avatar ? (
            <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <span>{player.name.charAt(0)}</span>
          )}
        </div>
        <div className="text-center sm:text-left space-y-2">
          <h1 className="text-3xl font-black text-slate-900">{player.name}</h1>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
              Rank #{players.indexOf(player) + 1}
            </span>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
              {player.stats.points} Points
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Played</div>
            <div className="text-2xl font-black text-slate-800">{player.stats.matchesPlayed}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Won</div>
            <div className="text-2xl font-black text-green-600">{player.stats.wins}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Win Rate</div>
            <div className="text-2xl font-black text-slate-800">
                {player.stats.matchesPlayed > 0 
                    ? Math.round((player.stats.wins / player.stats.matchesPlayed) * 100) 
                    : 0}%
            </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Game Diff</div>
            <div className={`text-2xl font-black ${player.stats.gameDifference > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {player.stats.gameDifference > 0 ? '+' : ''}{player.stats.gameDifference}
            </div>
        </div>
      </div>

      {/* Recent Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Recent Form
        </h3>
        {recentForm.length > 0 ? (
            <div className="flex gap-2">
                {recentForm.map((match) => (
                    <div 
                        key={match.id} 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm
                            ${match.result === 'win' ? 'bg-green-500' : match.result === 'loss' ? 'bg-red-500' : 'bg-slate-400'}`}
                        title={match.result.toUpperCase()}
                    >
                        {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-slate-500 text-sm">No matches played yet.</p>
        )}
      </div>

      {/* Head to Head */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Head to Head
        </h3>
        <div className="space-y-3">
            {headToHead.length > 0 ? headToHead.map((stat) => (
                <div key={stat.opponent!.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                            {stat.opponent!.avatar ? (
                                <img src={stat.opponent!.avatar} alt={stat.opponent!.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
                                    {stat.opponent!.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="font-bold text-slate-800">{stat.opponent!.name}</div>
                            <div className="text-xs text-slate-500">{stat.total} matches played</div>
                        </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                        <div className="text-center">
                            <div className="font-bold text-green-600">{stat.wins}</div>
                            <div className="text-[10px] text-slate-400 uppercase">Won</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-red-500">{stat.losses}</div>
                            <div className="text-[10px] text-slate-400 uppercase">Lost</div>
                        </div>
                    </div>
                </div>
            )) : (
                <p className="text-slate-500 text-sm">No opponents faced yet.</p>
            )}
        </div>
      </div>
    </div>
  );
}
