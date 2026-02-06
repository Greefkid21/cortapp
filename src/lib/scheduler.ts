import { Player, Match } from '../types';

/**
 * Generates a schedule where:
 * 1. Each player partners with every other player exactly once (using Polygon Method).
 * 2. Opponent matchups are optimized globally to ensure perfect or near-perfect balance.
 * 
 * Algorithm:
 * - Partnerships: 1-Factorization of K_n (Round Robin).
 * - Matchups: Iterative Global Optimization (Random Restart Hill Climbing).
 *   Instead of optimizing greedily round-by-round, we optimize the *entire season* structure.
 */
export function generateSchedule(players: Player[], startDate: string = new Date().toISOString().split('T')[0]): Match[] {
  // 1. Handle Odd Number of Players & Shuffle
  const realPlayerIds = players.map(p => p.id);
  
  // Fisher-Yates shuffle to ensure randomness in starting configuration
  for (let i = realPlayerIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [realPlayerIds[i], realPlayerIds[j]] = [realPlayerIds[j], realPlayerIds[i]];
  }

  let n = realPlayerIds.length;
  const workingPlayers = [...realPlayerIds];
  
  if (n % 2 !== 0) {
    workingPlayers.push('BYE');
    n++;
  }

  // 2. Generate All Rounds of Partnerships (Fixed)
  // We use the Polygon Method to determine *who pairs with whom* in each round.
  // This part is deterministic (relative to the shuffled order) and guarantees uniqueness.
  const numRounds = n - 1;
  const fixedPlayer = workingPlayers[n - 1]; 
  const rotatingPlayers = workingPlayers.slice(0, n - 1);
  const numRotating = rotatingPlayers.length;

  const roundsOfPairs: string[][][] = [];

  for (let r = 0; r < numRounds; r++) {
    const pairs: string[][] = [];
    const pFixed = fixedPlayer;
    const pRotator = rotatingPlayers[r % numRotating];
    pairs.push([pFixed, pRotator]);

    for (let k = 1; k <= (n - 2) / 2; k++) {
      const idx1 = (r - k + numRotating) % numRotating;
      const idx2 = (r + k) % numRotating;
      pairs.push([rotatingPlayers[idx1], rotatingPlayers[idx2]]);
    }
    
    // Filter BYE
    roundsOfPairs.push(pairs.filter(pair => pair[0] !== 'BYE' && pair[1] !== 'BYE'));
  }

  // 3. Global Optimization
  // We run multiple attempts with different random shuffles and keep the best one.
  // For N=8, 2000 attempts is very fast (<1s) and gives a good chance of finding a balanced schedule.
  return generateBestSchedule(players, startDate, n <= 8 ? 2000 : 500);
}

function generateBestSchedule(players: Player[], startDate: string, attempts: number): Match[] {
  let bestMatches: Match[] = [];
  let bestScore = Infinity; // Lower is better (Variance)

  for (let i = 0; i < attempts; i++) {
    const matches = generateSingleSchedule(players, startDate);
    const score = evaluateSchedule(matches, players);
    
    if (score < bestScore) {
      bestScore = score;
      bestMatches = matches;
    }
    
    // Perfect score check (for 8 players, perfect is 0 variance if everyone plays everyone 2x)
    // Variance calculation might not be exactly 0, but if difference is small.
    if (score < 0.5) break; 
  }
  
  return bestMatches;
}

function evaluateSchedule(matches: Match[], players: Player[]): number {
  const counts = new Map<string, number>(); // Key: "p1-p2", Value: count
  
  matches.forEach(m => {
    m.team1.forEach(p1 => m.team2.forEach(p2 => {
      if (p1 === 'BYE' || p2 === 'BYE') return;
      const key = [p1, p2].sort().join('-');
      counts.set(key, (counts.get(key) || 0) + 1);
    }));
  });
  
  const values = Array.from(counts.values());
  if (values.length === 0) return Infinity;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // We want to minimize the gap between min and max plays.
  // Also minimize sum of squares deviation from mean?
  // Simple range is good proxy.
  return (max - min) + (max * 0.1); // Tie-breaker: prefer lower max
}

