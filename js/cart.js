/* cart.js - shopping cart table with quantity controls,
   dynamic price calculation and checkout (CREATE order). */

const SHIPPING_FEE = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?\d[\d\s-]{6,19})$/;

function setErr(id, msg) {
  const el = document.querySelector(`.field-error[data-for="${id}"]`);
  if (el) el.textContent = msg || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const rowsEl = document.getElementById('cart-rows');
  const emptyEl = document.getElementById('cart-empty');
  const totalEl = document.getElementById('cart-total');
  const shipEl = document.getElementById('shipping');
  const form = document.getElementById('checkout-form');
  const hint = document.getElementById('checkout-login-hint');

  /* ---------- render cart table ---------- */
  function render() {
    const items = Cart.read();
    rowsEl.innerHTML = '';
    if (!items.length) {
      emptyEl.style.display = 'block';
      totalEl.innerHTML = '<strong>' + peso(0) + '</strong>';
      shipEl.textContent = peso(0);
      return;
    }
    emptyEl.style.display = 'none';

    items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cart-item-cell">
          <img src="${it.image || 'logo.jpg'}" alt="${it.name}" class="cart-thumb">
          <div>
            <div class="listing-name">${it.name}</div>
            ${it.variation ? '<small>' + it.variation + '</small>' : ''}
          </div>
        </td>
        <td>${peso(it.price)}</td>
        <td>
          <div class="qty-controls">
            <button class="qty-btn dec" title="Decrease">−</button>
            <input type="number" class="qty-input" min="1" max="99" value="${it.quantity}">
            <button class="qty-btn inc" title="Increase">+</button>
          </div>
        </td>
        <td class="line-subtotal">${peso(it.price * it.quantity)}</td>
        <td><button class="btn btn-sm btn-outline-danger remove-btn" title="Remove"><i class="fas fa-trash"></i></button></td>`;

      const input = tr.querySelector('.qty-input');
      const subtotalCell = tr.querySelector('.line-subtotal');

      const update = qty => {
        qty = parseInt(qty, 10);
        if (isNaN(qty) || qty < 1) qty = 1;
        if (qty > 99) qty = 99;
        Cart.setQty(it.product_id, qty);
        input.value = qty;
        // dynamic price calculation for this line + grand totals
        const newTotal = Cart.total();
        subtotalCell.textContent = peso(it.price * qty);
        renderTotals(newTotal);
        if (!Cart.read().find(i => i.product_id === it.product_id)) render();
      };

      tr.querySelector('.dec').addEventListener('click', () => update(input.value - 1));
      tr.querySelector('.inc').addEventListener('click', () => update(Number(input.value) + 1));
      input.addEventListener('change', () => update(input.value));
      tr.querySelector('.remove-btn').addEventListener('click', () => {
        if (confirm(`Remove ${it.name} from your cart?`)) {
          Cart.remove(it.product_id);
          render();
        }
      });
      rowsEl.appendChild(tr);
    });
    renderTotals(Cart.total());
  }

  function renderTotals(subtotals) {
    shipEl.textContent = subtotals > 0 ? peso(SHIPPING_FEE) : peso(0);
    totalEl.innerHTML = '<strong>' + peso(subtotals + (subtotals > 0 ? SHIPPING_FEE : 0)) + '</strong>';
  }

  /* ---------- auth check for checkout ---------- */
  let user = null;
  try { user = (await (await fetch('/api/me')).json()).user; } catch { /* offline */ }
  if (user) {
    hint.style.display = 'none';
    form.style.display = 'block';
    const nameEl = document.getElementById('ship-name');
    nameEl.value = user.full_name;
    if (user.phone) document.getElementById('ship-phone').value = user.phone;
  }

  /* ---------- place order ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    ['ship-name', 'ship-address', 'ship-phone'].forEach(id => setErr(id, ''));
    const name = document.getElementById('ship-name').value.trim();
    const addr = document.getElementById('ship-address').value.trim();
    const phone = document.getElementById('ship-phone').value.trim();

    let ok = true;
    if (name.length < 2) { setErr('ship-name', 'Full name is required.'); ok = false; }
    if (addr.length < 10) { setErr('ship-address', 'Please enter a complete delivery address.'); ok = false; }
    if (!PHONE_RE.test(phone)) { setErr('ship-phone', 'Invalid phone number format.'); ok = false; }
    const items = Cart.read();
    if (!items.length) { showToast('Your cart is empty.', 'error'); return; }
    if (!ok) return;

    if (!confirm(`Place order of ${peso(Cart.total() + SHIPPING_FEE)}?`)) return;

    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.product_id, quantity: i.quantity })),
          shipping: { name, address: addr, phone },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast((data.errors || [data.error || 'Order failed.']).join(' '), 'error');
        return;
      }
      Cart.clear();
      render();
      showToast(`Order #${data.orderId} placed successfully! Total: ${peso(data.total + SHIPPING_FEE)}`);
      setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } catch {
      showToast('Server unavailable - could not place order.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  render();
});
