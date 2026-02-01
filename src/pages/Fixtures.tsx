import { useState } from 'react';
import { Player, Match } from '../types';
import { generateSchedule } from '../lib/scheduler';
import { Calendar, Play, Shuffle, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

interface FixturesProps {
  players: Player[];
  matches: Match[];
  onAddMatches: (newMatches: Match[]) => void;
  onUpdateMatch?: (updated: Match) => void;
}

export function Fixtures({ players, matches, onAddMatches, onUpdateMatch }: FixturesProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { getUnreadCount } = useChat();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(players.map(p => p.id));
  const [generated, setGenerated] = useState<Match[]>([]);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Match['status']>('scheduled');
  const [leagueStartDate, setLeagueStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const scheduledMatches = matches
    .filter(m => m.status !== 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleGenerate = () => {
    // Filter player objects based on selection
    const activePlayers = players.filter(p => selectedPlayers.includes(p.id));
    const newFixtures = generateSchedule(activePlayers, leagueStartDate); // Generate full season (N-1 rounds)
    setGenerated(newFixtures);
  };

  const handleConfirm = () => {
    onAddMatches(generated);
    setGenerated([]);
  };

  const startReschedule = (m: Match) => {
    setRescheduleId(m.id);
    setNewDate(m.date);
    setNewStatus(m.status);
  };

  const applyReschedule = () => {
    if (!rescheduleId || !onUpdateMatch) return;
    const m = matches.find(mm => mm.id === rescheduleId);
    if (!m) return;
    onUpdateMatch({ ...m, date: newDate || m.date, status: newStatus });
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
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
        >
            Generate Rounds
        </button>

        {generated.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                <h4 className="font-medium text-slate-700 mb-3">Preview ({generated.length} Matches)</h4>
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
                                            <span className="font-medium">{getPlayerName(m.team1[0])}</span>/{getPlayerName(m.team1[1])}
                                            <span className="text-slate-300 mx-2">vs</span>
                                            <span className="font-medium">{getPlayerName(m.team2[0])}</span>/{getPlayerName(m.team2[1])}
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
                        {matches.map(match => (
                            <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                                    match.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                                    match.status === 'postponed' ? 'bg-amber-50 text-amber-700' :
                                    'bg-slate-50 text-slate-500'
                                    }`}>{match.status === 'postponed' ? 'Postponed' : 'Scheduled'}</span>
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
                                        Reschedule
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
                                        <span className="text-sm font-medium">{getPlayerName(match.team1[0])}</span>
                                        <span className="text-sm font-medium">{getPlayerName(match.team1[1])}</span>
                                    </div>

                                    <div className="text-xs font-bold text-slate-300 px-4">VS</div>

                                    <div className="flex-1 flex flex-col gap-1 text-right">
                                        <span className="text-sm font-medium">{getPlayerName(match.team2[0])}</span>
                                        <span className="text-sm font-medium">{getPlayerName(match.team2[1])}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )}
      </div>
      
      {rescheduleId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Reschedule Match</h3>
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
