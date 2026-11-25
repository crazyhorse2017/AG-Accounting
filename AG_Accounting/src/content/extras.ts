import quickFactsFile from './data/facts/quick-facts.json';
import historyFactsFile from './data/facts/history-facts.json';
import videosFile from './data/videos.json';
import type { Reviewable } from './status.ts';

export type QuickFact = Reviewable & { text: string; topic: string };
export type HistoryFact = Reviewable & { text: string; year: number | null; monthDay: string | null };
export type Video = Reviewable & { youtubeId: string; title: string; topic: string; durationSeconds: number; description: string };

export const quickFacts = quickFactsFile.items as unknown as QuickFact[];
export const historyFacts = (historyFactsFile.items as unknown as HistoryFact[]).slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
export const videos = videosFile.items as unknown as Video[];

export const VIDEO_TOPICS: { id: string; title: string }[] = videosFile.topics;
