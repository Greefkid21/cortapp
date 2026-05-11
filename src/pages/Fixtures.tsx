import { useMemo, useState } from 'react';
import { Player, Match } from '../types';
import { Calendar, Play, MessageSquare, Check, X, HelpCircle, Edit2, Sparkles, Save } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useAvailability } from '../context/AvailabilityContext';
import { getNextWeekStartDate, getWeekStartDate, formatDate } from '../lib/utils';
import { MatchAvailabilityStatus } from '../components/MatchAvailabilityStatus';

interface FixturesProps {
  players: Player[];
  matches: Match[];
  onUpdateMatch?: (updated: Match) => void;
  onGenerateFixtures?: (startDate: string) => Promise<void>;
}

export function Fixtures({ players, matches, onUpdateMatch, onGenerateFixtures }: FixturesProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { getAvailability } = useAvailability();
  const { getUnreadCount } = useChat();
  
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Match['status']>('scheduled');
  const [newTime, setNewTime] = useState<string>('');
  const [newVenue, setNewVenue] = useState<string>('');
  const [editTeam1, setEditTeam1] = useState<string[]>([]);
  const [editTeam2, setEditTeam2] = useState<string[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genStartDate, setGenStartDate] = useState(getNextWeekStartDate());
  const [generating, setGenerating] = useState(false);
  
  const leaguePlayers = useMemo(() => players.filter(p => p.in_league !== false), [players]);
  const scheduledMatches = matches
    .filter(m => m.status !== 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const startReschedule = (m: Match) => {
    setRescheduleId(m.id);
    setNewDate(m.date);
    setNewStatus(m.status);
    setNewTime(m.time || '');
    setNewVenue(m.venue || '');
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
        time: newTime || undefined,
        venue: newVenue || undefined,
        team1: editTeam1,
        team2: editTeam2
    });
    setRescheduleId(null);
    setNewDate('');
    setNewTime('');
    setNewVenue('');
  };

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';
  const getPlayerDivision = (id: string) => players.find(p => p.id === id)?.division || 1;
  const getMatchDivision = (match: Match): number | 'mixed' => {
    const divs = [...match.team1, ...match.team2].filter(Boolean).map(getPlayerDivision);
    if (divs.length === 0) return 'mixed';
    const first = divs[0];
    return divs.every(d => d === first) ? first : 'mixed';
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Upcoming Fixtures</h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Check Match Chat for detailed player availability
            </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowGenerate(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
            title="Generate Fixtures"
          >
            <Sparkles className="w-5 h-5 text-amber-400" />
            Generate
          </button>
        )}
      </div>

      {/* Scheduled Matches List */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Upcoming Matches
        </h3>
        
        {scheduledMatches.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No scheduled matches.
            </div>
        ) : (
            <div className="space-y-8">
                {Object.entries(
                  scheduledMatches.reduce((acc, m) => {
                    const weekKey = getWeekStartDate(new Date(m.date));
                    (acc[weekKey] = acc[weekKey] || []).push(m);
                    return acc;
                  }, {} as Record<string, typeof scheduledMatches>)
                ).map(([weekStart, matches]) => (
                    <div key={weekStart} className="space-y-3">
                        <h4 className="font-bold text-sm text-slate-500 flex items-center gap-2 sticky top-0 bg-slate-50/95 p-2 rounded-lg backdrop-blur-sm z-10">
                            <span className="w-2 h-2 rounded-full bg-primary/40"></span>
                            W/C {new Date(weekStart).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h4>
                        {(() => {
                          const grouped = matches.reduce((acc, match) => {
                            const d = getMatchDivision(match);
                            (acc[d] = acc[d] || []).push(match);
                            return acc;
                          }, {} as Record<string, Match[]>);

                          const order: Array<number | 'mixed'> = [1, 2, 'mixed'];
                          const sections = order.filter(k => (grouped[String(k)] || []).length > 0);

                          const renderMatch = (match: Match) => {
                            const wkStart = getWeekStartDate(new Date(match.date));
                            const getPlayerStatus = (pid: string) => {
                              const avail = getAvailability(pid, wkStart);
                              if (!avail) return 'unknown';
                              if (avail.daysAvailable && avail.daysAvailable.length > 0) return 'yes';
                              if (avail.isAvailable) return 'yes';
                              return 'no';
                            };

                            return (
                              <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3">
                                <div className="flex flex-wrap justify-between items-center gap-y-2 text-xs text-slate-400">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                      match.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                                      match.status === 'postponed' ? 'bg-amber-50 text-amber-700' :
                                      'bg-slate-50 text-slate-500'
                                    }`}>{match.status === 'postponed' ? 'Postponed' : 'Scheduled'}</span>

                                    <div className="ml-1 pl-2 border-l border-slate-200 truncate">
                                      <MatchAvailabilityStatus match={match} />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-1 text-slate-500 font-bold">
                                      <Calendar className="w-3 h-3" />
                                      <span>{formatDate(match.date)}</span>
                                    </div>
                                    {match.time && (
                                      <div className="flex items-center gap-1 text-slate-700 font-bold border-l border-slate-200 pl-3 ml-1">
                                        <span>{match.time}</span>
                                      </div>
                                    )}
                                    {match.venue && (
                                      <div className="flex items-center gap-1 text-primary font-bold border-l border-slate-200 pl-3 ml-1">
                                        <HelpCircle className="w-3 h-3" />
                                        <span>{match.venue}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 ml-auto">
                                    {(isAdmin) && (
                                      <button 
                                        onClick={() => navigate(`/add-match?matchId=${match.id}`)}
                                        className="flex items-center gap-1 text-primary font-bold hover:text-teal-700 p-1"
                                        title="Record Result"
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                        <span className="hidden sm:inline">Play</span>
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => startReschedule(match)}
                                        className="flex items-center gap-1 text-amber-700 font-bold hover:text-amber-800 p-1"
                                        title="Reschedule Match"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                        <span className="hidden sm:inline">Reschedule</span>
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => navigate(`/chat?matchId=${match.id}`)}
                                      className="flex items-center gap-1 text-slate-600 font-bold hover:text-slate-900 relative p-1"
                                      title="Match Chat"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span className="hidden sm:inline">Chat</span>
                                      {getUnreadCount(match.id) > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white">
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
                          };

                          return (
                            <div className="space-y-6">
                              {sections.map((k) => {
                                const label = k === 'mixed' ? 'Mixed / Unassigned' : `Division ${k}`;
                                const pill = k === 'mixed'
                                  ? 'bg-slate-100 text-slate-600'
                                  : k === 1
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-emerald-50 text-emerald-700';

                                const ms = grouped[String(k)] || [];
                                return (
                                  <div key={String(k)} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${pill}`}>
                                        {label}
                                      </span>
                                      <span className="text-xs text-slate-400 font-bold">
                                        {ms.length} {ms.length === 1 ? 'match' : 'matches'}
                                      </span>
                                    </div>
                                    <div className="space-y-3">
                                      {ms.map(renderMatch)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-bold text-slate-700">Time</label>
                    <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <div>
                    <label className="text-sm font-bold text-slate-700">Venue</label>
                    <input
                        type="text"
                        placeholder="e.g. Court 1"
                        value={newVenue}
                        onChange={(e) => setNewVenue(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 focus:ring-2 focus:ring-primary outline-none text-sm"
                    />
                </div>
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

      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Generate Fixtures</h3>
              <button onClick={() => setShowGenerate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-medium">
                This creates weekly fixtures for Division 1 and Division 2 using the partner-rotation scheduler.
                Each division must have a player count divisible by 4.
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Start Week (Monday)</label>
                <input
                  type="date"
                  value={genStartDate}
                  onChange={(e) => setGenStartDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Eligible players: {leaguePlayers.length}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGenerate(false)}
                  className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  disabled={generating}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!onGenerateFixtures) return;
                    setGenerating(true);
                    try {
                      await onGenerateFixtures(genStartDate);
                      setShowGenerate(false);
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating || !onGenerateFixtures}
                  className="flex-1 py-3 text-white font-bold bg-primary rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? <Save className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
