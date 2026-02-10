
import { generateStrictSchedule } from './src/lib/strictScheduler';
import { Player } from './src/types';

// Mock Players
const createPlayers = (n: number): Player[] => {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    email: `p${i + 1}@test.com`,
    seed: i + 1, // Seeds 1..N
    active: true
  }));
};

const runTest = async () => {
  const N = 12;
  const players = createPlayers(N);
  const NUM_RUNS = 10;
  
  console.log(`Running ${NUM_RUNS} tests for N=${N} (Strict 50% Rule)...`);
  console.log("Rule: AC <= 1 AND AA >= 2");
  
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
    const AA = stats.count_3x_by_tier.AA;
    const AC = stats.count_3x_by_tier.AC;
    const forcedFailure = stats.seededFairnessForcedFailure;

    console.log(`  AA: ${AA}, AC: ${AC}`);
    console.log(`  Forced Failure Flag: ${forcedFailure}`);

    // Verify Logic
    const rule1 = AC <= 1;
    const rule2 = AA >= 2;
    const rulePassed = rule1 && rule2;

    if (rulePassed) {
        if (forcedFailure) {
             console.log("  ⚠️ ERROR: Flag set but rule passed?");
        } else {
             console.log("  ✅ PASSED");
             passed++;
        }
    } else {
        if (forcedFailure) {
            console.log("  ⚠️ WARNED (Correctly flagged)");
            warnings++;
        } else {
            console.log("  ❌ ERROR: Rule failed but flag NOT set!");
            failures++;
        }
    }
  }

  console.log("\n--------------------------------------------------");
  console.log(`Results: ${passed} Passed, ${warnings} Warnings (Valid Fallback), ${failures} Errors`);
  console.log("--------------------------------------------------");
};

runTest();
