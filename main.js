/* ===== Layout shared by every page + page-specific code ===== */

const PAGES = [
  ["index", "Home"],
  ["farmer", "For farmers"],
  ["buyer", "For buyers"],
  ["marketplace", "Marketplace"],
  ["compare", "Compare prices"],
  ["order", "Orders"],
  ["surplus", "Surplus deals"],
  ["business", "Business model"]
];

function buildLayout() {
  const current = document.body.dataset.page;

  document.getElementById("site-header").innerHTML = `
    <a class="brand" href="index.html">Shamba Link</a>
    <button class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav id="nav" aria-label="Main">
      ${PAGES.map(([file, label]) =>
        `<a href="${file}.html" ${file === current ? 'aria-current="page"' : ""}>${label}</a>`
      ).join("")}
    </nav>`;

  document.getElementById("site-footer").innerHTML =
    "<p>Shamba Link is a student project. All farms, prices and orders are sample data saved in your browser.</p>";

  const btn = document.querySelector(".menu-btn");
  btn.addEventListener("click", () => {
    const open = document.getElementById("nav").classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
}

function showNotice(el, text, isError) {
  el.textContent = text;
  el.className = "notice" + (isError ? " error" : "");
  el.hidden = false;
}

/* ---------- HOME ---------- */
function initHome() {
  const box = document.getElementById("home-deals");
  const deals = activeDeals().slice(0, 3);
  box.innerHTML = deals.length
    ? deals.map(dealCard).join("")
    : '<p class="muted">No surplus alerts right now. Check back soon.</p>';

  document.getElementById("stat-listings").textContent = getListings().length;
  document.getElementById("stat-requests").textContent = getRequests().filter(r => r.status === "Open").length;
  document.getElementById("stat-deals").textContent = activeDeals().length;
}

/* ---------- FARMER PORTAL ---------- */

// Shrinks a photo so it fits in browser storage
function compressImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function initFarmer() {
  const form = document.getElementById("harvest-form");
  const msg = document.getElementById("harvest-msg");
  const cropSel = document.getElementById("f-crop");
  const otherBox = document.getElementById("f-other-box");
  const unitSel = document.getElementById("f-unit");
  const photoInput = document.getElementById("f-photo");
  const preview = document.getElementById("photo-preview");
  const myList = document.getElementById("my-listings");
  const board = document.getElementById("board");
  const boardCrop = document.getElementById("board-crop");
  let photoData = "";

  // Fill crop and unit lists
  cropSel.innerHTML = Object.keys(CROPS).map(c => `<option>${c}</option>`).join("");
  unitSel.innerHTML = UNITS.map(u => `<option>${u}</option>`).join("");

  // Remember the farm name and location in this browser
  const farm = load("ftt_farm", { name: "", location: "" });
  document.getElementById("f-name").value = farm.name;
  document.getElementById("f-location").value = farm.location;
  document.getElementById("f-ready").min = isoDate(0);
  document.getElementById("f-ready").value = isoDate(0);

  cropSel.addEventListener("change", () => {
    otherBox.hidden = cropSel.value !== "Other";
    unitSel.value = cropInfo(cropSel.value).unit;
  });
  unitSel.value = cropInfo(cropSel.value).unit;

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    photoData = "";
    preview.hidden = true;
    if (!file) return;
    try {
      photoData = await compressImage(file, 480);
      preview.src = photoData;
      preview.hidden = false;
    } catch (e) {
      showNotice(msg, "That file could not be read as a picture. Try a JPG or PNG.", true);
    }
  });

  // ----- Submit a harvest listing -----
  form.addEventListener("submit", e => {
    e.preventDefault();
    const farmName = document.getElementById("f-name").value.trim();
    const location = document.getElementById("f-location").value.trim();
    let crop = cropSel.value;
    if (crop === "Other") crop = document.getElementById("f-other").value.trim();
    const qty = Number(document.getElementById("f-qty").value);
    const price = Number(document.getElementById("f-price").value);
    const ready = document.getElementById("f-ready").value;

    const problems = [];
    if (farmName.length < 2) problems.push("Enter your farm name.");
    if (location.length < 2) problems.push("Enter your location.");
    if (crop.length < 2) problems.push("Type the name of your crop.");
    if (!(qty >= 1)) problems.push("Enter a quantity of at least 1.");
    if (!(price > 0)) problems.push("Enter a price above 0.");
    if (!ready) problems.push("Pick the date your harvest is ready.");
    if (problems.length) {
      showNotice(msg, problems.join(" "), true);
      return;
    }

    save("ftt_farm", { name: farmName, location });

    const info = cropInfo(cropSel.value === "Other" ? "Other" : crop);
    const listing = {
      id: Date.now(), name: crop, category: info.category, farmer: farmName, location,
      price, unit: unitSel.value, stock: qty, icon: info.icon, color: info.color,
      photo: photoData, readyBy: ready, mine: true
    };

    const all = getListings();
    all.unshift(listing);
    if (!saveListings(all)) {
      // Probably the photo made it too big. Try again without it.
      all[0].photo = "";
      saveListings(all);
      showNotice(msg, "Saved, but the photo was too large to store, so it was left out.", true);
    } else {
      showNotice(msg, "Harvest listed. Buyers can now see it in the marketplace.", false);
    }

    form.reset();
    document.getElementById("f-name").value = farmName;
    document.getElementById("f-location").value = location;
    document.getElementById("f-ready").value = isoDate(0);
    otherBox.hidden = true;
    unitSel.value = cropInfo(cropSel.value).unit;
    photoData = "";
    preview.hidden = true;
    renderMine();
    renderBoard();
  });

  // ----- Your listings -----
  function renderMine() {
    const mine = getListings().filter(p => p.mine);
    myList.innerHTML = mine.length
      ? mine.map(p => listingCard(p, true)).join("")
      : '<p class="empty">You have not listed any harvest yet. Fill in the form to list your first crop.</p>';
  }

  myList.addEventListener("click", e => {
    const btn = e.target.closest("[data-remove-listing]");
    if (!btn) return;
    saveListings(getListings().filter(p => p.id !== Number(btn.dataset.removeListing)));
    renderMine();
    renderBoard();
  });

  // ----- Buyer requests board -----
  function renderBoard() {
    const myCrops = getListings().filter(p => p.mine).map(p => p.name);
    const requests = getRequests().filter(r => r.status === "Open");

    // Keep the filter list up to date
    const wanted = boardCrop.value;
    const cropsInBoard = [...new Set(requests.map(r => r.crop))].sort();
    boardCrop.innerHTML = '<option value="">All crops</option>' +
      cropsInBoard.map(c => `<option>${esc(c)}</option>`).join("");
    boardCrop.value = cropsInBoard.includes(wanted) ? wanted : "";

    const shown = requests
      .filter(r => boardCrop.value === "" || r.crop === boardCrop.value)
      .sort((a, b) => a.neededBy.localeCompare(b.neededBy));

    board.innerHTML = shown.length
      ? shown.map(r => {
          const myOffer = r.offers.find(o => o.mine);
          const matches = myCrops.includes(r.crop);
          return `
            <article class="card request">
              <div class="req-top">
                <div>
                  <h3>${esc(r.buyer)} needs ${r.qty} ${esc(r.unit)} of ${esc(r.crop)}
                    ${matches ? '<span class="badge">Matches your harvest</span>' : ""}</h3>
                  <p class="muted">${esc(r.buyerType)}, ${esc(r.location)}<br>Needed by ${r.neededBy}</p>
                </div>
                <div class="req-price">
                  <p class="price">Up to ${money(r.maxPrice)}</p>
                  <span class="muted">per ${esc(r.unit)}</span>
                </div>
              </div>
              ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
              <p class="muted">${r.offers.length} offer${r.offers.length === 1 ? "" : "s"} so far</p>
              ${myOffer
                ? `<p class="notice">Your offer: ${money(myOffer.price)} per ${esc(r.unit)} for ${myOffer.qty} ${esc(r.unit)}. Status: <strong>${myOffer.status}</strong></p>`
                : offerForm(r)}
            </article>`;
        }).join("")
      : '<p class="empty">No open buyer requests for this crop right now.</p>';
  }

  function offerForm(r) {
    return `
      <details class="offer-box">
        <summary class="btn small">Make an offer</summary>
        <form class="offer-form" data-request="${r.id}" novalidate>
          <div class="two">
            <label>Farm name<input name="farmer" type="text" value="${esc(load("ftt_farm", { name: "" }).name)}"></label>
            <label>Your price per ${esc(r.unit)}<input name="price" type="number" step="0.01" min="0.01" value="${r.maxPrice}"></label>
          </div>
          <div class="two">
            <label>Quantity you can supply<input name="qty" type="number" min="1" value="${r.qty}"></label>
            <label>Delivery
              <select name="delivery">
                <option value="yes">I can deliver</option>
                <option value="no">Pickup only</option>
              </select>
            </label>
          </div>
          <label>Note to the buyer (optional)<input name="note" type="text"></label>
          <p class="notice error form-error" role="alert" hidden></p>
          <div><button class="btn small" type="submit">Send offer</button></div>
        </form>
      </details>`;
  }

  board.addEventListener("submit", e => {
    const f = e.target.closest(".offer-form");
    if (!f) return;
    e.preventDefault();

    const farmer = f.elements.farmer.value.trim();
    const price = Number(f.elements.price.value);
    const qty = Number(f.elements.qty.value);
    const err = f.querySelector(".form-error");

    if (farmer.length < 2 || !(price > 0) || !(qty >= 1)) {
      err.textContent = "Enter your farm name, a price above 0, and a quantity of at least 1.";
      err.hidden = false;
      return;
    }

    const all = getRequests();
    const req = all.find(r => r.id === Number(f.dataset.request));
    req.offers.push({
      id: Date.now(), farmer, price, qty,
      delivery: f.elements.delivery.value === "yes",
      note: f.elements.note.value.trim(),
      status: "Pending", mine: true
    });
    saveRequests(all);
    renderBoard();
  });

  boardCrop.addEventListener("input", renderBoard);

  renderMine();
  renderBoard();
}

