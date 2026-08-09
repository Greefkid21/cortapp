import { LeagueTable } from '../components/LeagueTable';
import { Player, Match } from '../types';

export function Home({ players }: { players: Player[]; matches: Match[] }) {
  return (
    <div className="space-y-6">
      <div className="brand-panel p-6 sm:p-7">
        <div className="brand-kicker mb-4">Cort Club League</div>
        <div className="flex justify-between items-center gap-4">
          <div>
            <h2 className="brand-heading text-3xl sm:text-4xl">League Standings</h2>
            <p className="brand-subtle mt-2 max-w-2xl">
              Live league positions, built for quick sharing and cleaner screenshots across socials and WhatsApp.
            </p>
          </div>
        </div>
      </div>

      <LeagueTable players={players} />
    </div>
  );
}
