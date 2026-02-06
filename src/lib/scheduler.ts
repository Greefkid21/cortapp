import { Player, Match } from '../types';

/**
 * Generates a schedule where:
 * 1. Each player partners with every other player exactly once (using Polygon Method).
 * 2. Opponent matchups are optimized globally using exhaustive search over the fixed partnership rounds.
 * 
 * Algorithm:
 * - Partnerships: 1-Factorization of K_n (Round Robin / Polygon Method).
 * - Matchups: 
 *   1. Outer Loop: Random Restart (Shuffle Players) to vary the factorization structure.
 *   2. Inner Loop: Exhaustive Search (Recursion) to find the absolute best set of matchups 
 *      for a given factorization.
 *      For N=8, there are 7 rounds * 3 matchup-configurations/round = 3^7 = 2187 combinations.
 *      This is trivial to solve optimally.
 */
export function generateSchedule(players: Player[], startDate: string = new Date().toISOString().split('T')[0]): Match[] {
  console.log('Starting Optimized Fairness Search (100 restarts)...');
  const realPlayerIds = players.map(p => p.id);
  const n = realPlayerIds.length;
  
  // Optimization: Map player IDs to indices 0..N-1 for fast 2D array access
  const playerToIndex = new Map<string, number>();
  realPlayerIds.forEach((id, i) => playerToIndex.set(id, i));
  
  // Configuration
  // Adaptive strategy:
  // N <= 8: Exhaustive Search (Best quality, 3^7 = 2187 checks * 100 restarts)
  // N > 8: Greedy Search (Good quality, avoids exponential explosion)
  const USE_GREEDY = n > 8;
  const RESTARTS = USE_GREEDY ? 200 : 100; // More restarts for greedy to explore better
  
  let bestGlobalMatches: Match[] = [];
  let bestGlobalScore = Infinity;

  for (let i = 0; i < RESTARTS; i++) {
    // 1. Shuffle Players
    const shuffledIds = [...realPlayerIds];
    for (let k = shuffledIds.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [shuffledIds[k], shuffledIds[j]] = [shuffledIds[j], shuffledIds[k]];
    }

    // 2. Generate Rounds of Pairs (Polygon Method)
    const roundsOfPairs = generatePolygonRounds(shuffledIds);

    // 3. Search for Best Matchups
    let result;
    if (USE_GREEDY) {
        result = findGreedyScheduleForRounds(roundsOfPairs, startDate, playerToIndex, n);
    } else {
        result = findOptimalScheduleForRounds(roundsOfPairs, startDate, playerToIndex, n);
    }
    
    // 4. Evaluate Final Schedule Fairness
    const score = evaluateScheduleFairness(result.matches, playerToIndex, n);
    
    if (score < bestGlobalScore) {
      bestGlobalScore = score;
      bestGlobalMatches = result.matches;
      
      if (score <= 1.0) break;
    }
  }

  return bestGlobalMatches;
}

/**
 * Generates rounds of pairs using the Polygon Method (1-factorization of K_n).
 * Guarantees every player partners with every other player exactly once.
 * Requires N to be even.
 */
function generatePolygonRounds(players: string[]): string[][][] {
  const n = players.length;
  if (n % 2 !== 0) throw new Error("Number of players must be even for Polygon Method");

  const rounds: string[][][] = [];
  const numRounds = n - 1;
  const fixedPlayer = players[0];
  const rotatingPlayers = players.slice(1);

  for (let r = 0; r < numRounds; r++) {
    const roundPairs: string[][] = [];
    
    // Pair the fixed player with the current 'last' player in the rotation
    // (In standard polygon method, fixed point is center, others are vertices)
    // Here we align 0 with index r of rotation?
    // Let's use standard indices:
    // Fixed point connects to rotatingPlayers[r]
    // Then others connect crossing the polygon
    
    // Actually, simpler implementation:
    // Round r:
    // Pair (Fixed, Rotating[r])
    // Pair (Rotating[r+1], Rotating[r-1]) ...
    // Indices are mod (n-1)
    
    const m = rotatingPlayers.length; // n-1 (odd)
    
    // First pair: Fixed player + Rotating[r]
    roundPairs.push([fixedPlayer, rotatingPlayers[r]]);
    
    // Remaining pairs
    for (let i = 1; i <= (n - 2) / 2; i++) {
      const idx1 = (r + i) % m;
      const idx2 = (r - i + m) % m;
      roundPairs.push([rotatingPlayers[idx1], rotatingPlayers[idx2]]);
    }
    
    rounds.push(roundPairs);
  }
  
  return rounds;
}

