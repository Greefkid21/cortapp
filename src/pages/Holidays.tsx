import { Link } from 'react-router-dom';
import { CalendarDays, Plane, AlertCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Player } from '../types';
import { useAuth } from '../context/AuthContext';
import { useHolidays } from '../context/HolidayContext';

function formatHolidayRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (startDate === endDate) {
    return start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  return `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function Holidays({ players }: { players: Player[] }) {
  const { user } = useAuth();
  const { buildPath } = useAuth();
  const { holidays, loading, setupMessage } = useHolidays();

  const upcomingHolidays = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return holidays
      .filter(holiday => holiday.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [holidays]);

  const getPlayer = (playerId: string) => players.find(player => player.id === playerId);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="brand-panel p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-accent flex items-center justify-center shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="brand-kicker mb-3">Planning</div>
              <h2 className="brand-heading text-3xl sm:text-4xl">Holiday Sheet</h2>
              <p className="brand-subtle mt-2 text-sm sm:text-base">See who is away soon and plan fixtures around upcoming holidays.</p>
            </div>
          </div>
          {user?.playerId && (
            <Link
              to={buildPath(`/player/${user.playerId}`)}
              className="brand-button-accent whitespace-nowrap"
            >
              Manage Mine
            </Link>
          )}
        </div>
      </div>

      {setupMessage && (
        <div className="p-4 rounded-2xl border border-accent/50 bg-[#fff9cc] text-slate-900 text-sm flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
          <div className="space-y-2">
            <span className="block font-medium">{setupMessage}</span>
            <span className="block text-xs text-slate-700">
              Run the SQL in `supabase/migrations/20260706_create_player_holidays_table.sql` in your Supabase SQL editor to enable shared holiday saving.
            </span>
          </div>
        </div>
      )}

      <div className="brand-panel overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/5 flex items-center gap-3 bg-primary">
          <div className="w-9 h-9 rounded-xl bg-accent text-black flex items-center justify-center">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-white">Upcoming Holidays</h3>
            <p className="text-xs text-white/60">League-wide upcoming absences</p>
          </div>
        </div>

        {upcomingHolidays.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No upcoming holidays have been added yet.
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {upcomingHolidays.map((holiday) => {
              const player = getPlayer(holiday.playerId);
              const today = new Date().toISOString().split('T')[0];
              const isCurrent = holiday.startDate <= today && holiday.endDate >= today;

              return (
                <div key={holiday.id || `${holiday.playerId}-${holiday.startDate}-${holiday.endDate}`} className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-white to-[#faf8ef]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary border border-black/10 text-accent flex items-center justify-center overflow-hidden shadow-sm">
                      {player?.avatar ? (
                        <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold">{player?.name?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{player?.name || 'Unknown player'}</div>
                      <div className="text-sm text-slate-500">{formatHolidayRange(holiday.startDate, holiday.endDate)}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <span className={`text-xs font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full ${isCurrent ? 'bg-accent text-black' : 'bg-primary/10 text-primary'}`}>
                      {isCurrent ? 'Away Now' : 'Upcoming'}
                    </span>
                    {holiday.note && (
                      <div className="text-sm text-slate-600 italic max-w-md text-left sm:text-right">
                        "{holiday.note}"
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