/* ---------- BUYER PORTAL ---------- */
function initBuyer() {
  const form = document.getElementById("request-form");
  const msg = document.getElementById("request-msg");
  const cropSel = document.getElementById("b-crop");
  const otherBox = document.getElementById("b-other-box");
  const unitSel = document.getElementById("b-unit");
  const list = document.getElementById("my-requests");

  cropSel.innerHTML = Object.keys(CROPS).map(c => `<option>${c}</option>`).join("");
  unitSel.innerHTML = UNITS.map(u => `<option>${u}</option>`).join("");

  const buyer = load("ftt_buyer", { name: "", type: "Household", location: "" });
  document.getElementById("b-name").value = buyer.name;
  document.getElementById("b-type").value = buyer.type;
  document.getElementById("b-location").value = buyer.location;
  document.getElementById("b-date").min = isoDate(0);
  document.getElementById("b-date").value = isoDate(3);

  // Link from the marketplace: buyer.html?crop=Tomatoes
  const fromLink = new URLSearchParams(location.search).get("crop");
  if (fromLink && CROPS[fromLink]) cropSel.value = fromLink;

  function syncCrop() {
    otherBox.hidden = cropSel.value !== "Other";
    unitSel.value = cropInfo(cropSel.value).unit;
  }
  cropSel.addEventListener("change", syncCrop);
  syncCrop();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("b-name").value.trim();
    const type = document.getElementById("b-type").value;
    const place = document.getElementById("b-location").value.trim();
    let crop = cropSel.value;
    if (crop === "Other") crop = document.getElementById("b-other").value.trim();
    const qty = Number(document.getElementById("b-qty").value);
    const maxPrice = Number(document.getElementById("b-price").value);
    const date = document.getElementById("b-date").value;

    const problems = [];
    if (name.length < 2) problems.push("Enter your name or business name.");
    if (place.length < 2) problems.push("Enter your delivery location.");
    if (crop.length < 2) problems.push("Type the name of the produce you need.");
    if (!(qty >= 1)) problems.push("Enter a quantity of at least 1.");
    if (!(maxPrice > 0)) problems.push("Enter the highest price you will pay.");
    if (!date) problems.push("Pick the date you need it by.");
    if (problems.length) {
      showNotice(msg, problems.join(" "), true);
      return;
    }

    save("ftt_buyer", { name, type, location: place });

    const requests = getRequests();
    requests.unshift({
      id: Date.now(), buyer: name, buyerType: type, crop, qty, unit: unitSel.value,
      maxPrice, neededBy: date, location: place,
      notes: document.getElementById("b-notes").value.trim(),
      status: "Open", mine: true, offers: []
    });
    saveRequests(requests);

    // Tell the buyer how many farmers already list this crop at their price
    const already = getListings().filter(p => p.name === crop && p.price <= maxPrice).length;
    showNotice(msg,
      "Request posted. Farmers can now send you offers." +
      (already ? ` ${already} farmer${already === 1 ? " already lists" : "s already list"} ${crop} at or below your price. See the marketplace.` : ""),
      false);

    form.reset();
    document.getElementById("b-name").value = name;
    document.getElementById("b-type").value = type;
    document.getElementById("b-location").value = place;
    document.getElementById("b-date").value = isoDate(3);
    syncCrop();
    renderRequests();
  });

  function renderRequests() {
    const mine = getRequests().filter(r => r.mine);
    if (!mine.length) {
      list.innerHTML = '<p class="empty">You have not requested anything yet. Fill in the form so farmers can send you offers.</p>';
      return;
    }

    list.innerHTML = mine.map(r => `
      <article class="card request">
        <div class="req-top">
          <div>
            <h3>${r.qty} ${esc(r.unit)} of ${esc(r.crop)} <span class="badge ${r.status === "Matched" ? "ok" : ""}">${r.status}</span></h3>
            <p class="muted">Up to ${money(r.maxPrice)} per ${esc(r.unit)}, needed by ${r.neededBy}<br>Deliver to ${esc(r.location)}</p>
          </div>
          <button class="btn small ghost" type="button" data-close="${r.id}">Delete request</button>
        </div>
        ${r.offers.length
          ? r.offers.map(o => offerRow(r, o)).join("")
          : '<p class="muted">No offers yet. Farmers will see your request on their board.</p>'}
      </article>`).join("");
  }

  function offerRow(r, o) {
    const canAccept = r.status === "Open" && o.status === "Pending";
    return `
      <div class="offer">
        <p><strong>${esc(o.farmer)}</strong> offers ${o.qty} ${esc(r.unit)} at ${money(o.price)} per ${esc(r.unit)}
          (${money(o.price * o.qty)} total). ${o.delivery ? "Can deliver." : "Pickup only."}
          <span class="badge ${o.status === "Accepted" ? "ok" : ""}">${o.status}</span></p>
        ${o.note ? `<p class="muted">"${esc(o.note)}"</p>` : ""}
        ${canAccept ? `
          <div class="row">
            <select aria-label="Pickup or delivery for ${esc(o.farmer)}" data-method="${o.id}">
              <option value="pickup">Pickup</option>
              ${o.delivery ? `<option value="delivery">Delivery (+${money(DELIVERY_FEES.mid)})</option>` : ""}
            </select>
            <button class="btn small" type="button" data-accept="${r.id}" data-offer="${o.id}">Accept offer</button>
          </div>` : ""}
      </div>`;
  }

  list.addEventListener("click", e => {
    // Delete a request
    const del = e.target.closest("[data-close]");
    if (del) {
      saveRequests(getRequests().filter(r => r.id !== Number(del.dataset.close)));
      renderRequests();
      return;
    }

    // Accept an offer: this creates an order
    const acc = e.target.closest("[data-accept]");
    if (!acc) return;

    const requests = getRequests();
    const req = requests.find(r => r.id === Number(acc.dataset.accept));
    const offer = req.offers.find(o => o.id === Number(acc.dataset.offer));
    const method = list.querySelector(`[data-method="${offer.id}"]`).value;
    const fee = method === "delivery" ? DELIVERY_FEES.mid : 0;

    const orders = load("ftt_orders", []);
    orders.unshift({
      id: Date.now(), buyer: req.buyer, buyerType: req.buyerType, product: req.crop,
      farmer: offer.farmer, unit: req.unit, qty: offer.qty,
      total: offer.price * offer.qty + fee, method, date: req.neededBy, stage: 0
    });
    save("ftt_orders", orders);

    offer.status = "Accepted";
    req.offers.forEach(o => { if (o !== offer) o.status = "Declined"; });
    req.status = "Matched";
    saveRequests(requests);

    showNotice(msg, "Offer accepted. Your order is on the Orders page.", false);
    renderRequests();
  });

  renderRequests();
}

