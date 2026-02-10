import { useState } from 'react';
import { Player, Match } from '../types';
import { Calendar, Play, Shuffle, MessageSquare, Check, X, HelpCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useAvailability } from '../context/AvailabilityContext';
import { getWeekStartDate } from '../lib/utils';
import { MatchAvailabilityStatus } from '../components/MatchAvailabilityStatus';

interface FixturesProps {
  players: Player[];
  matches: Match[];
  onAddMatches: (newMatches: Match[]) => void;
  onUpdateMatch?: (updated: Match) => void;
}

export function Fixtures({ players, matches, onAddMatches, onUpdateMatch }: FixturesProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { getAvailability } = useAvailability();
  const { getUnreadCount } = useChat();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(players.map(p => p.id));
  const [generated, setGenerated] = useState<Match[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Match['status']>('scheduled');
  const [editTeam1, setEditTeam1] = useState<string[]>([]);
  const [editTeam2, setEditTeam2] = useState<string[]>([]);
  const [leagueStartDate, setLeagueStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const scheduledMatches = matches
    .filter(m => m.status !== 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleGenerate = () => {
    setIsGenerating(true);
    
    // Use a Web Worker to run the schedule generation off the main thread
    const worker = new Worker(new URL('../lib/scheduler.worker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'SUCCESS') {
            if (payload.error) {
                alert(`Generation Error: ${payload.error.message}`);
                console.error("Scheduler Error:", payload.error);
                setIsGenerating(false);
                worker.terminate();
                return;
            }

            if (payload.matches && Array.isArray(payload.matches)) {
                setGenerated(payload.matches);
                if (payload.stats) {
                    setStats(payload.stats);
                    console.log('Schedule Stats:', payload.stats);
                }
                if (payload.explanation) {
                    setExplanation(payload.explanation);
                }
            } else if (Array.isArray(payload)) {
                // Legacy fallback
                setGenerated(payload);
                setStats(null);
                setExplanation('');
            }
        } else {
            console.error('Error generating schedule:', payload);
            const msg = payload?.message || 'An error occurred while generating the schedule.';
            alert(msg);
        }
        setIsGenerating(false);
        worker.terminate();
    };

    worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Extract error message for better debugging
        const errorMessage = error instanceof ErrorEvent ? error.message : 'Unknown error';
        alert(`A worker error occurred: ${errorMessage}. Check console for details.`);
        setIsGenerating(false);
        worker.terminate();
    };

    // Filter player objects based on selection
    const activePlayers = players.filter(p => selectedPlayers.includes(p.id));
    if (activePlayers.length < 4) {
        alert('Please select at least 4 players to generate a schedule.');
        setIsGenerating(false);
        worker.terminate();
        return;
    }

    // STRICT MODE VALIDATION (Client-side pre-check)
    if (activePlayers.length % 4 === 0) {
        // Check for missing seeds
        const missingSeeds = activePlayers.filter(p => p.seed === undefined);
        if (missingSeeds.length > 0) {
             alert(`Strict Mode (N=${activePlayers.length}) requires all players to have a seed.\n\nMissing seeds for: ${missingSeeds.map(p => p.name).join(', ')}`);
             setIsGenerating(false);
             worker.terminate();
             return;
        }
    }
    
    worker.postMessage({ players: activePlayers, startDate: leagueStartDate });
  };

  const handleConfirm = () => {
    onAddMatches(generated);
    setGenerated([]);
  };

  const startReschedule = (m: Match) => {
    setRescheduleId(m.id);
    setNewDate(m.date);
    setNewStatus(m.status);
    setEditTeam1([...m.team1]);
    setEditTeam2([...m.team2]);
  };

  const applyReschedule = () => {
    if (!rescheduleId || !onUpdateMatch) return;
    const m = matches.find(mm => mm.id === rescheduleId);
    if (!m) return;
    onUpdateMatch({ 
        ...m, 
        date: newDate || m.date, 
        status: newStatus,
        team1: editTeam1,
        team2: editTeam2
    });
    setRescheduleId(null);
    setNewDate('');
  };

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Fixtures</h2>
      </div>

      {/* Generator Section - Admin Only */}
      {isAdmin && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-primary" />
            Generate New Fixtures
        </h3>
        
        <div className="space-y-2">
            <p className="text-sm text-slate-500">Select players to include in the rotation:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {players.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-slate-50 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={selectedPlayers.includes(p.id)}
                            onChange={(e) => {
                                if (e.target.checked) setSelectedPlayers([...selectedPlayers, p.id]);
                                else setSelectedPlayers(selectedPlayers.filter(id => id !== p.id));
                            }}
                            className="rounded text-primary focus:ring-primary"
                        />
                        {p.name}
                        {p.seed !== undefined && <span className="text-xs text-slate-400 ml-1">(Seed: {p.seed})</span>}
                    </label>
                ))}
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">League Start Date (Week Commencing)</label>
            <input
                type="date"
                value={leagueStartDate}
                onChange={(e) => setLeagueStartDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
        </div>

        <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
            {isGenerating ? (
                <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                </>
            ) : (
                'Generate Rounds'
            )}
        </button>

        {generated.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                <h4 className="font-medium text-slate-700 mb-3">Preview ({generated.length} Matches)</h4>
                
                {stats && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h5 className="font-bold text-slate-800">Fairness Optimization Stats</h5>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">STRICT MODE</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p>Max Opponent Repeat: <span className="font-mono font-bold">{stats.maxOpponentRepeat}</span></p>
                                <p>Min Opponent Repeat: <span className="font-mono font-bold">{stats.minOpponentRepeat}</span></p>
                                <p>Total Cost: <span className="font-mono">{stats.cost}</span></p>
                                {stats.seeded_3x_summary && (
                                  <div className="pt-2 mt-2 border-t border-slate-200 text-[10px]">
                                    <p className="font-semibold mb-1">Seeded 3x Repeats:</p>
                                    <div className="grid grid-cols-2 gap-x-2">
                                        <p>Top-Top: {stats.seeded_3x_summary.topTop}</p>
                                        <p>Top-Low: {stats.seeded_3x_summary.topLow}</p>
                                        <p>Total: {stats.seeded_3x_summary.total}</p>
                                    </div>
                                  </div>
                                )}
                            </div>
                            <div>
                                <p className="mb-1 font-semibold">Opponent Frequency (Pairs):</p>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {Object.entries(stats.opponentCountHistogram || {}).map(([k, v]) => (
                                        <div key={k} className="bg-white px-2 py-1 rounded border border-slate-100 shadow-sm flex items-center gap-1">
                                            <span className="font-bold text-slate-800">{k}x:</span> 
                                            <span>{v as any}</span>
                                        </div>
                                    ))}
                                </div>
                                {explanation && (
                                    <div className="p-2 bg-blue-50 text-blue-800 rounded border border-blue-100 text-[10px] whitespace-pre-wrap leading-tight">
                                        {explanation}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto pr-2">
                    {Object.entries(generated.reduce((acc, m) => {
                        (acc[m.date] = acc[m.date] || []).push(m);
                        return acc;
                    }, {} as Record<string, typeof generated>)).map(([date, roundMatches]) => (
                        <div key={date}>
                            <h5 className="text-xs font-bold text-slate-500 mb-1 sticky top-0 bg-white py-1">
                                W/C {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </h5>
                            <div className="space-y-1">
                                {roundMatches.map((m, idx) => (
                                    <div key={m.id || idx} className="text-xs bg-slate-50 p-2 rounded flex justify-between items-center border border-slate-100">
                                        <span>
                                            <Link to={`/player/${m.team1[0]}`} className="font-medium hover:underline hover:text-primary">{getPlayerName(m.team1[0])}</Link>
                                            /
                                            <Link to={`/player/${m.team1[1]}`} className="font-medium hover:underline hover:text-primary">{getPlayerName(m.team1[1])}</Link>
                                            <span className="text-slate-300 mx-2">vs</span>
                                            <Link to={`/player/${m.team2[0]}`} className="font-medium hover:underline hover:text-primary">{getPlayerName(m.team2[0])}</Link>
                                            /
                                            <Link to={`/player/${m.team2[1]}`} className="font-medium hover:underline hover:text-primary">{getPlayerName(m.team2[1])}</Link>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <button 
                    onClick={handleConfirm}
                    className="w-full bg-primary text-white py-2 rounded-lg font-bold text-sm shadow-lg shadow-primary/20"
                >
                    Confirm & Add to Schedule
                </button>
            </div>
        )}
      </div>
      )}

      {/* Scheduled Matches List */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Upcoming Matches
        </h3>
        
        {scheduledMatches.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No scheduled matches. Generate some above!
            </div>
        ) : (
            <div className="space-y-8">
                {Object.entries(scheduledMatches.reduce((acc, m) => {
                    (acc[m.date] = acc[m.date] || []).push(m);
                    return acc;
                }, {} as Record<string, typeof scheduledMatches>)).map(([date, matches]) => (
                    <div key={date} className="space-y-3">
                        <h4 className="font-bold text-sm text-slate-500 flex items-center gap-2 sticky top-0 bg-slate-50/95 p-2 rounded-lg backdrop-blur-sm z-10">
                            <span className="w-2 h-2 rounded-full bg-primary/40"></span>
                            W/C {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h4>
                        {matches.map(match => {
                            const weekStart = getWeekStartDate(new Date(match.date));
                            const dayName = new Date(match.date).toLocaleDateString('en-US', { weekday: 'short' });
                            
                            const getPlayerStatus = (pid: string) => {
                                const avail = getAvailability(pid, weekStart);
                                if (!avail) return 'unknown';
                                if (!avail.isAvailable) return 'no';
                                if (avail.daysAvailable.includes(dayName)) return 'yes';
                                return 'no';
                            };

                            return (
                            <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                                        match.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                                        match.status === 'postponed' ? 'bg-amber-50 text-amber-700' :
                                        'bg-slate-50 text-slate-500'
                                        }`}>{match.status === 'postponed' ? 'Postponed' : 'Scheduled'}</span>

                                        <div className="ml-2 pl-2 border-l border-slate-200">
                                            <MatchAvailabilityStatus match={match} />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                    {(isAdmin) && (
                                        <button 
                                            onClick={() => navigate(`/add-match?matchId=${match.id}`)}
                                            className="flex items-center gap-1 text-primary font-bold hover:text-teal-700"
                                        >
                                            <Play className="w-3 h-3 fill-current" /> Play
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button
                                        onClick={() => startReschedule(match)}
                                        className="flex items-center gap-1 text-amber-700 font-bold hover:text-amber-800"
                                        >
                                        Edit
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => navigate(`/chat?matchId=${match.id}`)}
                                        className="flex items-center gap-1 text-slate-600 font-bold hover:text-slate-900 relative"
                                    >
                                        <MessageSquare className="w-3 h-3" /> Chat
                                        {getUnreadCount(match.id) > 0 && (
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">
                                                {getUnreadCount(match.id)}
                                            </span>
                                        )}
                                    </button>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <div className="flex-1 flex flex-col gap-1">
                                        {[match.team1[0], match.team1[1]].map(pid => {
                                            const status = getPlayerStatus(pid);
                                            return (
                                                <div key={pid} className="flex items-center gap-1.5">
                                                    <Link to={`/player/${pid}`} className="text-sm font-medium hover:underline truncate">{getPlayerName(pid)}</Link>
                                                    {status !== 'unknown' && (
                                                        <div title={status === 'yes' ? 'Available' : 'Unavailable'} className={status === 'yes' ? 'text-green-500' : 'text-red-500'}>
                                                            {status === 'yes' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                        </div>
                                                    )}
                                                    {status === 'unknown' && <HelpCircle className="w-3 h-3 text-slate-300" />}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="text-xs font-bold text-slate-300 px-4">VS</div>

                                    <div className="flex-1 flex flex-col gap-1 items-end">
                                        {[match.team2[0], match.team2[1]].map(pid => {
                                            const status = getPlayerStatus(pid);
                                            return (
                                                <div key={pid} className="flex items-center gap-1.5 flex-row-reverse">
                                                    <Link to={`/player/${pid}`} className="text-sm font-medium hover:underline truncate">{getPlayerName(pid)}</Link>
                                                    {status !== 'unknown' && (
                                                        <div title={status === 'yes' ? 'Available' : 'Unavailable'} className={status === 'yes' ? 'text-green-500' : 'text-red-500'}>
                                                            {status === 'yes' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                        </div>
                                                    )}
                                                    {status === 'unknown' && <HelpCircle className="w-3 h-3 text-slate-300" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        )}
      </div>
      
      {rescheduleId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Edit Match</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700">Scheduled Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Match['status'])}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>

              {/* Player Editing Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800">Edit Lineup</h4>
                
                {/* Team 1 */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Team 1</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[0, 1].map(idx => (
                            <select
                                key={`t1-${idx}`}
                                value={editTeam1[idx]}
                                onChange={(e) => {
                                    const newTeam = [...editTeam1];
                                    newTeam[idx] = e.target.value;
                                    setEditTeam1(newTeam);
                                }}
                                className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                            >
                                {players.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        ))}
                    </div>
                </div>

                {/* Team 2 */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Team 2</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[0, 1].map(idx => (
                            <select
                                key={`t2-${idx}`}
                                value={editTeam2[idx] || ''}
                          onChange={(e) => {
                              const newTeam = [...editTeam2];
                              newTeam[idx] = e.target.value;
                              setEditTeam2(newTeam);
                          }}
                                className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                            >
                                {players.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        ))}
                    </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRescheduleId(null)}
                  className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={applyReschedule}
                  className="flex-1 py-3 text-white font-bold bg-primary rounded-xl hover:bg-teal-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
