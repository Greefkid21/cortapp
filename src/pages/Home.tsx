import { LeagueTable } from '../components/LeagueTable';
import { Player } from '../types';

export function Home({ players }: { players: Player[] }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">League Standings</h2>
      </div>

      <LeagueTable players={players} />
    </div>
  );
}
