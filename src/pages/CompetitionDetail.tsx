import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Player, Competition, CompetitionMatch, CompetitionStandings } from '../types';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, Plus, Calendar, Medal, Users, Trophy, Trash2, Save, X, History as HistoryIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export function CompetitionDetail({ players }: { players: Player[] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompetitionMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add Match Form State
  const [round, setRound] = useState(1);
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);

  useEffect(() => {
    fetchCompetitionData();
  }, [id]);

  const fetchCompetitionData = async () => {
    try {
      if (!supabase || !id) return;
      
      const [compRes, matchesRes] = await Promise.all([
        supabase.from('competitions').select('*').eq('id', id).single(),
        supabase.from('competition_matches').select('*').eq('competition_id', id).order('created_at', { ascending: false })
      ]);

      if (compRes.error) throw compRes.error;
      if (matchesRes.error) throw matchesRes.error;

      setCompetition(compRes.data);
      setMatches(matchesRes.data || []);
      
      // Auto-set next round
      if (matchesRes.data && matchesRes.data.length > 0) {
          const maxRound = Math.max(...matchesRes.data.map(m => m.round));
          setRound(maxRound);
      }
    } catch (error) {
      console.error('Error fetching competition detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const standings = useMemo(() => {
    if (!competition) return [];
    
    const stats: Record<string, CompetitionStandings> = {};
    
    // Initialize stats for all participants
    competition.players.forEach(pid => {
      const p = players.find(player => player.id === pid);
      stats[pid] = {
        playerId: pid,
        playerName: p?.name || 'Unknown',
        matchesPlayed: 0,
        points: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDiff: 0
      };
    });

    // Calculate from matches
    matches.filter(m => m.status === 'completed').forEach(m => {
      // Team 1
      m.team1.forEach(pid => {
        if (stats[pid]) {
          stats[pid].matchesPlayed++;
          stats[pid].points += m.score1;
          stats[pid].gamesWon += m.score1;
          stats[pid].gamesLost += m.score2;
          stats[pid].gameDiff = stats[pid].gamesWon - stats[pid].gamesLost;
        }
      });
      // Team 2
      m.team2.forEach(pid => {
        if (stats[pid]) {
          stats[pid].matchesPlayed++;
          stats[pid].points += m.score2;
          stats[pid].gamesWon += m.score2;
          stats[pid].gamesLost += m.score1;
          stats[pid].gameDiff = stats[pid].gamesWon - stats[pid].gamesLost;
        }
      });
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.gameDiff - a.gameDiff;
    });
  }, [competition, matches, players]);

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (team1.length !== 2 || team2.length !== 2) {
      alert('Please select 2 players for each team.');
      return;
    }

    setSaving(true);
    try {
      if (!supabase || !id) return;
      const { data, error } = await supabase
        .from('competition_matches')
        .insert([{
          competition_id: id,
          round,
          team1,
          team2,
          score1,
          score2,
          status: 'completed'
        }])
        .select()
        .single();

      if (error) throw error;
      
      setMatches([data, ...matches]);
      setShowAddMatch(false);
      setTeam1([]);
      setTeam2([]);
      setScore1(0);
      setScore2(0);
    } catch (error: any) {
      alert('Error adding match: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async (matchId: string) => {
    if (!confirm('Are you sure you want to delete this match result?')) return;
    try {
      if (!supabase) return;
      const { error } = await supabase.from('competition_matches').delete().eq('id', matchId);
      if (error) throw error;
      setMatches(matches.filter(m => m.id !== matchId));
    } catch (error: any) {
      alert('Error deleting match: ' + error.message);
    }
  };

  const deleteTournament = async () => {
    if (!confirm('Are you sure you want to delete this entire tournament? This cannot be undone.')) return;
    try {
      if (!supabase || !id) return;
      const { error } = await supabase.from('competitions').delete().eq('id', id);
      if (error) throw error;
      navigate('/competitions');
    } catch (error: any) {
      alert('Error deleting tournament: ' + error.message);
    }
  };

  const getPlayerName = (pid: string) => players.find(p => p.id === pid)?.name || 'Unknown';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading details...</p>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500 font-bold">Tournament not found.</p>
        <Link to="/competitions" className="text-primary font-black hover:underline">Back to List</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/competitions" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors font-bold">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Competitions
      </Link>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                competition.type === 'americano' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
              )}>
                {competition.type}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                Max {competition.max_points} Points
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{competition.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {competition.date}
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {competition.players.length} Players
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={deleteTournament}
                className="p-2 text-red-300 hover:text-red-500 transition-colors"
                title="Delete Tournament"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowAddMatch(true)}
                className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-primary/20 font-black text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Match
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Standings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-primary" />
            <h3 className="font-black text-lg text-slate-900 tracking-tight">Standings</h3>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-4 w-12 text-center">#</th>
                    <th className="px-4 py-4">Player</th>
                    <th className="px-4 py-4 text-center">P</th>
                    <th className="px-4 py-4 text-center">+/-</th>
                    <th className="px-4 py-4 text-center text-primary">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {standings.map((stat, index) => (
                    <tr key={stat.playerId} className={cn(
                      "hover:bg-slate-50 transition-colors",
                      index === 0 && "bg-yellow-50/30"
                    )}>
                      <td className="px-4 py-4 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{stat.playerName}</span>
                          {index === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-500 font-bold">{stat.matchesPlayed}</td>
                      <td className={cn(
                        "px-4 py-4 text-center font-bold",
                        stat.gameDiff > 0 ? "text-green-600" : stat.gameDiff < 0 ? "text-red-500" : "text-slate-400"
                      )}>
                        {stat.gameDiff > 0 ? '+' : ''}{stat.gameDiff}
                      </td>
                      <td className="px-4 py-4 text-center font-black text-primary text-base">
                        {stat.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary" />
            <h3 className="font-black text-lg text-slate-900 tracking-tight">Match History</h3>
          </div>
          <div className="space-y-3">
            {matches.length === 0 ? (
              <p className="text-slate-400 text-sm font-bold text-center py-8">No results recorded yet.</p>
            ) : (
              matches.map(match => (
                <div key={match.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 relative group">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Round {match.round}</span>
                    {isAdmin && (
                      <button 
                        onClick={() => deleteMatch(match.id)}
                        className="text-red-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 items-center gap-2">
                    <div className="col-span-2 space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 truncate">{getPlayerName(match.team1[0])}</div>
                      <div className="text-xs font-bold text-slate-900 truncate">{getPlayerName(match.team1[1])}</div>
                    </div>
                    <div className="col-span-1 flex items-center justify-center gap-1 font-black text-lg">
                      <span className={match.score1 > match.score2 ? "text-primary" : "text-slate-400"}>{match.score1}</span>
                      <span className="text-slate-200">-</span>
                      <span className={match.score2 > match.score1 ? "text-primary" : "text-slate-400"}>{match.score2}</span>
                    </div>
                    <div className="col-span-2 space-y-0.5 text-right">
                      <div className="text-xs font-bold text-slate-900 truncate">{getPlayerName(match.team2[0])}</div>
                      <div className="text-xs font-bold text-slate-900 truncate">{getPlayerName(match.team2[1])}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Match Modal */}
      {showAddMatch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">Record Match Result</h3>
              <button onClick={() => setShowAddMatch(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAddMatch} className="p-6 space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Round</label>
                  <input
                    type="number"
                    value={round}
                    onChange={e => setRound(parseInt(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex-1 space-y-2">
                   {/* Could add court here if needed */}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Team 1 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-primary uppercase tracking-widest">Team 1</h4>
                  <div className="space-y-2">
                    {[0, 1].map(idx => (
                      <select
                        key={idx}
                        value={team1[idx] || ''}
                        onChange={e => {
                          const newTeam = [...team1];
                          newTeam[idx] = e.target.value;
                          setTeam1(newTeam);
                        }}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                      >
                        <option value="">Select Player</option>
                        {competition.players.map(pid => (
                          <option key={pid} value={pid} disabled={team1.includes(pid) || team2.includes(pid)}>
                            {getPlayerName(pid)}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Score</label>
                    <input
                      type="number"
                      value={score1}
                      onChange={e => setScore1(parseInt(e.target.value))}
                      max={competition.max_points}
                      className="w-full p-4 bg-primary/5 border border-primary/20 rounded-2xl text-center text-2xl font-black text-primary outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Team 2 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest text-right">Team 2</h4>
                  <div className="space-y-2">
                    {[0, 1].map(idx => (
                      <select
                        key={idx}
                        value={team2[idx] || ''}
                        onChange={e => {
                          const newTeam = [...team2];
                          newTeam[idx] = e.target.value;
                          setTeam2(newTeam);
                        }}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                      >
                        <option value="">Select Player</option>
                        {competition.players.map(pid => (
                          <option key={pid} value={pid} disabled={team1.includes(pid) || team2.includes(pid)}>
                            {getPlayerName(pid)}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                  <div className="space-y-2 text-right">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Score</label>
                    <input
                      type="number"
                      value={score2}
                      onChange={e => setScore2(parseInt(e.target.value))}
                      max={competition.max_points}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-2xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-xs text-blue-700 font-bold leading-relaxed">
                  Total points must equal {competition.max_points} (e.g., 12-12 or 14-10).
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-teal-700 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Record Result'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