/**
 * Given a list of pairs for a round, generate possible matchup configurations.
 * Handles even and odd numbers of pairs (odd = one pair gets a bye).
 */
function generateMatchConfigurations(pairs: string[][]): string[][][][] {
  // Base case: 0 or 1 pair -> No matches possible
  if (pairs.length < 2) {
    return [[]]; 
  }
  
  // Base case: 2 pairs -> 1 match
  if (pairs.length === 2) {
    return [[ [pairs[0], pairs[1]] ]];
  }
  
  // If odd number of pairs, we must pick one to sit out (Bye)
  if (pairs.length % 2 !== 0) {
    const results: string[][][][] = [];
    for (let i = 0; i < pairs.length; i++) {
        // Pair i is the bye
        const remaining = pairs.filter((_, idx) => idx !== i);
        const subConfigs = generateMatchConfigurations(remaining);
        // We don't record the bye in the match list, so just pass through subConfigs
        for (const sub of subConfigs) {
            results.push(sub);
        }
    }
    return results;
  }
  
  // Even number of pairs > 2
  // Fix first pair, iterate through opponents
  const results: string[][][][] = [];
  const first = pairs[0];
  
  for (let i = 1; i < pairs.length; i++) {
    const opponent = pairs[i];
    const remaining = pairs.filter((_, idx) => idx !== 0 && idx !== i);
    
    if (remaining.length === 0) {
       results.push([[first, opponent]]);
    } else {
      const subConfigs = generateMatchConfigurations(remaining);
      for (const subConfig of subConfigs) {
        results.push([[first, opponent], ...subConfig]);
      }
    }
  }
  
  return results;
}

function findGreedyScheduleForRounds(
    rounds: string[][][], 
    startDate: string,
    playerToIndex: Map<string, number>,
    n: number
): { matches: Match[], cost: number } {
    let currentMatches: Match[] = [];
    
    for (let r = 0; r < rounds.length; r++) {
        const pairs = rounds[r];
        const matchConfigs = generateMatchConfigurations(pairs);
        
        let bestConfig: Match[] | null = null;
        let bestConfigScore = Infinity;
        
        // Calculate date for this round
        const roundDate = new Date(startDate);
        roundDate.setDate(roundDate.getDate() + (r * 7));
        const dateStr = roundDate.toISOString().split('T')[0];

        // Evaluate each config locally
        for (const config of matchConfigs) {
             const roundMatches = config.map((matchUp, i) => ({
                id: `gen-${r}-${i}-${Math.random().toString(36).substr(2, 5)}`,
                date: dateStr,
                team1: matchUp[0],
                team2: matchUp[1],
                sets: [],
                winner: null,
                status: 'scheduled' as const
              }));

             const tempHistory = [...currentMatches, ...roundMatches];
             const { diff, totalCost } = calculateMetrics(tempHistory, playerToIndex, n);
             
             // Weighted score
             const score = diff * 1000000 + totalCost; 
             if (score < bestConfigScore) {
                 bestConfigScore = score;
                 bestConfig = roundMatches;
             }
        }
        
        if (bestConfig) {
            currentMatches.push(...bestConfig);
        }
    }
    
    const { totalCost } = calculateMetrics(currentMatches, playerToIndex, n);
    return { matches: currentMatches, cost: totalCost };
}

