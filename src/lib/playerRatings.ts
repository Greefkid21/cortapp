import { Player, PlayerRating } from '../types';

export const PLAYER_RATINGS: PlayerRating[] = ['A', 'B', 'C'];

const RATING_TO_STORED_SEED: Record<PlayerRating, number> = {
  A: 10,
  B: 20,
  C: 30,
};

export function ratingToStoredSeed(rating?: PlayerRating): number | undefined {
  if (!rating) return undefined;
  return RATING_TO_STORED_SEED[rating];
}

export function getPlayerRating(player?: Pick<Player, 'rating' | 'seed'> | null): PlayerRating {
  if (player?.rating) return player.rating;

  const seed = player?.seed;
  if (seed === 10) return 'A';
  if (seed === 20) return 'B';
  if (seed === 30) return 'C';

  // Backward compatibility for older numeric seed data.
  if (!Number.isFinite(seed)) return 'B';
  if ((seed as number) <= 4) return 'A';
  if ((seed as number) <= 8) return 'B';
  return 'C';
}

export function getRatingStrength(rating: PlayerRating): number {
  if (rating === 'A') return 3;
  if (rating === 'B') return 2;
  return 1;
}
