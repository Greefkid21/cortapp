import { useState } from 'react';
import { Player, Match } from '../types';
import { Calendar, Play, MessageSquare, Check, X, HelpCircle, Edit2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useAvailability } from '../context/AvailabilityContext';
import { getWeekStartDate } from '../lib/utils';
import { MatchAvailabilityStatus } from '../components/MatchAvailabilityStatus';

interface FixturesProps {
  players: Player[];
  matches: Match[];
  onUpdateMatch?: (updated: Match) => void;
}

export function Fixtures({ players, matches, onUpdateMatch }: FixturesProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { getAvailability } = useAvailability();
  const { getUnreadCount } = useChat();
  
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Match['status']>('scheduled');
  const [editTeam1, setEditTeam1] = useState<string[]>([]);
  const [editTeam2, setEditTeam2] = useState<string[]>([]);
  
  const scheduledMatches = matches
    .filter(m => m.status !== 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Upcoming Fixtures</h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Check Match Chat for detailed player availability
            </p>
        </div>
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
                            
                            const getPlayerStatus = (pid: string) => {
                                const avail = getAvailability(pid, weekStart);
                                if (!avail) return 'unknown';
                                
                                // Force Green Tick if ANY day is selected
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
                                        title="Edit Match"
                                        >
                                        <Edit2 className="w-3 h-3" />
                                        <span className="hidden sm:inline">Edit</span>
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
