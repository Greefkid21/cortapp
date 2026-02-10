
import { generateStrictSchedule } from './src/lib/strictScheduler';
import { Player } from './src/types';

// Mock Player Creation
const createPlayers = (n: number): Player[] => 
    Array.from({ length: n }, (_, i) => ({
        id: `p${i+1}`,
        name: `Player ${i+1}`,
        seed: i+1,
        stats: {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            points: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            gameDifference: 0
        }
    }));

const runTest = async () => {
    const N = 12;
    const players = createPlayers(N);
    const NUM_RUNS = 10;
    
    console.log(`Running ${NUM_RUNS} tests for N=${N}...`);
    
    let passed = 0;
    let warnings = 0;
    let failures = 0;

    for (let i = 0; i < NUM_RUNS; i++) {
        console.log(`\nRun ${i+1}/${NUM_RUNS}:`);
        const result = generateStrictSchedule(players, '2024-01-01', 5000); // 5s timeout
        
        if (!result.ok) {
            console.log(`❌ FAILED: ${result.error?.message}`);
            failures++;
            continue;
        }

        const stats = result.stats!;
        const warning = stats.seededFairnessWarning;
        const { AC, AA } = stats.count_3x_by_tier;

        console.log(`   AC 3x: ${AC}, AA 3x: ${AA}`);
        console.log(`   Warning Flag: ${warning ? 'TRUE (Rejected)' : 'FALSE (Accepted)'}`);
        
        if (warning) {
            warnings++;
        } else {
            passed++;
        }
    }

    console.log(`\n--- SUMMARY ---`);
    console.log(`Total Runs: ${NUM_RUNS}`);
    console.log(`Passed (No Warning): ${passed}`);
    console.log(`Warnings (Rule Violation): ${warnings}`);
    console.log(`Failures (Error): ${failures}`);
};

runTest();