/* ---------- MARKETPLACE ---------- */
function initMarketplace() {
  const search = document.getElementById("search");
  const cat = document.getElementById("category");
  const loc = document.getElementById("location");
  const sort = document.getElementById("sort");
  const grid = document.getElementById("product-grid");
  const count = document.getElementById("result-count");

  const listings = getListings();
  const categories = [...new Set(listings.map(p => p.category))];
  const locations = [...new Set(listings.map(p => p.location))];
  cat.innerHTML += categories.map(c => `<option>${esc(c)}</option>`).join("");
  loc.innerHTML += locations.map(l => `<option>${esc(l)}</option>`).join("");

  function render() {
    const text = search.value.trim().toLowerCase();
    let list = listings.filter(p =>
      (p.name.toLowerCase().includes(text) || p.farmer.toLowerCase().includes(text)) &&
      (cat.value === "" || p.category === cat.value) &&
      (loc.value === "" || p.location === loc.value)
    );

    if (sort.value === "low") list.sort((a, b) => a.price - b.price);
    if (sort.value === "high") list.sort((a, b) => b.price - a.price);
    if (sort.value === "name") list.sort((a, b) => a.name.localeCompare(b.name));

    count.textContent = list.length + " listing" + (list.length === 1 ? "" : "s");
    grid.innerHTML = list.length
      ? list.map(p => listingCard(p, false)).join("")
      : `<p class="empty">No listings match your search. Can't find it? <a href="buyer.html">Post a request</a> and let farmers come to you.</p>`;
  }

  [search, cat, loc, sort].forEach(el => el.addEventListener("input", render));
  render();
}

