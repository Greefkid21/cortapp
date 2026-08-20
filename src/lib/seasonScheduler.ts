import { Match, Player, PlayerAvailability, PlayerRating } from '../types';
import { getPlayerRating, getRatingStrength } from './playerRatings';

type Team = [number, number];
type IndexedMatch = [Team, Team];
type TeamPattern = 'AA' | 'AB' | 'AC' | 'BB' | 'BC' | 'CC';

export interface FixtureFairnessWeights {
  availability: number;
  completeMatches: number;
  matchBalance: number;
  byeBalance: number;
  partnerRepeat: number;
  exactMatchRepeat: number;
  opponentRepeat: number;
  abilityBalance: number;
  competitiveness: number;
  seasonFairness: number;
}

export interface FixtureGeneratorConfig {
  startDate: string;
  availability?: PlayerAvailability[];
  weekCount?: number;
  weekStartDates?: string[];
  courtsAvailable?: number;
  matchDurationMinutes?: number;
  idealMatchesPerPlayer?: number;
  allowByes?: boolean;
  fairnessWeights?: Partial<FixtureFairnessWeights>;
}

export interface PlayerFairnessSummary {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  byes: number;
  uniquePartners: number;
  repeatedPartnerships: number;
  uniqueOpponents: number;
  repeatedOpponents: number;
  uniqueGroupsOfFour: number;
  abilityBalance: number;
  availableWeeks: number;
  unavailableWeeks: number;
}

export interface FairnessIssue {
  severity: 'high' | 'medium' | 'low';
  type: 'matches' | 'byes' | 'partners' | 'opponents' | 'groups' | 'balance' | 'availability' | 'courts';
  message: string;
}

export interface SeasonFairnessReport {
  overallScore: number;
  explanation: string;
  compromises: string[];
  issues: FairnessIssue[];
  playerSummaries: PlayerFairnessSummary[];
  metrics: {
    totalWeeks: number;
    totalMatches: number;
    averageMatchesPlayed: number;
    averageByes: number;
    matchSpread: number;
    byeSpread: number;
    missingPartnerPairs: number;
    maxPartnerRepeat: number;
    repeatedPartnerships: number;
    repeatedOpponents: number;
    repeatedGroupsOfFour: number;
    repeatedExactMatches: number;
    unbalancedMatches: number;
    weeksWithInsufficientPlayers: number;
    weeksLimitedByCourts: number;
  };
}

export interface SeasonScheduleResult {
  matches: Match[];
  fixtures: Match[][];
  explanation: string;
  report: SeasonFairnessReport;
  configUsed: FixtureGeneratorConfig & { fairnessWeights: FixtureFairnessWeights; weekStartDates: string[] };
}

interface ScheduleState {
  matchCounts: number[];
  byeCounts: number[];
  partnerCounts: number[][];
  opponentCounts: number[][];
  lastPartnerWeek: number[][];
  lastOpponentWeek: number[][];
  lastByeWeek: number[];
  groupCounts: Map<string, number>;
  exactMatchCounts: Map<string, number>;
  byePairCounts: Map<string, number>;
}

interface AttemptResult {
  indexedFixtures: IndexedMatch[][];
  byeWeeks: number[][];
  state: ScheduleState;
  report: SeasonFairnessReport;
  constructionScore: number;
}

const DEFAULT_WEIGHTS: FixtureFairnessWeights = {
  availability: 1_000_000,
  completeMatches: 350_000,
  matchBalance: 35_000,
  byeBalance: 18_000,
  partnerRepeat: 11_000,
  exactMatchRepeat: 7_500,
  opponentRepeat: 2_500,
  abilityBalance: 450,
  competitiveness: 300,
  seasonFairness: 1_000,
};

function isoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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

function quartetKey(values: number[]) {
  return [...values].sort((a, b) => a - b).join('|');
}

function exactMatchKey(teamA: Team, teamB: Team) {
  const left = [...teamA].sort((a, b) => a - b).join(':');
  const right = [...teamB].sort((a, b) => a - b).join(':');
  return [left, right].sort().join('|');
}

function createState(playerCount: number): ScheduleState {
  return {
    matchCounts: Array(playerCount).fill(0),
    byeCounts: Array(playerCount).fill(0),
    partnerCounts: Array.from({ length: playerCount }, () => Array(playerCount).fill(0)),
    opponentCounts: Array.from({ length: playerCount }, () => Array(playerCount).fill(0)),
    lastPartnerWeek: Array.from({ length: playerCount }, () => Array(playerCount).fill(-999)),
    lastOpponentWeek: Array.from({ length: playerCount }, () => Array(playerCount).fill(-999)),
    lastByeWeek: Array(playerCount).fill(-999),
    groupCounts: new Map(),
    exactMatchCounts: new Map(),
    byePairCounts: new Map(),
  };
}

