/** Reference media for the exercise library: demonstration video links. Anatomy pictures live in muscle-images.ts. */

/**
 * Demonstration videos chosen by the trainer, keyed by exercise ID. Add a full video address here
 * after watching it and confirming it matches the written steps. Exercises without an entry open a
 * video search instead, so a link is never invented.
 */
const TRAINER_DEMO_VIDEOS: Record<string, string> = {};

export interface DemoVideoLink {
  url: string;
  /** True when a trainer picked this exact video; false when it is a search for the exercise name. */
  curated: boolean;
}

export function getDemoVideoLink(exercise: { id: string; name: string }): DemoVideoLink {
  const curated = TRAINER_DEMO_VIDEOS[exercise.id];
  if (curated && /^https:\/\//.test(curated)) return { url: curated, curated: true };
  const query = `${exercise.name} exercise proper form for beginners`;
  return { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, curated: false };
}
