import assert from "node:assert/strict";
import { cannotVerify, getPlannedExpenseRupees, resolveAnswer } from "@/lib/assistant/evidence";
import type { EvidenceFact } from "@/lib/assistant/evidence";
import { monthBounds } from "@/lib/format";

const fact: EvidenceFact = { id: "spend:food:2026-08-01:2026-08-31", valueMinor: 125_000, label: "food spending" };
const facts = new Map([[fact.id, fact]]);

assert.equal(resolveAnswer(`Food spending was {{fact:${fact.id}}}.`, facts, true), "Food spending was ₹1,250.");
assert.equal(resolveAnswer("Food spending was ₹900.", facts, true), cannotVerify);
assert.equal(resolveAnswer("Food spending was {{fact:invented}}.", facts, true), cannotVerify);
assert.equal(resolveAnswer(`Food spending was {{fact:${fact.id}}}.`, facts, false), cannotVerify);
assert.equal(resolveAnswer("Food spending was one thousand rupees.", facts, true), cannotVerify);

assert.equal(getPlannedExpenseRupees("Can I afford a ₹40,000 expense this month?"), 40_000);
assert.equal(getPlannedExpenseRupees("Can I afford 40000 rupee this month?"), 40_000);
assert.equal(getPlannedExpenseRupees("Could I afford 40k INR?"), 40_000);
assert.equal(getPlannedExpenseRupees("Can I afford a large purchase?"), null);
assert.equal(getPlannedExpenseRupees("Can I afford ₹40,000.50?"), null);

assert.deepEqual(monthBounds(new Date("2026-09-29T12:00:00Z")), {
  start: "2026-09-01",
  end: "2026-10-01",
  previousStart: "2026-08-01",
  previousComparableEnd: "2026-08-29"
});
assert.deepEqual(monthBounds(new Date("2024-03-31T12:00:00Z")), {
  start: "2024-03-01",
  end: "2024-04-01",
  previousStart: "2024-02-01",
  previousComparableEnd: "2024-02-29"
});

console.log("Grounding and date checks passed: unsupported amounts fail closed; month bounds handle timezone days and leap months.");