function estimateWeekCount(players: Player[], config: FixtureGeneratorConfig) {
  const playerCount = players.length;
  const maxMatchesPerWeek = Math.max(
    1,
    Math.min(Math.floor(playerCount / 4), config.courtsAvailable ?? Number.MAX_SAFE_INTEGER)
  );
  const partnershipsPerWeek = Math.max(1, maxMatchesPerWeek * 2);
  const totalPartnerPairs = (playerCount * (playerCount - 1)) / 2;
  const coverageWeeks = Math.ceil(totalPartnerPairs / partnershipsPerWeek);
  const idealMatchWeeks = config.idealMatchesPerPlayer
    ? Math.ceil((config.idealMatchesPerPlayer * playerCount) / (maxMatchesPerWeek * 4))
    : 0;

  return clamp(Math.max(4, coverageWeeks, idealMatchWeeks), 4, 40);
}

function buildWeekStartDates(players: Player[], config: FixtureGeneratorConfig) {
  const minimumWeekCount = estimateWeekCount(players, config);

  if (config.weekStartDates && config.weekStartDates.length > 0) {
    return Array.from(new Set(config.weekStartDates)).sort();
  }

  if (config.weekCount && config.weekCount > 0) {
    return Array.from({ length: config.weekCount }, (_, index) => addDays(config.startDate, index * 7));
  }

  const relevantAvailability = (config.availability || [])
    .filter((entry) => players.some((player) => player.id === entry.playerId))
    .map((entry) => entry.weekStartDate)
    .filter((week) => week >= config.startDate);

  const derivedWeeks = Array.from(new Set(relevantAvailability)).sort();
  if (derivedWeeks.length > 0) {
    if (derivedWeeks.length >= minimumWeekCount) {
      return derivedWeeks;
    }

    const extendedWeeks = [...derivedWeeks];
    let cursor = derivedWeeks[derivedWeeks.length - 1];

    while (extendedWeeks.length < minimumWeekCount) {
      cursor = addDays(cursor, 7);
      extendedWeeks.push(cursor);
    }

    return extendedWeeks;
  }

  return Array.from({ length: minimumWeekCount }, (_, index) => addDays(config.startDate, index * 7));
}

function availabilityMap(availability: PlayerAvailability[]) {
  const map = new Map<string, PlayerAvailability>();
  availability.forEach((entry) => {
    map.set(`${entry.playerId}|${entry.weekStartDate}`, entry);
  });
  return map;
}

function isAvailableForWeek(
  playerId: string,
  weekStartDate: string,
  entries: Map<string, PlayerAvailability>
) {
  const entry = entries.get(`${playerId}|${weekStartDate}`);
  if (!entry) return true;
  if (!entry.isAvailable) return false;
  if (!entry.daysAvailable || entry.daysAvailable.length === 0) return true;
  return true;
}

function countMissingPartners(partnerCounts: number[][], idx: number) {
  let missing = 0;
  for (let other = 0; other < partnerCounts.length; other++) {
    if (other !== idx && partnerCounts[idx][other] === 0) missing += 1;
  }
  return missing;
}

function countFreshPartnersInPool(partnerCounts: number[][], idx: number, pool: number[]) {
  return pool.reduce((count, other) => {
    if (other === idx) return count;
    return count + (partnerCounts[idx][other] === 0 ? 1 : 0);
  }, 0);
}

