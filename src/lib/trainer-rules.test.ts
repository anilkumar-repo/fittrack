import assert from "node:assert/strict";
import test from "node:test";
import { canManageTrainerClientRules, DEFAULT_TRAINER_RULE_SETTINGS, profileWithTrainerEquipment, trainerRuleChangesNeedConfirmation, validateTrainerRuleSettings } from "./trainer-rules.ts";
import type { Profile, TrainerRuleSettings } from "./types";

const profile: Profile = {
  id: "client-1", displayName: "Client", experience: "beginner", sessionsPerWeek: 3,
  trainingDays: [2, 4, 6], trainingStartDate: "2026-10-01", timeZone: "Asia/Kolkata", deadliftEnabled: false,
  trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [],
};

function clone(): TrainerRuleSettings {
  return structuredClone(DEFAULT_TRAINER_RULE_SETTINGS);
}

test("accepts conservative defaults and rejects invalid, duplicated, and restricted template overrides", () => {
  assert.deepEqual(validateTrainerRuleSettings(DEFAULT_TRAINER_RULE_SETTINGS), []);
  const settings = clone();
  settings.exerciseTemplates = [
    { exerciseId: "goblet_squat", sets: 2, minReps: 8, maxReps: 12, restSeconds: 90 },
    { exerciseId: "goblet_squat", sets: 2, minReps: 8, maxReps: 12, restSeconds: 90 },
  ];
  assert.ok(validateTrainerRuleSettings(settings).some((error) => error.includes("once")));
  settings.exerciseTemplates = [{ exerciseId: "dumbbell_rdl", sets: 2, minReps: 8, maxReps: 10, restSeconds: 90 }];
  assert.ok(validateTrainerRuleSettings(settings).some((error) => error.includes("repetition-based exercise")));
  settings.exerciseTemplates = [{ exerciseId: "plank", sets: 2, minReps: 20, maxReps: 30, restSeconds: 45 }];
  assert.ok(validateTrainerRuleSettings(settings).some((error) => error.includes("repetition-based")));
});

test("rejects rule values outside bounded progression, recovery, and equipment ranges", () => {
  const settings = clone();
  settings.progression.smallLoadStepKg = 10;
  settings.recovery.stopEnergyThreshold = 5;
  settings.equipment = { mode: "verified", availableEquipment: ["rack", "rack"] };
  const errors = validateTrainerRuleSettings(settings);
  assert.ok(errors.some((error) => error.includes("Progression")));
  assert.ok(errors.some((error) => error.includes("Recovery-session")));
  assert.ok(errors.some((error) => error.includes("unique FitTrack")));
});

test("equipment overrides use only explicit trainer-confirmed choices", () => {
  const settings = clone();
  settings.equipment = { mode: "verified", availableEquipment: ["dumbbells", "bench"] };
  const effective = profileWithTrainerEquipment(profile, settings);
  assert.equal(effective.equipmentAvailability, "verified");
  assert.deepEqual(effective.availableEquipment, ["dumbbells", "bench"]);
  settings.equipment = { mode: "unknown", availableEquipment: [] };
  assert.deepEqual(profileWithTrainerEquipment(effective, settings).availableEquipment, []);
});

test("sensitive increases require review and relaxed rules do not bypass range validation", () => {
  const relaxed = clone();
  relaxed.recovery.stopEnergyThreshold = 1;
  relaxed.progression.smallLoadStepKg = 2;
  assert.equal(trainerRuleChangesNeedConfirmation(DEFAULT_TRAINER_RULE_SETTINGS, relaxed), true);
  const safer = clone();
  safer.recovery.stopEnergyThreshold = 2;
  assert.equal(trainerRuleChangesNeedConfirmation(DEFAULT_TRAINER_RULE_SETTINGS, safer), false);
  const reducedRest = clone();
  reducedRest.exerciseTemplates = [{ exerciseId: "goblet_squat", sets: 3, minReps: 8, maxReps: 10, restSeconds: 60 }];
  assert.equal(trainerRuleChangesNeedConfirmation(DEFAULT_TRAINER_RULE_SETTINGS, reducedRest), true);
});

test("rule changes require the trusted trainer, exact trainer identity, and an active linked client", () => {
  const linked = ["client-1"];
  assert.equal(canManageTrainerClientRules({ id: "trainer-1", trustedRole: "trainer" }, "trainer-1", "client-1", linked), true);
  assert.equal(canManageTrainerClientRules({ id: "trainer-1", trustedRole: "client" }, "trainer-1", "client-1", linked), false);
  assert.equal(canManageTrainerClientRules({ id: "trainer-2", trustedRole: "trainer" }, "trainer-1", "client-1", linked), false);
  assert.equal(canManageTrainerClientRules({ id: "trainer-1", trustedRole: "trainer" }, "trainer-1", "other-client", linked), false);
  assert.equal(canManageTrainerClientRules({ id: "trainer-1", trustedRole: "trainer" }, "trainer-1", "trainer-1", linked), false);
});
