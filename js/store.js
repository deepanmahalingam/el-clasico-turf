/* ============================================================
   El Clasico Turf — Persistence layer (localStorage mock backend)
   ------------------------------------------------------------
   Mirrors the data entities from the spec:
     User, Venue, Slot, Booking, Pricing, Blocks.
   On a real deployment these calls map 1:1 to API endpoints.
   ============================================================ */

const Store = (() => {
  const KEYS = {
    users: "ect_users",
    bookings: "ect_bookings",
    blocks: "ect_blocks",
    pricing: "ect_pricing",
    session: "ect_session",
  };

  const read = (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Pricing ---------- */
  function getPricing() {
    const stored = read(KEYS.pricing, null);
    return stored || { ...DEFAULT_PRICING };
  }
  function setVenuePrice(venueId, price) {
    const p = getPricing();
    p[venueId] = Number(price);
    write(KEYS.pricing, p);
    return p;
  }
  function priceFor(venueId) {
    return getPricing()[venueId];
  }

  /* ---------- Users ---------- */
  function getUsers() {
    return read(KEYS.users, []);
  }
  function upsertUser(whatsapp, name) {
    const users = getUsers();
    let u = users.find((x) => x.whatsapp_number === whatsapp);
    if (!u) {
      u = {
        id: uid(),
        whatsapp_number: whatsapp,
        name: name || "",
        created_at: new Date().toISOString(),
      };
      users.push(u);
    } else if (name) {
      u.name = name;
    }
    write(KEYS.users, users);
    return u;
  }

  /* ---------- Session ---------- */
  function getSession() {
    return read(KEYS.session, null);
  }
  function setSession(user) {
    write(KEYS.session, user);
  }
  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }

  /* ---------- Blocks (admin maintenance / tournaments) ---------- */
  function getBlocks() {
    return read(KEYS.blocks, []);
  }
  function isBlocked(venueId, date, start) {
    return getBlocks().some(
      (b) => b.venue_id === venueId && b.date === date && b.start === start
    );
  }
  function toggleBlock(venueId, date, start, reason) {
    let blocks = getBlocks();
    const existing = blocks.find(
      (b) => b.venue_id === venueId && b.date === date && b.start === start
    );
    if (existing) {
      blocks = blocks.filter((b) => b !== existing);
    } else {
      blocks.push({ id: uid(), venue_id: venueId, date, start, reason: reason || "Maintenance" });
    }
    write(KEYS.blocks, blocks);
    return !existing; // true = now blocked
  }

  /* ---------- Bookings ---------- */
  function getBookings() {
    return read(KEYS.bookings, []);
  }
  function bookingsForUser(userId) {
    return getBookings().filter((b) => b.user_id === userId);
  }
  function isBooked(venueId, date, start) {
    return getBookings().some(
      (b) => b.venue_id === venueId && b.date === date && b.start === start
    );
  }
  // Slot is available only if neither booked nor admin-blocked.
  function slotStatus(venueId, date, start) {
    if (isBooked(venueId, date, start)) return "booked";
    if (isBlocked(venueId, date, start)) return "blocked";
    return "available";
  }

  function createBooking({ user, venueId, sport, date, start, end }) {
    // Final guard against double-booking (race-safe enough for a single client).
    if (slotStatus(venueId, date, start) !== "available") {
      throw new Error("Slot is no longer available.");
    }
    const booking = {
      id: uid(),
      user_id: user.id,
      user_name: user.name,
      user_whatsapp: user.whatsapp_number,
      venue_id: venueId,
      sport_type: sport,
      date,
      start,
      end,
      total_price: priceFor(venueId),
      payment_status: "pending",
      whatsapp_confirmed: true, // confirmation "sent" on creation (mock)
      created_at: new Date().toISOString(),
    };
    const bookings = getBookings();
    bookings.push(booking);
    write(KEYS.bookings, bookings);
    return booking;
  }

  // Cancelling a booking frees the slot (removes it from the calendar).
  function cancelBooking(bookingId, userId) {
    let bookings = getBookings();
    const before = bookings.length;
    bookings = bookings.filter(
      (b) => !(b.id === bookingId && (!userId || b.user_id === userId))
    );
    write(KEYS.bookings, bookings);
    return bookings.length < before;
  }

  return {
    getPricing,
    setVenuePrice,
    priceFor,
    getUsers,
    upsertUser,
    getSession,
    setSession,
    clearSession,
    getBlocks,
    isBlocked,
    toggleBlock,
    getBookings,
    bookingsForUser,
    isBooked,
    slotStatus,
    createBooking,
    cancelBooking,
  };
})();
