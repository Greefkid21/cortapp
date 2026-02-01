import { MatchHistory } from '../components/MatchHistory';
import { Match, Player } from '../types';

export function HistoryPage({ matches, players, onEditResult }: { matches: Match[], players: Player[], onEditResult?: (match: Match) => void }) {
  return (
    <div className="space-y-6">
       <h2 className="text-2xl font-bold text-slate-900">Match History</h2>
       <MatchHistory matches={matches} players={players} onEditResult={onEditResult} />
    </div>
  );
}
