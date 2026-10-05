/* admin.js - Administrator dashboard:
   full CRUD for products, order status updates, reservation
   management (cancel/reschedule) and customer management. */

document.addEventListener('DOMContentLoaded', async () => {
  /* guard: only admins may view this page */
  let user = null;
  try { user = (await (await fetch('/api/me')).json()).user; } catch { /* offline */ }
  if (!user) { window.location.href = 'login.html'; return; }
  if (!user.is_admin) { showToast('Administrator access required.', 'error');
                        window.location.href = 'dashboard.html'; return; }

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  function setErr(id, msg) {
    const el = document.querySelector(`.field-error[data-for="${id}"]`);
    if (el) el.textContent = msg || '';
  }
  async function postJson(url, method, body) {
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }
  const errMsg = d => d.error || (d.errors || []).join(' ') || 'Request failed.';

  /* ---------------- tabs ---------------- */
  document.querySelectorAll('.admin-tabs .nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.admin-tabs .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
      document.getElementById('tab-' + link.dataset.tab).style.display = 'block';
      loadTab(link.dataset.tab);
    });
  });
  function loadTab(tab) {
    if (tab === 'products') loadProducts();
    if (tab === 'orders') loadOrders();
    if (tab === 'reservations') loadReservations();
    if (tab === 'customers') loadCustomers();
  }

  /* ================= PRODUCTS (C/R/U/D) ================= */
  const catSel = document.getElementById('pd-cat');
  try {
    const cats = await (await fetch('/api/categories')).json();
    catSel.innerHTML = cats.map(c => `<option value="${c.category_id}">${esc(c.name)}</option>`).join('');
  } catch { /* ignore */ }

  const form = document.getElementById('product-form');
  let editingId = null;

  document.getElementById('new-product-btn').addEventListener('click', () => {
    editingId = null;
    form.reset();
    document.getElementById('product-form-title').textContent = 'Add Product';
    form.style.display = 'block';
  });
  document.getElementById('cancel-product-btn').addEventListener('click', () => form.style.display = 'none');

  async function loadProducts() {
    const body = document.getElementById('products-body');
    try {
      const prods = await (await fetch('/api/products')).json();
      body.innerHTML = prods.map(p => `
        <tr>
          <td>${p.product_id}</td>
          <td>${esc(p.name)} ${p.variation ? '<small>(' + esc(p.variation) + ')</small>' : ''}</td>
          <td>${esc(p.category_name)}</td>
          <td>${peso(p.price)}</td>
          <td><span class="status-badge ${p.stock_status === 'in_stock' ? 'status-confirmed' : 'status-cancelled'}">
                ${p.stock_status === 'in_stock' ? 'in stock' : 'out of stock'}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-primary edit-p" data-id="${p.product_id}"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline-danger del-p" data-id="${p.product_id}" data-name="${esc(p.name)}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`).join('');

      body.querySelectorAll('.edit-p').forEach(b => b.addEventListener('click', () => {
        const p = prods.find(x => x.product_id === Number(b.dataset.id));
        editingId = p.product_id;
        document.getElementById('product-form-title').textContent = 'Edit Product #' + p.product_id;
        document.getElementById('pd-name').value = p.name;
        document.getElementById('pd-cat').value = p.category_id;
        document.getElementById('pd-price').value = p.price;
        document.getElementById('pd-var').value = p.variation || '';
        document.getElementById('pd-sizes').value = p.sizes || '';
        document.getElementById('pd-img').value = p.image || '';
        document.getElementById('pd-desc').value = p.description || '';
        document.getElementById('pd-stock').value = p.stock_status;
        document.getElementById('pd-featured').checked = !!p.featured;
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth' });
      }));

      body.querySelectorAll('.del-p').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`Delete "${b.dataset.name}"? This also removes it from past order lines.`)) return;
        const r = await postJson('/api/products/' + b.dataset.id, 'DELETE');
        showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
        if (r.ok) loadProducts();
      }));
    } catch { body.innerHTML = '<tr><td colspan="6">Could not load products.</td></tr>'; }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    ['pd-name','pd-cat','pd-price'].forEach(id => setErr(id, ''));
    const name = document.getElementById('pd-name').value.trim();
    const price = document.getElementById('pd-price').value;
    let ok = true;
    if (!name) { setErr('pd-name', 'Product name is required.'); ok = false; }
    if (price === '' || Number(price) < 0 || isNaN(Number(price))) {
      setErr('pd-price', 'A valid non-negative price is required.'); ok = false;
    }
    if (!ok) return;

    const payload = {
      name, category_id: Number(catSel.value), price: Number(price),
      variation: document.getElementById('pd-var').value.trim(),
      sizes: document.getElementById('pd-sizes').value.trim(),
      image: document.getElementById('pd-img').value.trim(),
      description: document.getElementById('pd-desc').value.trim(),
      stock_status: document.getElementById('pd-stock').value,
      featured: document.getElementById('pd-featured').checked,
    };
    const r = editingId
      ? await postJson('/api/products/' + editingId, 'PUT', payload)
      : await postJson('/api/products', 'POST', payload);
    showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
    if (r.ok) { form.style.display = 'none'; loadProducts(); }
  });

  /* ================= ORDERS (R/U/D) ================= */
  async function loadOrders() {
    const body = document.getElementById('admin-orders-body');
    try {
      const orders = await (await fetch('/api/admin/orders')).json();
      if (!orders.length) { body.innerHTML = '<tr><td colspan="7" class="text-center">No orders yet.</td></tr>'; return; }
      const allowed = ['pending','confirmed','shipped','cancelled'];
      body.innerHTML = orders.map(o => `
        <tr>
          <td>#${o.order_id}</td>
          <td>${esc(o.customer_name)}</td>
          <td>${new Date(o.ordered_at).toLocaleDateString('en-PH')}</td>
          <td><ul class="order-items-list">${o.items.map(i => `<li>${i.quantity} × ${esc(i.name)}</li>`).join('')}</ul></td>
          <td>${peso(Number(o.total_amount) + 200)}</td>
          <td>
            <select class="status-select" data-id="${o.order_id}">
              ${allowed.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td><button class="btn btn-sm btn-outline-danger del-o" data-id="${o.order_id}"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('');

      body.querySelectorAll('.status-select').forEach(sel =>
        sel.addEventListener('change', async () => {
          const r = await postJson(`/api/admin/orders/${sel.dataset.id}/status`, 'PUT', { status: sel.value });
          showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
        }));
      body.querySelectorAll('.del-o').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`Delete order #${b.dataset.id}?`)) return;
        const r = await postJson('/api/orders/' + b.dataset.id, 'DELETE');
        showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
        if (r.ok) loadOrders();
      }));
    } catch { body.innerHTML = '<tr><td colspan="7">Could not load orders.</td></tr>'; }
  }

  /* ================ RESERVATIONS (R/U/D) ================ */
  async function loadReservations() {
    const body = document.getElementById('reservations-body');
    try {
      const rs = await (await fetch('/api/admin/reservations')).json();
      if (!rs.length) { body.innerHTML = '<tr><td colspan="7" class="text-center">No reservations yet.</td></tr>'; return; }
      body.innerHTML = rs.map(r => `
        <tr class="${r.status === 'cancelled' ? 'row-cancelled' : ''}">
          <td>#${r.reservation_id}</td>
          <td>${esc(r.full_name)}</td>
          <td>${esc(r.email)}</td>
          <td>${esc(r.shoe_model)}</td>
          <td><input type="date" class="res-date" data-id="${r.reservation_id}" value="${String(r.reserved_date).slice(0,10)}"></td>
          <td><span class="status-badge ${r.status === 'active' ? 'status-confirmed' : 'status-cancelled'}">${r.status}</span></td>
          <td>
            ${r.status === 'active'
              ? `<button class="btn btn-sm btn-outline-warning cancel-r" data-id="${r.reservation_id}">Cancel</button>`
              : ''}
            <button class="btn btn-sm btn-outline-danger del-r" data-id="${r.reservation_id}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`).join('');

      body.querySelectorAll('.cancel-r').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`Cancel reservation #${b.dataset.id}?`)) return;
        const r = await postJson('/api/admin/reservations/' + b.dataset.id, 'PUT', { status: 'cancelled' });
        showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
        if (r.ok) loadReservations();
      }));
      body.querySelectorAll('.res-date').forEach(inp => inp.addEventListener('change', async () => {
        if (!inp.value) return;
        const r = await postJson('/api/admin/reservations/' + inp.dataset.id, 'PUT', { reserved_date: inp.value });
        showToast(r.ok ? 'Reservation rescheduled.' : errMsg(r.data), r.ok ? 'success' : 'error');
        if (r.ok) loadReservations();
      }));
      body.querySelectorAll('.del-r').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`Delete reservation #${b.dataset.id}?`)) return;
        const r = await postJson('/api/admin/reservations/' + b.dataset.id, 'DELETE');
        showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
        if (r.ok) loadReservations();
      }));
    } catch { body.innerHTML = '<tr><td colspan="7">Could not load reservations.</td></tr>'; }
  }

  /* ================= CUSTOMERS (R/U/D) ================= */
  async function loadCustomers() {
    const body = document.getElementById('customers-body');
    try {
      const cs = await (await fetch('/api/admin/customers')).json();
      body.innerHTML = cs.map(c => `
        <tr>
          <td>${c.customer_id}</td>
          <td><input type="text" class="cu-name" value="${esc(c.full_name)}" data-id="${c.customer_id}"></td>
          <td><input type="email" class="cu-email" value="${esc(c.email)}" data-id="${c.customer_id}"></td>
          <td><input type="text" class="cu-phone" value="${esc(c.phone || '')}" data-id="${c.customer_id}"></td>
          <td>${c.is_admin ? '<span class="badge badge-dark">admin</span>' : '<span class="badge badge-light">customer</span>'}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary save-c" data-id="${c.customer_id}">Save</button>
            ${c.is_admin ? '' : `<button class="btn btn-sm btn-outline-danger del-c" data-id="${c.customer_id}" data-name="${esc(c.full_name)}"><i class="fas fa-trash"></i></button>`}
          </td>
        </tr>`).join('');

      body.querySelectorAll('.save-c').forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const payload = {
          full_name: body.querySelector(`.cu-name[data-id="${id}"]`).value.trim(),
          email: body.querySelector(`.cu-email[data-id="${id}"]`).value.trim(),
          phone: body.querySelector(`.cu-phone[data-id="${id}"]`).value.trim(),
        };
        const r = await postJson('/api/admin/customers/' + id, 'PUT', payload);
        showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
      }));
      body.querySelectorAll('.del-c').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`Delete customer "${b.dataset.name}" and all their orders?`)) return;
        const r = await postJson('/api/admin/customers/' + b.dataset.id, 'DELETE');
        showToast(r.ok ? r.data.message : errMsg(r.data), r.ok ? 'success' : 'error');
        if (r.ok) loadCustomers();
      }));
    } catch { body.innerHTML = '<tr><td colspan="6">Could not load customers.</td></tr>'; }
  }

  loadTab('products');
});
