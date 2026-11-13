/** How long an information message stays: short ones ~4 s, longer ones up to 10 s (time to read). */
export function noticeDuration(text: string): number {
  return Math.min(10_000, Math.max(4_000, 1_500 + text.length * 60));
}

/** Messages about something going wrong get a warning look instead of a tick. */
export function noticeIsProblem(text: string): boolean {
  return /could not|couldn[’']t|can[’']t|failed|error|unable|not saved|try again/i.test(text);
}
