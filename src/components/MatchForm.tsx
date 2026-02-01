import { useState } from 'react';
import { Player, Match } from '../types';
import { Save, Plus } from 'lucide-react';

interface MatchFormProps {
  players: Player[];
  onSubmit: (data: any) => void;
  initialData?: Match;
}

export function MatchForm({ players, onSubmit, initialData }: MatchFormProps) {
  const [team1, setTeam1] = useState<string[]>(initialData?.team1 || ['', '']);
  const [team2, setTeam2] = useState<string[]>(initialData?.team2 || ['', '']);
  const [sets, setSets] = useState(
    (initialData?.sets && initialData.sets.length > 0) 
      ? initialData.sets.map(s => ({ t1: s.team1, t2: s.team2 })) 
      : [{ t1: 0, t2: 0 }, { t1: 0, t2: 0 }]
  );
  const [tieBreaker, setTieBreaker] = useState(initialData?.tieBreaker ? { t1: initialData.tieBreaker.team1, t2: initialData.tieBreaker.team2 } : { t1: 0, t2: 0 });
  const [showTieBreaker, setShowTieBreaker] = useState(!!initialData?.tieBreaker);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { 
        team1, 
        team2, 
        sets,
        matchId: initialData?.id // Pass ID if editing/completing
    };
    if (showTieBreaker) {
      data.tieBreaker = tieBreaker;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-lg font-bold text-slate-900">Record Match</h2>
        
        {/* Teams Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="font-semibold text-primary">Team 1</h3>
            <select 
              value={team1[0]}
              onChange={(e) => { const newT = [...team1]; newT[0] = e.target.value; setTeam1(newT); }}
              className="w-full p-2 rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Select Player 1</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select 
              value={team1[1]}
              onChange={(e) => { const newT = [...team1]; newT[1] = e.target.value; setTeam1(newT); }}
              className="w-full p-2 rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Select Player 2</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">Team 2</h3>
            <select 
              value={team2[0]}
              onChange={(e) => { const newT = [...team2]; newT[0] = e.target.value; setTeam2(newT); }}
              className="w-full p-2 rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Select Player 3</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select 
              value={team2[1]}
              onChange={(e) => { const newT = [...team2]; newT[1] = e.target.value; setTeam2(newT); }}
              className="w-full p-2 rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Select Player 4</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Score Entry */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="font-medium text-slate-900">Score</h3>
          {sets.map((set, idx) => (
            <div key={idx} className="flex items-center justify-center gap-4">
              <span className="w-12 text-sm text-slate-500">Set {idx + 1}</span>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min="0" max="7"
                  className="w-12 h-10 text-center border border-slate-200 rounded-lg font-bold text-lg"
                  value={set.t1}
                  onChange={(e) => {
                    const newSets = [...sets];
                    newSets[idx].t1 = parseInt(e.target.value) || 0;
                    setSets(newSets);
                  }}
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="number" 
                  min="0" max="7"
                  className="w-12 h-10 text-center border border-slate-200 rounded-lg font-bold text-lg"
                  value={set.t2}
                  onChange={(e) => {
                    const newSets = [...sets];
                    newSets[idx].t2 = parseInt(e.target.value) || 0;
                    setSets(newSets);
                  }}
                />
              </div>
            </div>
          ))}
          <button type="button" className="text-xs text-primary font-medium flex items-center gap-1 mx-auto">
            <Plus className="w-3 h-3" /> Add Set
          </button>
        </div>

        {/* Tie Breaker Option */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
           <input 
             type="checkbox" 
             id="showTieBreaker"
             checked={showTieBreaker}
             onChange={(e) => setShowTieBreaker(e.target.checked)}
             className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
           />
           <label htmlFor="showTieBreaker" className="text-sm text-slate-700 font-medium">Add Tie Breaker</label>
        </div>

        {showTieBreaker && (
          <div className="space-y-4 pt-2">
             <h3 className="font-medium text-slate-900 text-sm">Tie Breaker (Best of 16)</h3>
             <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="0" max="16"
                    className="w-14 h-10 text-center border border-slate-200 rounded-lg font-bold text-lg bg-slate-50"
                    value={tieBreaker.t1}
                    onChange={(e) => setTieBreaker({...tieBreaker, t1: parseInt(e.target.value) || 0})}
                  />
                  <span className="text-slate-300">-</span>
                  <input 
                    type="number" 
                    min="0" max="16"
                    className="w-14 h-10 text-center border border-slate-200 rounded-lg font-bold text-lg bg-slate-50"
                    value={tieBreaker.t2}
                    onChange={(e) => setTieBreaker({...tieBreaker, t2: parseInt(e.target.value) || 0})}
                  />
                </div>
             </div>
          </div>
        )}
      </div>

      <button 
        type="submit"
        className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
      >
        <Save className="w-5 h-5" />
        Save Match
      </button>
    </form>
  );
}
