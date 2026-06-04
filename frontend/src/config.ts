export const BACKEND_URL = 'http://localhost:3001';

// Regional routing clusters offered in the search screen.
export const REGIONS = [
  { value: 'europe', label: 'Europe (EUW / EUNE / TR / RU)' },
  { value: 'americas', label: 'Americas (NA / BR / LAN / LAS / OCE)' },
  { value: 'asia', label: 'Asia (KR / JP)' },
] as const;

const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal (Draft)',
  420: 'Ranked Solo/Duo',
  430: 'Normal (Blind)',
  440: 'Ranked Flex',
  480: 'Swiftplay',
  490: 'Quickplay',
  700: 'Clash',
};

export function queueName(queueId?: number): string {
  if (queueId === undefined) return 'Summoner’s Rift';
  return QUEUE_NAMES[queueId] ?? 'Summoner’s Rift';
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function relativeDate(timestamp?: number): string {
  if (!timestamp) return '';
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'vor 1 Woche' : `vor ${weeks} Wochen`;
}
