import { test } from "node:test";
import assert from "node:assert/strict";
import { round2 } from "@/projects/types";
import { priceWith } from "@/pricing/repo";

const coupon = (kind: "pct" | "amount", value: number) => ({ kind, value, active: true, validUntil: null, maxUses: null, uses: 0 });

test("round2 rounds half away from zero like Postgres round(x, 2)", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(0.145), 0.15);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(-1.005), -1.01);
});
test("coupon percentage math is exact in halalas (matches coupon_price)", () => {
  // 75000 × 0.41٪ = 307.5 → 308 هللة خصماً (Postgres: round(75000 * 0.41 / 100) = 308)
  assert.equal(priceWith(coupon("pct", 0.41), 75000), 74692);
  for (let v = 1; v <= 9999; v++) {
    const pct = v / 100;
    const expected = 75000 - Math.round((75000 * v) / 10000 + 1e-9);
    assert.equal(priceWith(coupon("pct", pct), 75000), Math.max(expected, 0), String(pct));
  }
  assert.equal(priceWith(coupon("amount", 100), 75000), 65000);
});