function chooseByePlayers(
  availableIndexes: number[],
  byeSlots: number,
  state: ScheduleState,
  weekIdx: number,
  totalWeeks: number,
  weights: FixtureFairnessWeights
) {
  if (byeSlots <= 0) return [] as number[];
  if (byeSlots >= availableIndexes.length) return [...availableIndexes];

  const averageMatches = average(state.matchCounts);

  const sortedCandidates = [...availableIndexes].sort((a, b) => {
    const scoreA =
      (Math.max(0, averageMatches - state.matchCounts[a]) * weights.matchBalance) +
      (state.byeCounts[a] * weights.byeBalance) +
      (Math.max(0, 2 - (weekIdx - state.lastByeWeek[a])) * weights.byeBalance * 0.5) +
      (countMissingPartners(state.partnerCounts, a) * weights.partnerRepeat * 0.2) -
      (state.matchCounts[a] * weights.matchBalance * 0.15) -
      ((totalWeeks - weekIdx) < countMissingPartners(state.partnerCounts, a) ? weights.seasonFairness * 8 : 0);

    const scoreB =
      (Math.max(0, averageMatches - state.matchCounts[b]) * weights.matchBalance) +
      (state.byeCounts[b] * weights.byeBalance) +
      (Math.max(0, 2 - (weekIdx - state.lastByeWeek[b])) * weights.byeBalance * 0.5) +
      (countMissingPartners(state.partnerCounts, b) * weights.partnerRepeat * 0.2) -
      (state.matchCounts[b] * weights.matchBalance * 0.15) -
      ((totalWeeks - weekIdx) < countMissingPartners(state.partnerCounts, b) ? weights.seasonFairness * 8 : 0);

    return scoreA - scoreB;
  });

  const pool = sortedCandidates.slice(0, Math.min(sortedCandidates.length, byeSlots + 6));
  const combos = combinations(pool, byeSlots);
  let best = combos[0] || pool.slice(0, byeSlots);
  let bestScore = Infinity;

  for (const combo of combos) {
    const comboScore = combo.reduce((sum, idx) => {
      return sum +
        (Math.max(0, averageMatches - state.matchCounts[idx]) * weights.matchBalance) +
        (state.byeCounts[idx] * weights.byeBalance) +
        (Math.max(0, 2 - (weekIdx - state.lastByeWeek[idx])) * weights.byeBalance * 0.5) +
        (countMissingPartners(state.partnerCounts, idx) * weights.partnerRepeat * 0.2) -
        (state.matchCounts[idx] * weights.matchBalance * 0.15);
    }, 0);

    const pairPenalty = combo.reduce((sum, idx, index) => {
      return sum + combo.slice(index + 1).reduce((pairSum, other) => {
        return pairSum + ((state.byePairCounts.get(pairKey(idx, other)) || 0) * weights.byeBalance * 0.1);
      }, 0);
    }, 0);

    const score = comboScore + pairPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = combo;
    }
  }

  return best;
}

