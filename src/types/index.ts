export type PlayerRating = 'A' | 'B' | 'C';
export type WorkspaceBillingStatus = 'billing_pending' | 'billable_active' | 'grace_period' | 'suspended' | 'free_exempt';
export type WorkspaceBillingPlan = 'monthly';
export type WorkspaceMembershipRole = 'owner_admin' | 'admin' | 'viewer';
export type PlatformRole = 'user' | 'platform_admin';
export type PayPalSubscriptionStatus = 'not_started' | 'pending_approval' | 'active' | 'past_due' | 'cancelled';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  billingStatus: WorkspaceBillingStatus;
  billingPlan: WorkspaceBillingPlan;
  isBillingExempt: boolean;
  billingExemptReason?: string;
  gracePeriodEndsAt?: string;
  billingPendingStartedAt?: string;
  ownerUserId?: string;
  paypalSubscriptionStatus?: PayPalSubscriptionStatus;
  paypalSubscriptionId?: string;
  paypalPlanId?: string;
  paypalPayerId?: string;
  paypalSubscriptionStartedAt?: string;
  paypalSubscriptionEndsAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformBillingConfig {
  id: number;
  provider: 'paypal';
  monthlyPrice: number;
  currency: string;
  supportEmail?: string;
  checkoutEnabled: boolean;
  isLive: boolean;
  paypalProductId?: string;
  paypalPlanId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMembershipRole;
  playerId?: string;
  createdAt?: string;
  workspace?: Workspace;
}

export interface WorkspaceAccessSummary {
  workspace: Workspace;
  membershipRole: WorkspaceMembershipRole;
  playerId?: string;
}

export interface Player {
  id: string;
  name: string;
  workspaceId?: string;
  rating?: PlayerRating; // A = strongest, C = weakest
  seed?: number; // Legacy numeric storage kept for backward compatibility
  avatar?: string;
  division?: number; // 1 for Division 1, 2 for Division 2, etc.
  in_league?: boolean; // false = excluded from league table and future fixtures
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

export interface Season {
  id: string;
  workspace_id?: string;
  name: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  is_draft?: boolean;
  final_standings?: {
    players?: Player[];
    matches?: Match[];
    meta?: {
      divisionCount?: number;
    };
  };
}

export interface Match {
  id: string;
  workspaceId?: string;
  date: string;
  time?: string; // e.g., '18:00'
  venue?: string; // e.g., 'Court 1'
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
  availability?: Record<string, 'available' | 'unavailable'>; // playerId -> status
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  playerId?: string;
  role: 'admin' | 'viewer'; // 'viewer' is the "Player" role
  platformRole?: PlatformRole;
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

export interface PlayerAvailability {
  id?: string;
  workspaceId?: string;
  playerId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  isAvailable: boolean;
  daysAvailable: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  note?: string;
  updatedAt?: string;
}

export interface PlayerHoliday {
  id?: string;
  workspaceId?: string;
  playerId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  note?: string;
  createdAt?: string;
}

export interface Rule {
  id: string;
  workspaceId?: string;
  content: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export type CompetitionType = 'americano' | 'mexicano';

export interface Competition {
  id: string;
  name: string;
  type: CompetitionType;
  date: string;
  status: 'open' | 'completed';
  max_points: number; // e.g. 24 or 32 points total per match
  num_courts: number; // Number of available courts
  players: string[]; // participant IDs
  created_at?: string;
}

export interface CompetitionMatch {
  id: string;
  competition_id: string;
  round: number;
  court?: string;
  team1: string[]; // [player1Id, player2Id]
  team2: string[]; // [player3Id, player4Id]
  score1: number;
  score2: number;
  status: 'completed' | 'pending';
  created_at?: string;
}

export interface CompetitionStandings {
  playerId: string;
  playerName: string;
  matchesPlayed: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
}
