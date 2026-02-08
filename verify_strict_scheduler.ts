import { generateStrictSchedule } from './src/lib/strictScheduler.ts';
import { Player } from './src/types';

function createMockPlayers(n: number): Player[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: `Player ${i}`,
        stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0 }
    }));
}

function verifySchedule(n: number) {
    console.log(`\n=== Verifying Schedule for N=${n} ===`);
    try {
        const players = createMockPlayers(n);
        const result = generateStrictSchedule(players, '2024-01-01');
        const matches = result.matches;
        
        console.log(`Generated ${matches.length} matches.`);
        console.log(`Stats:`, result.stats);

        // 1. Verify Week Count
        const dates = new Set(matches.map(m => m.date));
        if (dates.size !== n - 1) {
            console.error(`FAIL: Expected ${n - 1} weeks, got ${dates.size}`);
        } else {
            console.log(`PASS: ${dates.size} weeks generated.`);
        }

        // 2. Verify Matches per Week & No Byes
        let weekFail = false;
        for (const date of dates) {
            const weekMatches = matches.filter(m => m.date === date);
            if (weekMatches.length !== n / 4) {
                console.error(`FAIL: Week ${date} has ${weekMatches.length} matches, expected ${n / 4}`);
                weekFail = true;
            }
            
            const playersInWeek = new Set<string>();
            weekMatches.forEach(m => {
                [...m.team1, ...m.team2].forEach(p => playersInWeek.add(p));
            });
            
            if (playersInWeek.size !== n) {
                console.error(`FAIL: Week ${date} has ${playersInWeek.size} unique players, expected ${n}`);
                weekFail = true;
            }
        }
        if (!weekFail) console.log(`PASS: All weeks have ${n / 4} matches and ${n} unique players.`);

        // 3. Verify Partner Wheel (Each pair exactly once)
        const partnerCounts = new Map<string, number>();
        matches.forEach(m => {
            const addPair = (p1: string, p2: string) => {
                const k = [p1, p2].sort().join('-');
                partnerCounts.set(k, (partnerCounts.get(k) || 0) + 1);
            };
            addPair(m.team1[0], m.team1[1]);
            addPair(m.team2[0], m.team2[1]);
        });

        const expectedPairs = (n * (n - 1)) / 2;
        if (partnerCounts.size !== expectedPairs) {
             console.error(`FAIL: Expected ${expectedPairs} unique partnerships, got ${partnerCounts.size}`);
        }
        
        const badPairs = Array.from(partnerCounts.entries()).filter(([_, c]) => c !== 1);
        if (badPairs.length > 0) {
            console.error(`FAIL: ${badPairs.length} pairs appear != 1 times.`);
            // console.log(badPairs);
        } else {
            console.log(`PASS: All ${expectedPairs} partnerships appear exactly once.`);
        }

        // 4. Verify Fairness Constraints (Min >= 1, Max <= 3)
        const minOpponentRepeat = result.stats.minOpponentRepeat;
        const maxOpponentRepeat = result.stats.maxOpponentRepeat;

        if (minOpponentRepeat < 1) {
             console.error(`FAIL: Found pairs that never play against each other (Min: ${minOpponentRepeat})`);
        } else {
             console.log(`PASS: Min Opponent Repeat >= 1 (${minOpponentRepeat})`);
        }

        if (maxOpponentRepeat > 3) {
             console.error(`FAIL: Found pairs that play too often (Max: ${maxOpponentRepeat} > 3)`);
        } else {
             console.log(`PASS: Max Opponent Repeat <= 3 (${maxOpponentRepeat})`);
        }

    } catch (e: any) {
        console.error("ERROR:", e.message);
    }
}

// Test cases
verifySchedule(4);
verifySchedule(8);
verifySchedule(12);
verifySchedule(16);

// Test invalid
console.log("\n=== Testing Invalid Input (N=6) ===");
try {
    generateStrictSchedule(createMockPlayers(6), '2024-01-01');
} catch (e: any) {
    console.log("PASS: Caught expected error:", e.message);
}
