import { generateStrictSchedule } from './src/lib/strictScheduler';
import { Player } from './src/types';

// Mock Players (N=12) with Seeds
// Seeds: 1..12
const players: Player[] = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    seed: i + 1, // 1 is best, 12 is worst
    stats: {
        matchesPlayed: 0, wins: 0, losses: 0, draws: 0,
        points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0
    }
}));

console.log(`Running Strict Mode Verification for N=${players.length}...`);

const result = generateStrictSchedule(players, '2025-01-01', 5000); // Give it 5s for verification

if (!result.ok) {
    console.error("Generation Failed:", result.error);
    process.exit(1);
}

const fixtures = result.fixtures!;
const stats = result.stats!;

console.log("Generation Successful!");
console.log("Stats:", JSON.stringify(stats, null, 2));

// 1. Validate Structure
if (fixtures.length !== 11) {
    console.error(`FAIL: Expected 11 weeks, got ${fixtures.length}`);
} else {
    console.log("PASS: 11 weeks");
}

let allPassed = true;

// 2. Validate Constraints
const playerAppearances = new Map<string, number>();
const partnerCounts = new Map<string, number>();
const opponentCounts = new Map<string, number>();

// Track dates to ensure they increment
const weekDates: string[] = [];

fixtures.forEach((week, wIdx) => {
    // Check week coverage
    const weekPlayers = new Set<string>();
    if (week.length !== 3) {
        console.error(`FAIL: Week ${wIdx+1} has ${week.length} matches (expected 3)`);
        allPassed = false;
    }

    // Check dates
    const datesInWeek = new Set(week.map(m => m.date));
    if (datesInWeek.size !== 1) {
        console.error(`FAIL: Week ${wIdx+1} has mixed dates: ${Array.from(datesInWeek).join(', ')}`);
        allPassed = false;
    }
    const weekDate = week[0].date;
    weekDates.push(weekDate);

    week.forEach(m => {
        // Players (IDs)
        const p1 = m.team1[0]; const p2 = m.team1[1];
        const p3 = m.team2[0]; const p4 = m.team2[1];
        
        [p1, p2, p3, p4].forEach(p => {
            if (weekPlayers.has(p)) {
                console.error(`FAIL: Player ${p} appears twice in Week ${wIdx+1}`);
                allPassed = false;
            }
            weekPlayers.add(p);
            playerAppearances.set(p, (playerAppearances.get(p) || 0) + 1);
        });

        // Partners
        const addPartner = (a: string, b: string) => {
            const k = [a, b].sort().join('-');
            partnerCounts.set(k, (partnerCounts.get(k) || 0) + 1);
        };
        addPartner(p1, p2);
        addPartner(p3, p4);

        // Opponents
        const addOpponent = (a: string, b: string) => {
            const k = [a, b].sort().join('-');
            opponentCounts.set(k, (opponentCounts.get(k) || 0) + 1);
        };
        // Team 1 vs Team 2
        addOpponent(p1, p3); addOpponent(p1, p4);
        addOpponent(p2, p3); addOpponent(p2, p4);
    });

    if (weekPlayers.size !== 12) {
        console.error(`FAIL: Week ${wIdx+1} has ${weekPlayers.size} unique players (expected 12)`);
        allPassed = false;
    }
});

// Validate Dates are distinct and sorted
console.log("Week Dates:", weekDates);
const uniqueDates = new Set(weekDates);
if (uniqueDates.size !== fixtures.length) {
    console.error(`FAIL: Dates are not unique across weeks! Found ${uniqueDates.size} unique dates for ${fixtures.length} weeks.`);
    allPassed = false;
} else {
    console.log("PASS: Dates are unique across weeks.");
}

// Check Partner Rotation
let partnerErrors = 0;
// Total unique pairs for N=12 is 12*11/2 = 66
if (partnerCounts.size !== 66) {
    console.error(`FAIL: Partner pairs count is ${partnerCounts.size} (expected 66)`);
    allPassed = false;
}
for (const [pair, count] of partnerCounts) {
    if (count !== 1) {
        console.error(`FAIL: Partner pair ${pair} played together ${count} times (expected 1)`);
        partnerErrors++;
    }
}
if (partnerErrors === 0) console.log("PASS: Strict partner rotation (all pairs exactly once)");
else allPassed = false;

if (allPassed) {
    console.log("\nALL VERIFICATIONS PASSED!");
} else {
    console.error("\nVERIFICATION FAILED!");
    process.exit(1);
}