/* ---------- COMPARE ---------- */
function initCompare() {
  const select = document.getElementById("crop");
  const out = document.getElementById("compare-out");
  const listings = getListings();
  const crops = [...new Set(listings.map(p => p.name))].sort();

  if (!crops.length) {
    out.innerHTML = '<p class="empty">No harvest is listed yet. Farmers can add listings on the For farmers page.</p>';
    select.disabled = true;
    return;
  }

  select.innerHTML = crops.map(c => `<option>${esc(c)}</option>`).join("");
  const wanted = new URLSearchParams(location.search).get("crop");
  if (wanted && crops.includes(wanted)) select.value = wanted;

  function render() {
    const rows = listings.filter(p => p.name === select.value).sort((a, b) => a.price - b.price);
    const cheapest = rows[0];
    const dearest = rows[rows.length - 1];
    const saving = dearest.price > 0 ? Math.round((1 - cheapest.price / dearest.price) * 100) : 0;

    out.innerHTML = `
      <p class="callout">${rows.length > 1
        ? `Buying from <strong>${esc(cheapest.farmer)}</strong> saves you up to <strong>${saving}%</strong> compared with the most expensive seller.`
        : `Only <strong>${esc(cheapest.farmer)}</strong> sells this right now.`}</p>
      <div class="table-wrap">
        <table>
          <caption class="sr-only">Price comparison for ${esc(select.value)}</caption>
          <thead><tr><th>Farmer</th><th>Location</th><th>Price</th><th>Available</th><th></th></tr></thead>
          <tbody>
            ${rows.map((p, i) => `
              <tr class="${i === 0 ? "best" : ""}">
                <td>${esc(p.farmer)} ${i === 0 ? '<span class="badge">Lowest price</span>' : ""}</td>
                <td>${esc(p.location)}</td>
                <td>${money(p.price)} per ${esc(p.unit)}</td>
                <td>${p.stock} ${esc(p.unit)}</td>
                <td><a class="btn small" href="order.html?product=${p.id}">Order</a></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  select.addEventListener("change", render);
  render();
}

/* ---------- ORDERS ---------- */
function initOrder() {
  const form = document.getElementById("order-form");
  const productSel = document.getElementById("product");
  const qtyInput = document.getElementById("qty");
  const methodSel = document.getElementById("method");
  const zoneBox = document.getElementById("zone-box");
  const zoneSel = document.getElementById("zone");
  const dateInput = document.getElementById("date");
  const summary = document.getElementById("summary");
  const errors = document.getElementById("errors");
  const dealNote = document.getElementById("deal-note");

  function fillProducts(selectedId) {
    productSel.innerHTML = getListings().map(p =>
      `<option value="${p.id}">${esc(p.name)} - ${esc(p.farmer)} (${money(p.price)}/${esc(p.unit)})</option>`
    ).join("");
    if (selectedId) productSel.value = selectedId;
  }

  if (!getListings().length) {
    form.innerHTML = '<p class="empty">No harvest is listed yet, so there is nothing to order. Farmers can add listings on the For farmers page.</p>';
    summary.hidden = true;
    renderOrders();
    return;
  }

  fillProducts();

  // Pre-select from link (?product=3 or ?deal=2)
  const params = new URLSearchParams(location.search);
  let deal = null;
  if (params.get("deal")) {
    deal = activeDeals().find(d => d.id === Number(params.get("deal"))) || null;
  }
  if (deal) {
    productSel.value = deal.productId;
    productSel.disabled = true;
    showDealNote();
  } else if (params.get("product") && getProduct(params.get("product"))) {
    productSel.value = params.get("product");
  }

  function showDealNote() {
    const p = getProduct(deal.productId);
    dealNote.hidden = false;
    dealNote.textContent = `Surplus deal: ${deal.discount}% off ${p.name} from ${deal.farmer}. Up to ${deal.qty} ${p.unit} left.`;
  }

  dateInput.min = isoDate(0);

  function figures() {
    const p = getProduct(productSel.value);
    const qty = Number(qtyInput.value) || 0;
    const unitPrice = deal ? dealPrice(deal) : p.price;
    const subtotal = unitPrice * qty;
    const disc = bulkDiscount(qty);
    const discountAmt = subtotal * disc / 100;
    const fee = methodSel.value === "delivery" ? DELIVERY_FEES[zoneSel.value] : 0;
    return { p, qty, unitPrice, subtotal, disc, discountAmt, fee, total: subtotal - discountAmt + fee };
  }

  function updateSummary() {
    zoneBox.hidden = methodSel.value !== "delivery";
    const f = figures();
    summary.innerHTML = `
      <h3>Order summary</h3>
      <dl>
        <dt>Price</dt><dd>${money(f.unitPrice)} per ${esc(f.p.unit)}</dd>
        <dt>Subtotal</dt><dd>${money(f.subtotal)}</dd>
        <dt>Bulk discount (${f.disc}%)</dt><dd>-${money(f.discountAmt)}</dd>
        <dt>Delivery fee</dt><dd>${money(f.fee)}</dd>
        <dt class="total">Total</dt><dd class="total">${money(f.total)}</dd>
      </dl>
      <p class="muted">Order 50 or more for 5% off, and 200 or more for 10% off.</p>`;
  }

  form.addEventListener("input", updateSummary);

  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = figures();
    const name = document.getElementById("buyer").value.trim();
    const maxQty = deal ? Math.min(deal.qty, f.p.stock) : f.p.stock;
    const problems = [];

    if (name.length < 2) problems.push("Enter your name or your business name.");
    if (!Number.isInteger(f.qty) || f.qty < 1) problems.push("Enter a quantity of at least 1.");
    if (f.qty > maxQty) problems.push(`Only ${maxQty} ${f.p.unit} available. Lower the quantity.`);
    if (!dateInput.value) problems.push("Pick a date for pickup or delivery.");

    if (problems.length) {
      errors.innerHTML = "<ul>" + problems.map(m => `<li>${esc(m)}</li>`).join("") + "</ul>";
      errors.hidden = false;
      return;
    }
    errors.hidden = true;

    const orders = load("ftt_orders", []);
    orders.unshift({
      id: Date.now(),
      buyer: name,
      buyerType: document.getElementById("buyer-type").value,
      product: f.p.name,
      farmer: f.p.farmer,
      unit: f.p.unit,
      qty: f.qty,
      total: f.total,
      method: methodSel.value,
      date: dateInput.value,
      stage: 0
    });
    save("ftt_orders", orders);

    // Take the ordered amount out of the farmer's stock (and out of the deal)
    const listings = getListings();
    const listing = listings.find(p => p.id === f.p.id);
    listing.stock -= f.qty;
    saveListings(listings);
    if (deal) {
      const deals = getDeals();
      const stored = deals.find(d => d.id === deal.id);
      stored.qty -= f.qty;
      deal.qty = stored.qty;
      save("ftt_surplus", deals.filter(d => d.qty > 0));
      showDealNote();
    }

    const keep = productSel.value;
    form.reset();
    fillProducts(keep);
    if (deal) productSel.value = deal.productId;
    updateSummary();
    renderOrders();
    document.getElementById("orders-heading").scrollIntoView({ behavior: "smooth" });
  });

  updateSummary();
  renderOrders();
}

