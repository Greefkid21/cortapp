import { useSearchParams, useNavigate } from 'react-router-dom';
import { MatchForm } from '../components/MatchForm';
import { Match, Player } from '../types';
import { ArrowLeft } from 'lucide-react';

interface AddMatchProps {
  matches: Match[];
  players: Player[];
  onAddResult: (match: Match) => void;
}

export function AddMatch({ matches, players, onAddResult }: AddMatchProps) {
  const [params] = useSearchParams();
  const matchId = params.get('matchId');
  const navigate = useNavigate();

  const match = matches.find(m => m.id === matchId);

  if (!match) {
    return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-slate-800">Match not found</h2>
            <button onClick={() => navigate('/fixtures')} className="mt-4 text-primary font-bold">Back to Fixtures</button>
        </div>
    );
  }

  const handleSubmit = (data: any) => {
      // Construct updated match object
      // Data from form: team1, team2, sets, tieBreaker (optional)
      const updatedMatch: Match = {
          ...match,
          team1: data.team1,
          team2: data.team2,
          sets: data.sets.map((s: any) => ({ team1: s.t1, team2: s.t2 })),
          tieBreaker: data.tieBreaker ? { team1: data.tieBreaker.t1, team2: data.tieBreaker.t2 } : undefined,
          status: 'completed'
      };

      onAddResult(updatedMatch);
      navigate('/fixtures');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/fixtures')} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">Add Match Result</h2>
      </div>

      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-700 mb-6">
        <p>You are entering the result for the match between <strong>{players.find(p => p.id === match.team1[0])?.name} / {players.find(p => p.id === match.team1[1])?.name}</strong> and <strong>{players.find(p => p.id === match.team2[0])?.name} / {players.find(p => p.id === match.team2[1])?.name}</strong>.</p>
        <p className="mt-1">Date: {new Date(match.date).toLocaleDateString()}</p>
      </div>

      <MatchForm 
        players={players} 
        initialData={match} 
        onSubmit={handleSubmit} 
      />
    </div>
  );
}