function buildWeekMatches(
  activeIndexes: number[],
  ratings: PlayerRating[],
  strengths: number[],
  state: ScheduleState,
  weekIdx: number,
  totalWeeks: number,
  weights: FixtureFairnessWeights
) {
  if (activeIndexes.length < 4) {
    return { matches: [] as IndexedMatch[], score: 0 };
  }

  const attempts = activeIndexes.length >= 16 ? 260 : 180;
  let bestMatches: IndexedMatch[] | null = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const remainingPlayers = shuffle(activeIndexes);
    const teams: Team[] = [];
    let attemptScore = 0;

    while (remainingPlayers.length > 1) {
      let anchorIndex = 0;
      for (let i = 1; i < remainingPlayers.length; i++) {
        const current = remainingPlayers[i];
        const best = remainingPlayers[anchorIndex];
        const currentFreshOptions = countFreshPartnersInPool(state.partnerCounts, current, remainingPlayers);
        const bestFreshOptions = countFreshPartnersInPool(state.partnerCounts, best, remainingPlayers);
        const urgencyCurrent =
          (currentFreshOptions === 0 ? 100_000 : 0) +
          (countMissingPartners(state.partnerCounts, current) * 100) -
          (currentFreshOptions * 1_000) -
          (state.matchCounts[current] * 10);
        const urgencyBest =
          (bestFreshOptions === 0 ? 100_000 : 0) +
          (countMissingPartners(state.partnerCounts, best) * 100) -
          (bestFreshOptions * 1_000) -
          (state.matchCounts[best] * 10);
        if (urgencyCurrent > urgencyBest) {
          anchorIndex = i;
        }
      }

      const [a] = remainingPlayers.splice(anchorIndex, 1);
      const freshPartnersForAnchor = remainingPlayers.filter((candidate) => state.partnerCounts[a][candidate] === 0);
      const mustUseFreshPartner = freshPartnersForAnchor.length > 0;
      let bestPartnerIdx = 0;
      let bestPartnerScore = Infinity;

      for (let i = 0; i < remainingPlayers.length; i++) {
        const b = remainingPlayers[i];
        const partnerRepeats = state.partnerCounts[a][b];
        if (mustUseFreshPartner && partnerRepeats > 0) {
          continue;
        }
        const recentPartnerGap = weekIdx - state.lastPartnerWeek[a][b];
        const abilityGap = Math.abs(strengths[a] - strengths[b]);
        const combinedMatchCountGap = Math.abs(state.matchCounts[a] - state.matchCounts[b]);
        const freshOptionsForB = countFreshPartnersInPool(state.partnerCounts, b, remainingPlayers);
        const missingBonus =
          partnerRepeats === 0
            ? -(weights.partnerRepeat * 4) - ((countMissingPartners(state.partnerCounts, a) + countMissingPartners(state.partnerCounts, b)) * weights.seasonFairness * 0.5)
            : 0;
        const urgencyPenalty =
          partnerRepeats > 0 && (totalWeeks - weekIdx) <= countMissingPartners(state.partnerCounts, a)
            ? weights.seasonFairness * 12
            : 0;
        const flexibilityPenalty =
          partnerRepeats === 0
            ? Math.max(0, 2 - freshOptionsForB) * weights.seasonFairness * 0.4
            : Math.max(0, freshOptionsForB) * weights.partnerRepeat * 0.8;

        const score =
          (partnerRepeats * partnerRepeats * weights.partnerRepeat * 4) +
          (Math.max(0, 3 - recentPartnerGap) * weights.partnerRepeat * 0.4) +
          (abilityGap * weights.abilityBalance * 0.4) +
          (combinedMatchCountGap * weights.matchBalance * 0.08) +
          urgencyPenalty +
          flexibilityPenalty +
          missingBonus +
          Math.random() * 10;

        if (score < bestPartnerScore) {
          bestPartnerScore = score;
          bestPartnerIdx = i;
        }
      }

      const [b] = remainingPlayers.splice(bestPartnerIdx, 1);
      teams.push([a, b]);
      attemptScore += bestPartnerScore;
    }

    const remainingTeams = shuffle(teams);
    const matches: IndexedMatch[] = [];

    while (remainingTeams.length > 1) {
      const teamA = remainingTeams.shift()!;
      let bestOpponentIdx = 0;
      let bestOpponentScore = Infinity;

      for (let i = 0; i < remainingTeams.length; i++) {
        const teamB = remainingTeams[i];
        const crossPairs: Array<[number, number]> = [
          [teamA[0], teamB[0]],
          [teamA[0], teamB[1]],
          [teamA[1], teamB[0]],
          [teamA[1], teamB[1]],
        ];
        const opponentPenalty = crossPairs.reduce((sum, [left, right]) => {
          const repeats = state.opponentCounts[left][right];
          const recentGap = weekIdx - state.lastOpponentWeek[left][right];
          return sum +
            (repeats * repeats * weights.opponentRepeat) +
            (Math.max(0, 2 - recentGap) * weights.opponentRepeat * 0.15);
        }, 0);

        const groupKey = quartetKey([teamA[0], teamA[1], teamB[0], teamB[1]]);
        const matchKey = exactMatchKey(teamA, teamB);
        const teamStrengthGap = Math.abs((strengths[teamA[0]] + strengths[teamA[1]]) - (strengths[teamB[0]] + strengths[teamB[1]]));
        const patternPenalty = matchupPatternPenalty(
          teamPattern(ratings[teamA[0]], ratings[teamA[1]]),
          teamPattern(ratings[teamB[0]], ratings[teamB[1]])
        );

        const score =
          opponentPenalty +
          ((state.groupCounts.get(groupKey) || 0) * weights.exactMatchRepeat * 0.6) +
          ((state.exactMatchCounts.get(matchKey) || 0) * weights.exactMatchRepeat) +
          (teamStrengthGap * weights.abilityBalance) +
          (patternPenalty * weights.competitiveness) +
          Math.random() * 30;

        if (score < bestOpponentScore) {
          bestOpponentScore = score;
          bestOpponentIdx = i;
        }
      }

      const [teamB] = remainingTeams.splice(bestOpponentIdx, 1);
      matches.push([teamA, teamB]);
      attemptScore += bestOpponentScore;
    }

    if (attemptScore < bestScore) {
      bestScore = attemptScore;
      bestMatches = matches;
    }
  }

  return {
    matches: bestMatches || [],
    score: bestScore === Infinity ? 0 : bestScore,
  };
}

