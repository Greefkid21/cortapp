import { Match } from '../types';

export function isEmptySetScore(t1: number, t2: number) {
  return t1 === 0 && t2 === 0;
}

export function isValidCompletedSetScore(t1: number, t2: number) {
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return false;
  if (t1 < 0 || t2 < 0) return false;
  if (t1 > 7 || t2 > 7) return false;
  if (t1 === t2) return false;

  const max = Math.max(t1, t2);
  const min = Math.min(t1, t2);

  if (max === 6) return min <= 4;
  if (max === 7) return min === 5 || min === 6;
  return false;
}

export function validateMatchScoreInput(sets: Array<{ t1: number; t2: number }>, tieBreaker?: { t1: number; t2: number }) {
  if (!Array.isArray(sets) || sets.length < 2) {
    return { ok: false, message: 'Match must have 2 sets.' };
  }

  for (let i = 0; i < 2; i++) {
    const set = sets[i];
    if (!set) return { ok: false, message: `Set ${i + 1} is missing.` };
    const t1 = Number(set.t1 ?? 0);
    const t2 = Number(set.t2 ?? 0);

    if (isEmptySetScore(t1, t2)) {
      return { ok: false, message: `Set ${i + 1} is 0-0. Enter a completed score.` };
    }

    if (!isValidCompletedSetScore(t1, t2)) {
      return { ok: false, message: `Set ${i + 1} score ${t1}-${t2} is not a completed set. Valid examples: 6-4, 7-5, 7-6.` };
    }
  }

  const setWinners = sets.slice(0, 2).map(s => (s.t1 > s.t2 ? 'team1' : 'team2'));
  const t1SetWins = setWinners.filter(w => w === 'team1').length;
  const t2SetWins = setWinners.filter(w => w === 'team2').length;

  const hasTieBreaker = !!tieBreaker && (tieBreaker.t1 > 0 || tieBreaker.t2 > 0);
  if (hasTieBreaker && t1SetWins !== 1) {
    return { ok: false, message: 'Tie breaker can only be entered when sets are split 1-1.' };
  }
  if (hasTieBreaker && t2SetWins !== 1) {
    return { ok: false, message: 'Tie breaker can only be entered when sets are split 1-1.' };
  }

  return { ok: true };
}

export function calculateMatchStats(match: Match) {
  if (match.status !== 'completed') {
    return { t1Sets: 0, t2Sets: 0, t1Games: 0, t2Games: 0, t1Points: 0, t2Points: 0, winner: null as any };
  }

  let t1Sets = 0, t2Sets = 0;
  let t1Games = 0, t2Games = 0;
  let t1Points = 0, t2Points = 0;

  match.sets.forEach(set => {
    const s1 = Number(set.team1 ?? 0);
    const s2 = Number(set.team2 ?? 0);

    t1Games += s1;
    t2Games += s2;

    if (isEmptySetScore(s1, s2)) return;
    if (!isValidCompletedSetScore(s1, s2)) return;

    if (s1 > s2) {
      t1Sets++;
      t1Points++;
    } else if (s2 > s1) {
      t2Sets++;
      t2Points++;
    }
  });

  if (match.tieBreaker) {
    if (match.tieBreaker.team1 > match.tieBreaker.team2) {
      t1Points += 1;
      t1Games += 1;
    } else if (match.tieBreaker.team2 > match.tieBreaker.team1) {
      t2Points += 1;
      t2Games += 1;
    }
  }

  let winner = 'draw' as any;
  if (t1Points > t2Points) winner = 'team1';
  else if (t2Points > t1Points) winner = 'team2';
  else winner = 'draw';

  return { t1Sets, t2Sets, t1Games, t2Games, t1Points, t2Points, winner };
}