function findOptimalScheduleForRounds(
    rounds: string[][][], 
    startDate: string,
    playerToIndex: Map<string, number>,
    n: number
): { matches: Match[], cost: number } {
  // const numPairs = rounds[0].length; // Unused
  
  let bestSchedule: Match[] = [];
  let minMaxDiff = Infinity;
  let minTotalCost = Infinity;

  // Pre-allocate metrics buffer for performance
  // We use a flat array instead of 2D for slightly better perf? 2D is fine.
  
  function recurse(roundIdx: number, currentMatches: Match[]) {
    if (roundIdx === rounds.length) {
      // Base case: evaluate full schedule
      const { diff, totalCost } = calculateMetrics(currentMatches, playerToIndex, n);
      
      if (diff < minMaxDiff || (diff === minMaxDiff && totalCost < minTotalCost)) {
        minMaxDiff = diff;
        minTotalCost = totalCost;
        bestSchedule = [...currentMatches];
      }
      return;
    }

    const pairs = rounds[roundIdx];
    const matchConfigs = generateMatchConfigurations(pairs);
    
    // Calculate date once
    const roundDate = new Date(startDate);
    roundDate.setDate(roundDate.getDate() + (roundIdx * 7));
    const dateStr = roundDate.toISOString().split('T')[0];

    for (const config of matchConfigs) {
      const newMatches = config.map((matchUp, i) => ({
        id: `gen-${roundIdx}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        date: dateStr,
        team1: matchUp[0],
        team2: matchUp[1],
        sets: [],
        winner: null,
        status: 'scheduled' as const
      }));
      
      recurse(roundIdx + 1, [...currentMatches, ...newMatches]);
    }
  }

  recurse(0, []);
  return { matches: bestSchedule, cost: minTotalCost };
}

function calculateMetrics(matches: Match[], playerToIndex: Map<string, number>, n: number): { diff: number, totalCost: number } {
  // Use a flat array of size N*N to store counts
  // count[i*N + j] stores count of i vs j
  const counts = new Int32Array(n * n);
  
  let totalCost = 0;

  for (const m of matches) {
    // team1 vs team2
    // optimized inner loops
    const t1 = m.team1;
    const t2 = m.team2;
    // We assume doubles (2 players per team)
    // t1[0] vs t2[0], t1[0] vs t2[1], t1[1] vs t2[0], t1[1] vs t2[1]
    
    const p1a = playerToIndex.get(t1[0])!;
    const p1b = playerToIndex.get(t1[1])!;
    const p2a = playerToIndex.get(t2[0])!;
    const p2b = playerToIndex.get(t2[1])!;

    // Symmetric update not needed for cost calculation if we just check one way
    // But to be safe and simple, let's just increment lower-index vs higher-index
    
    const update = (i: number, j: number) => {
        const u = i < j ? i : j;
        const v = i < j ? j : i;
        counts[u * n + v]++;
    };

    update(p1a, p2a);
    update(p1a, p2b);
    update(p1b, p2a);
    update(p1b, p2b);
  }

  let min = Infinity;
  let max = -Infinity;
  let hasValues = false;

  // Scan the upper triangle
  for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
          const c = counts[i * n + j];
          if (c > 0) { // Only count pairs that played (should be all for a full round robin?)
             // Actually, some pairs might not play if N is large.
             // But for fairness, we want ALL pairs to play.
             // If c=0, that's a diff of (max - 0).
          }
          // Include 0s? The original code did: "values = Array.from(counts.values())"
          // Which only included non-zero entries (Map only stores keys that were set).
          // So we should only check c > 0.
          
          if (c > 0) {
            if (c < min) min = c;
            if (c > max) max = c;
            totalCost += Math.pow(c, 5);
            hasValues = true;
          }
      }
  }

  if (!hasValues) return { diff: Infinity, totalCost: Infinity };

  return { diff: max - min, totalCost };
}

function evaluateScheduleFairness(matches: Match[], playerToIndex: Map<string, number>, n: number): number {
  const { diff, totalCost } = calculateMetrics(matches, playerToIndex, n);
  return diff + (totalCost / 1000000); 
}