function applyWeek(matches: IndexedMatch[], byes: number[], state: ScheduleState, weekIdx: number) {
  byes.forEach((idx, byIndex) => {
    state.byeCounts[idx] += 1;
    state.lastByeWeek[idx] = weekIdx;

    for (let j = byIndex + 1; j < byes.length; j++) {
      const key = pairKey(idx, byes[j]);
      state.byePairCounts.set(key, (state.byePairCounts.get(key) || 0) + 1);
    }
  });

  matches.forEach(([teamA, teamB]) => {
    const allPlayers = [teamA[0], teamA[1], teamB[0], teamB[1]];
    const groupKey = quartetKey(allPlayers);
    const matchKey = exactMatchKey(teamA, teamB);

    state.groupCounts.set(groupKey, (state.groupCounts.get(groupKey) || 0) + 1);
    state.exactMatchCounts.set(matchKey, (state.exactMatchCounts.get(matchKey) || 0) + 1);

    [teamA[0], teamA[1], teamB[0], teamB[1]].forEach((idx) => {
      state.matchCounts[idx] += 1;
    });

    state.partnerCounts[teamA[0]][teamA[1]] += 1;
    state.partnerCounts[teamA[1]][teamA[0]] += 1;
    state.partnerCounts[teamB[0]][teamB[1]] += 1;
    state.partnerCounts[teamB[1]][teamB[0]] += 1;
    state.lastPartnerWeek[teamA[0]][teamA[1]] = weekIdx;
    state.lastPartnerWeek[teamA[1]][teamA[0]] = weekIdx;
    state.lastPartnerWeek[teamB[0]][teamB[1]] = weekIdx;
    state.lastPartnerWeek[teamB[1]][teamB[0]] = weekIdx;

    const crossPairs: Array<[number, number]> = [
      [teamA[0], teamB[0]],
      [teamA[0], teamB[1]],
      [teamA[1], teamB[0]],
      [teamA[1], teamB[1]],
    ];

    crossPairs.forEach(([left, right]) => {
      state.opponentCounts[left][right] += 1;
      state.opponentCounts[right][left] += 1;
      state.lastOpponentWeek[left][right] = weekIdx;
      state.lastOpponentWeek[right][left] = weekIdx;
    });
  });
}