function renderOrders() {
  const box = document.getElementById("order-list");
  const orders = load("ftt_orders", []);

  if (!orders.length) {
    box.innerHTML = '<p class="empty">No orders yet. Place an order above, or accept a farmer\'s offer on the For buyers page.</p>';
    return;
  }

  box.innerHTML = orders.map(o => {
    const stages = o.method === "delivery" ? STAGES_DELIVERY : STAGES_PICKUP;
    const done = o.stage >= stages.length - 1;
    return `
      <article class="card order">
        <div class="order-top">
          <div>
            <h3>${o.qty} ${esc(o.unit)} ${esc(o.product)}</h3>
            <p class="muted">${esc(o.buyer)} (${esc(o.buyerType)}), from ${esc(o.farmer)}<br>
            ${o.method === "delivery" ? "Delivery" : "Pickup"} on ${o.date}</p>
          </div>
          <p class="price">${money(o.total)}</p>
        </div>
        <ol class="stages" aria-label="Order progress">
          ${stages.map((s, i) => `<li class="${i < o.stage ? "done" : ""} ${i === o.stage ? "current" : ""}">${s}</li>`).join("")}
        </ol>
        ${done ? "" : `<button class="btn small ghost" data-advance="${o.id}">Move to next stage</button>`}
      </article>`;
  }).join("");

  box.querySelectorAll("[data-advance]").forEach(btn => {
    btn.addEventListener("click", () => {
      const all = load("ftt_orders", []);
      const o = all.find(x => x.id === Number(btn.dataset.advance));
      const stages = o.method === "delivery" ? STAGES_DELIVERY : STAGES_PICKUP;
      if (o.stage < stages.length - 1) o.stage++;
      save("ftt_orders", all);
      renderOrders();
    });
  });
}

