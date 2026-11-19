import assert from "node:assert/strict";
import test from "node:test";
import { redactContactDetails } from "./privacy.ts";

test("emails and phone numbers are masked; fitness numbers, dates and times stay", () => {
  assert.equal(redactContactDetails("Mail me at anil.k+fit@example.co.in or +91 98765 43210"), "Mail me at [email] or [phone]");
  assert.equal(redactContactDetails("call (555) 123-4567 now"), "call [phone] now");
  assert.equal(redactContactDetails("9876543210"), "[phone]");
  for (const kept of ["Bench 42.5 kg x 8", "3 sets of 10-12 reps", "on 2026-11-18 at 18:30", "I weigh 78.4 kg and I'm 176 cm", "squat 100 kg for 5x5"]) {
    assert.equal(redactContactDetails(kept), kept, kept);
  }
});

test("card links only go to pages inside RozFit", async () => {
  const { isInAppLink } = await import("./cards.ts");
  for (const ok of ["/today", "/progress?exercise=bench", "/rozi"]) assert.equal(isInAppLink(ok), true, ok);
  for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "today", "", "/to\nday", null, 5]) {
    assert.equal(isInAppLink(bad), false, String(bad));
  }
});