function buildReport(
  players: Player[],
  strengths: number[],
  weekStartDates: string[],
  indexedFixtures: IndexedMatch[][],
  state: ScheduleState,
  configUsed: FixtureGeneratorConfig & { fairnessWeights: FixtureFairnessWeights; weekStartDates: string[] }
): SeasonFairnessReport {
  const playerGroups = Array.from({ length: players.length }, () => new Set<string>());
  const playerAbilityGaps = Array.from({ length: players.length }, () => [] as number[]);
  let repeatedGroupsOfFour = 0;
  let repeatedExactMatches = 0;
  let unbalancedMatches = 0;
  let weeksWithInsufficientPlayers = 0;
  let weeksLimitedByCourts = 0;

  const availabilityEntries = availabilityMap(configUsed.availability || []);
  const maxCourts = configUsed.courtsAvailable ?? Number.MAX_SAFE_INTEGER;

  indexedFixtures.forEach((weekMatches, weekIdx) => {
    const weekStart = weekStartDates[weekIdx];
    const availableCount = players.filter((player) => isAvailableForWeek(player.id, weekStart, availabilityEntries)).length;
    const rawCourtCapacity = Math.floor(availableCount / 4);

    if (availableCount > 0 && availableCount < 4) {
      weeksWithInsufficientPlayers += 1;
    }

    if (rawCourtCapacity > maxCourts) {
      weeksLimitedByCourts += 1;
    }

    weekMatches.forEach(([teamA, teamB]) => {
      const all = [teamA[0], teamA[1], teamB[0], teamB[1]];
      const teamStrengthGap = Math.abs((strengths[teamA[0]] + strengths[teamA[1]]) - (strengths[teamB[0]] + strengths[teamB[1]]));
      if (teamStrengthGap >= 2) {
        unbalancedMatches += 1;
      }

      all.forEach((idx) => {
        playerGroups[idx].add(quartetKey(all));
        playerAbilityGaps[idx].push(teamStrengthGap);
      });
    });
  });

  state.groupCounts.forEach((count) => {
    if (count > 1) repeatedGroupsOfFour += count - 1;
  });

  state.exactMatchCounts.forEach((count) => {
    if (count > 1) repeatedExactMatches += count - 1;
  });

  const playerSummaries: PlayerFairnessSummary[] = players.map((player, idx) => {
    const partnerCounts = state.partnerCounts[idx];
    const opponentCounts = state.opponentCounts[idx];
    const uniquePartners = partnerCounts.filter((count, other) => other !== idx && count > 0).length;
    const repeatedPartnerships = partnerCounts.reduce((sum, count, other) => {
      if (other === idx) return sum;
      return sum + Math.max(0, count - 1);
    }, 0);
    const uniqueOpponents = opponentCounts.filter((count, other) => other !== idx && count > 0).length;
    const repeatedOpponents = opponentCounts.reduce((sum, count, other) => {
      if (other === idx) return sum;
      return sum + Math.max(0, count - 1);
    }, 0);
    const availableWeeks = weekStartDates.filter((weekStart) => isAvailableForWeek(player.id, weekStart, availabilityEntries)).length;
    const abilityBalance = average(playerAbilityGaps[idx]);

    return {
      playerId: player.id,
      playerName: player.name,
      matchesPlayed: state.matchCounts[idx],
      byes: state.byeCounts[idx],
      uniquePartners,
      repeatedPartnerships,
      uniqueOpponents,
      repeatedOpponents,
      uniqueGroupsOfFour: playerGroups[idx].size,
      abilityBalance: Number(abilityBalance.toFixed(2)),
      availableWeeks,
      unavailableWeeks: weekStartDates.length - availableWeeks,
    };
  });

  const totalMatches = indexedFixtures.reduce((sum, week) => sum + week.length, 0);
  const averageMatchesPlayed = average(state.matchCounts);
  const averageByes = average(state.byeCounts);
  const matchSpread = Math.max(...state.matchCounts) - Math.min(...state.matchCounts);
  const byeSpread = Math.max(...state.byeCounts) - Math.min(...state.byeCounts);

  let repeatedPartnerships = 0;
  let repeatedOpponents = 0;
  let missingPartnerPairs = 0;
  let maxPartnerRepeat = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (state.partnerCounts[i][j] === 0) {
        missingPartnerPairs += 1;
      }
      maxPartnerRepeat = Math.max(maxPartnerRepeat, state.partnerCounts[i][j]);
      repeatedPartnerships += Math.max(0, state.partnerCounts[i][j] - 1);
      repeatedOpponents += Math.max(0, state.opponentCounts[i][j] - 1);
    }
  }

  const issues: FairnessIssue[] = [];
  const compromises: string[] = [];

  playerSummaries
    .filter((summary) => Math.abs(summary.matchesPlayed - averageMatchesPlayed) > 1)
    .forEach((summary) => {
      issues.push({
        severity: 'medium',
        type: 'matches',
        message: `${summary.playerName} plays ${summary.matchesPlayed} matches versus an average of ${averageMatchesPlayed.toFixed(1)}.`,
      });
    });

  playerSummaries
    .filter((summary) => summary.byes > averageByes + 1)
    .forEach((summary) => {
      issues.push({
        severity: 'medium',
        type: 'byes',
        message: `${summary.playerName} receives ${summary.byes} byes versus an average of ${averageByes.toFixed(1)}.`,
      });
    });

  if (missingPartnerPairs > 0) {
    issues.push({
      severity: 'high',
      type: 'partners',
      message: `${missingPartnerPairs} partner pairing(s) never occurred across the season.`,
    });
    compromises.push(`${missingPartnerPairs} partner pairing(s) could not be completed within the available weeks, courts, or availability constraints.`);
  }

  if (repeatedPartnerships > 0) {
    issues.push({
      severity: repeatedPartnerships > players.length ? 'high' : 'medium',
      type: 'partners',
      message: `${repeatedPartnerships} repeat partnership(s) remain across the season.`,
    });
  }

  if (repeatedOpponents > 0) {
    issues.push({
      severity: repeatedOpponents > players.length * 2 ? 'high' : 'medium',
      type: 'opponents',
      message: `${repeatedOpponents} repeat opponent pairing(s) remain across the season.`,
    });
  }

  if (repeatedGroupsOfFour > 0) {
    issues.push({
      severity: 'medium',
      type: 'groups',
      message: `${repeatedGroupsOfFour} repeated group-of-four appearance(s) remain.`,
    });
  }

  if (unbalancedMatches > 0) {
    issues.push({
      severity: unbalancedMatches > Math.max(2, totalMatches / 4) ? 'high' : 'medium',
      type: 'balance',
      message: `${unbalancedMatches} match(es) have a notable A/B/C strength gap.`,
    });
  }

  if (weeksWithInsufficientPlayers > 0) {
    compromises.push(`${weeksWithInsufficientPlayers} week(s) had fewer than 4 available players, so no complete match could be created.`);
    issues.push({
      severity: 'high',
      type: 'availability',
      message: `${weeksWithInsufficientPlayers} week(s) could not host a match because availability dropped below 4 players.`,
    });
  }

  if (weeksLimitedByCourts > 0) {
    compromises.push(`${weeksLimitedByCourts} week(s) were limited by the number of available courts.`);
    issues.push({
      severity: 'medium',
      type: 'courts',
      message: `${weeksLimitedByCourts} week(s) had enough players for more matches but were capped by court availability.`,
    });
  }

  if (repeatedExactMatches > 0) {
    compromises.push(`${repeatedExactMatches} exact match combination(s) repeated because cleaner alternatives were not available.`);
  }

  const penalty =
    (matchSpread * configUsed.fairnessWeights.matchBalance * 0.015) +
    (byeSpread * configUsed.fairnessWeights.byeBalance * 0.02) +
    (missingPartnerPairs * configUsed.fairnessWeights.partnerRepeat * 0.01) +
    (maxPartnerRepeat > 1 ? (maxPartnerRepeat - 1) * configUsed.fairnessWeights.partnerRepeat * 0.025 : 0) +
    (repeatedPartnerships * configUsed.fairnessWeights.partnerRepeat * 0.0009) +
    (repeatedOpponents * configUsed.fairnessWeights.opponentRepeat * 0.003) +
    (repeatedGroupsOfFour * configUsed.fairnessWeights.exactMatchRepeat * 0.0025) +
    (repeatedExactMatches * configUsed.fairnessWeights.exactMatchRepeat * 0.004) +
    (unbalancedMatches * configUsed.fairnessWeights.abilityBalance * 0.04) +
    (weeksWithInsufficientPlayers * 8) +
    (weeksLimitedByCourts * 4);

  const overallScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  const explanation = [
    `Generated ${totalMatches} match${totalMatches === 1 ? '' : 'es'} across ${weekStartDates.length} week${weekStartDates.length === 1 ? '' : 's'}.`,
    `Average matches per player: ${averageMatchesPlayed.toFixed(1)}. Average byes: ${averageByes.toFixed(1)}.`,
    missingPartnerPairs === 0
      ? 'Everyone partners with every possible teammate at least once across the season.'
      : `${missingPartnerPairs} partner pairing(s) are still missing after optimisation.`,
    repeatedPartnerships === 0
      ? 'No partnerships repeat before full coverage is achieved.'
      : `${repeatedPartnerships} repeat partnership(s) remain after optimisation.`,
    repeatedOpponents === 0
      ? 'Opponent rotation is fully varied.'
      : `${repeatedOpponents} repeat opponent pairing(s) remain.`,
    unbalancedMatches === 0
      ? 'All matches stay within the configured A/B/C balance tolerance.'
      : `${unbalancedMatches} match(es) are less balanced on ability than ideal.`,
  ].join(' ');

  return {
    overallScore,
    explanation,
    compromises,
    issues,
    playerSummaries,
    metrics: {
      totalWeeks: weekStartDates.length,
      totalMatches,
      averageMatchesPlayed: Number(averageMatchesPlayed.toFixed(2)),
      averageByes: Number(averageByes.toFixed(2)),
      matchSpread,
      byeSpread,
      missingPartnerPairs,
      maxPartnerRepeat,
      repeatedPartnerships,
      repeatedOpponents,
      repeatedGroupsOfFour,
      repeatedExactMatches,
      unbalancedMatches,
      weeksWithInsufficientPlayers,
      weeksLimitedByCourts,
    },
  };
}

