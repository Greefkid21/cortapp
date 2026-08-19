import { Player, Match } from '../types';
import { generateFlexibleSchedule } from './flexibleScheduler';
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
 * - If N is divisible by 4 (Strict Mode), uses the strict solver.
 * - Otherwise, uses a flexible solver that rotates weekly byes/rest players.
 */
export function generateSchedule(players: Player[], startDate: string = new Date().toISOString().split('T')[0]): SchedulerResult {
  try {
    if (!players || !Array.isArray(players) || players.length < 2) {
        throw new Error("Invalid players array provided");
    }

    const n = players.length;

    // Multi-Division Handling
    const divisions = Array.from(new Set(players.map(p => p.division || 1))).sort();
    if (divisions.length > 1) {
        console.log(`Generating Multi-Division Schedule for ${n} players...`);
        const allFixtures: Match[][] = [];
        let combinedExplanation = "";
        let combinedMatches: Match[] = [];

        for (const div of divisions) {
            const divPlayers = players.filter(p => (p.division || 1) === div);
            if (divPlayers.length === 0) continue;
            
            const result = generateSchedule(divPlayers, startDate);
            if (result.error) {
                return {
                    matches: [],
                    error: {
                        code: result.error.code,
                        message: `Division ${div} failed: ${result.error.message}`
                    }
                };
            }

            // Combine fixtures by week
            result.fixtures?.forEach((weekMatches, weekIdx) => {
                if (!allFixtures[weekIdx]) allFixtures[weekIdx] = [];
                allFixtures[weekIdx].push(...weekMatches);
            });
            
            if (result.matches) combinedMatches.push(...result.matches);
            combinedExplanation += `Division ${div}: ${result.explanation}\n`;
        }

        return {
            matches: combinedMatches,
            fixtures: allFixtures,
            explanation: combinedExplanation
        };
    }

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

    // Flexible Mode for N % 4 !== 0
    console.log(`Using Flexible Scheduler for ${n} players (with weekly byes)...`);
    const result = generateFlexibleSchedule(players, startDate);
    return {
        matches: result.matches,
        fixtures: result.fixtures,
        stats: result.stats,
        explanation: result.explanation
    };

  } catch (e) {
      console.error("Scheduler Error:", e);
      return {
        matches: [],
        error: {
          code: 'SCHEDULER_ERROR',
          message: e instanceof Error ? e.message : 'Unknown scheduler error'
        }
      };
  }
}
