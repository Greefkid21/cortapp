import { Player, Competition, CompetitionMatch, CompetitionStandings } from '../types';

/**
 * Generates the next round of matches for a competition.
 */
export function generateNextCompetitionRound(
  competition: Competition,
  _players: Player[],
  existingMatches: CompetitionMatch[],
  standings: CompetitionStandings[]
): { round: number; matches: Partial<CompetitionMatch>[] } {
  const nextRoundNumber = existingMatches.length > 0 
    ? Math.max(...existingMatches.map(m => m.round)) + 1 
    : 1;

  if (competition.type === 'mexicano') {
    return generateMexicanoRound(competition, nextRoundNumber, standings);
  } else {
    return generateAmericanoRound(competition, nextRoundNumber, competition.players, existingMatches);
  }
}

/**
 * Mexicano Logic:
 * Round 1: Random pairings.
 * Round 2+: Based on standings. 
 * Court 1: Rank 1 & 4 vs Rank 2 & 3
 * Court 2: Rank 5 & 8 vs Rank 6 & 7
 * etc.
 */
function generateMexicanoRound(
  competition: Competition,
  round: number,
  standings: CompetitionStandings[]
): { round: number; matches: Partial<CompetitionMatch>[] } {
  const matches: Partial<CompetitionMatch>[] = [];
  
  // Use current standings for rankings, or competition.players if round 1
  let rankedPlayerIds = standings.map(s => s.playerId);
  
  if (round === 1 || rankedPlayerIds.length === 0) {
    // Shuffle players for the first round
    rankedPlayerIds = [...competition.players].sort(() => Math.random() - 0.5);
  }

  const numCourts = Math.floor(rankedPlayerIds.length / 4);

  for (let i = 0; i < numCourts; i++) {
    const offset = i * 4;
    // Pairing: 1 & 4 vs 2 & 3 (Standard Mexicano power pairing)
    const p1 = rankedPlayerIds[offset];
    const p2 = rankedPlayerIds[offset + 1];
    const p3 = rankedPlayerIds[offset + 2];
    const p4 = rankedPlayerIds[offset + 3];

    if (p1 && p2 && p3 && p4) {
      matches.push({
        competition_id: competition.id,
        round,
        court: `Court ${i + 1}`,
        team1: [p1, p4],
        team2: [p2, p3],
        score1: 0,
        score2: 0,
        status: 'pending'
      });
    }
  }

  return { round, matches };
}

/**
 * Americano Logic:
 * Tries to ensure players play with different partners and against different opponents.
 * For simplicity in a dynamic app, we use a randomized approach that prioritizes 
 * players who haven't played together recently if possible, or a simple rotation.
 */
function generateAmericanoRound(
  competition: Competition,
  round: number,
  allPlayerIds: string[],
  existingMatches: CompetitionMatch[]
): { round: number; matches: Partial<CompetitionMatch>[] } {
  const matches: Partial<CompetitionMatch>[] = [];
  
  // Get counts of how many times each pair has played together
  const partnerCounts: Record<string, number> = {};
  existingMatches.forEach(m => {
    const pairs = [
      m.team1.sort().join(','),
      m.team2.sort().join(',')
    ];
    pairs.forEach(p => {
      partnerCounts[p] = (partnerCounts[p] || 0) + 1;
    });
  });

  // Simple Americano rotation: 
  // We shuffle and try to find pairings that haven't happened yet.
  // This is a greedy approximation.
  let availablePlayers = [...allPlayerIds].sort(() => Math.random() - 0.5);
  const numCourts = Math.floor(availablePlayers.length / 4);

  for (let i = 0; i < numCourts; i++) {
    // Pick 4 players
    const courtPlayers = availablePlayers.splice(0, 4);
    
    // Of these 4, find the best pairing (least played together)
    const possiblePairings = [
      { t1: [courtPlayers[0], courtPlayers[1]], t2: [courtPlayers[2], courtPlayers[3]] },
      { t1: [courtPlayers[0], courtPlayers[2]], t2: [courtPlayers[1], courtPlayers[3]] },
      { t1: [courtPlayers[0], courtPlayers[3]], t2: [courtPlayers[1], courtPlayers[2]] },
    ];

    const bestPairing = possiblePairings.sort((a, b) => {
      const scoreA = (partnerCounts[a.t1.sort().join(',')] || 0) + (partnerCounts[a.t2.sort().join(',')] || 0);
      const scoreB = (partnerCounts[b.t1.sort().join(',')] || 0) + (partnerCounts[b.t2.sort().join(',')] || 0);
      return scoreA - scoreB;
    })[0];

    matches.push({
      competition_id: competition.id,
      round,
      court: `Court ${i + 1}`,
      team1: bestPairing.t1,
      team2: bestPairing.t2,
      score1: 0,
      score2: 0,
      status: 'pending'
    });
  }

  return { round, matches };
}
