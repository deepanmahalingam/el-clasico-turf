/* ============================================================
   El Clasico Turf — Runtime config
   ------------------------------------------------------------
   API_BASE controls how OTPs are sent:

   • ""  (empty)  -> DEMO mode: a fake OTP is generated in the
                     browser and shown on screen. No real WhatsApp.

   • "https://el-clasico-otp.<you>.workers.dev"
                  -> LIVE mode: the app calls your Cloudflare Worker,
                     which sends a real OTP via the Meta WhatsApp
                     Cloud API. Paste your deployed Worker URL here
                     (no trailing slash) and re-deploy GitHub Pages.

   See worker/README.md for full deploy steps.
   ============================================================ */
const CONFIG = {
  API_BASE: "",
};
