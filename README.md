# ⚽ El Clasico Turf

A **mobile-first** web app for booking Football & Box Cricket slots across El Clasico Turf's 4 venues, with **WhatsApp-based** login and confirmations.

> **Live demo:** _enabled via GitHub Pages_ → `https://<username>.github.io/<repo>/`

![logo](assets/logo.jpeg)

---

## ✨ Features

### 👤 Client
- **WhatsApp OTP login** — enter number → receive 6-digit OTP → verify.
- **4 venues**, each an independent booking calendar:
  - El Clasico - Mahindra City
  - El Clasico - Chengalpattu
  - El Clasico 5'aside - Potheri
  - El Clasico 6'aside - Potheri
- **Amenities** shown as icons on every venue: 🅿️ Parking · 👕 Changing Room · 🚻 Washroom · 🚰 Drinking Water.
- **Sport selection** — Football ⚽ or Box Cricket 🏏.
- **Slot booking** — date picker + hourly slots (5:00 AM – 11:00 PM) with **double-booking prevention**.
- **Booking summary** with a WhatsApp confirmation (deep-link) including the Google Maps location.
- **My Bookings** — upcoming & past games, **Navigate to venue** (Google Maps) and **Share with friends** (WhatsApp).

### 🛠️ Owner / Admin
- **Dynamic pricing** — set per-hour price per venue (Potheri 6'aside priced higher than 5'aside by default).
- **Manual slot blocking** — block slots for maintenance or tournaments.
- **Customer log** — list of users with their booking history.

Admin access: tap **"Owner / Admin login"** on the login screen. Demo passcode: `1234`.

---

## 🏗️ Tech

Pure **HTML + CSS + vanilla JS** — no build step, deployable to any static host (GitHub Pages).

```
index.html          # screens & shell
css/styles.css      # mobile-first styles (brand green + navy)
js/data.js          # venues, pricing, amenities, slot config
js/store.js         # localStorage persistence (mock backend)
js/app.js           # app controller / routing / UI logic
assets/logo.jpeg    # brand logo
```

### Data entities (mirrors the spec)
`User` · `Venue` · `Slot` · `Booking` · plus `Pricing` and `Blocks` for the admin tools.

---

## 🔌 Going to production (real WhatsApp backend)

This demo runs entirely in the browser; OTPs and bookings live in `localStorage`, and the demo OTP is shown on-screen. To make it real:

1. **OTP delivery** — replace the client-side OTP in `js/app.js` (`sendOtp`) with a call to your backend, which sends the code via the **Meta WhatsApp Business API** / **Twilio** / **Gupshup**:
   ```
   POST /api/auth/request-otp   { whatsapp }      → sends WhatsApp OTP template
   POST /api/auth/verify-otp    { whatsapp, otp } → returns a session token
   ```
2. **Bookings** — back `js/store.js` with a database (the schema already matches the entities). Use a transaction / unique constraint on `(venue_id, date, start)` to enforce no double-booking server-side.
3. **Confirmation message** — on successful booking, the backend sends a *"Booking Confirmed"* WhatsApp template including the venue's Google Maps link (text built in `buildConfirmationText`).

---

## ▶️ Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

---

_Built for El Clasico Turf._ 🟢
