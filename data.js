/* ===== Shared data and helper functions ===== */

// Change this to your local currency symbol
const CURRENCY = "$";

// Crops we know about (icon and colour are the fallback when there is no photo)
const CROPS = {
  "Tomatoes": { category: "Vegetables",     icon: "🍅", color: "#F6D5CE", unit: "kg" },
  "Onions":   { category: "Vegetables",     icon: "🧅", color: "#EBDDF0", unit: "kg" },
  "Cabbage":  { category: "Vegetables",     icon: "🥬", color: "#D5EBCB", unit: "kg" },
  "Maize":    { category: "Grains",         icon: "🌽", color: "#F7E7A8", unit: "kg" },
  "Mangoes":  { category: "Fruit",          icon: "🥭", color: "#FBDDA6", unit: "kg" },
  "Eggs":     { category: "Dairy and eggs", icon: "🥚", color: "#EFEBDD", unit: "tray" },
  "Milk":     { category: "Dairy and eggs", icon: "🥛", color: "#E3EEF7", unit: "litre" },
  "Other":    { category: "Other",          icon: "🌱", color: "#DCE8D6", unit: "kg" }
};
const UNITS = ["kg", "tray", "litre", "crate", "bag"];

// Order stages
const STAGES_DELIVERY = ["Pending", "Packed", "On the way", "Delivered"];
const STAGES_PICKUP   = ["Pending", "Packed", "Collected"];

// Delivery fees (flat fee per order)
const DELIVERY_FEES = { near: 3, mid: 6, far: 10 };

// ----- Small helpers -----

// Makes user-typed text safe to put inside HTML
function esc(text) {
  return String(text).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function money(n) {
  return CURRENCY + Number(n).toFixed(2);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("Could not save data", e);
    return false;
  }
}

function isoDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function cropInfo(name) {
  return CROPS[name] || CROPS.Other;
}

// Bulk discount: 5% from 50 units, 10% from 200 units
function bulkDiscount(qty) {
  if (qty >= 200) return 10;
  if (qty >= 50) return 5;
  return 0;
}

// ----- Harvest listings (what farmers have available) -----
function seedListings() {
  // crop, farmer, location, price, unit, stock
  const rows = [
    ["Tomatoes", "Green Valley Farm", "Northside", 1.8,  "kg",   400],
    ["Tomatoes", "Sunrise Growers",   "Eastfield", 1.5,  "kg",   250],
    ["Tomatoes", "Riverbend Co-op",   "Southgate", 2.1,  "kg",   500],
    ["Onions",   "Green Valley Farm", "Northside", 1.2,  "kg",   600],
    ["Onions",   "Sunrise Growers",   "Eastfield", 1.0,  "kg",   350],
    ["Maize",    "Riverbend Co-op",   "Southgate", 0.7,  "kg",   2000],
    ["Maize",    "Hilltop Farm",      "Westridge", 0.65, "kg",   1500],
    ["Eggs",     "Hilltop Farm",      "Westridge", 3.2,  "tray", 120],
    ["Mangoes",  "Sunrise Growers",   "Eastfield", 1.4,  "kg",   300],
    ["Mangoes",  "Riverbend Co-op",   "Southgate", 1.6,  "kg",   450],
    ["Cabbage",  "Hilltop Farm",      "Westridge", 0.9,  "kg",   350],
    ["Cabbage",  "Green Valley Farm", "Northside", 1.1,  "kg",   280],
    ["Milk",     "Riverbend Co-op",   "Southgate", 0.9,  "litre", 200]
  ];
  return rows.map((r, i) => {
    const c = cropInfo(r[0]);
    return {
      id: i + 1, name: r[0], category: c.category, farmer: r[1], location: r[2],
      price: r[3], unit: r[4], stock: r[5], icon: c.icon, color: c.color,
      photo: "", readyBy: isoDate(i % 4), mine: false
    };
  });
}

function getListings() {
  let list = load("ftt_listings", null);
  if (list === null) {
    list = seedListings();
    save("ftt_listings", list);
  }
  return list;
}

function saveListings(list) {
  return save("ftt_listings", list);
}

function getProduct(id) {
  return getListings().find(p => p.id === Number(id));
}

