import { Check, X, HelpCircle } from 'lucide-react';
import { useAvailability } from '../context/AvailabilityContext';
import { getWeekStartDate } from '../lib/utils';
import { Match } from '../types';

export function MatchAvailabilityStatus({ match }: { match: Match }) {
    const { getAvailability } = useAvailability();
    const weekStart = getWeekStartDate(new Date(match.date));

    const getStatus = (pid: string) => {
        const avail = getAvailability(pid, weekStart);
        if (!avail) return 'unknown';
        // Relaxed Logic: If user marked "Available" (Yes) for the week, show as ready (Tick),
    // regardless of whether the specific match day is selected.
        // Only show 'no' (X) if they explicitly said "No" for the week.
        if (!avail.isAvailable) return 'no';
        return 'yes';
    };

    const players = [...match.team1, ...match.team2];
    const statuses = players.map(getStatus);
    
    const unavailableCount = statuses.filter(s => s === 'no').length;
    const unknownCount = statuses.filter(s => s === 'unknown').length;
    const notReadyCount = unavailableCount + unknownCount;

    let indicatorColor = 'bg-green-500';
    if (notReadyCount >= 2) indicatorColor = 'bg-red-500';
    else if (notReadyCount === 1) indicatorColor = 'bg-amber-500';

    return (
        <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${indicatorColor}`} title="Match Readiness" />
            <span className="text-slate-400 font-medium text-xs">8:00–9:00am</span>
            
            <div className="flex -space-x-1.5">
                {statuses.map((s, i) => (
                    <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center border-2 border-white text-[10px] font-bold ${
                        s === 'yes' ? 'bg-green-100 text-green-600' : 
                        s === 'no' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                        {s === 'yes' && <Check className="w-3 h-3" />}
                        {s === 'no' && <X className="w-3 h-3" />}
                        {s === 'unknown' && <HelpCircle className="w-3 h-3" />}
                    </div>
                ))}
            </div>
        </div>
    );
}
