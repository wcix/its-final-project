/* confirmation.js - reads the most recent saved order from
   MySQL (via /api/orders) and displays the confirmation. */

document.addEventListener('DOMContentLoaded', async () => {
  const itemsEl = document.getElementById('confirm-items');
  const totalEl = document.getElementById('c-total');
  const title = document.getElementById('confirm-title');
  const text = document.getElementById('confirm-text');

  try {
    const orders = await (await fetch('/api/orders')).json();
    if (!orders.length) {
      title.textContent = 'No recent order found';
      text.textContent = 'Place an order from your cart first.';
      document.getElementById('confirm-table').style.display = 'none';
      return;
    }
    const o = orders[0]; // most recent
    title.innerHTML = `Order <strong>#${o.order_id}</strong> confirmed!`;
    text.textContent = `Placed on ${new Date(o.ordered_at).toLocaleString('en-PH')} — status: ${o.status}. A copy of this order is saved in our database.`;
    let sub = 0;
    itemsEl.innerHTML = o.items.map(i => {
      const line = Number(i.unit_price) * i.quantity; sub += line;
      return `<tr>
        <td>${i.name}${i.variation ? ' (' + i.variation + ')' : ''}</td>
        <td>${i.quantity}</td>
        <td>${peso(i.unit_price)}</td>
        <td>${peso(line)}</td></tr>`;
    }).join('');
    totalEl.innerHTML = '<strong>' + peso(sub + 200) + '</strong>';
  } catch {
    title.textContent = 'Could not load your order';
    text.textContent = 'Please make sure the server is running, then check your dashboard.';
    document.getElementById('confirm-table').style.display = 'none';
  }
});
