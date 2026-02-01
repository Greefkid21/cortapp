import { MatchForm } from '../components/MatchForm';
import { Player, Match } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export function AddMatch({ players, onAddMatch, matches }: { players: Player[], onAddMatch: (data: any) => void, matches?: Match[] }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId');
  
  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const initialMatch = matchId && matches ? matches.find(m => m.id === matchId) : undefined;

  const handleSubmit = (data: any) => {
    // In a real app, validate and process data here
    onAddMatch(data);
    navigate('/history');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">{initialMatch ? 'Play Scheduled Match' : 'Add New Match'}</h2>
      <MatchForm players={players} onSubmit={handleSubmit} initialData={initialMatch} />
    </div>
  );
}