function attemptSeason(
  players: Player[],
  configUsed: FixtureGeneratorConfig & { fairnessWeights: FixtureFairnessWeights; weekStartDates: string[] }
) {
  const state = createState(players.length);
  const entries = availabilityMap(configUsed.availability || []);
  const ratings = players.map((player) => getPlayerRating(player));
  const strengths = ratings.map((rating) => getRatingStrength(rating));
  const indexedFixtures: IndexedMatch[][] = [];
  const byeWeeks: number[][] = [];
  let constructionScore = 0;

  configUsed.weekStartDates.forEach((weekStart, weekIdx) => {
    const availableIndexes = players
      .map((player, idx) => ({ player, idx }))
      .filter(({ player }) => isAvailableForWeek(player.id, weekStart, entries))
      .map(({ idx }) => idx);

    const courtsAvailable = configUsed.courtsAvailable ?? Number.MAX_SAFE_INTEGER;
    const maxMatches = Math.min(Math.floor(availableIndexes.length / 4), courtsAvailable);
    const activePlayerCount = maxMatches * 4;
    const byeSlots = configUsed.allowByes === false
      ? Math.max(0, availableIndexes.length - activePlayerCount)
      : availableIndexes.length - activePlayerCount;
    const byes = chooseByePlayers(
      availableIndexes,
      Math.max(0, byeSlots),
      state,
      weekIdx,
      configUsed.weekStartDates.length,
      configUsed.fairnessWeights
    );
    const byeSet = new Set(byes);
    const activeIndexes = availableIndexes.filter((idx) => !byeSet.has(idx)).slice(0, activePlayerCount);
    const { matches, score } = buildWeekMatches(
      activeIndexes,
      ratings,
      strengths,
      state,
      weekIdx,
      configUsed.weekStartDates.length,
      configUsed.fairnessWeights
    );

    indexedFixtures.push(matches);
    byeWeeks.push(byes);
    applyWeek(matches, byes, state, weekIdx);
    constructionScore += score;
  });

  const report = buildReport(players, strengths, configUsed.weekStartDates, indexedFixtures, state, configUsed);

  return {
    indexedFixtures,
    byeWeeks,
    state,
    report,
    constructionScore,
  };
}

