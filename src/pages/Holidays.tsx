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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Plane className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Holiday Sheet</h2>
            <p className="text-sm text-slate-500">See who is away soon and plan fixtures around upcoming holidays.</p>
          </div>
        </div>
        {user?.playerId && (
          <Link
            to={`/player/${user.playerId}`}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
          >
            Manage Mine
          </Link>
        )}
      </div>

      {setupMessage && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{setupMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-slate-800">Upcoming Holidays</h3>
        </div>

        {upcomingHolidays.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No upcoming holidays have been added yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingHolidays.map((holiday) => {
              const player = getPlayer(holiday.playerId);
              const today = new Date().toISOString().split('T')[0];
              const isCurrent = holiday.startDate <= today && holiday.endDate >= today;

              return (
                <div key={holiday.id || `${holiday.playerId}-${holiday.startDate}-${holiday.endDate}`} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                      {player?.avatar ? (
                        <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-slate-500">{player?.name?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{player?.name || 'Unknown player'}</div>
                      <div className="text-sm text-slate-500">{formatHolidayRange(holiday.startDate, holiday.endDate)}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full ${isCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
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
