import { Player, Match } from '../types';

interface SchedulerStats {
  maxOpponentRepeat: number;
  minOpponentRepeat: number;
  opponentCountHistogram: Record<number, number>;
  topRepeatedPairs: { p1: string; p2: string; count: number }[];
  cost: number;
}

interface StrictSchedulerResult {
  matches: Match[];
  stats: SchedulerStats;
}

export function generateStrictSchedule(
  players: Player[], 
  startDate: string,
  maxTimeMs: number = 800
): StrictSchedulerResult {
  const N = players.length;

  // 1. Strict Mode Eligibility
  if (N < 4 || N % 4 !== 0) {
    throw new Error(`Strict mode requires N >= 4 and divisible by 4 (e.g., 4, 8, 12, 16). Received ${N}.`);
  }

  const playerIds = players.map(p => p.id);
  // Map player IDs to 0..N-1 for internal calculation
  const idToIndex = new Map<string, number>();
  const indexToId = new Map<number, string>();
  playerIds.forEach((id, i) => {
    idToIndex.set(id, i);
    indexToId.set(i, id);
  });

  // 2. Deterministic Partner Construction (Polygon Method)
  // Generates N-1 rounds. Each round has N/2 pairs.
  // Each pair is a Team.
  const roundsOfTeams = generatePolygonRounds(N);

  // 3. Optimization (Matchup Assignment)
  // We need to partition N/2 teams into N/4 matches for each round.
  const bestSchedule = optimizeMatchups(roundsOfTeams, N, maxTimeMs);

  // 4. Convert to Match Objects
  const matches: Match[] = [];
  const dateObj = new Date(startDate);

  bestSchedule.weeks.forEach((weekMatches, weekIdx) => {
    // Calculate date for this week
    const weekDate = new Date(dateObj);
    weekDate.setDate(weekDate.getDate() + (weekIdx * 7));
    const dateStr = weekDate.toISOString().split('T')[0];

    weekMatches.forEach((matchTeams, matchIdx) => {
      const t1Indices = matchTeams[0];
      const t2Indices = matchTeams[1];

      matches.push({
        id: `strict-${weekIdx}-${matchIdx}-${Math.random().toString(36).substr(2, 9)}`,
        date: dateStr,
        team1: [indexToId.get(t1Indices[0])!, indexToId.get(t1Indices[1])!],
        team2: [indexToId.get(t2Indices[0])!, indexToId.get(t2Indices[1])!],
        sets: [],
        winner: null,
        status: 'scheduled'
      });
    });
  });

  return {
    matches,
    stats: bestSchedule.stats
  };
}

// --- Internal Logic ---

// Represents a Week: Array of Matches. Each Match is [TeamA, TeamB].
// Team is [p1, p2] (indices).
type Team = [number, number];
type Matchup = [Team, Team];
type WeekSchedule = Matchup[];

interface OptimizationResult {
  weeks: WeekSchedule[];
  stats: SchedulerStats;
}

function generatePolygonRounds(N: number): Team[][] {
  // Polygon method for 1-factorization of K_N
  // Fixed point: N-1.
  // Rotating points: 0 .. N-2.
  const rounds: Team[][] = [];
  const numRounds = N - 1;
  const numPairs = N / 2;

  for (let r = 0; r < numRounds; r++) {
    const roundPairs: Team[] = [];
    
    // 1. Pair fixed point (N-1) with current vertex r
    roundPairs.push([N - 1, r]);

    // 2. Pair others: (r-k) vs (r+k)
    // Vertices are 0..N-2 (total N-1 vertices in polygon)
    const m = N - 1;
    for (let k = 1; k < numPairs; k++) {
      const v1 = (r - k + m) % m;
      const v2 = (r + k) % m;
      roundPairs.push([v1, v2]);
    }

    rounds.push(roundPairs);
  }

  return rounds;
}

