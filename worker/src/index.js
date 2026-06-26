/* ============================================================
   El Clasico Turf — WhatsApp OTP backend (Cloudflare Worker)
   ------------------------------------------------------------
   Sends real OTPs via the Meta WhatsApp Cloud API. The secret
   access token lives ONLY here (as a Worker secret) — never in
   the browser.

   Endpoints (all JSON, CORS-enabled):
     POST /api/auth/request-otp   { whatsapp }          -> { ok }
     POST /api/auth/verify-otp    { whatsapp, otp }     -> { ok }
     POST /api/notify/booking     { whatsapp, text }    -> { ok }  (best-effort)

   OTPs are stored in a KV namespace (OTP_KV) with a 5-min TTL and
   are single-use (deleted on successful verify).

   Required secrets / vars (see worker/README.md):
     WA_TOKEN            Meta permanent access token   (secret)
     WA_PHONE_ID         WhatsApp phone-number ID       (var or secret)
     WA_TEMPLATE         OTP authentication template name (var)
     WA_LANG             template language code, e.g. en_US (var, default en_US)
     WA_TEMPLATE_BUTTON  "true"/"false" include copy-code button (var, default true)
     ALLOW_ORIGIN        allowed CORS origin, e.g. https://<user>.github.io (var)
   ============================================================ */

const GRAPH_VERSION = "v21.0";
const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
      });

    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/api/auth/request-otp") {
        return await requestOtp(request, env, json);
      }
      if (request.method === "POST" && url.pathname === "/api/auth/verify-otp") {
        return await verifyOtp(request, env, json);
      }
      if (request.method === "POST" && url.pathname === "/api/notify/booking") {
        return await notifyBooking(request, env, json);
      }
      return json({ ok: true, service: "el-clasico-otp" });
    } catch (err) {
      return json({ ok: false, error: String(err && err.message || err) }, 500);
    }
  },
};

/* ---------- helpers ---------- */

// Normalise to digits with country code (assumes +91 India if 10 digits).
function normalisePhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return d;
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function metaSend(env, payload) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.WA_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Meta API error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ---------- request-otp ---------- */
async function requestOtp(request, env, json) {
  const { whatsapp } = await request.json();
  const phone = normalisePhone(whatsapp);
  if (phone.length < 11) return json({ ok: false, error: "Invalid number" }, 400);

  const otp = genOtp();
  await env.OTP_KV.put(
    `otp:${phone}`,
    JSON.stringify({ otp, attempts: 0 }),
    { expirationTtl: OTP_TTL_SECONDS }
  );

  const includeButton = String(env.WA_TEMPLATE_BUTTON ?? "true") !== "false";
  const components = [
    { type: "body", parameters: [{ type: "text", text: otp }] },
  ];
  // Authentication templates carry the code on the copy-code / autofill button.
  if (includeButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otp }],
    });
  }

  await metaSend(env, {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: env.WA_TEMPLATE,
      language: { code: env.WA_LANG || "en_US" },
      components,
    },
  });

  return json({ ok: true });
}

/* ---------- verify-otp ---------- */
async function verifyOtp(request, env, json) {
  const { whatsapp, otp } = await request.json();
  const phone = normalisePhone(whatsapp);
  const key = `otp:${phone}`;

  const raw = await env.OTP_KV.get(key);
  if (!raw) return json({ ok: false, error: "OTP expired. Request a new one." }, 400);

  const rec = JSON.parse(raw);
  if (rec.attempts >= MAX_ATTEMPTS) {
    await env.OTP_KV.delete(key);
    return json({ ok: false, error: "Too many attempts. Request a new OTP." }, 429);
  }

  if (String(otp).trim() !== rec.otp) {
    rec.attempts += 1;
    await env.OTP_KV.put(key, JSON.stringify(rec), { expirationTtl: OTP_TTL_SECONDS });
    return json({ ok: false, error: "Incorrect OTP." }, 401);
  }

  await env.OTP_KV.delete(key); // single-use
  return json({ ok: true });
}

/* ---------- booking confirmation (best-effort) ---------- */
// Free-form text only delivers inside the 24h customer-initiated window.
// For guaranteed delivery, swap this for an approved utility template.
async function notifyBooking(request, env, json) {
  const { whatsapp, text } = await request.json();
  const phone = normalisePhone(whatsapp);
  try {
    await metaSend(env, {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { preview_url: true, body: String(text || "Booking confirmed!") },
    });
    return json({ ok: true });
  } catch (err) {
    // Non-fatal: booking already succeeded client-side.
    return json({ ok: false, error: String(err.message), delivered: false });
  }
}
