import { Match, Player, PlayerRating } from '../types';
import { getPlayerRating, getRatingStrength } from './playerRatings';

export interface FlexibleScheduleResult {
  matches: Match[];
  fixtures: Match[][];
  explanation: string;
  stats: {
    weeks: number;
    playersPerWeek: number;
    byePlayersPerWeek: number;
    byeHistogram: Record<string, number>;
    missingPartnerPairs: number;
    partnerCoverageComplete: boolean;
    maxPartnerRepeat: number;
    maxOpponentRepeat: number;
  };
}

type Team = [number, number];
type TeamPattern = 'AA' | 'AB' | 'AC' | 'BB' | 'BC' | 'CC';

function pairKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function teamPattern(r1: PlayerRating, r2: PlayerRating): TeamPattern {
  const ratings = [r1, r2].sort();
  return `${ratings[0]}${ratings[1]}` as TeamPattern;
}

function matchupPatternPenalty(patternA: TeamPattern, patternB: TeamPattern) {
  const key = [patternA, patternB].sort().join('|');

  const penalties: Record<string, number> = {
    'AA|AA': 0,
    'AB|AB': 0,
    'AC|BB': 0,
    'BC|BC': 0,
    'CC|CC': 0,
    'AC|AC': 1,
    'BB|BB': 1,
    'AB|BB': 2,
    'AC|BC': 2,
    'AA|AB': 3,
    'BC|CC': 3,
    'AA|AC': 4,
    'BB|BC': 4,
    'AB|CC': 5,
    'AA|BB': 6,
    'AC|CC': 6,
    'AB|AC': 8,
    'AB|BC': 8,
    'AA|BC': 10,
    'AA|CC': 14,
  };

  return penalties[key] ?? 6;
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function combinations(values: number[], choose: number): number[][] {
  if (choose === 0) return [[]];
  if (values.length < choose) return [];

  const result: number[][] = [];
  for (let i = 0; i <= values.length - choose; i++) {
    const head = values[i];
    const tails = combinations(values.slice(i + 1), choose - 1);
    tails.forEach((tail) => result.push([head, ...tail]));
  }
  return result;
}

export function generateFlexibleSchedule(players: Player[], startDate: string): FlexibleScheduleResult {
  const n = players.length;
  const activePlayersPerWeek = n - (n % 4);
  const byePlayersPerWeek = n - activePlayersPerWeek;
  const partnershipsPerWeek = activePlayersPerWeek / 2;
  const totalPartnerPairs = (n * (n - 1)) / 2;

  if (activePlayersPerWeek < 4) {
    throw new Error(`At least 4 active players are required to generate doubles fixtures. You currently have ${n}.`);
  }

  const weeks = Math.max(n, Math.ceil(totalPartnerPairs / partnershipsPerWeek));
  const seasonAttempts = n >= 16 ? 120 : 90;
  const ratings = players.map((player) => getPlayerRating(player));
  const strengths = ratings.map((rating) => getRatingStrength(rating));

  const countMissingPartners = (partnerCounts: number[][], idx: number) => {
    let missing = 0;
    for (let other = 0; other < n; other++) {
      if (other !== idx && partnerCounts[idx][other] === 0) missing++;
    }
    return missing;
  };

  const matchCost = (teamA: Team, teamB: Team, opponentCounts: number[][]) => {
    const crossPairs: Array<[number, number]> = [
      [teamA[0], teamB[0]],
      [teamA[0], teamB[1]],
      [teamA[1], teamB[0]],
      [teamA[1], teamB[1]],
    ];

    const opponentRepeatCost = crossPairs.reduce((sum, [a, b]) => {
      const repeats = opponentCounts[a][b];
      return sum + (repeats * 1500) + (repeats * repeats * 200);
    }, 0);

    const strengthGap = Math.abs((strengths[teamA[0]] + strengths[teamA[1]]) - (strengths[teamB[0]] + strengths[teamB[1]]));
    const patternPenalty = matchupPatternPenalty(
      teamPattern(ratings[teamA[0]], ratings[teamA[1]]),
      teamPattern(ratings[teamB[0]], ratings[teamB[1]])
    );

    return opponentRepeatCost + (strengthGap * 50) + (patternPenalty * 80);
  };

  const chooseByePlayers = (
    weekIdx: number,
    byeCounts: number[],
    lastByeWeek: number[],
    playCounts: number[],
    byePairCounts: Map<string, number>,
    partnerCounts: number[][]
  ) => {
    if (byePlayersPerWeek === 0) return [] as number[];

    const rankedPlayers = Array.from({ length: n }, (_, idx) => idx)
      .sort((a, b) => {
        const missingA = countMissingPartners(partnerCounts, a);
        const missingB = countMissingPartners(partnerCounts, b);
        const urgentA = (weeks - weekIdx) <= missingA ? 4000 : 0;
        const urgentB = (weeks - weekIdx) <= missingB ? 4000 : 0;
        const scoreA = (byeCounts[a] * 1000) - ((weekIdx - lastByeWeek[a]) * 25) + (playCounts[a] * 2) + (missingA * 120) + urgentA;
        const scoreB = (byeCounts[b] * 1000) - ((weekIdx - lastByeWeek[b]) * 25) + (playCounts[b] * 2) + (missingB * 120) + urgentB;
        return scoreA - scoreB;
      });

    const candidatePool = rankedPlayers.slice(0, Math.min(n, byePlayersPerWeek + 5));
    const candidateCombos = combinations(candidatePool, byePlayersPerWeek);

    let bestCombo = candidateCombos[0] || rankedPlayers.slice(0, byePlayersPerWeek);
    let bestScore = Infinity;

    for (const combo of candidateCombos) {
      const comboScore = combo.reduce((sum, idx) => {
        const spacingBonus = weekIdx - lastByeWeek[idx];
        const missingPartners = countMissingPartners(partnerCounts, idx);
        const urgentPenalty = (weeks - weekIdx) <= missingPartners ? 4000 : 0;
        return sum + (byeCounts[idx] * 1000) - (spacingBonus * 30) + (playCounts[idx] * 2) + (missingPartners * 120) + urgentPenalty;
      }, 0);

      const pairPenalty = combo.reduce((sum, idx, i) => {
        return sum + combo.slice(i + 1).reduce((pairSum, otherIdx) => {
          return pairSum + ((byePairCounts.get(pairKey(idx, otherIdx)) || 0) * 200);
        }, 0);
      }, 0);

      const score = comboScore + pairPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestCombo = combo;
      }
    }

    return bestCombo;
  };

  const buildWeek = (
    activeIndexes: number[],
    weekIdx: number,
    partnerCounts: number[][],
    opponentCounts: number[][],
    lastByeWeek: number[]
  ) => {
    const attempts = activeIndexes.length >= 16 ? 320 : 220;
    let bestTeams: Team[] | null = null;
    let bestMatches: Array<[Team, Team]> | null = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const remaining = shuffle(activeIndexes);
      const teams: Team[] = [];
      let teamScore = 0;
      const missingPartnerCounts = Object.fromEntries(activeIndexes.map((idx) => [idx, countMissingPartners(partnerCounts, idx)]));

      while (remaining.length > 0) {
        let aIndex = 0;
        for (let i = 1; i < remaining.length; i++) {
          const current = remaining[i];
          const best = remaining[aIndex];
          if ((missingPartnerCounts[current] || 0) > (missingPartnerCounts[best] || 0)) {
            aIndex = i;
          }
        }

        const [a] = remaining.splice(aIndex, 1);
        let bestPartnerIndex = 0;
        let bestPartnerScore = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          const b = remaining[i];
          const repeats = partnerCounts[a][b];
          const strengthGap = Math.abs(strengths[a] - strengths[b]);
          const recentPenalty = Math.max(0, 3 - (weekIdx - Math.max(lastByeWeek[a], lastByeWeek[b])));
          const coverageUrgency = repeats === 0
            ? -12000 - ((missingPartnerCounts[a] || 0) * 350) - ((missingPartnerCounts[b] || 0) * 350)
            : (repeats * 9000) + (repeats * repeats * 1800);
          const deadlinePenalty = repeats === 0 && ((weeks - weekIdx) <= (missingPartnerCounts[a] || 0) || (weeks - weekIdx) <= (missingPartnerCounts[b] || 0))
            ? -5000
            : 0;
          const score = coverageUrgency + deadlinePenalty + (strengthGap * 35) + (recentPenalty * 12) + Math.random() * 20;

          if (score < bestPartnerScore) {
            bestPartnerScore = score;
            bestPartnerIndex = i;
          }
        }

        const [b] = remaining.splice(bestPartnerIndex, 1);
        teams.push([a, b]);
        teamScore += bestPartnerScore;
      }

      const remainingTeams = shuffle(teams);
      const matches: Array<[Team, Team]> = [];
      let totalScore = teamScore;

      while (remainingTeams.length > 0) {
        const teamA = remainingTeams.shift()!;
        let bestOpponentIndex = 0;
        let bestOpponentScore = Infinity;

        for (let i = 0; i < remainingTeams.length; i++) {
          const teamB = remainingTeams[i];
          const score = matchCost(teamA, teamB, opponentCounts) + Math.random() * 30;
          if (score < bestOpponentScore) {
            bestOpponentScore = score;
            bestOpponentIndex = i;
          }
        }

        const [teamB] = remainingTeams.splice(bestOpponentIndex, 1);
        matches.push([teamA, teamB]);
        totalScore += bestOpponentScore;
      }

      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestTeams = teams;
        bestMatches = matches;
      }
    }

    if (!bestTeams || !bestMatches) {
      throw new Error('Unable to build a valid week of fixtures.');
    }

    return { teams: bestTeams, matches: bestMatches, score: bestScore };
  };

  const summarizeSchedule = (partnerCounts: number[][], opponentCounts: number[][], byeCounts: number[]) => {
    let maxPartnerRepeat = 0;
    let maxOpponentRepeat = 0;
    let missingPartnerPairs = 0;
    let repeatedPartnerWeight = 0;
    let opponentRepeatWeight = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const partnerCount = partnerCounts[i][j];
        const opponentCount = opponentCounts[i][j];

        if (partnerCount === 0) missingPartnerPairs++;
        maxPartnerRepeat = Math.max(maxPartnerRepeat, partnerCount);
        maxOpponentRepeat = Math.max(maxOpponentRepeat, opponentCount);
        repeatedPartnerWeight += Math.max(0, partnerCount - 1);
        opponentRepeatWeight += Math.max(0, opponentCount - 2);
      }
    }

    const byeHistogram = byeCounts.reduce<Record<string, number>>((acc, count) => {
      const key = String(count);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const byeSpread = Math.max(...byeCounts) - Math.min(...byeCounts);

    return {
      maxPartnerRepeat,
      maxOpponentRepeat,
      missingPartnerPairs,
      repeatedPartnerWeight,
      opponentRepeatWeight,
      byeHistogram,
      byeSpread,
    };
  };

  let bestSchedule: Array<Array<[Team, Team]>> | null = null;
  let bestSummary: ReturnType<typeof summarizeSchedule> | null = null;
  let bestScore = Infinity;

  for (let seasonAttempt = 0; seasonAttempt < seasonAttempts; seasonAttempt++) {
    const partnerCounts = Array.from({ length: n }, () => Array(n).fill(0));
    const opponentCounts = Array.from({ length: n }, () => Array(n).fill(0));
    const byeCounts = Array(n).fill(0);
    const lastByeWeek = Array(n).fill(-999);
    const playCounts = Array(n).fill(0);
    const byePairCounts = new Map<string, number>();
    const indexedFixtures: Array<Array<[Team, Team]>> = [];
    let constructionScore = 0;

    for (let weekIdx = 0; weekIdx < weeks; weekIdx++) {
      const byeIndexes = chooseByePlayers(weekIdx, byeCounts, lastByeWeek, playCounts, byePairCounts, partnerCounts);
      const byeSet = new Set(byeIndexes);
      const activeIndexes = Array.from({ length: n }, (_, idx) => idx).filter((idx) => !byeSet.has(idx));
      const { teams, matches, score } = buildWeek(activeIndexes, weekIdx, partnerCounts, opponentCounts, lastByeWeek);

      byeIndexes.forEach((idx) => {
        byeCounts[idx] += 1;
        lastByeWeek[idx] = weekIdx;
      });

      byeIndexes.forEach((idx, i) => {
        for (let j = i + 1; j < byeIndexes.length; j++) {
          const key = pairKey(idx, byeIndexes[j]);
          byePairCounts.set(key, (byePairCounts.get(key) || 0) + 1);
        }
      });

      activeIndexes.forEach((idx) => {
        playCounts[idx] += 1;
      });

      teams.forEach(([a, b]) => {
        partnerCounts[a][b] += 1;
        partnerCounts[b][a] += 1;
      });

      matches.forEach(([teamA, teamB]) => {
        const crossPairs: Array<[number, number]> = [
          [teamA[0], teamB[0]],
          [teamA[0], teamB[1]],
          [teamA[1], teamB[0]],
          [teamA[1], teamB[1]],
        ];

        crossPairs.forEach(([a, b]) => {
          opponentCounts[a][b] += 1;
          opponentCounts[b][a] += 1;
        });
      });

      indexedFixtures.push(matches);
      constructionScore += score;
    }

    const summary = summarizeSchedule(partnerCounts, opponentCounts, byeCounts);
    const attemptScore =
      (summary.missingPartnerPairs * 10_000_000) +
      (summary.repeatedPartnerWeight * 100_000) +
      (summary.maxPartnerRepeat * 10_000) +
      (summary.opponentRepeatWeight * 500) +
      (summary.maxOpponentRepeat * 50) +
      (summary.byeSpread * 20) +
      constructionScore;

    if (attemptScore < bestScore) {
      bestScore = attemptScore;
      bestSchedule = indexedFixtures;
      bestSummary = summary;
    }

    if (summary.missingPartnerPairs === 0 && summary.maxPartnerRepeat <= 2) {
      break;
    }
  }

  if (!bestSchedule || !bestSummary) {
    throw new Error('Unable to generate a flexible schedule.');
  }

  const fixtures: Match[][] = bestSchedule.map((matches, weekIdx) => {
    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + (weekIdx * 7));
    const dateStr = weekDate.toISOString().split('T')[0];

    return matches.map(([teamA, teamB], matchIdx) => ({
      id: `w${weekIdx + 1}-m${matchIdx + 1}`,
      team1: [players[teamA[0]].id, players[teamA[1]].id],
      team2: [players[teamB[0]].id, players[teamB[1]].id],
      date: dateStr,
      sets: [],
      winner: null,
      status: 'scheduled',
      time: undefined,
      venue: undefined,
      availability: {},
    }));
  });

  const explanation = [
    `Generated a flexible doubles schedule for ${n} players over ${weeks} weeks.`,
    `Each week schedules ${activePlayersPerWeek} players and rotates ${byePlayersPerWeek} bye${byePlayersPerWeek === 1 ? '' : 's'} fairly.`,
    bestSummary.missingPartnerPairs === 0
      ? 'Everyone is scheduled to partner everyone else across the full fixture list.'
      : `The scheduler reduced missing partner pairings to ${bestSummary.missingPartnerPairs}, which is the best result found.`,
    'The scheduler still balances opponents and avoids unfair A/B/C mismatches where possible.',
  ].join(' ');

  return {
    matches: fixtures.flat(),
    fixtures,
    explanation,
    stats: {
      weeks,
      playersPerWeek: activePlayersPerWeek,
      byePlayersPerWeek,
      byeHistogram: bestSummary.byeHistogram,
      missingPartnerPairs: bestSummary.missingPartnerPairs,
      partnerCoverageComplete: bestSummary.missingPartnerPairs === 0,
      maxPartnerRepeat: bestSummary.maxPartnerRepeat,
      maxOpponentRepeat: bestSummary.maxOpponentRepeat,
    },
  };
}
