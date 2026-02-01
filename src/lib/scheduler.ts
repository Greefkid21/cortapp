import { Player, Match } from '../types';

/**
 * Generates a schedule where each player partners with every other player exactly once.
 * This uses a 1-factorization of the complete graph K_n (for even n).
 * 
 * Constraints:
 * - Best for N divisible by 4 (e.g., 4, 8, 12, 16).
 * - If N is not divisible by 4, some players will have byes (no match) in certain rounds.
 */
export function generateSchedule(players: Player[], startDate: string = new Date().toISOString().split('T')[0]): Match[] {
  const generatedMatches: Match[] = [];
  
  // 1. Handle Odd Number of Players
  // If odd, we add a dummy 'BYE' player to make it even.
  // The person paired with 'BYE' sits out that round.
  const realPlayerIds = players.map(p => p.id);
  let n = realPlayerIds.length;
  const workingPlayers = [...realPlayerIds];
  
  if (n % 2 !== 0) {
    workingPlayers.push('BYE');
    n++;
  }

  // 2. Algorithm: 1-Factorization of K_n
  // Vertices are 0, ..., n-1.
  // Fix vertex n-1. Rotate 0, ..., n-2.
  // Rounds = n - 1.
  
  const numRounds = n - 1;
  const fixedPlayer = workingPlayers[n - 1]; // The fixed player (usually the last one or BYE)
  const rotatingPlayers = workingPlayers.slice(0, n - 1);
  const numRotating = rotatingPlayers.length; // n - 1 (should be odd)

  for (let r = 0; r < numRounds; r++) {
    const roundDate = new Date(startDate);
    roundDate.setDate(roundDate.getDate() + (r * 7)); // Add 7 days per round
    const dateStr = roundDate.toISOString().split('T')[0];

    // Find pairs for this round
    const pairs: [string, string][] = [];

    // Pair the fixed player with the player at the current rotation index
    // The rotating indices are 0 to numRotating-1.
    // In round r, fixed player pairs with rotatingPlayers[r].
    // Note: The standard polygon method usually aligns index 'r' with 'infinity'.
    const pFixed = fixedPlayer;
    const pRotator = rotatingPlayers[r % numRotating];
    pairs.push([pFixed, pRotator]);

    // Pair the rest
    for (let k = 1; k <= (n - 2) / 2; k++) {
      // Indices in the rotating array
      const idx1 = (r - k + numRotating) % numRotating;
      const idx2 = (r + k) % numRotating;
      
      const p1 = rotatingPlayers[idx1];
      const p2 = rotatingPlayers[idx2];
      pairs.push([p1, p2]);
    }

    // 3. Filter out pairs containing 'BYE'
    // If a pair contains 'BYE', those players don't play this round (Bye).
    const validPairs = pairs.filter(pair => pair[0] !== 'BYE' && pair[1] !== 'BYE');

    // 4. Group pairs into Matches (Doubles: 2 pairs per match)
    // We pair validPairs[0] vs validPairs[1], validPairs[2] vs validPairs[3], etc.
    // If we have an odd number of valid pairs, one pair sits out (Bye).
    
    for (let i = 0; i < validPairs.length - 1; i += 2) {
      const pair1 = validPairs[i];
      const pair2 = validPairs[i+1];

      const newMatch: Match = {
        id: `gen-${Date.now()}-${r}-${i}`,
        date: dateStr,
        team1: pair1,
        team2: pair2,
        sets: [],
        winner: null,
        status: 'scheduled'
      };
      
      generatedMatches.push(newMatch);
    }
    
    // If validPairs.length is odd, the last pair (validPairs[validPairs.length-1]) 
    // unfortunately gets a bye this round because there's no opposing pair.
    // Ideally N is divisible by 4 so validPairs.length is even.
  }

  return generatedMatches;
}