/* ---------- SURPLUS ---------- */
function initSurplus() {
  const list = document.getElementById("deal-list");
  const form = document.getElementById("surplus-form");
  const productSel = document.getElementById("s-product");
  const msg = document.getElementById("s-msg");

  const farm = load("ftt_farm", { name: "" });
  document.getElementById("s-farmer").value = farm.name;

  // Farmers pick from their own listings first. If they have none, from all listings.
  const all = getListings();
  const mine = all.filter(p => p.mine);
  const choices = mine.length ? mine : all;
  productSel.innerHTML = choices.map(p =>
    `<option value="${p.id}">${esc(p.name)} - ${esc(p.farmer)}</option>`
  ).join("");

  function render() {
    const deals = activeDeals();
    list.innerHTML = deals.length
      ? deals.map(dealCard).join("")
      : '<p class="empty">No surplus alerts right now. Farmers can post extra produce with the form.</p>';
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const farmer = document.getElementById("s-farmer").value.trim();
    const qty = Number(document.getElementById("s-qty").value);
    const discount = Number(document.getElementById("s-discount").value);
    const hours = Number(document.getElementById("s-hours").value);
    const p = getProduct(productSel.value);

    if (!p || farmer.length < 2 || !(qty >= 1) || !(discount >= 5 && discount <= 70) || !(hours >= 1 && hours <= 72)) {
      showNotice(msg, "Check the form: add your name, a quantity of at least 1, a discount from 5 to 70%, and hours from 1 to 72.", true);
      return;
    }

    const deals = getDeals();
    deals.unshift({ id: Date.now(), farmer, productId: p.id, qty, discount, expiresAt: Date.now() + hours * 3600000 });
    save("ftt_surplus", deals);
    showNotice(msg, "Surplus alert posted. Buyers can see it now.", false);
    form.reset();
    document.getElementById("s-farmer").value = farmer;
    render();
  });

  render();
  setInterval(render, 60000); // refresh the countdowns every minute
}

