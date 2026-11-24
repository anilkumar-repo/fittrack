// ---------- Rozi AI: keep contact details out of what's sent to AI providers ----------
//
// Tools never send names, emails, phone numbers or account ids. But a person might TYPE their email or phone number
// into a question ("email my plan to …"). Those are masked before anything goes to a provider.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
/** A run of digits with optional +, spaces, dots, dashes or brackets between them. */
const DIGIT_RUN = /\+?\(?\d[\d\s().-]{6,}\d/g;

/**
 * Masks email addresses and phone numbers (10+ digits; weights, reps, dates and times are shorter and stay).
 * "Mail me at anil@example.com or +91 98765 43210" → "Mail me at [email] or [phone]".
 */
export function redactContactDetails(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(DIGIT_RUN, (match) => (match.replace(/\D/g, "").length >= 10 ? "[phone]" : match));
}

/**
 * R13: text that tries to steer the AI ("ignore your rules", "you are now…", "system prompt", markup). Used to refuse
 * memory notes (they go into Rozi's instructions) and to drop a goal's "why" (shown on the approval card).
 */
const INSTRUCTION_LIKE = /\b(ignore|disregard|forget|override|bypass)\b[^.]{0,40}\b(instructions?|rules?|prompts?|guidelines?|safety)\b|\b(system|developer)\s*(prompt|message|mode)\b|\byou are (now|no longer)\b|\b(act|behave|respond) as\b|\bpretend (to be|you)\b|\bnew (rules?|instructions?)\b|\bjailbreak|\bassistant\s*:|<\/?[a-z][^>]*>|```/i;

export function looksLikeInstructions(text: string): boolean {
  return INSTRUCTION_LIKE.test(text);
}

/** A short line of the model's text that is safe to show on a card: one line, at most `max` characters, or "" if it holds contact details, links or instruction-like text. */
export function plainCardText(raw: unknown, max: number): string {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
  if (!text || redactContactDetails(text) !== text || /\bhttps?:\/\/|\bwww\./i.test(text) || looksLikeInstructions(text)) return "";
  return text;
}
