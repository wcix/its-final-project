/* contact.js - client-side validation + server save for the
   "Reserve a Shoe" form on contact.html (CREATE reservation). */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reservation-form');
  if (!form) return;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');
  const modelEl = document.getElementById('shoe-model');
  const dateEl = document.getElementById('reserve-date');

  // min pick-up date = tomorrow
  const t = new Date(); t.setDate(t.getDate() + 1);
  dateEl.min = t.toISOString().slice(0, 10);

  // datalist of current shoe models from MySQL (nice-to-have)
  fetch('/api/products').then(r => r.json()).then(prods => {
    const dl = document.getElementById('model-list');
    dl.innerHTML = prods.map(p =>
      `<option value="${p.name}${p.variation ? ' ' + p.variation : ''}">`).join('');
  }).catch(() => { /* offline: datalist stays empty */ });

  function setErr(id, msg) {
    const el = document.querySelector(`.field-error[data-for="${id}"]`);
    if (el) el.textContent = msg || '';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    ['name','email','shoe-model','reserve-date'].forEach(id => setErr(id, ''));
    let ok = true;
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const model = modelEl.value.trim();
    const date = dateEl.value;

    if (name.length < 2) { setErr('name', 'Please enter your full name.'); ok = false; }
    if (!EMAIL_RE.test(email)) { setErr('email', 'Please enter a valid email address.'); ok = false; }
    if (!model) { setErr('shoe-model', 'Please enter the shoe model you want to reserve.'); ok = false; }
    if (!date) { setErr('reserve-date', 'Please choose a pick-up date.'); ok = false; }
    else if (new Date(date) < new Date(new Date().toDateString())) {
      setErr('reserve-date', 'Pick-up date cannot be in the past.'); ok = false;
    }
    if (!ok) return;

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name, email, shoe_model: model, reserved_date: date,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast((data.errors || [data.error || 'Reservation failed.']).join(' '), 'error');
        return;
      }
      showToast(`Reservation #${data.reservationId} saved! See you on ${date}.`);
      form.reset();
    } catch {
      showToast('Server unavailable - could not save reservation.', 'error');
    }
  });
});
