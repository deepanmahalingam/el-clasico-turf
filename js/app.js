/* ============================================================
   El Clasico Turf — App controller (vanilla JS, no build step)
   ============================================================ */

const App = (() => {
  // ---- transient state ----
  const state = {
    pendingNumber: null,
    pendingOtp: null,
    isAdmin: false,
    booking: { venueId: null, sport: null, date: null },
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const fmtHour = (h) => {
    const hh = ((h % 24) + 24) % 24; // 24 -> 0 (midnight), keeps end-times correct
    const ampm = hh >= 12 ? "PM" : "AM";
    const hr = hh % 12 === 0 ? 12 : hh % 12;
    return `${hr}:00 ${ampm}`;
  };
  const venueById = (id) => VENUES.find((v) => v.id === id);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, kind = "") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast " + kind), 3200);
  }

  /* ============================================================
     AUTH (WhatsApp OTP)
     ------------------------------------------------------------
     LIVE mode  (CONFIG.API_BASE set): calls the Cloudflare Worker,
       which sends a real OTP via the Meta WhatsApp Cloud API and
       verifies it server-side. The code never touches the browser.
     DEMO mode  (API_BASE empty): OTP is generated locally and shown
       on screen so the app is fully usable without a backend.
     ============================================================ */
  const liveMode = () =>
    typeof CONFIG !== "undefined" && CONFIG.API_BASE && CONFIG.API_BASE.trim().length > 0;

  async function api(path, body) {
    const res = await fetch(CONFIG.API_BASE.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Request failed. Please try again.");
    }
    return data;
  }

  function setBtnLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = label || "Please wait…";
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }

  async function sendOtp() {
    const raw = $("#wa-number").value.replace(/\D/g, "");
    if (raw.length !== 10) {
      toast("Enter a valid 10-digit WhatsApp number");
      return;
    }
    state.pendingNumber = "+91" + raw;
    const btn = $("#btn-send-otp");

    if (liveMode()) {
      setBtnLoading(btn, true, "Sending OTP…");
      try {
        await api("/api/auth/request-otp", { whatsapp: state.pendingNumber });
      } catch (e) {
        toast(e.message);
        setBtnLoading(btn, false);
        return;
      }
      setBtnLoading(btn, false);
      goToOtpStep();
      toast(`OTP sent to your WhatsApp ${state.pendingNumber} 📲`, "otp");
      return;
    }

    // Demo mode
    state.pendingOtp = String(Math.floor(100000 + Math.random() * 900000));
    goToOtpStep();
    toast(`Demo OTP for ${state.pendingNumber}: ${state.pendingOtp}`, "otp");
  }

  function goToOtpStep() {
    $("#login-step-phone").classList.add("hidden");
    $("#login-step-otp").classList.remove("hidden");
    $("#otp-input").value = "";
    $("#otp-input").focus();
  }

  async function verifyOtp() {
    const entered = $("#otp-input").value.replace(/\D/g, "");
    if (entered.length < 4) {
      toast("Enter the OTP you received");
      return;
    }
    const btn = $("#btn-verify-otp");

    if (liveMode()) {
      setBtnLoading(btn, true, "Verifying…");
      try {
        await api("/api/auth/verify-otp", { whatsapp: state.pendingNumber, otp: entered });
      } catch (e) {
        toast(e.message);
        setBtnLoading(btn, false);
        return;
      }
      setBtnLoading(btn, false);
    } else if (entered !== state.pendingOtp) {
      toast("Incorrect OTP. Try again.");
      return;
    }

    const user = Store.upsertUser(state.pendingNumber, "");
    Store.setSession(user);
    enterApp();
    // First-time users: prompt for a name once.
    if (!user.name) promptName(user);
  }

  function promptName(user) {
    const name = prompt("Welcome! What's your name? (for booking confirmations)");
    if (name && name.trim()) {
      const updated = Store.upsertUser(user.whatsapp_number, name.trim());
      Store.setSession(updated);
      toast(`Hi ${updated.name.split(" ")[0]}! 👋`);
    }
  }

  /* ============================================================
     ROUTING / SHELL
     ============================================================ */
  function show(screen) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $("#screen-" + screen).classList.add("active");
    $$(".nav-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.nav === screen)
    );
    window.scrollTo(0, 0);
  }

  function enterApp() {
    state.isAdmin = false;
    $("#screen-login").classList.remove("active");
    $("#app-header").classList.remove("hidden");
    $("#bottom-nav").classList.remove("hidden");
    $(".nav-admin").classList.add("hidden");
    renderVenues();
    show("venues");
  }

  function enterAdmin() {
    const pass = prompt("Enter admin passcode:");
    if (pass !== ADMIN_PASSCODE) {
      if (pass !== null) toast("Wrong passcode");
      return;
    }
    state.isAdmin = true;
    $("#screen-login").classList.remove("active");
    $("#app-header").classList.remove("hidden");
    $("#bottom-nav").classList.remove("hidden");
    $(".nav-admin").classList.remove("hidden");
    renderAdmin();
    show("admin");
    toast("Admin mode");
  }

  function logout() {
    Store.clearSession();
    state.isAdmin = false;
    $("#app-header").classList.add("hidden");
    $("#bottom-nav").classList.add("hidden");
    $("#login-step-otp").classList.add("hidden");
    $("#login-step-phone").classList.remove("hidden");
    $("#wa-number").value = "";
    $("#screen-login").classList.add("active");
    $$(".screen").forEach((s) => {
      if (s.id !== "screen-login") s.classList.remove("active");
    });
  }

  /* ============================================================
     VENUES
     ============================================================ */
  function amenityChips(venue, small) {
    return venue.amenities
      .map((a) => {
        const m = AMENITY_META[a];
        return `<span class="amenity"><span class="ico">${m.icon}</span>${
          small ? "" : m.label
        }</span>`;
      })
      .join("");
  }

  function renderVenues() {
    const list = $("#venue-list");
    list.innerHTML = VENUES.map(
      (v) => `
      <div class="venue-card" data-venue="${v.id}">
        <div class="vc-top">
          <h3>${v.name}</h3>
          <span class="venue-price">${inr(Store.priceFor(v.id))}/hr</span>
        </div>
        <div class="amenities">${amenityChips(v, false)}</div>
        <div class="vc-cta">
          <button class="btn btn--primary btn--sm" data-venue="${v.id}">Book Now</button>
          <button class="btn btn--ghost btn--sm" data-map="${v.id}">📍 Navigate</button>
        </div>
      </div>`
    ).join("");
  }

  /* ============================================================
     BOOKING FLOW
     ============================================================ */
  function openVenue(venueId) {
    const v = venueById(venueId);
    state.booking = { venueId, sport: v.sports[0], date: todayStr() };

    $("#venue-head").innerHTML = `
      <h2>${v.name}</h2>
      <div class="vh-amen">${amenityChips(v, false)}</div>`;

    $("#sport-select").innerHTML = v.sports
      .map(
        (s) => `
      <div class="sport-chip ${s === state.booking.sport ? "active" : ""}" data-sport="${s}">
        <span class="s-ico">${s === "Football" ? "⚽" : "🏏"}</span>${s}
      </div>`
      )
      .join("");

    const dp = $("#date-picker");
    dp.min = todayStr();
    dp.value = state.booking.date;

    $("#slot-price-tag").textContent = inr(Store.priceFor(venueId)) + " / hr";
    renderSlots();
    show("book");
  }

  function renderSlots() {
    const { venueId, date } = state.booking;
    const grid = $("#slot-grid");
    const now = new Date();
    const isToday = date === todayStr();

    grid.innerHTML = SLOTS.map((s) => {
      const status = Store.slotStatus(venueId, date, s.start);
      const isPast = isToday && s.start <= now.getHours();
      let cls = status;
      if (isPast && status === "available") cls = "past";
      const label =
        status === "booked" ? "Booked" : status === "blocked" ? "Blocked" : isPast ? "Past" : "Open";
      return `
        <div class="slot ${cls}" data-start="${s.start}" data-end="${s.end}">
          ${fmtHour(s.start)}
          <small>${label}</small>
        </div>`;
    }).join("");
  }

  function selectSlot(start, end) {
    const { venueId, sport, date } = state.booking;
    if (Store.slotStatus(venueId, date, start) !== "available") return;
    const isToday = date === todayStr();
    if (isToday && start <= new Date().getHours()) {
      toast("That slot has already passed");
      return;
    }
    openConfirm({ start, end });
  }

  function openConfirm({ start, end }) {
    const { venueId, sport, date } = state.booking;
    const v = venueById(venueId);
    const price = Store.priceFor(venueId);
    const dateLabel = new Date(date + "T00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });

    $("#confirm-body").innerHTML = `
      <div class="confirm-icon">📝</div>
      <h3 class="confirm-h">Confirm Booking</h3>
      <div class="summary">
        <div class="row"><span>Venue</span><span>${v.short}</span></div>
        <div class="row"><span>Sport</span><span>${sport}</span></div>
        <div class="row"><span>Date</span><span>${dateLabel}</span></div>
        <div class="row"><span>Time</span><span>${fmtHour(start)} – ${fmtHour(end)}</span></div>
        <div class="row total"><span>Total</span><span>${inr(price)}</span></div>
      </div>
      <div class="confirm-actions">
        <button class="btn btn--primary" id="do-confirm">Confirm &amp; Pay at Venue</button>
        <button class="btn btn--ghost" id="cancel-confirm">Cancel</button>
      </div>`;

    $("#confirm-modal").classList.remove("hidden");
    $("#do-confirm").onclick = () => finalizeBooking(start, end);
    $("#cancel-confirm").onclick = closeConfirm;
  }

  function closeConfirm() {
    $("#confirm-modal").classList.add("hidden");
  }

  function finalizeBooking(start, end) {
    const user = Store.getSession();
    const { venueId, sport, date } = state.booking;
    let booking;
    try {
      booking = Store.createBooking({ user, venueId, sport, date, start, end });
    } catch (e) {
      toast(e.message);
      closeConfirm();
      renderSlots();
      return;
    }
    // Live mode: send the real "Booking Confirmed" WhatsApp message (best-effort).
    if (liveMode()) {
      const v = venueById(booking.venue_id);
      const dateLabel = new Date(booking.date + "T00:00").toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      });
      api("/api/notify/booking", {
        whatsapp: booking.user_whatsapp,
        text: buildConfirmationText(booking, v, dateLabel),
      }).catch(() => {}); // non-fatal — booking already succeeded
    }
    showConfirmed(booking);
  }

  // Booking summary + WhatsApp confirmation (mock send via wa.me deep link).
  function showConfirmed(booking) {
    const v = venueById(booking.venue_id);
    const dateLabel = new Date(booking.date + "T00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
    const waText = buildConfirmationText(booking, v, dateLabel);
    const selfWa = booking.user_whatsapp.replace(/\D/g, "");

    $("#confirm-body").innerHTML = `
      <div class="confirm-icon">✅</div>
      <h3 class="confirm-h">Booking Confirmed!</h3>
      <div class="summary">
        <div class="row"><span>Venue</span><span>${v.short}</span></div>
        <div class="row"><span>Sport</span><span>${booking.sport_type}</span></div>
        <div class="row"><span>Date</span><span>${dateLabel}</span></div>
        <div class="row"><span>Time</span><span>${fmtHour(booking.start)} – ${fmtHour(booking.end)}</span></div>
        <div class="row total"><span>Total</span><span>${inr(booking.total_price)}</span></div>
      </div>
      <p class="hint" style="text-align:center">A confirmation has been sent to your WhatsApp ${booking.user_whatsapp}.</p>
      <div class="confirm-actions">
        <a class="btn btn--primary" target="_blank" rel="noopener"
           href="https://wa.me/${selfWa}?text=${encodeURIComponent(waText)}">
          📲 View WhatsApp Confirmation
        </a>
        <button class="btn btn--ghost" id="goto-bookings">View My Bookings</button>
      </div>`;

    $("#goto-bookings").onclick = () => {
      closeConfirm();
      renderBookings("upcoming");
      show("bookings");
    };
    toast("Confirmation sent to WhatsApp ✅", "otp");
  }

  function buildConfirmationText(b, v, dateLabel) {
    return (
      `✅ *El Clasico Turf — Booking Confirmed*\n\n` +
      `🏟️ Venue: ${v.name}\n` +
      `🏆 Sport: ${b.sport_type}\n` +
      `📅 Date: ${dateLabel}\n` +
      `⏰ Time: ${fmtHour(b.start)} – ${fmtHour(b.end)}\n` +
      `💰 Amount: ${inr(b.total_price)} (pay at venue)\n\n` +
      `📍 Navigate: ${v.google_maps_url}\n\n` +
      `See you on the turf! ⚽`
    );
  }

  /* ============================================================
     MY BOOKINGS
     ============================================================ */
  function renderBookings(tab) {
    const user = Store.getSession();
    const all = Store.bookingsForUser(user.id);
    const now = new Date();
    const upcoming = [];
    const past = [];
    all.forEach((b) => {
      const dt = new Date(b.date + "T" + String(b.end).padStart(2, "0") + ":00");
      (dt >= now ? upcoming : past).push(b);
    });
    upcoming.sort((a, b) => (a.date + a.start) > (b.date + b.start) ? 1 : -1);
    past.sort((a, b) => (a.date + a.start) < (b.date + b.start) ? 1 : -1);

    const rows = tab === "upcoming" ? upcoming : past;
    const list = $("#bookings-list");

    if (!rows.length) {
      list.innerHTML = `<div class="empty"><span class="e-ico">${tab === "upcoming" ? "📭" : "🗂️"}</span>No ${tab} games yet.</div>`;
      return;
    }

    list.innerHTML = rows
      .map((b) => {
        const v = venueById(b.venue_id);
        const dateLabel = new Date(b.date + "T00:00").toLocaleDateString("en-IN", {
          weekday: "short", day: "numeric", month: "short",
        });
        const waText = buildConfirmationText(b, v, dateLabel);
        const shareText =
          `🔥 Game on! Join me at *El Clasico Turf*\n\n` +
          `🏟️ ${v.name}\n🏆 ${b.sport_type}\n📅 ${dateLabel}, ${fmtHour(b.start)}–${fmtHour(b.end)}\n\n📍 ${v.google_maps_url}`;
        return `
        <div class="booking-card">
          <div class="bc-top">
            <h3>${v.short}</h3>
            <span class="badge ${tab === "upcoming" ? "badge--up" : "badge--past"}">${tab === "upcoming" ? "Upcoming" : "Completed"}</span>
          </div>
          <p class="bc-meta">
            ${b.sport_type === "Football" ? "⚽" : "🏏"} <strong>${b.sport_type}</strong><br/>
            📅 ${dateLabel} &nbsp; ⏰ ${fmtHour(b.start)}–${fmtHour(b.end)}<br/>
            💰 <strong>${inr(b.total_price)}</strong>
          </p>
          <div class="bc-actions">
            <a class="btn btn--navy btn--sm" target="_blank" rel="noopener" href="${v.google_maps_url}">📍 Navigate</a>
            <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener"
               href="https://wa.me/?text=${encodeURIComponent(shareText)}">👥 Share</a>
          </div>
          ${
            tab === "upcoming"
              ? `<button class="btn btn--danger btn--sm bc-cancel" data-cancel="${b.id}">✕ Cancel Booking</button>`
              : ""
          }
        </div>`;
      })
      .join("");
  }

  /* ============================================================
     ADMIN DASHBOARD
     ============================================================ */
  function renderAdmin() {
    renderAdminPricing();
    renderAdminBookings();
    renderAdminBlocks();
    renderAdminCustomers();
  }

  // Owner view of every booking, with the power to cancel (frees the slot).
  function renderAdminBookings() {
    const pane = $("#admin-bookings");
    const all = Store.getBookings().slice();
    if (!all.length) {
      pane.innerHTML = `<div class="empty"><span class="e-ico">📅</span>No bookings yet.</div>`;
      return;
    }
    const now = new Date();
    // Upcoming first (soonest at top), then past (most recent first).
    all.sort((a, b) => (a.date + String(a.start).padStart(2, "0")).localeCompare(b.date + String(b.start).padStart(2, "0")));
    const upcoming = [];
    const past = [];
    all.forEach((b) => {
      const dt = new Date(b.date + "T" + String(b.end).padStart(2, "0") + ":00");
      (dt >= now ? upcoming : past).push(b);
    });
    past.reverse();

    const card = (b) => {
      const v = venueById(b.venue_id);
      const dateLabel = new Date(b.date + "T00:00").toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
      });
      const isUpcoming = new Date(b.date + "T" + String(b.end).padStart(2, "0") + ":00") >= now;
      return `
        <div class="admin-row">
          <div class="bc-top">
            <h4>${v.short}</h4>
            <span class="badge ${isUpcoming ? "badge--up" : "badge--past"}">${isUpcoming ? "Upcoming" : "Past"}</span>
          </div>
          <p class="bc-meta">
            ${b.sport_type === "Football" ? "⚽" : "🏏"} ${b.sport_type} &nbsp; ⏰ ${fmtHour(b.start)}–${fmtHour(b.end)}<br/>
            📅 ${dateLabel} &nbsp; 💰 <strong>${inr(b.total_price)}</strong><br/>
            👤 ${b.user_name || "Unnamed"} • ${b.user_whatsapp}
          </p>
          ${
            isUpcoming
              ? `<button class="btn btn--danger btn--sm bc-cancel" data-admin-cancel="${b.id}">✕ Cancel &amp; Release Slot</button>`
              : ""
          }
        </div>`;
    };

    pane.innerHTML =
      (upcoming.length ? `<p class="page-sub">Upcoming (${upcoming.length})</p>` + upcoming.map(card).join("") : "") +
      (past.length ? `<p class="page-sub">Past (${past.length})</p>` + past.map(card).join("") : "");
  }

  function renderAdminPricing() {
    $("#admin-pricing").innerHTML = VENUES.map(
      (v) => `
      <div class="admin-row">
        <h4>${v.name}</h4>
        <div class="price-edit">
          <input type="number" min="0" step="50" value="${Store.priceFor(v.id)}" data-price="${v.id}" />
          <button class="btn btn--primary btn--sm" data-save-price="${v.id}">Save</button>
        </div>
      </div>`
    ).join("");
  }

  function renderAdminBlocks() {
    const venueOpts = VENUES.map((v) => `<option value="${v.id}">${v.short}</option>`).join("");
    const slotOpts = SLOTS.map((s) => `<option value="${s.start}">${fmtHour(s.start)} – ${fmtHour(s.end)}</option>`).join("");
    $("#admin-blocks").innerHTML = `
      <div class="admin-row">
        <h4>Block a Slot (maintenance / tournament)</h4>
        <div class="block-controls">
          <select id="blk-venue">${venueOpts}</select>
          <input id="blk-date" type="date" min="${todayStr()}" value="${todayStr()}" />
          <select id="blk-slot">${slotOpts}</select>
          <input id="blk-reason" type="text" placeholder="Reason (e.g. Maintenance)" />
          <button class="btn btn--navy" id="blk-toggle">Toggle Block</button>
        </div>
      </div>
      <div class="admin-row" id="blk-list-wrap"></div>`;
    renderBlockList();
  }

  function renderBlockList() {
    const blocks = Store.getBlocks();
    const wrap = $("#blk-list-wrap");
    if (!blocks.length) {
      wrap.innerHTML = `<h4>Active Blocks</h4><p class="hint">No slots blocked.</p>`;
      return;
    }
    wrap.innerHTML =
      `<h4>Active Blocks (${blocks.length})</h4>` +
      blocks
        .map((b) => {
          const v = venueById(b.venue_id);
          const d = new Date(b.date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          return `<div class="cust-bk">🚧 ${v.short} • ${d} • ${fmtHour(b.start)} — <em>${b.reason}</em></div>`;
        })
        .join("");
  }

  function renderAdminCustomers() {
    const users = Store.getUsers();
    const bookings = Store.getBookings();
    const pane = $("#admin-customers");
    if (!users.length) {
      pane.innerHTML = `<div class="empty"><span class="e-ico">👤</span>No customers yet.</div>`;
      return;
    }
    pane.innerHTML = users
      .map((u) => {
        const ub = bookings.filter((b) => b.user_id === u.id);
        const history = ub.length
          ? ub
              .map((b) => {
                const v = venueById(b.venue_id);
                const d = new Date(b.date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                return `<div class="cust-bk">• ${v.short} — ${b.sport_type}, ${d} ${fmtHour(b.start)} (${inr(b.total_price)})</div>`;
              })
              .join("")
          : `<div class="cust-bk">No bookings yet.</div>`;
        return `
        <div class="cust-card">
          <div class="cust-name">${u.name || "Unnamed"}</div>
          <div class="cust-wa">${u.whatsapp_number} • ${ub.length} booking(s)</div>
          ${history}
        </div>`;
      })
      .join("");
  }

  /* ============================================================
     EVENT WIRING (delegation)
     ============================================================ */
  function bind() {
    // Auth
    $("#btn-send-otp").onclick = sendOtp;
    $("#btn-verify-otp").onclick = verifyOtp;
    $("#btn-resend-otp").onclick = sendOtp;
    $("#btn-change-number").onclick = () => {
      $("#login-step-otp").classList.add("hidden");
      $("#login-step-phone").classList.remove("hidden");
    };
    $("#btn-admin-login").onclick = enterAdmin;
    $("#btn-logout").onclick = logout;
    $("#wa-number").addEventListener("keydown", (e) => { if (e.key === "Enter") sendOtp(); });
    $("#otp-input").addEventListener("keydown", (e) => { if (e.key === "Enter") verifyOtp(); });

    // Bottom nav
    $$(".nav-btn").forEach((b) => {
      b.onclick = () => {
        const nav = b.dataset.nav;
        if (nav === "venues") renderVenues();
        if (nav === "bookings") renderBookings(currentBkTab());
        if (nav === "admin") renderAdmin();
        show(nav);
      };
    });

    // Back buttons
    $$("[data-back]").forEach((b) => (b.onclick = () => show(b.dataset.back)));

    // Venue list (delegated)
    $("#venue-list").addEventListener("click", (e) => {
      const map = e.target.closest("[data-map]");
      if (map) { window.open(venueById(map.dataset.map).google_maps_url, "_blank"); return; }
      const card = e.target.closest("[data-venue]");
      if (card) openVenue(card.dataset.venue);
    });

    // Sport chips
    $("#sport-select").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-sport]");
      if (!chip) return;
      state.booking.sport = chip.dataset.sport;
      $$("#sport-select .sport-chip").forEach((c) => c.classList.toggle("active", c === chip));
    });

    // Date change
    $("#date-picker").addEventListener("change", (e) => {
      state.booking.date = e.target.value || todayStr();
      renderSlots();
    });

    // Slot pick
    $("#slot-grid").addEventListener("click", (e) => {
      const slot = e.target.closest(".slot");
      if (!slot || !slot.classList.contains("available")) return;
      selectSlot(Number(slot.dataset.start), Number(slot.dataset.end));
    });

    // Cancel a booking (upcoming only)
    $("#bookings-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cancel]");
      if (!btn) return;
      if (!confirm("Cancel this booking? The slot will be released.")) return;
      const user = Store.getSession();
      const ok = Store.cancelBooking(btn.dataset.cancel, user.id);
      toast(ok ? "Booking cancelled" : "Could not cancel booking");
      renderBookings(currentBkTab());
    });

    // Bookings tabs
    $$('#screen-bookings .tab').forEach((t) => {
      t.onclick = () => {
        $$('#screen-bookings .tab').forEach((x) => x.classList.toggle("active", x === t));
        renderBookings(t.dataset.tab);
      };
    });

    // Admin tabs
    $$('#screen-admin .tab').forEach((t) => {
      t.onclick = () => {
        $$('#screen-admin .tab').forEach((x) => x.classList.toggle("active", x === t));
        ["pricing", "bookings", "blocks", "customers"].forEach((p) =>
          $("#admin-" + p).classList.toggle("hidden", p !== t.dataset.atab)
        );
      };
    });

    // Admin pricing save
    $("#admin-pricing").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-save-price]");
      if (!btn) return;
      const id = btn.dataset.savePrice;
      const val = $(`input[data-price="${id}"]`).value;
      if (!val || Number(val) < 0) return toast("Enter a valid price");
      Store.setVenuePrice(id, val);
      toast(`${venueById(id).short} price updated to ${inr(val)}/hr`);
    });

    // Admin cancel a customer booking
    $("#admin-bookings").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-admin-cancel]");
      if (!btn) return;
      const id = btn.dataset.adminCancel;
      const booking = Store.getBookings().find((b) => b.id === id);
      if (!booking) return;
      if (!confirm(`Cancel ${booking.user_name || "this customer"}'s booking? The slot will be released.`)) return;
      Store.cancelBooking(id); // admin: no user scope
      // Live mode: let the customer know via WhatsApp (best-effort).
      if (liveMode()) {
        const v = venueById(booking.venue_id);
        const dateLabel = new Date(booking.date + "T00:00").toLocaleDateString("en-IN", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
        });
        api("/api/notify/booking", {
          whatsapp: booking.user_whatsapp,
          text:
            `⚠️ *El Clasico Turf — Booking Cancelled*\n\n` +
            `Your booking has been cancelled by the venue:\n` +
            `🏟️ ${v.name}\n📅 ${dateLabel}, ${fmtHour(booking.start)}–${fmtHour(booking.end)}\n\n` +
            `Sorry for the inconvenience. Please rebook or contact us.`,
        }).catch(() => {});
      }
      toast("Booking cancelled — slot released");
      renderAdminBookings();
    });

    // Admin block toggle
    $("#admin-blocks").addEventListener("click", (e) => {
      if (!e.target.closest("#blk-toggle")) return;
      const venueId = $("#blk-venue").value;
      const date = $("#blk-date").value || todayStr();
      const start = Number($("#blk-slot").value);
      const reason = $("#blk-reason").value.trim();
      const blocked = Store.toggleBlock(venueId, date, start, reason);
      toast(blocked ? "Slot blocked 🚧" : "Block removed");
      renderBlockList();
    });

    // Modal backdrop close
    $("#confirm-modal").addEventListener("click", (e) => {
      if (e.target.id === "confirm-modal") closeConfirm();
    });
  }

  function currentBkTab() {
    const active = $('#screen-bookings .tab.active');
    return active ? active.dataset.tab : "upcoming";
  }

  /* ---------- boot ---------- */
  function init() {
    bind();
    const session = Store.getSession();
    if (session) enterApp();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
