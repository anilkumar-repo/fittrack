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
