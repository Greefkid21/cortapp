import { generateSchedule } from './scheduler';

self.onmessage = (e: MessageEvent) => {
  try {
    const { players, startDate } = e.data;
    const matches = generateSchedule(players, startDate);
    self.postMessage({ type: 'SUCCESS', payload: matches });
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
  }
};
