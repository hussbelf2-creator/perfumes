// @ts-nocheck — اختبار سلوك (fetch مزيّف)
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST, parseLead, clientIp } from "../../api/lead";

const calls = [];
let turnstile = { success: true };
let insert = () => new Response(null, { status: 201 });
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).includes("turnstile")) return new Response(JSON.stringify(turnstile), { status: 200 });
  return insert();
};
const req = (body, headers = {}) => new Request("https://x.test/api/lead", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const good = { kind: "brief", payload: { email: "a@b.sa", track: "A" }, page: "/start/A", token: "tok" };
const t = (name, fn) => test(name, async () => { calls.length = 0; turnstile = { success: true }; insert = () => new Response(null, { status: 201 }); await fn(); });
const env = () => Object.assign(process.env, { TURNSTILE_SECRET_KEY: "ts-secret", SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srk" });

t("parseLead accepts a well-formed lead", () => assert.deepEqual(parseLead(good), good));
t("parseLead rejects unknown kinds, missing token, nested payloads and oversized bodies", () => {
  assert.equal(parseLead({ ...good, kind: "hack" }), null);
  assert.equal(parseLead({ ...good, token: "" }), null);
  assert.equal(parseLead({ ...good, payload: { a: { b: 1 } } }), null);
  assert.equal(parseLead({ ...good, payload: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, "x".repeat(5000)])) }), null);
  assert.equal(parseLead({ ...good, page: "https://evil" }).page, null);
});
t("clientIp prefers x-real-ip, else the first forwarded address; rejects junk", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "1.1.1.1" })), "198.51.100.2");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "<script>" })), null);
});
t("503 until configured", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  const r = await POST(req(good));
  assert.equal(r.status, 503);
  assert.equal(calls.length, 0);
});
t("bad body → 400 without calling Cloudflare", async () => {
  env();
  assert.equal((await POST(req("not json"))).status, 400);
  assert.equal((await POST(req({ ...good, kind: "x" }))).status, 400);
  assert.equal(calls.length, 0);
});
t("failed human check → 403, nothing inserted", async () => {
  env();
  turnstile = { success: false };
  const r = await POST(req(good));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "captcha_failed");
  assert.ok(!calls.some((c) => c.url.includes("/rest/v1/")));
});
t("verified → token checked with the secret and visitor ip, lead inserted with the service key and x-client-ip", async () => {
  env();
  const r = await POST(req(good));
  assert.equal(r.status, 200);
  const v = calls.find((c) => c.url.includes("siteverify"));
  assert.equal(v.init.body.get("secret"), "ts-secret");
  assert.equal(v.init.body.get("remoteip"), "203.0.113.9");
  const ins = calls.find((c) => c.url === "https://p.supabase.co/rest/v1/leads");
  assert.equal(ins.init.headers.Authorization, "Bearer srk");
  assert.equal(ins.init.headers["x-client-ip"], "203.0.113.9");
  assert.deepEqual(JSON.parse(ins.init.body), { kind: "brief", payload: good.payload, page: "/start/A" });
});
t("database rate limit → 429", async () => {
  env();
  insert = () => new Response(JSON.stringify({ message: "rate_limited" }), { status: 400 });
  const r = await POST(req(good));
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, "rate_limited");
});
