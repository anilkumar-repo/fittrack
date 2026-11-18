import { shiftDate } from "./dates.ts";

// ---------- Feed (Phase 7 step B) ----------

export const CAPTION_MAX = 1000;
export const COMMENT_MAX = 500;
/** Posts can be made for workouts from the last week (the database checks this too). */
export const POST_WINDOW_DAYS = 7;
/** Photos are shrunk to fit inside this many pixels on the long side. */
export const PHOTO_MAX_SIDE = 1600;
/** The storage bucket refuses anything bigger. */
export const PHOTO_MAX_BYTES = 1_500_000;

/** Whether a finished workout on `date` can still be posted today. */
export function canPostDate(date: string, today: string): boolean {
  return date <= shiftDate(today, 1) && date >= shiftDate(today, -POST_WINDOW_DAYS);
}

/** The size to draw a photo at so its long side is at most `max` (never enlarged). */
export function fitInside(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** "Just now", "5 min", "3 h", "Yesterday", "Mon", or "Nov 3" — how long ago something was posted. */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60 && at.getDate() === now.getDate()) return `${Math.floor(minutes / 60)} h`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (minutes < 6 * 24 * 60) return at.toLocaleDateString("en", { weekday: "short" });
  return at.toLocaleDateString("en", { month: "short", day: "numeric", year: at.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** "1 like" / "3 likes", "No comments yet" / "1 comment" / "4 comments". */
export function countLabel(count: number, one: string, many: string, none?: string): string {
  if (count === 0 && none !== undefined) return none;
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Shrinks a picked photo for posting: fits it inside 1600 px, turns it the right way up, and re-saves it as WebP
 * (falls back to JPEG). Redrawing also drops the photo's hidden details (GPS location, camera info).
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const size = fitInside(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can’t prepare photos.");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  for (const [type, quality] of [["image/webp", 0.82], ["image/webp", 0.7], ["image/jpeg", 0.75]] as const) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob && blob.type === type && blob.size <= PHOTO_MAX_BYTES) return blob;
  }
  throw new Error("That photo is too large. Try another one.");
}
