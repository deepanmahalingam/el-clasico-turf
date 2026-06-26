# El Clasico Turf — WhatsApp OTP Worker

A tiny [Cloudflare Worker](https://workers.cloudflare.com/) that sends **real**
WhatsApp OTPs via the **Meta WhatsApp Cloud API**. Your secret access token lives
only here — never in the browser. The GitHub Pages frontend calls this Worker.

```
Browser (GitHub Pages)  ──►  Cloudflare Worker  ──►  Meta WhatsApp Cloud API  ──►  User's WhatsApp
```

---

## 1. Prerequisites (Meta side)

1. Create a Meta app at <https://developers.facebook.com/> → add the **WhatsApp** product.
2. Note your **Phone number ID** and a **permanent access token**
   (System User token with `whatsapp_business_messaging`).
3. Create & get approved an **Authentication** message template (this delivers the OTP).
   Note its **name** and **language code** (e.g. `en_US`).

> While testing you can use the temporary token + test number from the Meta dashboard,
> but the temporary token expires in 24h.

## 2. Deploy the Worker

```bash
cd worker
npm install -g wrangler        # if you don't have it
wrangler login

# Create the KV namespace that stores OTPs, then paste the printed id
# into wrangler.toml ([[kv_namespaces]] id = "...").
wrangler kv namespace create OTP_KV

# Edit wrangler.toml [vars]:
#   WA_PHONE_ID  = your phone-number ID
#   WA_TEMPLATE  = your OTP template name
#   WA_LANG      = template language code (e.g. en_US)
#   ALLOW_ORIGIN = https://deepanmahalingam.github.io

# Set the secret token (never committed):
wrangler secret put WA_TOKEN
#   (paste your Meta permanent access token)

wrangler deploy
```

`wrangler deploy` prints your Worker URL, e.g.
`https://el-clasico-otp.<your-subdomain>.workers.dev`.

## 3. Point the frontend at the Worker

Edit [`../js/config.js`](../js/config.js):

```js
const CONFIG = {
  API_BASE: "https://el-clasico-otp.<your-subdomain>.workers.dev",
};
```

Commit & push — GitHub Pages redeploys automatically. Done: the login screen now
sends a **real** WhatsApp OTP. (Leave `API_BASE` empty to fall back to demo mode.)

---

## Endpoints

| Method | Path                     | Body                     | Purpose                         |
|--------|--------------------------|--------------------------|---------------------------------|
| POST   | `/api/auth/request-otp`  | `{ whatsapp }`           | Generate + send OTP (5-min TTL) |
| POST   | `/api/auth/verify-otp`   | `{ whatsapp, otp }`      | Verify OTP (single-use)         |
| POST   | `/api/notify/booking`    | `{ whatsapp, text }`     | Booking confirmation (best-effort) |

## Notes
- OTPs are 6 digits, expire in 5 minutes, are single-use, and lock after 5 wrong tries.
- `WA_TEMPLATE_BUTTON=true` (default) sends the code on the template's copy-code/autofill
  button as Meta's authentication templates require. Set `false` if your template has no button.
- The booking confirmation uses a free-form text message, which Meta only delivers inside the
  24-hour customer-initiated window. For guaranteed delivery, replace it with an approved
  **utility** template in `notifyBooking()`.
