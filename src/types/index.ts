export interface Player {
  id: string;
  name: string;
  seed?: number; // 1 = strongest, higher = weaker
  avatar?: string;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    points: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    gameDifference: number; // Games Won - Games Lost
  };
}

export interface Match {
  id: string;
  date: string;
  // Store player IDs
  team1: string[]; // [player1Id, player2Id]
  team2: string[]; // [player3Id, player4Id]
  
  // Scores per set
  sets: {
    team1: number;
    team2: number;
  }[];
  
  // Optional tie-breaker (e.g., played if sets are 1-1)
  tieBreaker?: {
    team1: number;
    team2: number;
  };

  winner: 'team1' | 'team2' | 'draw' | null;
  status: 'scheduled' | 'postponed' | 'completed';
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  playerId?: string;
  role: 'admin' | 'viewer'; // 'viewer' is the "Player" role
  status: 'active' | 'invited';
  lastLogin?: string;
}

export interface LeagueSettings {
  pointsPerWin: number;
  pointsPerDraw: number;
  pointsPerLoss: number;
}

export interface SeasonArchive {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  players: Player[];
  matches: Match[];
}
