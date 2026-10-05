/* dashboard.js - customer area: profile update (UPDATE) and
   order history with cancel option (READ / DELETE). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?\d[\d\s-]{6,19})$/;

function setErr(id, msg) {
  const el = document.querySelector(`.field-error[data-for="${id}"]`);
  if (el) el.textContent = msg || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  /* redirect to login when not authenticated */
  let user = null;
  try { user = (await (await fetch('/api/me')).json()).user; } catch { /* offline */ }
  if (!user) { window.location.href = 'login.html'; return; }

  /* ---------- profile form ---------- */
  const pf = document.getElementById('profile-form');
  document.getElementById('pf-name').value = user.full_name;
  document.getElementById('pf-email').value = user.email;
  document.getElementById('pf-phone').value = user.phone || '';

  pf.addEventListener('submit', async e => {
    e.preventDefault();
    ['pf-name','pf-email','pf-phone'].forEach(id => setErr(id, ''));
    const name = document.getElementById('pf-name').value.trim();
    const email = document.getElementById('pf-email').value.trim();
    const phone = document.getElementById('pf-phone').value.trim();
    let ok = true;
    if (name.length < 2) { setErr('pf-name', 'Full name is required.'); ok = false; }
    if (!EMAIL_RE.test(email)) { setErr('pf-email', 'Invalid email format.'); ok = false; }
    if (phone && !PHONE_RE.test(phone)) { setErr('pf-phone', 'Invalid phone number.'); ok = false; }
    if (!ok) return;

    const res = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, email, phone }),
    });
    const data = await res.json();
    showToast(res.ok ? 'Profile updated!' : (data.error || (data.errors || []).join(' ')),
              res.ok ? 'success' : 'error');
  });

  /* ---------- orders table ---------- */
  async function loadOrders() {
    const body = document.getElementById('orders-body');
    const empty = document.getElementById('no-orders');
    try {
      const orders = await (await fetch('/api/orders')).json();
      if (!orders.length) {
        body.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';
      body.innerHTML = orders.map(o => `
        <tr>
          <td>#${o.order_id}</td>
          <td>${new Date(o.ordered_at).toLocaleDateString('en-PH')}</td>
          <td>
            <ul class="order-items-list">
              ${o.items.map(i => `<li>${i.quantity} × ${i.name}</li>`).join('')}
            </ul>
          </td>
          <td>${peso(Number(o.total_amount) + 200)}</td>
          <td><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td>
            ${o.status === 'pending'
              ? `<button class="btn btn-sm btn-outline-danger cancel-btn" data-id="${o.order_id}">Cancel</button>`
              : '—'}
          </td>
        </tr>`).join('');

      body.querySelectorAll('.cancel-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          if (!confirm(`Cancel order #${btn.dataset.id}?`)) return;
          const res = await fetch('/api/orders/' + btn.dataset.id, { method: 'DELETE' });
          const data = await res.json();
          showToast(res.ok ? data.message : (data.error || (data.errors || []).join(' ')),
                    res.ok ? 'success' : 'error');
          loadOrders();
        }));
    } catch {
      body.innerHTML = '<tr><td colspan="6" class="text-center">Could not load orders.</td></tr>';
    }
  }
  loadOrders();
});