// Photo for a listing. A photo the farmer uploaded wins. Otherwise we look for
// images/<crop>.jpg, e.g. images/tomatoes.jpg. If neither exists, the emoji shows.
function produceImage(p) {
  const file = p.name.toLowerCase().replace(/\s+/g, "-");
  const src = p.photo ? p.photo : "images/" + encodeURIComponent(file) + ".jpg";
  return `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">`;
}

function listingCard(p, showRemove) {
  return `
    <article class="card product">
      <div class="tile" style="background:${p.color}" aria-hidden="true">${p.icon}${produceImage(p)}</div>
      <h3>${esc(p.name)}</h3>
      <p class="muted">${esc(p.farmer)}<br>${esc(p.location)}</p>
      <p class="price">${money(p.price)} <span class="muted">per ${esc(p.unit)}</span></p>
      <p class="muted">${p.stock} ${esc(p.unit)} available${p.readyBy ? ", ready " + p.readyBy : ""}</p>
      <div class="row">
        ${showRemove
          ? `<button class="btn small ghost" type="button" data-remove-listing="${p.id}">Remove</button>`
          : `<a class="btn small" href="order.html?product=${p.id}">Order</a>
             <a class="btn small ghost" href="compare.html?crop=${encodeURIComponent(p.name)}">Compare</a>`}
      </div>
    </article>`;
}

// ----- Buyer requests (what buyers want to buy) -----
function getRequests() {
  let list = load("ftt_requests", null);
  if (list === null) {
    list = [
      { id: 101, buyer: "Savanna Grill", buyerType: "Restaurant", crop: "Tomatoes", qty: 80, unit: "kg",
        maxPrice: 1.7, neededBy: isoDate(3), location: "Northside",
        notes: "Firm, ripe tomatoes for sauces. Weekly order if the quality is good.", status: "Open", mine: false, offers: [] },
      { id: 102, buyer: "Fresh Basket Mart", buyerType: "Retailer", crop: "Maize", qty: 300, unit: "kg",
        maxPrice: 0.7, neededBy: isoDate(6), location: "Southgate",
        notes: "Dry maize, bagged if possible.", status: "Open", mine: false, offers: [] },
      { id: 103, buyer: "The Mensah family", buyerType: "Household", crop: "Mangoes", qty: 10, unit: "kg",
        maxPrice: 1.5, neededBy: isoDate(2), location: "Eastfield",
        notes: "Ripe mangoes for a family event.", status: "Open", mine: false, offers: [] }
    ];
    save("ftt_requests", list);
  }
  return list;
}

function saveRequests(list) {
  return save("ftt_requests", list);
}

// ----- Surplus deals (discounted extra produce) -----
function getDeals() {
  let deals = load("ftt_surplus", null);
  if (deals === null) {
    const hour = 3600000;
    deals = [
      { id: 1, farmer: "Sunrise Growers",  productId: 2,  qty: 120, discount: 30, expiresAt: Date.now() + 10 * hour },
      { id: 2, farmer: "Hilltop Farm",     productId: 11, qty: 90,  discount: 40, expiresAt: Date.now() + 6 * hour },
      { id: 3, farmer: "Riverbend Co-op",  productId: 10, qty: 200, discount: 25, expiresAt: Date.now() + 26 * hour }
    ];
    save("ftt_surplus", deals);
  }
  return deals;
}

// Only deals that have not expired and whose product still exists
function activeDeals() {
  return getDeals().filter(d => d.expiresAt > Date.now() && getProduct(d.productId));
}

function dealPrice(deal) {
  const p = getProduct(deal.productId);
  return Math.round(p.price * (1 - deal.discount / 100) * 100) / 100;
}

function timeLeft(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? h + "h " + m + "m left" : m + "m left";
}

function dealCard(d) {
  const p = getProduct(d.productId);
  return `
    <article class="card deal">
      <div class="deal-tag">${d.discount}% off</div>
      <div class="deal-icon" style="background:${p.color}" aria-hidden="true">${p.icon}${produceImage(p)}</div>
      <div>
        <h3>${esc(p.name)}</h3>
        <p class="muted">${esc(d.farmer)}, ${esc(p.location)}</p>
        <p><strong>${money(dealPrice(d))}</strong> per ${esc(p.unit)} <s class="muted">${money(p.price)}</s></p>
        <p class="muted">${d.qty} ${esc(p.unit)} available, ${timeLeft(d.expiresAt - Date.now())}</p>
        <a class="btn small" href="order.html?deal=${d.id}">Order this deal</a>
      </div>
    </article>`;
}