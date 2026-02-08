import { generateSchedule } from './scheduler';
import { Player } from '../types';

export interface WorkerInput {
    players: Player[];
    startDate: string;
}

export interface WorkerResponse {
    type: 'SUCCESS' | 'ERROR';
    payload: any;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  try {
    if (!e.data || !Array.isArray(e.data.players)) {
        throw new Error("Invalid input: 'players' array is required.");
    }

    const { players, startDate } = e.data;
    const result = generateSchedule(players, startDate);
    
    // Safety check: ensure result is serializable
    // (This is generally true for JSON-like objects, but good to be mindful)
    const payload = JSON.parse(JSON.stringify(result));

    self.postMessage({ type: 'SUCCESS', payload });
  } catch (error) {
    console.error("Worker Error:", error);
    self.postMessage({ 
        type: 'ERROR', 
        payload: {
            message: error instanceof Error ? error.message : 'Unknown worker error',
            code: 'WORKER_EXCEPTION'
        }
    });
  }
};