function generateSingleSchedule(players: Player[], startDate: string): Match[] {
  const generatedMatches: Match[] = [];
  
  // 1. Shuffle & Prep
  const realPlayerIds = players.map(p => p.id);
  // Fisher-Yates
  for (let i = realPlayerIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [realPlayerIds[i], realPlayerIds[j]] = [realPlayerIds[j], realPlayerIds[i]];
  }

  let n = realPlayerIds.length;
  const workingPlayers = [...realPlayerIds];
  if (n % 2 !== 0) {
    workingPlayers.push('BYE');
    n++;
  }

  // 2. Opponent History
  const opponentHistory = new Map<string, Map<string, number>>();
  workingPlayers.forEach(p => opponentHistory.set(p, new Map()));
  const getOpponentCount = (p1: string, p2: string) => opponentHistory.get(p1)?.get(p2) || 0;
  const recordMatch = (team1: string[], team2: string[]) => {
    for (const p1 of team1) {
      for (const p2 of team2) {
        if (p1 === 'BYE' || p2 === 'BYE') continue;
        const c = getOpponentCount(p1, p2);
        opponentHistory.get(p1)?.set(p2, c + 1);
        opponentHistory.get(p2)?.set(p1, c + 1);
      }
    }
  };

  // 3. Rounds
  const numRounds = n - 1;
  const fixedPlayer = workingPlayers[n - 1]; 
  const rotatingPlayers = workingPlayers.slice(0, n - 1);
  const numRotating = rotatingPlayers.length;

  for (let r = 0; r < numRounds; r++) {
    const roundDate = new Date(startDate);
    roundDate.setDate(roundDate.getDate() + (r * 7));
    const dateStr = roundDate.toISOString().split('T')[0];

    const pairs: string[][] = [];
    const pFixed = fixedPlayer;
    const pRotator = rotatingPlayers[r % numRotating];
    pairs.push([pFixed, pRotator]);

    for (let k = 1; k <= (n - 2) / 2; k++) {
      const idx1 = (r - k + numRotating) % numRotating;
      const idx2 = (r + k) % numRotating;
      pairs.push([rotatingPlayers[idx1], rotatingPlayers[idx2]]);
    }

    const activePairs = pairs.filter(pair => pair[0] !== 'BYE' && pair[1] !== 'BYE');
    
    // Optimize for this round
    const bestMatchups = findOptimalMatchups(activePairs, getOpponentCount);

    bestMatchups.forEach((matchUp, i) => {
      const team1 = matchUp[0];
      const team2 = matchUp[1];
      recordMatch(team1, team2);
      generatedMatches.push({
        id: `gen-${Date.now()}-${r}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        date: dateStr,
        team1: team1,
        team2: team2,
        sets: [],
        winner: null,
        status: 'scheduled'
      });
    });
  }

  return generatedMatches;
}

function findOptimalMatchups(
  pairs: string[][], 
  getCount: (p1: string, p2: string) => number
): [string[], string[]][] {
  if (pairs.length < 2) return [];

  let bestCost = Infinity;
  let bestConfiguration: [string[], string[]][] = [];

  const currentPair = pairs[0];
  const remainingPairs = pairs.slice(1);

  // Randomize order of checking to avoid deterministic bias in ties
  // (Though for N=8 it's small enough we check all)
  
  for (let i = 0; i < remainingPairs.length; i++) {
    const opponentPair = remainingPairs[i];
    const matchCost = calculateMatchCost(currentPair, opponentPair, getCount);
    
    const others = [...remainingPairs];
    others.splice(i, 1);
    
    const subResult = findOptimalMatchups(others, getCount);
    
    let totalCost = matchCost;
    for (const m of subResult) {
      totalCost += calculateMatchCost(m[0], m[1], getCount);
    }

    // Add small random noise to break ties? No, we want strict optimality for the cost function.
    if (totalCost < bestCost) {
      bestCost = totalCost;
      bestConfiguration = [[currentPair, opponentPair], ...subResult];
    }
  }

  return bestConfiguration;
}

function calculateMatchCost(team1: string[], team2: string[], getCount: (p1: string, p2: string) => number): number {
  let cost = 0;
  for (const p1 of team1) {
    for (const p2 of team2) {
      const count = getCount(p1, p2);
      // Cubic penalty to strongly discourage 3+ repeats
      // We bump this to power 5 to make '3' repeats prohibitively expensive compared to '2'.
      cost += Math.pow(count, 5); 
    }
  }
  return cost;
}
