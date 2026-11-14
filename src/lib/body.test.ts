import assert from "node:assert/strict";
import test from "node:test";
import { bmi, bmiBand, bodyPlan, healthyRange, validBodyStats, weighInDue, weighInTips } from "./body.ts";
import { comebackMessage, comebackSlot, expectedByNow, waterMood, waterNudge, waterTargetMl } from "./wellness.ts";

test("BMI and the healthy range for a height", () => {
  assert.equal(bmi(170, 72), 24.9);
  assert.equal(bmiBand(24.9), "healthy");
  assert.equal(bmiBand(27), "over");
  assert.equal(bmiBand(31), "obese");
  assert.equal(bmiBand(17.9), "under");
  assert.deepEqual(healthyRange(170), { minKg: 54, maxKg: 71 });
});

test("over the range: lose fat at a safe pace, goal suggestion is weight loss", () => {
  const plan = bodyPlan({ heightCm: 165, weightKg: 80, age: 32, sex: "female" });
  assert.equal(plan.direction, "lose");
  assert.equal(plan.recommendedGoal, "fatloss");
  assert.equal(plan.amountKg, 13);
  assert.ok(plan.weeks > 25 && plan.weeks < 40);
});

test("under the range: gain as muscle, slower for women than men", () => {
  const woman = bodyPlan({ heightCm: 165, weightKg: 47, age: 24, sex: "female" });
  const man = bodyPlan({ heightCm: 165, weightKg: 47, age: 24, sex: "male" });
  assert.equal(woman.direction, "gain");
  assert.equal(woman.recommendedGoal, "muscle");
  assert.ok(woman.weeks > man.weeks);
});

test("in range: keep weight and tone up; under-18s get no weight target", () => {
  assert.equal(bodyPlan({ heightCm: 175, weightKg: 70, age: 30 }).direction, "maintain");
  const teen = bodyPlan({ heightCm: 160, weightKg: 75, age: 15 });
  assert.equal(teen.youth, true);
  assert.equal(teen.amountKg, 0);
  assert.equal(validBodyStats({ heightCm: 170, weightKg: 70, age: 12 }), false);
  assert.equal(validBodyStats({ heightCm: 170, weightKg: 70, age: 30 }), true);
});

test("monthly weigh-in: due after 30 days or with no weight, with tips that follow the goal", () => {
  assert.equal(weighInDue([], "2026-11-14"), true);
  assert.equal(weighInDue([{ id: "a", measuredOn: "2026-10-20", weightKg: 80 }], "2026-11-14"), false);
  assert.equal(weighInDue([{ id: "a", measuredOn: "2026-10-15", weightKg: 80 }], "2026-11-14"), true);
  assert.match(weighInTips(80, 80, 30, "fatloss", 165).join(" "), /No loss yet/);
  assert.match(weighInTips(80, 78.5, 30, "fatloss", 165).join(" "), /Great pace/);
  assert.match(weighInTips(55, 54.5, 30, "muscle", 175).join(" "), /No gain yet/);
});

test("water: target from weight, pace by the hour, reminders only when behind and never too often", () => {
  assert.equal(waterTargetMl(60, false), 2100);
  assert.equal(waterTargetMl(60, true), 2600);
  assert.equal(waterTargetMl(null, false), 2200);
  assert.equal(expectedByNow(2600, 8), 0);
  assert.equal(expectedByNow(2600, 21), 2600);
  assert.equal(waterMood(1500, 2600, 14), "on-track");
  assert.equal(waterMood(250, 2600, 16), "thirsty");
  const now = Date.parse("2026-11-14T10:00:00Z");
  assert.ok(waterNudge({ loggedMl: 250, targetMl: 2600, hour: 16, lastSentAt: null, now, justTrained: false }));
  assert.equal(waterNudge({ loggedMl: 250, targetMl: 2600, hour: 16, lastSentAt: now - 3_600_000, now, justTrained: false }), null);
  assert.equal(waterNudge({ loggedMl: 250, targetMl: 2600, hour: 22, lastSentAt: null, now, justTrained: false }), null);
  assert.equal(waterNudge({ loggedMl: 1500, targetMl: 2600, hour: 14, lastSentAt: null, now, justTrained: false }), null);
  assert.match(waterNudge({ loggedMl: 1500, targetMl: 2600, hour: 14, lastSentAt: null, now, justTrained: true })?.title ?? "", /refuel/);
});

test("comeback: three reminders a day after a 5-day break, until a workout starts", () => {
  assert.equal(comebackSlot(4, 9, false), null);
  assert.equal(comebackSlot(5, 9, false), 0);
  assert.equal(comebackSlot(9, 13, false), 1);
  assert.equal(comebackSlot(9, 19, false), 2);
  assert.equal(comebackSlot(9, 10, false), null);
  assert.equal(comebackSlot(9, 19, true), null);
  assert.match(comebackMessage("Priya", "Keep up with my kids", 0).body, /Keep up with my kids/);
});
