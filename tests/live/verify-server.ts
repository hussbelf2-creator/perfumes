// دالة التحقق من الدفع كما على Vercel، مع مويسر وهمي (تُسجَّل الدفعات عبر POST /mock) وSupabase المحلي الحقيقي.
//   LIVE_SERVICE_KEY=… node --import ./tests/unit/setup.mjs --import jiti/register tests/live/verify-server.ts
import http from "node:http";
import { GET } from "../../api/payments/verify";

const payments = new Map();
const real = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith("https://api.moyasar.com/v1/payments/")) {
    const p = payments.get(u.split("/").pop());
    return p ? new Response(JSON.stringify(p), { status: 200 }) : new Response("{}", { status: 404 });
  }
  return real(url, init);
};
Object.assign(process.env, { MOYASAR_SECRET_KEY: "sk_test_x", SUPABASE_URL: process.env.LIVE_API || "http://localhost:54321", SUPABASE_SERVICE_ROLE_KEY: process.env.LIVE_SERVICE_KEY });
http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (req.method === "POST" && req.url === "/mock") {
      const p = JSON.parse(Buffer.concat(chunks).toString());
      payments.set(p.id, p);
      res.end("ok");
      return;
    }
    const r = await GET(new Request("http://x" + req.url));
    res.writeHead(r.status, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(await r.text());
  })
  .listen(8788, () => console.log("verify :8788"));
