/* login.js - client-side validation + API calls for
   the Login and Registration forms on login.html */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?\d[\d\s-]{6,19})$/;

function setErr(id, msg) {
  const el = document.querySelector(`.field-error[data-for="${id}"]`);
  if (el) el.textContent = msg || '';
  const input = document.getElementById(id);
  if (input) input.classList.toggle('is-invalid', !!msg);
}

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------- LOGIN ---------------- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    let ok = true;
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    setErr('login-email', ''); setErr('login-password', '');
    if (!email) { setErr('login-email', 'Email is required.'); ok = false; }
    else if (!EMAIL_RE.test(email)) { setErr('login-email', 'Please use a valid email format.'); ok = false; }
    if (!password) { setErr('login-password', 'Password is required.'); ok = false; }
    if (!ok) return;

    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || (data.errors || []).join(' ');
        setErr('login-email', msg);
        showToast(msg, 'error');
        return;
      }
      showToast('Welcome back, ' + data.user.fullName + '!');
      setTimeout(() => window.location.href = data.user.isAdmin ? 'admin.html' : 'dashboard.html', 800);
    } catch { showToast('Server unavailable. Is server.js running?', 'error'); }
  });

  /* -------------- REGISTER --------------- */
  const regForm = document.getElementById('register-form');
  if (regForm) regForm.addEventListener('submit', async e => {
    e.preventDefault();
    ['reg-name','reg-email','reg-phone','reg-password','reg-confirm'].forEach(id => setErr(id, ''));
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pw = document.getElementById('reg-password').value;
    const cf = document.getElementById('reg-confirm').value;

    let ok = true;
    if (name.length < 2) { setErr('reg-name', 'Full name is required (min 2 characters).'); ok = false; }
    if (!email) { setErr('reg-email', 'Email is required.'); ok = false; }
    else if (!EMAIL_RE.test(email)) { setErr('reg-email', 'Invalid email format.'); ok = false; }
    if (phone && !PHONE_RE.test(phone)) { setErr('reg-phone', 'Invalid phone number format.'); ok = false; }
    if (pw.length < 6) { setErr('reg-password', 'Password must be at least 6 characters.'); ok = false; }
    if (cf !== pw) { setErr('reg-confirm', 'Passwords do not match.'); ok = false; }
    if (!ok) return;

    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, email, phone, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast((data.errors || [data.error || 'Registration failed.']).join(' '), 'error');
        return;
      }
      showToast('Account created! Please log in.');
      // auto-fill login with the new credentials
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = pw;
    } catch { showToast('Server unavailable. Is server.js running?', 'error'); }
  });
});
