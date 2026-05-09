import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Player, Competition } from '../types';
import { supabase } from '../lib/supabase';
import { Trophy, Plus, Calendar, Medal, Loader2, ChevronRight, X, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Competitions({ players }: { players: Player[] }) {
  const { isAdmin } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'americano' | 'mexicano'>('americano');
  const [maxPoints, setMaxPoints] = useState(24);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setCompetitions(data || []);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || selectedPlayers.length < 4) {
      alert('Please provide a name and select at least 4 players.');
      return;
    }

    setCreating(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('competitions')
        .insert([{
          name,
          type,
          max_points: maxPoints,
          players: selectedPlayers,
          date: new Date().toISOString().split('T')[0],
          status: 'open'
        }])
        .select()
        .single();

      if (error) throw error;
      
      setCompetitions([data, ...competitions]);
      setShowCreate(false);
      setName('');
      setSelectedPlayers([]);
    } catch (error: any) {
      alert('Error creating competition: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayers(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading tournaments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Competitions</h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-white p-2 rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {competitions.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Medal className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">No tournaments yet</h3>
              <p className="text-sm text-slate-500">Active tournaments will appear here.</p>
            </div>
          </div>
        ) : (
          competitions.map(comp => (
            <Link
              key={comp.id}
              to={`/competitions/${comp.id}`}
              className="group bg-white p-6 rounded-3xl border border-slate-100 hover:border-primary/30 transition-all shadow-sm hover:shadow-xl flex items-center justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                    comp.type === 'americano' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                  )}>
                    {comp.type}
                  </span>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                    comp.status === 'open' ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"
                  )}>
                    {comp.status}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors">
                  {comp.name}
                </h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-bold">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {comp.date}
                  </div>
                  <div className="flex items-center gap-1 text-primary">
                    <Users className="w-3.5 h-3.5" />
                    {comp.players.length} Players
                  </div>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-primary transition-colors group-hover:translate-x-1" />
            </Link>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">New Tournament</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tournament Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sunday Morning Americano"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-bold"
                  >
                    <option value="americano">Americano</option>
                    <option value="mexicano">Mexicano</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Points per Match</label>
                  <input
                    type="number"
                    value={maxPoints}
                    onChange={e => setMaxPoints(parseInt(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                  Select Players
                  <span className="text-primary">{selectedPlayers.length} Selected</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100">
                  {players.sort((a,b) => a.name.localeCompare(b.name)).map(player => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => togglePlayer(player.id)}
                      className={cn(
                        "p-3 rounded-xl text-left text-sm font-bold transition-all border",
                        selectedPlayers.includes(player.id)
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                          : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                      )}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-teal-700 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Start Tournament'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
