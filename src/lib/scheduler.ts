import { Player, Match } from '../types';
import { generateStrictSchedule } from './strictScheduler';

export interface SchedulerResult {
    matches: Match[];
    fixtures?: Match[][];
    stats?: any;
    explanation?: string;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Generates a schedule for the league.
 * 
 * Dispatcher:
 * - If N is divisible by 4 (Strict Mode), uses the new strict solver (Partner-perfect, fairness optimized).
 * - Otherwise, falls back to the legacy solver (Polygon + Greedy/Exhaustive).
 */
export function generateSchedule(players: Player[], startDate: string = new Date().toISOString().split('T')[0]): SchedulerResult {
  try {
    if (!players || !Array.isArray(players) || players.length < 2) {
        throw new Error("Invalid players array provided");
    }

    const n = players.length;

    // Strict Mode for N % 4 === 0
    if (n % 4 === 0) {
        console.log(`Using Strict Mode Scheduler for ${n} players...`);
        const result = generateStrictSchedule(players, startDate);
        
        if (!result.ok) {
            console.error("Strict Mode Generation Failed:", result.error);
            return {
                matches: [],
                stats: result.stats,
                error: result.error
            };
        }

        // Flatten Match[][] to Match[] for legacy compatibility
        const flatMatches = result.fixtures ? result.fixtures.flat() : [];

        // Log stats for verification
        console.log("Strict Schedule Stats:", result.stats);
        
        return { 
            matches: flatMatches,
            fixtures: result.fixtures, 
            stats: result.stats,
            explanation: result.explanation
        };
    }

    // Legacy Mode for N % 4 !== 0
    console.log(`Using Legacy Scheduler for ${n} players (not divisible by 4)...`);
    // Fallback/Legacy Logic (Simplistic placeholder as strict mode is priority)
    return {
        matches: [],
        error: {
            code: "LEGACY_MODE_UNAVAILABLE",
            message: "Legacy mode (N not divisible by 4) is currently unavailable. Please use N=12, 16, etc."
        }
    };

  } catch (e) {
      console.error("Scheduler Error:", e);
      throw e;
  }
}
