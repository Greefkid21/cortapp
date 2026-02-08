
import { generateStrictSchedule } from './src/lib/strictScheduler';
import { Player } from './src/types';

const createMockPlayers = (n: number): Player[] => {
    return Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: `Player ${i}`,
        email: `p${i}@test.com`,
        phone: '123',
        rating: 5
    }));
};

try {
    console.log("Testing N=12...");
    const players = createMockPlayers(12);
    const result = generateStrictSchedule(players, '2024-01-01');
    console.log("Success!");
    console.log("Stats:", result.stats);
} catch (e) {
    console.error("Error:", e);
}
