import { useParams, Link } from 'react-router-dom';
import { Player, Match } from '../types';
import { Trophy, TrendingUp, ArrowLeft, Camera, Loader2, Calendar, HelpCircle, Plane, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useHolidays } from '../context/HolidayContext';

function formatHolidayRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (startDate === endDate) {
    return start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  return `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface PlayerProfileProps {
  players: Player[];
  matches: Match[];
}

export function PlayerProfile({ players, matches }: PlayerProfileProps) {
  const { id } = useParams<{ id: string }>();
  const player = players.find(p => p.id === id);
  const { user } = useAuth();
  const { getPlayerHolidays, addHoliday, deleteHoliday, setupMessage } = useHolidays();
  const [uploading, setUploading] = useState(false);
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');
  const [holidayNote, setHolidayNote] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  const divisionPlayers = useMemo(() => {
    if (!player || player.in_league === false) return [];
    const playerDivision = player.division || 1;
    return players.filter(p => (p.in_league !== false) && (p.division || 1) === playerDivision);
  }, [players, player]);

  const leagueRank = useMemo(() => {
    if (!player || player.in_league === false) return null;
    const sorted = [...divisionPlayers].sort((a, b) => {
      if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
      return (b.stats.gameDifference || 0) - (a.stats.gameDifference || 0);
    });
    const index = sorted.findIndex(p => p.id === player.id);
    if (index === -1) return null;
    return index + 1;
  }, [divisionPlayers, player]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !player) return;
    
    try {
      setUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${player.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      if (!supabase) throw new Error('Supabase not configured');

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket "avatars" not found. Please ask an admin to create a public bucket named "avatars" in Supabase Storage.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('players')
        .update({ avatar: publicUrl })
        .eq('id', player.id);

      if (updateError) throw updateError;

      window.location.reload();
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 1. Get all matches involving this player
  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter(m => 
        (m.team1.includes(player.id) || m.team2.includes(player.id))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, player]);

  const completedMatches = useMemo(() => {
    return playerMatches.filter(m => m.status === 'completed');
  }, [playerMatches]);

  const upcomingMatches = useMemo(() => {
    return playerMatches
      .filter(m => m.status !== 'completed')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [playerMatches]);

  // 2. Calculate Recent Form (Last 5 matches)
  const recentForm = useMemo(() => {
    return completedMatches.slice(0, 5).map(m => {
      const isTeam1 = m.team1.includes(player!.id);
      const isWinner = (isTeam1 && m.winner === 'team1') || (!isTeam1 && m.winner === 'team2');
      const isDraw = m.winner === 'draw';
      return { id: m.id, result: isDraw ? 'draw' : (isWinner ? 'win' : 'loss') };
    });
  }, [completedMatches, player]);

  // 3. Head-to-Head Stats
  const headToHead = useMemo(() => {
    if (!player) return [];
    const stats: Record<string, { wins: number; losses: number; draws: number; total: number }> = {};

    completedMatches.forEach(m => {
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
  }, [completedMatches, player, players]);

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';
  const canManageHolidays = !!player && (user?.playerId === player.id || user?.role === 'admin');
  const upcomingHolidays = useMemo(() => {
    if (!player) return [];
    const today = new Date().toISOString().split('T')[0];
    return getPlayerHolidays(player.id).filter(holiday => holiday.endDate >= today);
  }, [getPlayerHolidays, player]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !holidayStart || !holidayEnd) return;
    if (holidayEnd < holidayStart) {
      alert('Holiday end date cannot be before the start date.');
      return;
    }

    setSavingHoliday(true);
    const success = await addHoliday(player.id, holidayStart, holidayEnd, holidayNote);
    setSavingHoliday(false);

    if (!success) {
      alert('Failed to save holiday. Please check the holiday table setup and try again.');
      return;
    }

    setHolidayStart('');
    setHolidayEnd('');
    setHolidayNote('');
  };

  const handleDeleteHoliday = async (holidayId?: string) => {
    if (!holidayId) return;
    if (!confirm('Delete this holiday entry?')) return;
    const success = await deleteHoliday(holidayId);
    if (!success) {
      alert('Failed to delete holiday. Please try again.');
    }
  };

  if (!player) {
    return <div className="p-8 text-center">Player not found</div>;
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <Link to="/" className="inline-flex items-center text-slate-500 hover:text-primary transition-colors font-medium">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to League
      </Link>

      {/* Profile Header */}
      <div className="brand-panel p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-r from-white to-[#faf8ef]">
        <div className="w-24 h-24 rounded-full bg-primary text-accent flex items-center justify-center text-3xl overflow-hidden border-4 border-[#f6efb3] relative group shadow-[0_20px_40px_-24px_rgba(0,0,0,0.75)]">
          {player.avatar ? (
            <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <span>{player.name.charAt(0)}</span>
          )}
          
          {user?.playerId === player.id && (
            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
        <div className="text-center sm:text-left space-y-2">
          <div className="brand-kicker">Player Profile</div>
          <h1 className="text-3xl font-black text-slate-900">{player.name}</h1>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {player.in_league === false ? (
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-bold">
                No League
              </span>
            ) : (
              <span className="bg-primary text-accent px-3 py-1 rounded-full text-sm font-bold">
                Division {player.division || 1} Rank #{leagueRank ?? '-'}
              </span>
            )}
            <span className="bg-accent text-black px-3 py-1 rounded-full text-sm font-bold">
              {player.stats.points} Points
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="brand-panel p-4 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Played</div>
            <div className="text-2xl font-black text-slate-800">{player.stats.matchesPlayed}</div>
        </div>
        <div className="brand-panel p-4 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Won</div>
            <div className="text-2xl font-black text-green-600">{player.stats.wins}</div>
        </div>
        <div className="brand-panel p-4 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Win Rate</div>
            <div className="text-2xl font-black text-slate-800">
                {player.stats.matchesPlayed > 0 
                    ? Math.round((player.stats.wins / player.stats.matchesPlayed) * 100) 
                    : 0}%
            </div>
        </div>
        <div className="brand-panel p-4 text-center">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Game Diff</div>
            <div className={`text-2xl font-black ${player.stats.gameDifference > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {player.stats.gameDifference > 0 ? '+' : ''}{player.stats.gameDifference}
            </div>
        </div>
      </div>

      {/* Recent Form */}
      <div className="brand-panel p-6">
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

      {/* Upcoming Matches */}
      <div className="brand-panel p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Next Matches
        </h3>
        <div className="space-y-3">
          {upcomingMatches.length > 0 ? upcomingMatches.map(match => (
            <div key={match.id} className="rounded-xl p-4 border border-black/5 bg-gradient-to-r from-white to-[#faf8ef]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{match.date}</span>
                <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-slate-600 shadow-sm border border-slate-100 capitalize">
                  {match.status}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 text-sm text-slate-700">
                  {getPlayerName(match.team1[0])} & {getPlayerName(match.team1[1])}
                </div>
                <div className="text-xs font-bold text-slate-400">VS</div>
                <div className="flex-1 text-sm text-slate-700 text-right">
                  {getPlayerName(match.team2[0])} & {getPlayerName(match.team2[1])}
                </div>
              </div>
              {(match.time || match.venue) && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 flex gap-4">
                  {match.time && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      <Calendar className="w-3.5 h-3.5" />
                      {match.time}
                    </div>
                  )}
                  {match.venue && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <HelpCircle className="w-3.5 h-3.5" />
                      {match.venue}
                    </div>
                  )}
                </div>
              )}
            </div>
          )) : (
            <p className="text-slate-500 text-sm italic">No upcoming matches scheduled.</p>
          )}
        </div>
      </div>

      <div className="brand-panel p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            Upcoming Holidays
          </h3>
          <Link to="/holidays" className="text-sm font-bold text-primary hover:text-black">
            View Holiday Sheet
          </Link>
        </div>

        {setupMessage && canManageHolidays && (
          <div className="mb-4 p-4 rounded-2xl border border-accent/50 bg-[#fff9cc] text-slate-900 text-sm flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
            <div>
              <span className="block font-medium">{setupMessage}</span>
              <span className="block text-xs text-slate-700 mt-1">
                Ask an admin to run `supabase/migrations/20260706_create_player_holidays_table.sql` in Supabase.
              </span>
            </div>
          </div>
        )}

        {canManageHolidays && (
          <form onSubmit={handleAddHoliday} className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="date"
              value={holidayStart}
              onChange={(e) => setHolidayStart(e.target.value)}
              className="p-3 bg-[#fbfaf6] border border-black/10 rounded-xl focus:ring-2 focus:ring-accent outline-none"
              aria-label="Holiday start date"
              required
            />
            <input
              type="date"
              value={holidayEnd}
              onChange={(e) => setHolidayEnd(e.target.value)}
              className="p-3 bg-[#fbfaf6] border border-black/10 rounded-xl focus:ring-2 focus:ring-accent outline-none"
              aria-label="Holiday end date"
              required
            />
            <button
              type="submit"
              disabled={savingHoliday}
              className="px-4 py-3 bg-accent text-black rounded-xl font-black hover:bg-[#f4dc00] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {savingHoliday ? 'Saving...' : 'Add Holiday'}
            </button>
            <textarea
              value={holidayNote}
              onChange={(e) => setHolidayNote(e.target.value)}
              placeholder="Optional note, e.g. family holiday"
              className="sm:col-span-3 p-3 bg-[#fbfaf6] border border-black/10 rounded-xl focus:ring-2 focus:ring-accent outline-none min-h-[84px]"
            />
          </form>
        )}

        <div className="space-y-3">
          {upcomingHolidays.length > 0 ? upcomingHolidays.map((holiday) => {
            const today = new Date().toISOString().split('T')[0];
            const isCurrent = holiday.startDate <= today && holiday.endDate >= today;

            return (
              <div key={holiday.id || `${holiday.startDate}-${holiday.endDate}`} className="rounded-xl p-4 border border-black/5 bg-gradient-to-r from-white to-[#faf8ef] flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{formatHolidayRange(holiday.startDate, holiday.endDate)}</span>
                    <span className={`text-[11px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-full ${isCurrent ? 'bg-accent text-black' : 'bg-primary/10 text-primary'}`}>
                      {isCurrent ? 'Away Now' : 'Upcoming'}
                    </span>
                  </div>
                  {holiday.note && (
                    <div className="text-sm text-slate-600 italic mt-1">
                      "{holiday.note}"
                    </div>
                  )}
                </div>
                {canManageHolidays && (
                  <button
                    onClick={() => handleDeleteHoliday(holiday.id)}
                    className="self-start sm:self-auto p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete holiday"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          }) : (
            <p className="text-slate-500 text-sm">No upcoming holidays added yet.</p>
          )}
        </div>
      </div>

      {/* Match Results */}
      <div className="brand-panel p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Season Match Results
        </h3>
        <div className="space-y-3">
          {completedMatches.length > 0 ? completedMatches.map(match => {
            const scoreDisplay = match.sets.map(s => `${s.team1}-${s.team2}`).join(', ');
            const tieBreakerDisplay = match.tieBreaker ? ` (${match.tieBreaker.team1}-${match.tieBreaker.team2})` : '';
            
            return (
              <div key={match.id} className="rounded-xl p-4 flex flex-col gap-3 border border-black/5 bg-gradient-to-r from-white to-[#faf8ef]">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>{match.date}</span>
                  <span className="bg-white px-2 py-0.5 rounded-full text-slate-600 shadow-sm">Finished</span>
                </div>
                
                <div className="flex justify-between items-center">
                  {/* Team 1 */}
                  <div className={cn("flex-1 flex flex-col gap-1", match.winner === 'team1' && "font-bold text-slate-900")}>
                    <Link to={`/player/${match.team1[0]}`} className="text-sm hover:underline">{getPlayerName(match.team1[0])}</Link>
                    <Link to={`/player/${match.team1[1]}`} className="text-sm hover:underline">{getPlayerName(match.team1[1])}</Link>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center px-4">
                     <div className="text-sm font-bold tracking-wider text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm whitespace-nowrap">
                       {scoreDisplay}{tieBreakerDisplay}
                     </div>
                  </div>

                  {/* Team 2 */}
                  <div className={cn("flex-1 flex flex-col gap-1 text-right", match.winner === 'team2' && "font-bold text-slate-900")}>
                    <Link to={`/player/${match.team2[0]}`} className="text-sm hover:underline">{getPlayerName(match.team2[0])}</Link>
                    <Link to={`/player/${match.team2[1]}`} className="text-sm hover:underline">{getPlayerName(match.team2[1])}</Link>
                  </div>
                </div>
              </div>
            );
          }) : (
            <p className="text-slate-500 text-sm">No matches found for this player.</p>
          )}
        </div>
      </div>

      {/* Head to Head */}
      <div className="brand-panel p-6">
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
