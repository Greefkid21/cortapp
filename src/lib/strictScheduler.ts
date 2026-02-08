import { Player, Match } from '../types';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface StrictModeStats {
  maxOpponentRepeat: number;
  minOpponentRepeat: number;
  opponentCountHistogram: Record<string, number>; // "0":x, "1":y, ...
  cost: number;
  seeded_3x_summary: {
    total: number;
    topTop: number;   // Both in top quartile
    topMid: number;   // Top vs Mid
    midMid: number;   // Both Mid
    midLow: number;   // Mid vs Bottom
    lowLow: number;   // Both Bottom
    topLow: number;   // Top vs Bottom (Should be minimized)
  };
  per_player_strength_of_schedule: Array<{
    id: string;
    seed: number;
    avg_opponent_seed: number;
    matches_vs_top_quartile: number;
    matches_vs_bottom_quartile: number;
  }>;
}

export interface StrictModeResult {
  ok: boolean;
  fixtures?: Match[][];
  stats?: StrictModeStats;
  explanation?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// HELPER: SEED UTILS
// ---------------------------------------------------------------------------

function getSeedMetrics(players: Player[]) {
  // Check if seeds exist
  const seeds = players.map(p => p.seed).filter(s => s !== undefined) as number[];
  const maxSeed = seeds.length > 0 ? Math.max(...seeds, 1) : 1;
  const minSeed = seeds.length > 0 ? Math.min(...seeds, 1) : 1;
  
  // Create quick lookup for player index -> seed
  // We assume players are 0..N-1 in the internal logic, so we map input array index to seed
  const pSeeds = players.map(p => p.seed || 999);

  // Normalization functions
  // seedNorm(i): 1.0 = strongest (seed 1), 0.0 = weakest (maxSeed)
  const seedNorm = (idx: number) => {
    if (maxSeed === minSeed) return 0.5;
    return (maxSeed - pSeeds[idx]) / (maxSeed - minSeed);
  };

  return { maxSeed, minSeed, pSeeds, seedNorm };
}

// ---------------------------------------------------------------------------
// CORE SCHEDULER
// ---------------------------------------------------------------------------

export function generateStrictSchedule(
  players: Player[], 
  startDate: string, // Unused logic-wise but kept for signature compatibility if needed
  maxTimeMs: number = 500
): StrictModeResult {
  const N = players.length;
  const startTime = Date.now();

  // 1. ELIGIBILITY CHECKS
  if (N % 4 !== 0) {
    return {
      ok: false,
      error: {
        code: "STRICT_MODE_REQUIRES_N_DIV_4",
        message: `Strict mode requires N divisible by 4 (e.g., 12, 16, 20). You provided ${N}.`
      }
    };
  }
  
  // Check seeds
  const missingSeeds = players.some(p => p.seed === undefined || p.seed === null);
  if (missingSeeds) {
    return {
      ok: false,
      error: {
        code: "MISSING_SEEDS",
        message: "All players must have a seed for seeded strict mode."
      }
    };
  }

  // 2. PREPARE DATA
  const { pSeeds, seedNorm } = getSeedMetrics(players);

  // Precompute pair metrics for cost function
  // seedDistance(i,j) = abs(norm(i) - norm(j)) -> 0=same level, 1=max diff
  // topness(i,j) = (norm(i) + norm(j)) / 2 -> 1=both top, 0=both bottom
  const pairMetrics = new Array(N).fill(0).map(() => new Array(N).fill(null));
  
  for(let i=0; i<N; i++) {
    for(let j=0; j<N; j++) {
      if (i === j) continue;
      const normI = seedNorm(i);
      const normJ = seedNorm(j);
      const dist = Math.abs(normI - normJ);
      const top = (normI + normJ) / 2;
      pairMetrics[i][j] = { dist, top };
    }
  }

  // Cost Function
  const getPairCost = (i: number, j: number, count: number): number => {
    // Hard penalties based on counts - INCREASED MAGNITUDE
    // User requested base 50/100 for 0/4+, and 1 for 1/3.
    // We scale these up to ensure hard constraints are strictly respected by the optimizer.
    if (count === 2) return 0; // Ideal
    if (count === 0) return 30000; // Must avoid (User base 50 -> Scaled)
    if (count === 4) return 40000; // Forbidden (User base 100 -> Scaled)
    if (count > 4) return 100000 + (count - 3) * 10000; // Absolutely Forbidden

    const { dist, top } = pairMetrics[i][j];

    // Seed-weighted penalty for 3x
    if (count === 3) {
      // User formula: penalty *= (1 + seedDistance_norm - 0.6 * topness)
      // Base penalty 1000 (Scaled from 1)
      return 1000 * (1 + dist - 0.6 * top);
    }

    // Seed-weighted penalty for 1x
    if (count === 1) {
      // User formula: penalty *= (1 - 0.2 * seedDistance_norm)
      // Base penalty 500 (Scaled from 1)
      return 500 * (1 - 0.2 * dist);
    }

    return 0;
  };

  // 3. CONSTRUCTION (Partner-Perfect Wheel)
  // Polygon method for 1-factorization of K_N
  const rounds: Array<Array<[number, number]>> = [];
  const numRounds = N - 1;
  
  // Initialize ring 0..N-2
  const ring = Array.from({ length: N - 1 }, (_, i) => i);
  const fixedPoint = N - 1;

  for (let r = 0; r < numRounds; r++) {
    const roundPairs: [number, number][] = [];
    
    // Pair with center
    roundPairs.push([ring[0], fixedPoint]);
    
    // Pair others
    for (let k = 1; k <= (N - 2) / 2; k++) {
      const p1 = ring[k];
      const p2 = ring[ring.length - k];
      roundPairs.push([p1, p2]);
    }
    
    rounds.push(roundPairs);
    
    // Rotate ring
    const last = ring.pop()!;
    ring.unshift(last);
  }

  // Initial schedule
  let schedule = rounds.map(weekPairs => {
    const matches: [number, number][][] = [];
    for (let i = 0; i < weekPairs.length; i += 2) {
      matches.push([weekPairs[i], weekPairs[i+1]]);
    }
    return matches;
  });

  // 4. OPTIMIZATION (Hill Climbing with Random Restarts)
  
  const calculateTotalCostFromCounts = (counts: number[][]) => {
    let cost = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        cost += getPairCost(i, j, counts[i][j]);
      }
    }
    return cost;
  };

  const matchesPerWeek = N / 4;
  let globalBestSchedule = JSON.parse(JSON.stringify(schedule));
  let globalBestCost = Infinity;

  // Initial cost check
  const opponentCounts = Array(N).fill(0).map(() => Array(N).fill(0));
  const updateCounts = (sched: [number, number][][][], op: 'add' | 'sub', countsMatrix: number[][]) => {
      const val = op === 'add' ? 1 : -1;
      for (const week of sched) {
        for (const match of week) {
          const t1 = match[0];
          const t2 = match[1];
          // Opponents are t1 vs t2
          // t1[0] vs t2[0], t1[0] vs t2[1], t1[1] vs t2[0], t1[1] vs t2[1]
          countsMatrix[t1[0]][t2[0]] += val; countsMatrix[t2[0]][t1[0]] += val;
          countsMatrix[t1[0]][t2[1]] += val; countsMatrix[t2[1]][t1[0]] += val;
          countsMatrix[t1[1]][t2[0]] += val; countsMatrix[t2[0]][t1[1]] += val;
          countsMatrix[t1[1]][t2[1]] += val; countsMatrix[t2[1]][t1[1]] += val;
        }
      }
  };
  
  // Optimization Loop
  while ((Date.now() - startTime) < maxTimeMs) {
    // 4a. Random Initial State (Shuffle matches within weeks)
    const currentSchedule = rounds.map(weekPairs => {
      const shuffled = [...weekPairs].sort(() => Math.random() - 0.5);
      const matches: [number, number][][] = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        matches.push([shuffled[i], shuffled[i+1]]);
      }
      return matches;
    });

    const currentCounts = Array(N).fill(0).map(() => Array(N).fill(0));
    updateCounts(currentSchedule, 'add', currentCounts);
    let currentCost = calculateTotalCostFromCounts(currentCounts);

    // 4b. Local Search
    let localImprovement = true;
    let localIter = 0;
    const maxLocalIter = 10000; // Increased iterations from 2500

    while (localImprovement && localIter < maxLocalIter && (Date.now() - startTime) < maxTimeMs) {
        localImprovement = false;
        localIter++;

        // Pick a random week
        const w = Math.floor(Math.random() * numRounds);
        const week = currentSchedule[w];
        if (matchesPerWeek < 2) break;

        // Try multiple random swaps per iteration
        for(let k=0; k<15; k++) { // Increased swap attempts
            const m1Idx = Math.floor(Math.random() * matchesPerWeek);
            let m2Idx = Math.floor(Math.random() * matchesPerWeek);
            while (m2Idx === m1Idx) m2Idx = Math.floor(Math.random() * matchesPerWeek);
            
            const match1 = week[m1Idx];
            const match2 = week[m2Idx];

            // Pick random slots to swap (0 or 1)
            const slot1 = Math.random() < 0.5 ? 0 : 1;
            const slot2 = Math.random() < 0.5 ? 0 : 1;

            const t1_stay = match1[1 - slot1];
            const t1_move = match1[slot1];
            const t2_stay = match2[1 - slot2];
            const t2_move = match2[slot2];

            // Helper to calc delta cost for swapping t1_move and t2_move
            const getMatchDelta = () => {
                let delta = 0;
                
                // Remove current: (t1_stay vs t1_move) and (t2_stay vs t2_move)
                // Add new: (t1_stay vs t2_move) and (t2_stay vs t1_move)
                
                // For match1 (removing)
                const pairsRemove1 = [[t1_stay[0], t1_move[0]], [t1_stay[0], t1_move[1]], [t1_stay[1], t1_move[0]], [t1_stay[1], t1_move[1]]];
                for (const [p1, p2] of pairsRemove1) {
                    const c = currentCounts[p1][p2];
                    delta -= getPairCost(p1, p2, c);
                    delta += getPairCost(p1, p2, c - 1);
                }

                // For match2 (removing)
                const pairsRemove2 = [[t2_stay[0], t2_move[0]], [t2_stay[0], t2_move[1]], [t2_stay[1], t2_move[0]], [t2_stay[1], t2_move[1]]];
                for (const [p1, p2] of pairsRemove2) {
                    const c = currentCounts[p1][p2];
                    delta -= getPairCost(p1, p2, c);
                    delta += getPairCost(p1, p2, c - 1);
                }

                // For match1 (adding t2_move)
                const pairsAdd1 = [[t1_stay[0], t2_move[0]], [t1_stay[0], t2_move[1]], [t1_stay[1], t2_move[0]], [t1_stay[1], t2_move[1]]];
                for (const [p1, p2] of pairsAdd1) {
                    const c = currentCounts[p1][p2];
                    delta -= getPairCost(p1, p2, c);
                    delta += getPairCost(p1, p2, c + 1);
                }

                // For match2 (adding t1_move)
                const pairsAdd2 = [[t2_stay[0], t1_move[0]], [t2_stay[0], t1_move[1]], [t2_stay[1], t1_move[0]], [t2_stay[1], t1_move[1]]];
                for (const [p1, p2] of pairsAdd2) {
                    const c = currentCounts[p1][p2];
                    delta -= getPairCost(p1, p2, c);
                    delta += getPairCost(p1, p2, c + 1);
                }
                
                return delta;
            };

            const delta = getMatchDelta();

            // Accept improvement OR Simulated Annealing
            // If delta < 0, we improve (cost goes down).
            // If delta > 0, we degrade.
            // SA Probability: exp(-delta / Temp). 
            // We use a simplified constant factor here.
            // Since penalties are huge (50000), we only want to accept bad moves if they are small (seed optimizations).
            // If delta is huge (e.g. creating a 0 or 4), prob should be 0.
            
            let accept = false;
            if (delta < 0) {
                accept = true;
            } else {
                 // Only allow uphill moves if they are "small" (seed adjustments, < 100)
                 if (delta < 100 && Math.random() < Math.exp(-delta * 0.5)) {
                    accept = true;
                 }
            }

            if (accept) {
                // Apply move
                // Update counts
                const pairsRemove = [
                    ...[[t1_stay[0], t1_move[0]], [t1_stay[0], t1_move[1]], [t1_stay[1], t1_move[0]], [t1_stay[1], t1_move[1]]],
                    ...[[t2_stay[0], t2_move[0]], [t2_stay[0], t2_move[1]], [t2_stay[1], t2_move[0]], [t2_stay[1], t2_move[1]]]
                ];
                for(const [p1, p2] of pairsRemove) {
                    currentCounts[p1][p2]--; currentCounts[p2][p1]--;
                }
                
                const pairsAdd = [
                    ...[[t1_stay[0], t2_move[0]], [t1_stay[0], t2_move[1]], [t1_stay[1], t2_move[0]], [t1_stay[1], t2_move[1]]],
                    ...[[t2_stay[0], t1_move[0]], [t2_stay[0], t1_move[1]], [t2_stay[1], t1_move[0]], [t2_stay[1], t1_move[1]]]
                ];
                for(const [p1, p2] of pairsAdd) {
                    currentCounts[p1][p2]++; currentCounts[p2][p1]++;
                }

                // Swap in schedule
                match1[slot1] = t2_move;
                match2[slot2] = t1_move;
                
                currentCost += delta;
                localImprovement = true;
            }
        }
    }

    if (currentCost < globalBestCost) {
        globalBestCost = currentCost;
        globalBestSchedule = JSON.parse(JSON.stringify(currentSchedule));
    }
  }

  // Use Best Schedule
  schedule = globalBestSchedule;
  
  // Recompute final counts for stats
  // Reset opponentCounts
  for(let i=0; i<N; i++) for(let j=0; j<N; j++) opponentCounts[i][j] = 0;
  updateCounts(schedule, 'add', opponentCounts);

  // 5. VALIDATION & STATS
  const stats: StrictModeStats = {
    maxOpponentRepeat: 0,
    minOpponentRepeat: 999,
    opponentCountHistogram: {},
    cost: globalBestCost,
    seeded_3x_summary: {
      total: 0,
      topTop: 0, topMid: 0, midMid: 0, midLow: 0, lowLow: 0, topLow: 0
    },
    per_player_strength_of_schedule: []
  };

  let valid = true;
  let validationError = "";

  // Check Fairness Floors
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const c = opponentCounts[i][j];
      stats.maxOpponentRepeat = Math.max(stats.maxOpponentRepeat, c);
      stats.minOpponentRepeat = Math.min(stats.minOpponentRepeat, c);
      
      const k = String(c);
      stats.opponentCountHistogram[k] = (stats.opponentCountHistogram[k] || 0) + 1;

      // Fail if < 1 or > 3
      if (c < 1 || c > 3) {
        valid = false;
        validationError = `Opponent count violation: Player ${i+1} vs ${j+1} played ${c} times (must be 1-3).`;
      }

      // Seed stats for 3x
      if (c === 3) {
        stats.seeded_3x_summary.total++;
        const s1 = seedNorm(i);
        const s2 = seedNorm(j);
        
        // Categorize
        // Quartiles approx: Top > 0.66, Mid 0.33-0.66, Low < 0.33
        const q1 = s1 > 0.66 ? 'T' : (s1 < 0.33 ? 'L' : 'M');
        const q2 = s2 > 0.66 ? 'T' : (s2 < 0.33 ? 'L' : 'M');
        const combo = [q1, q2].sort().join('');
        
        if (combo === 'TT') stats.seeded_3x_summary.topTop++;
        else if (combo === 'TM') stats.seeded_3x_summary.topMid++;
        else if (combo === 'MM') stats.seeded_3x_summary.midMid++;
        else if (combo === 'LM') stats.seeded_3x_summary.midLow++;
        else if (combo === 'LL') stats.seeded_3x_summary.lowLow++;
        else if (combo === 'LT') stats.seeded_3x_summary.topLow++;
      }
    }
  }

  // Player Strength of Schedule
  stats.per_player_strength_of_schedule = players.map((p, idx) => {
    let oppSeedsSum = 0;
    let oppCount = 0;
    let vsTop = 0;
    let vsBot = 0;
    
    for (let oppIdx = 0; oppIdx < N; oppIdx++) {
      if (idx === oppIdx) continue;
      const cnt = opponentCounts[idx][oppIdx];
      if (cnt > 0) {
        oppSeedsSum += (pSeeds[oppIdx] * cnt);
        oppCount += cnt;
        if (seedNorm(oppIdx) > 0.66) vsTop += cnt;
        if (seedNorm(oppIdx) < 0.33) vsBot += cnt;
      }
    }
    
    return {
      id: p.id,
      seed: pSeeds[idx],
      avg_opponent_seed: oppCount > 0 ? parseFloat((oppSeedsSum / oppCount).toFixed(2)) : 0,
      matches_vs_top_quartile: vsTop,
      matches_vs_bottom_quartile: vsBot
    };
  });

  if (!valid) {
    return {
      ok: false,
      error: {
        code: "FAIRNESS_VALIDATION_FAILED",
        message: validationError
      },
      stats // Return stats even on failure for debugging
    };
  }

  // 6. FORMAT OUTPUT
  const fixtures: Match[][] = schedule.map((weekMatches, wIdx) => {
    return weekMatches.map((m, mIdx) => {
      // Map indices back to Player IDs
      return {
        id: `w${wIdx+1}-m${mIdx+1}`,
        team1: [players[m[0][0]].id, players[m[0][1]].id],
        team2: [players[m[1][0]].id, players[m[1][1]].id],
        round: wIdx + 1,
        date: new Date(startDate).toISOString(), // Placeholder
        court: mIdx + 1,
        sets: [],
        winner: null,
        status: 'scheduled'
      };
    });
  });

  // Explanation
  const avgSeed = stats.per_player_strength_of_schedule.reduce((acc, p) => acc + p.avg_opponent_seed, 0) / N;
  const hardSchedulePlayers = stats.per_player_strength_of_schedule
    .filter(p => p.avg_opponent_seed < avgSeed - 1.0) // Lower avg seed = Harder opponents
    .map(p => p.id);
  const easySchedulePlayers = stats.per_player_strength_of_schedule
    .filter(p => p.avg_opponent_seed > avgSeed + 1.0) // Higher avg seed = Easier opponents
    .map(p => p.id);

  let explanation = `
Generated strict mode schedule for ${N} players.
- Constraints: All hard constraints met (Partner rotation, No byes).
- Fairness: Opponent repeats bounded between ${stats.minOpponentRepeat} and ${stats.maxOpponentRepeat}.
- Seed Logic: 3x repeats biased towards similar skill levels. 
  (Top-Top: ${stats.seeded_3x_summary.topTop}, Top-Low: ${stats.seeded_3x_summary.topLow}).
`.trim();

  if (hardSchedulePlayers.length > 0) {
      explanation += `\n- Note: Players ${hardSchedulePlayers.join(', ')} have a harder than average schedule.`;
  }
  if (easySchedulePlayers.length > 0) {
      explanation += `\n- Note: Players ${easySchedulePlayers.join(', ')} have an easier than average schedule.`;
  }

  return {
    ok: true,
    fixtures,
    stats,
    explanation
  };
}