/* ---------- BUSINESS ---------- */
function initBusiness() {
  const ids = ["m-orders", "m-value", "m-delivery", "m-subs"];
  const out = document.getElementById("revenue-out");

  function calc() {
    const [orders, value, deliveryPct, subs] = ids.map(id => Number(document.getElementById(id).value) || 0);

    const transaction = orders * value * 0.03;                 // 3% of every order
    const delivery = orders * (deliveryPct / 100) * 6 * 0.15; // 15% of an average 6.00 delivery fee
    const subscriptions = subs * 20;                          // 20.00 per month per business
    const total = transaction + delivery + subscriptions;

    out.innerHTML = `
      <dl>
        <dt>Transaction fees (3%)</dt><dd>${money(transaction)}</dd>
        <dt>Delivery commission (15%)</dt><dd>${money(delivery)}</dd>
        <dt>Subscriptions</dt><dd>${money(subscriptions)}</dd>
        <dt class="total">Monthly revenue</dt><dd class="total">${money(total)}</dd>
      </dl>`;
  }

  ids.forEach(id => document.getElementById(id).addEventListener("input", calc));
  calc();
}

/* ---------- Start ---------- */
document.addEventListener("DOMContentLoaded", () => {
  buildLayout();
  const page = document.body.dataset.page;
  if (page === "index") initHome();
  if (page === "farmer") initFarmer();
  if (page === "buyer") initBuyer();
  if (page === "marketplace") initMarketplace();
  if (page === "compare") initCompare();
  if (page === "order") initOrder();
  if (page === "surplus") initSurplus();
  if (page === "business") initBusiness();
});