// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { COUNTRIES, toE164, validNational, parsePhone, phoneOk, waDigits, formatPhone, flag, nationalOf } from "../../src/lib/phone";
import { waNumber } from "../../api/client-notify";
import { briefQuestions } from "../../src/start/briefs";
import { SERVICE_TRACKS } from "../../src/data/services";

test("country list: unique ISO, Saudi first, GCC pinned, sane dial codes", () => {
  const isos = COUNTRIES.map((c) => c.iso);
  assert.equal(new Set(isos).size, isos.length);
  assert.deepEqual(isos.slice(0, 6), ["SA", "AE", "KW", "QA", "BH", "OM"]);
  assert.ok(COUNTRIES.length >= 50);
  for (const c of COUNTRIES) assert.match(c.dial, /^[1-9]\d{0,2}$/, c.iso);
  assert.equal(flag("SA"), "🇸🇦");
});

test("Saudi numbers: any local form → E.164; must be a 9-digit mobile starting with 5", () => {
  for (const raw of ["0551234567", "551234567", "055 123 4567", "+966551234567", "00966551234567", "٠٥٥١٢٣٤٥٦٧"]) {
    assert.equal(toE164("SA", raw), "+966551234567", raw);
    assert.ok(validNational("SA", raw), raw);
  }
  assert.equal(validNational("SA", "0112345678"), false); // أرضي
  assert.equal(validNational("SA", "05512345"), false);
  assert.equal(validNational("SA", ""), false);
});

test("international numbers validate by country length and strip the trunk zero", () => {
  assert.equal(toE164("AE", "050 123 4567"), "+971501234567");
  assert.ok(validNational("AE", "501234567"));
  assert.equal(toE164("GB", "07700 900123"), "+447700900123");
  assert.ok(validNational("GB", "07700900123"));
  assert.ok(validNational("US", "(212) 555-0147"));
  assert.equal(validNational("US", "555-0147"), false);
  assert.equal(nationalOf("IT", "06 1234 5678"), "0612345678"); // إيطاليا تحتفظ بالصفر
  assert.ok(validNational("EG", "01012345678"));
  assert.equal(validNational("EG", "0212345678"), false);
});

test("parsePhone: stored values round-trip; legacy 05… is Saudi; longest dial code wins", () => {
  assert.deepEqual(parsePhone("+966551234567"), { country: "SA", national: "551234567" });
  assert.deepEqual(parsePhone("0551234567"), { country: "SA", national: "551234567" });
  assert.deepEqual(parsePhone("+971501234567"), { country: "AE", national: "501234567" });
  assert.deepEqual(parsePhone("+447700900123"), { country: "GB", national: "7700900123" });
  assert.equal(parsePhone("+12125550147").country, "US");
  assert.equal(parsePhone("+12125550147", "CA").country, "CA");
  assert.deepEqual(parsePhone("", "AE"), { country: "AE", national: "" });
  assert.ok(phoneOk("+971501234567"));
  assert.ok(phoneOk("0551234567"));
  assert.equal(phoneOk("+9665"), false);
  assert.equal(phoneOk(""), false);
});

test("WhatsApp digits and display", () => {
  assert.equal(waDigits("0551234567"), "966551234567");
  assert.equal(waDigits("+447700900123"), "447700900123");
  assert.equal(waDigits("+9661"), "");
  assert.equal(formatPhone("+966551234567"), "+966 55 123 4567");
});

test("server WhatsApp normaliser: Saudi local + any valid international", () => {
  assert.equal(waNumber("055 123 4567"), "966551234567");
  assert.equal(waNumber("+966551234567"), "966551234567");
  assert.equal(waNumber("+971501234567"), "971501234567");
  assert.equal(waNumber("+447700900123"), "447700900123");
  assert.equal(waNumber("0112345678"), "");
  assert.equal(waNumber("+966112345678"), ""); // سعودي أرضي
  assert.equal(waNumber("+0123"), "");
  assert.equal(waNumber("12345"), "");
});

test("visual identity brief asks identity-specific questions", () => {
  const d = SERVICE_TRACKS.find((s) => s.id === "D");
  const ids = briefQuestions(d).map((q) => q.id);
  assert.deepEqual(ids, ["need", "deliverables", "naming", "style", "audience", "timing", "package"]);
  assert.ok(briefQuestions(d).find((q) => q.id === "deliverables").multi);
  for (const t of SERVICE_TRACKS) for (const q of briefQuestions(t)) assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, `${t.id}.${q.id}`);
});
