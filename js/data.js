/* ============================================================
   El Clasico Turf — Static seed data
   ============================================================ */

// The 4 distinct turf entities. Each is an independent booking calendar.
const VENUES = [
  {
    id: "mahindra-city",
    name: "El Clasico - Mahindra City",
    short: "Mahindra City",
    sports: ["Football", "Box Cricket"],
    google_maps_url:
      "https://www.google.com/maps/search/?api=1&query=El+Clasico+Turf+Mahindra+City",
    amenities: ["Parking", "Changing Room", "Washroom", "Drinking Water"],
  },
  {
    id: "chengalpattu",
    name: "El Clasico - Chengalpattu",
    short: "Chengalpattu",
    sports: ["Football", "Box Cricket"],
    google_maps_url:
      "https://www.google.com/maps/search/?api=1&query=El+Clasico+Turf+Chengalpattu",
    amenities: ["Parking", "Changing Room", "Washroom", "Drinking Water"],
  },
  {
    id: "potheri-5",
    name: "El Clasico 5'aside - Potheri",
    short: "Potheri 5'aside",
    sports: ["Football", "Box Cricket"],
    google_maps_url:
      "https://www.google.com/maps/search/?api=1&query=El+Clasico+5aside+Potheri",
    amenities: ["Parking", "Changing Room", "Washroom", "Drinking Water"],
  },
  {
    id: "potheri-6",
    name: "El Clasico 6'aside - Potheri",
    short: "Potheri 6'aside",
    sports: ["Football", "Box Cricket"],
    google_maps_url:
      "https://www.google.com/maps/search/?api=1&query=El+Clasico+6aside+Potheri",
    amenities: ["Parking", "Changing Room", "Washroom", "Drinking Water"],
  },
];

// Default per-hour price (INR). Potheri 6'aside is priced higher than 5'aside.
const DEFAULT_PRICING = {
  "mahindra-city": 1200,
  chengalpattu: 1000,
  "potheri-5": 1100,
  "potheri-6": 1400,
};

// Amenity icon glyphs (emoji keeps it dependency-free + mobile friendly).
const AMENITY_META = {
  Parking: { icon: "🅿️", label: "Parking" },
  "Changing Room": { icon: "👕", label: "Changing Room" },
  Washroom: { icon: "🚻", label: "Washroom" },
  "Drinking Water": { icon: "🚰", label: "Drinking Water" },
};

// Operating hours: open 24 hours — hourly slots covering 00:00–24:00.
const OPEN_HOUR = 0;
const CLOSE_HOUR = 24;

function buildSlots() {
  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    slots.push({ start: h, end: h + 1 });
  }
  return slots;
}

const SLOTS = buildSlots();

// Demo admin passcode (front-end only mock — see README for real auth notes).
const ADMIN_PASSCODE = "1234";
