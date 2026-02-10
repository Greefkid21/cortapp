import { LeagueTable } from '../components/LeagueTable';
import { Player } from '../types';
import { AvailabilityWidget } from '../components/AvailabilityWidget';
import { useAuth } from '../context/AuthContext';
import { getNextWeekStartDate } from '../lib/utils';

export function Home({ players }: { players: Player[] }) {
  const { user } = useAuth();
  const nextWeekStart = getNextWeekStartDate();

  return (
    <div className="space-y-6">
      {user?.playerId && (
          <AvailabilityWidget playerId={user.playerId} weekStartDate={nextWeekStart} />
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">League Standings</h2>
      </div>

      <LeagueTable players={players} />
    </div>
  );
}