function attemptScore(result: AttemptResult, weights: FixtureFairnessWeights) {
  const metrics = result.report.metrics;
  return (
    (metrics.matchSpread * weights.matchBalance) +
    (metrics.byeSpread * weights.byeBalance) +
    (metrics.missingPartnerPairs * weights.partnerRepeat * 120) +
    (Math.max(0, metrics.maxPartnerRepeat - 1) * weights.partnerRepeat * 40) +
    (metrics.repeatedPartnerships * weights.partnerRepeat * 9) +
    (metrics.repeatedOpponents * weights.opponentRepeat * 3) +
    (metrics.repeatedGroupsOfFour * weights.exactMatchRepeat * 6) +
    (metrics.repeatedExactMatches * weights.exactMatchRepeat * 10) +
    (metrics.unbalancedMatches * weights.abilityBalance * 12) +
    (metrics.weeksWithInsufficientPlayers * weights.completeMatches * 0.4) +
    (metrics.weeksLimitedByCourts * weights.completeMatches * 0.1) +
    result.constructionScore
  );
}

function indexedFixturesToMatches(
  players: Player[],
  indexedFixtures: IndexedMatch[][],
  weekStartDates: string[],
  configUsed: FixtureGeneratorConfig & { fairnessWeights: FixtureFairnessWeights; weekStartDates: string[] }
) {
  return indexedFixtures.map((weekMatches, weekIdx) =>
    weekMatches.map(([teamA, teamB], matchIdx) => {
      const playerIds = [teamA[0], teamA[1], teamB[0], teamB[1]].map((idx) => players[idx].id);
      return {
        id: `generated-${weekIdx + 1}-${matchIdx + 1}-${playerIds.join('-')}`,
        date: weekStartDates[weekIdx],
        time: undefined,
        venue: Number.isFinite(configUsed.courtsAvailable) ? `Court ${matchIdx + 1}` : undefined,
        team1: [players[teamA[0]].id, players[teamA[1]].id],
        team2: [players[teamB[0]].id, players[teamB[1]].id],
        sets: [],
        winner: null,
        status: 'scheduled' as const,
        availability: Object.fromEntries(playerIds.map((playerId) => [playerId, 'available' as const])),
      };
    })
  );
}

export function generateSeasonSchedule(players: Player[], config: FixtureGeneratorConfig): SeasonScheduleResult {
  if (!players || players.length < 4) {
    throw new Error(`At least 4 players are required to generate doubles fixtures. You currently have ${players?.length || 0}.`);
  }

  const configUsed: FixtureGeneratorConfig & {
    fairnessWeights: FixtureFairnessWeights;
    weekStartDates: string[];
  } = {
    ...config,
    allowByes: config.allowByes ?? true,
    fairnessWeights: {
      ...DEFAULT_WEIGHTS,
      ...(config.fairnessWeights || {}),
    },
    weekStartDates: buildWeekStartDates(players, config),
  };

  if (configUsed.weekStartDates.length === 0) {
    throw new Error('No fixture weeks are available for generation.');
  }

  const attempts = players.length >= 16 ? 90 : 70;
  let bestResult: AttemptResult | null = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = attemptSeason(players, configUsed);
    const score = attemptScore(result, configUsed.fairnessWeights);

    if (score < bestScore) {
      bestScore = score;
      bestResult = result;
    }

    if (
      result.report.metrics.missingPartnerPairs === 0 &&
      result.report.metrics.repeatedPartnerships === 0 &&
      result.report.metrics.matchSpread <= 1 &&
      result.report.metrics.byeSpread <= 1
    ) {
      break;
    }
  }

  if (!bestResult) {
    throw new Error('Unable to generate a valid season schedule.');
  }

  const fixtures = indexedFixturesToMatches(players, bestResult.indexedFixtures, configUsed.weekStartDates, configUsed);

  return {
    matches: fixtures.flat(),
    fixtures,
    explanation: bestResult.report.explanation,
    report: bestResult.report,
    configUsed,
  };
}
