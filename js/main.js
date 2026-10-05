/* ============================================================
 * Sneakr.mnl - Shared front-end JavaScript
 * Features:
 *  1. Live product search (redirects to catalog with results)
 *  2. Shopping cart stored in localStorage, badge count,
 *     add-to-cart buttons injected into product listings
 *  3. Newsletter form -> POST /api/newsletter with validation
 *  4. Auth state in navbar (login/logout)
 * ============================================================ */

const API = '';   // same origin

/* ---------- formatting helper ---------- */
function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ---------- tiny toast notifications ---------- */
function showToast(msg, type = 'success') {
  let t = document.getElementById('sneakr-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sneakr-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'sneakr-toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ================= SHOPPING CART ================= */
const Cart = {
  KEY: 'sneakr_cart',
  read() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  write(items) { localStorage.setItem(this.KEY, JSON.stringify(items)); this.updateBadge(); },
  add(product, qty = 1) {
    const items = this.read();
    const found = items.find(i => i.product_id === product.product_id);
    if (found) found.quantity = Math.min(99, found.quantity + qty);
    else items.push({
      product_id: product.product_id, name: product.name,
      variation: product.variation, price: Number(product.price),
      image: product.image, quantity: qty,
    });
    this.write(items);
    showToast(`${product.name} added to cart!`);
  },
  setQty(id, qty) {
    let items = this.read();
    qty = Math.max(0, Math.min(99, parseInt(qty, 10) || 0));
    if (qty === 0) items = items.filter(i => i.product_id !== id);
    else items.forEach(i => { if (i.product_id === id) i.quantity = qty; });
    this.write(items);
  },
  remove(id) { this.write(this.read().filter(i => i.product_id !== id)); },
  clear() { this.write([]); },
  count() { return this.read().reduce((s, i) => s + i.quantity, 0); },
  total() { return this.read().reduce((s, i) => s + i.price * i.quantity, 0); },
  updateBadge() {
    document.querySelectorAll('.cart-count').forEach(el => {
      const n = this.count();
      el.textContent = n;
      el.style.display = n ? 'inline-flex' : 'none';
    });
  },
};

/* ================= AUTH STATE IN NAVBAR ================= */
async function loadAuthNav() {
  const slot = document.getElementById('auth-nav-slot');
  if (!slot) return;
  try {
    const res = await fetch(API + '/api/me');
    const data = await res.json();
    if (data.user) {
      slot.innerHTML = `
        <a class="nav-link" href="dashboard.html"><i class="fas fa-user"></i> ${data.user.full_name.split(' ')[0]}</a>
        <a class="nav-link" href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</a>`;
      document.getElementById('logout-link').addEventListener('click', async e => {
        e.preventDefault();
        await fetch(API + '/api/logout', { method: 'POST' });
        window.location.href = 'home.html';
      });
      window.sneakrUser = data.user;
    } else {
      slot.innerHTML = `<a class="nav-link" href="login.html"><i class="fas fa-user"></i> Login</a>`;
    }
  } catch { /* server offline - leave default link */ }
}

/* ================= SEARCH BAR ================= */
function initSearchBar() {
  const bar = document.querySelector('.search-bar input');
  const btn = document.querySelector('.search-bar button');
  if (!bar) return;
  const go = () => {
    const q = bar.value.trim();
    if (q) window.location.href = 'catalog.html?search=' + encodeURIComponent(q);
    else window.location.href = 'catalog.html';
  };
  if (btn) btn.addEventListener('click', e => { e.preventDefault(); go(); });
  bar.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}

/* ================= NEWSLETTER FORMS ================= */
function initNewsletter() {
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const email = (input.value || '').trim();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) { showToast('Please enter a valid email address.', 'error'); return; }
      try {
        const res = await fetch(API + '/api/newsletter', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        showToast(res.ok ? data.message : (data.error || (data.errors || [])[0] || 'Subscription failed.'),
                  res.ok ? 'success' : 'error');
        if (res.ok) input.value = '';
      } catch { showToast('Server unavailable - could not subscribe.', 'error'); }
    });
  });
}

/* ============ ADD-TO-CART BUTTONS ON LISTINGS ============
 * On shop pages (nike/air/nb/others/catalog) we match the
 * static .listing cards to DB products by name+variation and
 * inject an "Add to Cart" button next to Order Now.         */
async function initListingCartButtons() {
  const listings = document.querySelectorAll('.listing');
  if (!listings.length) return;
  let products = [];
  try {
    products = await (await fetch(API + '/api/products')).json();
  } catch { return; }

  listings.forEach(card => {
    const nameEl = card.querySelector('.listing-name');
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    const varSpan = Array.from(card.querySelectorAll('.listing-sizes span'))
                          .find(s => s.parentElement.textContent.includes('Variation'));
    const variation = varSpan ? varSpan.textContent.trim() : null;
    const p = products.find(x => x.name.trim().toLowerCase() === name.toLowerCase() &&
      (variation ? (x.variation || '') === variation : true));
    if (!p) return;
    card.dataset.productId = p.product_id;

    const actions = card.querySelector('.listing-actions');
    if (!actions) return;
    const btn = document.createElement('button');
    btn.className = 'add-cart-button';
    btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
    if (p.stock_status === 'out_of_stock') { btn.disabled = true; btn.title = 'Out of stock'; }
    btn.addEventListener('click', () => Cart.add(p, 1));
    actions.appendChild(btn);
  });
}

/* ================= BOOTSTRAP ON EVERY PAGE ================= */
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();
  initSearchBar();
  initNewsletter();
  loadAuthNav();
  initListingCartButtons();
});
