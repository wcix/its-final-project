/* catalog.js - dynamic product catalog with search,
   category filtering and price sorting (READ from MySQL). */

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('catalog-grid');
  const catSel = document.getElementById('cat-filter');
  const sortSel = document.getElementById('price-sort');
  const status = document.getElementById('catalog-status');

  // ?search=... coming from the navbar search bar
  const params = new URLSearchParams(window.location.search);
  const initialSearch = params.get('search') || '';
  const searchBox = document.querySelector('.search-bar input');
  if (searchBox && initialSearch) searchBox.value = initialSearch;

  /* load categories for the filter dropdown */
  try {
    const cats = await (await fetch('/api/categories')).json();
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c.category_id; o.textContent = c.name;
      catSel.appendChild(o);
    });
  } catch { /* ignore */ }

  async function render() {
    grid.innerHTML = '<p class="text-center w-100">Loading…</p>';
    let url = '/api/products?';
    if (catSel.value) url += 'category=' + encodeURIComponent(catSel.value) + '&';
    if (initialSearch) url += 'search=' + encodeURIComponent(initialSearch) + '&';
    let products;
    try {
      products = await (await fetch(url)).json();
    } catch {
      grid.innerHTML = '<p class="text-center w-100">Could not reach the server. Run <code>node server.js</code>.</p>';
      return;
    }
    if (sortSel.value === 'asc') products.sort((a, b) => a.price - b.price);
    if (sortSel.value === 'desc') products.sort((a, b) => b.price - a.price);

    status.textContent = `${products.length} product(s)` + (initialSearch ? ` matching “${initialSearch}”` : '');

    if (!products.length) {
      grid.innerHTML = '<p class="text-center w-100">No products found.</p>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <div class="listing catalog-card">
        <div class="listing-image">
          <img src="${p.image || 'logo.jpg'}" alt="${escapeHtml(p.name)}">
        </div>
        <div class="listing-details">
          <div class="listing-name">${escapeHtml(p.name)}</div>
          <div class="listing-sizes">
            ${p.category_name} ${p.variation ? '· <span>' + escapeHtml(p.variation) + '</span>' : ''}
            ${p.sizes ? '<br>Sizes (US): <span>' + escapeHtml(p.sizes) + '</span>' : ''}
          </div>
          <div class="listing-description">${escapeHtml(p.description || '')}</div>
          ${p.stock_status === 'out_of_stock'
              ? '<div class="alert alert-danger">Out of stock!</div>' : ''}
          <div class="listing-price">${peso(p.price)}</div>
          <div class="listing-actions">
            <button class="add-cart-button" data-id="${p.product_id}"
              ${p.stock_status === 'out_of_stock' ? 'disabled' : ''}>
              <i class="fas fa-shopping-cart"></i> Add to Cart
            </button>
          </div>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.add-cart-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = products.find(x => x.product_id === Number(btn.dataset.id));
        if (p) Cart.add(p, 1);
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  catSel.addEventListener('change', render);
  sortSel.addEventListener('change', render);
  render();
});
