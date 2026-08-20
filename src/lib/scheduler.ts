import { Match, Player, PlayerAvailability } from '../types';
import {
  FixtureGeneratorConfig,
  generateSeasonSchedule,
  SeasonFairnessReport,
} from './seasonScheduler';

export interface SchedulerResult {
    matches: Match[];
    fixtures?: Match[][];
    stats?: any;
    explanation?: string;
    report?: SeasonFairnessReport;
    configUsed?: FixtureGeneratorConfig;
    error?: {
        code: string;
        message: string;
    };
}

export interface GenerateScheduleOptions {
  startDate?: string;
  availability?: PlayerAvailability[];
  weekCount?: number;
  weekStartDates?: string[];
  courtsAvailable?: number;
  matchDurationMinutes?: number;
  idealMatchesPerPlayer?: number;
  allowByes?: boolean;
  fairnessWeights?: FixtureGeneratorConfig['fairnessWeights'];
}

function combineReports(reports: SeasonFairnessReport[]): SeasonFairnessReport | undefined {
  if (reports.length === 0) return undefined;

  const totalMatches = reports.reduce((sum, report) => sum + report.metrics.totalMatches, 0);
  const weightedScore = reports.reduce((sum, report) => {
    const weight = Math.max(1, report.metrics.totalMatches);
    return sum + (report.overallScore * weight);
  }, 0);
  const totalWeight = reports.reduce((sum, report) => sum + Math.max(1, report.metrics.totalMatches), 0);

  return {
    overallScore: Math.round(weightedScore / totalWeight),
    explanation: reports.map((report) => report.explanation).join(' '),
    compromises: reports.flatMap((report) => report.compromises),
    issues: reports.flatMap((report) => report.issues),
    playerSummaries: reports.flatMap((report) => report.playerSummaries),
    metrics: {
      totalWeeks: Math.max(...reports.map((report) => report.metrics.totalWeeks)),
      totalMatches,
      averageMatchesPlayed: Number(
        (
          reports.reduce((sum, report) => sum + report.metrics.averageMatchesPlayed * report.playerSummaries.length, 0) /
          Math.max(1, reports.reduce((sum, report) => sum + report.playerSummaries.length, 0))
        ).toFixed(2)
      ),
      averageByes: Number(
        (
          reports.reduce((sum, report) => sum + report.metrics.averageByes * report.playerSummaries.length, 0) /
          Math.max(1, reports.reduce((sum, report) => sum + report.playerSummaries.length, 0))
        ).toFixed(2)
      ),
      matchSpread: Math.max(...reports.map((report) => report.metrics.matchSpread)),
      byeSpread: Math.max(...reports.map((report) => report.metrics.byeSpread)),
      missingPartnerPairs: reports.reduce((sum, report) => sum + report.metrics.missingPartnerPairs, 0),
      maxPartnerRepeat: Math.max(...reports.map((report) => report.metrics.maxPartnerRepeat)),
      repeatedPartnerships: reports.reduce((sum, report) => sum + report.metrics.repeatedPartnerships, 0),
      repeatedOpponents: reports.reduce((sum, report) => sum + report.metrics.repeatedOpponents, 0),
      repeatedGroupsOfFour: reports.reduce((sum, report) => sum + report.metrics.repeatedGroupsOfFour, 0),
      repeatedExactMatches: reports.reduce((sum, report) => sum + report.metrics.repeatedExactMatches, 0),
      unbalancedMatches: reports.reduce((sum, report) => sum + report.metrics.unbalancedMatches, 0),
      weeksWithInsufficientPlayers: reports.reduce((sum, report) => sum + report.metrics.weeksWithInsufficientPlayers, 0),
      weeksLimitedByCourts: reports.reduce((sum, report) => sum + report.metrics.weeksLimitedByCourts, 0),
    },
  };
}

/**
 * Generates a schedule for the league.
 * 
 * Dispatcher:
 * - Splits active players by division.
 * - Runs the season-wide optimiser per division.
 * - Combines weekly fixtures and fairness reporting.
 */
export function generateSchedule(
  players: Player[],
  options: GenerateScheduleOptions | string = new Date().toISOString().split('T')[0]
): SchedulerResult {
  try {
    if (!players || !Array.isArray(players) || players.length < 2) {
        throw new Error("Invalid players array provided");
    }

    const normalizedOptions: GenerateScheduleOptions = typeof options === 'string'
      ? { startDate: options }
      : options;
    const startDate = normalizedOptions.startDate || new Date().toISOString().split('T')[0];
    const n = players.length;

    // Multi-Division Handling
    const divisions = Array.from(new Set(players.map(p => p.division || 1))).sort();
    if (divisions.length > 1) {
        console.log(`Generating Multi-Division Schedule for ${n} players...`);
        const allFixtures: Match[][] = [];
        let combinedExplanation = "";
        let combinedMatches: Match[] = [];
        const divisionReports: SeasonFairnessReport[] = [];

        for (const div of divisions) {
            const divPlayers = players.filter(p => (p.division || 1) === div);
            if (divPlayers.length === 0) continue;
            
            const result = generateSchedule(divPlayers, { ...normalizedOptions, startDate });
            if (result.error) {
                return {
                    matches: [],
                    error: {
                        code: result.error.code,
                        message: `Division ${div} failed: ${result.error.message}`
                    }
                };
            }

            // Combine fixtures by week
            result.fixtures?.forEach((weekMatches, weekIdx) => {
                if (!allFixtures[weekIdx]) allFixtures[weekIdx] = [];
                allFixtures[weekIdx].push(...weekMatches);
            });
            
            if (result.matches) combinedMatches.push(...result.matches);
            combinedExplanation += `Division ${div}: ${result.explanation}\n`;
            if (result.report) divisionReports.push(result.report);
        }

        return {
            matches: combinedMatches,
            fixtures: allFixtures,
            explanation: combinedExplanation.trim(),
            report: combineReports(divisionReports),
            configUsed: {
              startDate,
              availability: normalizedOptions.availability,
              weekCount: normalizedOptions.weekCount,
              weekStartDates: normalizedOptions.weekStartDates,
              courtsAvailable: normalizedOptions.courtsAvailable,
              matchDurationMinutes: normalizedOptions.matchDurationMinutes,
              idealMatchesPerPlayer: normalizedOptions.idealMatchesPerPlayer,
              allowByes: normalizedOptions.allowByes,
              fairnessWeights: normalizedOptions.fairnessWeights,
            }
        };
    }

    console.log(`Using Season Optimiser for ${n} players...`);
    const result = generateSeasonSchedule(players, {
      startDate,
      availability: normalizedOptions.availability,
      weekCount: normalizedOptions.weekCount,
      weekStartDates: normalizedOptions.weekStartDates,
      courtsAvailable: normalizedOptions.courtsAvailable,
      matchDurationMinutes: normalizedOptions.matchDurationMinutes,
      idealMatchesPerPlayer: normalizedOptions.idealMatchesPerPlayer,
      allowByes: normalizedOptions.allowByes,
      fairnessWeights: normalizedOptions.fairnessWeights,
    });
    return {
        matches: result.matches,
        fixtures: result.fixtures,
        explanation: result.explanation,
        report: result.report,
        configUsed: result.configUsed
    };

  } catch (e) {
      console.error("Scheduler Error:", e);
      return {
        matches: [],
        error: {
          code: 'SCHEDULER_ERROR',
          message: e instanceof Error ? e.message : 'Unknown scheduler error'
        }
      };
  }
}