function getPenalty(count: number): number {
  if (count === 2) return 0;   // Ideal
  if (count === 1) return 1;   // Acceptable
  if (count === 3) return 1;   // Acceptable
  if (count === 0) return 50;  // Avoid (Very High)
  // >= 4: Forbidden (Extreme). Add gradient so 5 is worse than 4.
  return 100 + (count - 4) * 50;
}

function optimizeMatchups(roundsOfTeams: Team[][], N: number, maxTimeMs: number): OptimizationResult {
  const getNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const startTime = getNow();
  const numWeeks = roundsOfTeams.length;
  
  // Global Best
  let bestGlobalSchedule: WeekSchedule[] = [];
  let bestGlobalCost = Infinity;
  let bestGlobalStats: SchedulerStats | null = null;
  let restarts = 0;

  // Reusable buffers to avoid GC
  const opponentCounts = new Int32Array(N * N);

  // Helper to generate a random schedule from rounds
  const generateRandomSchedule = (): WeekSchedule[] => {
    return roundsOfTeams.map(teams => {
      // Shuffle teams in this round
      const shuffled = [...teams];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const matchups: Matchup[] = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        matchups.push([shuffled[i], shuffled[i + 1]]);
      }
      return matchups;
    });
  };

  // Helper to get stats from counts
  const getStats = (counts: Int32Array, cost: number): SchedulerStats => {
      const stats: SchedulerStats = {
          maxOpponentRepeat: 0,
          minOpponentRepeat: Infinity,
          opponentCountHistogram: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
          topRepeatedPairs: [],
          cost: cost
      };
      
      const pairsList: { p1: number, p2: number, count: number }[] = [];
      
      for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
              const c = counts[i * N + j];
              if (c > stats.maxOpponentRepeat) stats.maxOpponentRepeat = c;
              if (c < stats.minOpponentRepeat) stats.minOpponentRepeat = c;
              const histKey = c >= 4 ? 4 : c;
              stats.opponentCountHistogram[histKey] = (stats.opponentCountHistogram[histKey] || 0) + 1;
              pairsList.push({ p1: i, p2: j, count: c });
          }
      }
      
      stats.topRepeatedPairs = pairsList
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map(p => ({
              p1: `Player ${p.p1}`, 
              p2: `Player ${p.p2}`,
              count: p.count
          }));
      
      return stats;
  };

  // Main Restart Loop
  while ((getNow() - startTime) < maxTimeMs) {
      restarts++;
      
      // 1. Initialize Random Schedule
      const currentSchedule = generateRandomSchedule();
      
      // 2. Initialize Counts & Cost
      opponentCounts.fill(0);
      
      // Base penalty for all 0s
      // Total pairs = N*(N-1)/2. 
      // Cost = TotalPairs * penalty(0).
      let currentCost = (N * (N - 1) / 2) * getPenalty(0);

      // Update function
      const updateMetrics = (t1: Team, t2: Team, delta: number) => {
        const pairs = [
          [t1[0], t2[0]], [t1[0], t2[1]],
          [t1[1], t2[0]], [t1[1], t2[1]]
        ];

        let costChange = 0;
        for (const [p1, p2] of pairs) {
          const u = p1 < p2 ? p1 : p2;
          const v = p1 < p2 ? p2 : p1;
          const idx = u * N + v;
          
          const oldCount = opponentCounts[idx];
          const oldPenalty = getPenalty(oldCount);
          
          const newCount = oldCount + delta;
          opponentCounts[idx] = newCount;
          
          const newPenalty = getPenalty(newCount);
          costChange += (newPenalty - oldPenalty);
        }
        return costChange;
      };

      // Apply initial matches
      for (const week of currentSchedule) {
          for (const match of week) {
              currentCost += updateMetrics(match[0], match[1], 1);
          }
      }

      // 3. Hill Climbing
      let improved = true;
      let iterations = 0;
      const MAX_LOCAL_STEPS = 5000; // Prevent getting stuck too long in one valley

      while (improved && iterations < MAX_LOCAL_STEPS && (getNow() - startTime) < maxTimeMs) {
          improved = false;
          iterations++;

          // Try random swaps? Or iterating all swaps?
          // Iterating all swaps is expensive if N is large, but N<=20.
          // N=16 -> 15 weeks. 4 matches/week.
          // Swaps per week: 4C2 = 6 pairs of matches.
          // Total moves = 15 * 6 = 90. Tiny!
          // We can exhaustively check all neighbors!

          // Iterate all weeks
          for (let w = 0; w < numWeeks; w++) {
              const week = currentSchedule[w];
              // Iterate all pairs of matches
              for (let m1 = 0; m1 < week.length; m1++) {
                  for (let m2 = m1 + 1; m2 < week.length; m2++) {
                      
                      const matchA = week[m1];
                      const matchB = week[m2];
                      
                      const tA = matchA[0];
                      const tB = matchA[1];
                      const tC = matchB[0];
                      const tD = matchB[1];

                      // Remove old
                      let baseDelta = 0;
                      baseDelta += updateMetrics(tA, tB, -1);
                      baseDelta += updateMetrics(tC, tD, -1);

                      // Try Swap 1: (A, C), (B, D)
                      let d1 = baseDelta;
                      d1 += updateMetrics(tA, tC, 1);
                      d1 += updateMetrics(tB, tD, 1);
                      
                      // Revert
                      updateMetrics(tA, tC, -1);
                      updateMetrics(tB, tD, -1);

                      // Try Swap 2: (A, D), (C, B)
                      let d2 = baseDelta;
                      d2 += updateMetrics(tA, tD, 1);
                      d2 += updateMetrics(tC, tB, 1);
                      
                      // Revert
                      updateMetrics(tA, tD, -1);
                      updateMetrics(tC, tB, -1);

                      // Restore original state for now (to apply best)
                      updateMetrics(tA, tB, 1);
                      updateMetrics(tC, tD, 1);

                      // Apply best if improvement
                      if (d1 < 0 && d1 <= d2) {
                          // Apply Swap 1
                          updateMetrics(tA, tB, -1);
                          updateMetrics(tC, tD, -1);
                          updateMetrics(tA, tC, 1);
                          updateMetrics(tB, tD, 1);
                          currentCost += d1;
                          
                          week[m1] = [tA, tC];
                          week[m2] = [tB, tD];
                          improved = true;
                      } else if (d2 < 0) {
                          // Apply Swap 2
                          updateMetrics(tA, tB, -1);
                          updateMetrics(tC, tD, -1);
                          updateMetrics(tA, tD, 1);
                          updateMetrics(tC, tB, 1);
                          currentCost += d2;
                          
                          week[m1] = [tA, tD];
                          week[m2] = [tC, tB];
                          improved = true;
                      }
                  }
              }
          }
      }

      // 4. Update Global Best
      if (currentCost < bestGlobalCost) {
          bestGlobalCost = currentCost;
          // Deep copy schedule
          bestGlobalSchedule = currentSchedule.map(w => w.map(m => [m[0], m[1]]));
          bestGlobalStats = getStats(opponentCounts, currentCost);
      }
      
      // Check for perfection (all 2s -> cost 0)
      if (currentCost === 0) break;
  }
  
  // If no valid schedule found (shouldn't happen), return initial
  if (!bestGlobalStats) {
       // Should not happen as we run at least once
       return { weeks: [], stats: { cost: Infinity, maxOpponentRepeat: 0, minOpponentRepeat: 0, opponentCountHistogram: {}, topRepeatedPairs: [] } };
  }

  console.log(`Optimization finished. Restarts: ${restarts}. Best Cost: ${bestGlobalCost}`);
  
  // 4. Final Validation
  const { maxOpponentRepeat, minOpponentRepeat } = bestGlobalStats;
  if (minOpponentRepeat < 1 || maxOpponentRepeat > 3) {
      throw new Error(`Fairness validation failed: Opponent repeats must be between 1 and 3. Found range [${minOpponentRepeat}, ${maxOpponentRepeat}].`);
  }

  return { weeks: bestGlobalSchedule, stats: bestGlobalStats };
}
