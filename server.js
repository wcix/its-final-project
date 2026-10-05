/* ============================================================
 * Sneakr.mnl - Back End (Node.js + Express + MySQL)
 *
 * Serves the existing static front-end pages and exposes a
 * REST API (/api/...) that performs full CRUD operations on
 * the MySQL database `sneakr_mnl`.
 *
 * Run:  node server.js          (default port 3000)
 * Env:  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, PORT
 * ============================================================ */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

/* --------------------- Database pool --------------------- */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sneakr_mnl',
  waitForConnections: true,
  connectionLimit: 10,
});

/* ----------------------- Middleware ---------------------- */
app.use(express.json());               // parse JSON bodies from fetch()
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());               // read the simple auth cookie
app.use(express.static(__dirname));    // home.html, nike.html, style.css, images...

/* Simple cookie "session": stores an opaque base64 token of the
   customer id.  Password hash is never exposed to the client.   */
function currentUser(req) {
  const token = req.cookies.sneakr_session;
  if (!token) return null;
  try {
    const id = parseInt(Buffer.from(token, 'base64').toString('utf8'), 10);
    return Number.isInteger(id) ? id : null;
  } catch { return null; }
}

function requireLogin(req, res, next) {
  const id = currentUser(req);
  if (!id) return res.status(401).json({ error: 'You must be logged in for this action.' });
  req.customerId = id;
  next();
}

async function requireAdmin(req, res, next) {
  const id = currentUser(req);
  if (!id) return res.status(401).json({ error: 'You must be logged in for this action.' });
  const [rows] = await pool.query(
    'SELECT is_admin FROM customers WHERE customer_id = ?', [id]);
  if (!rows.length || !rows[0].is_admin)
    return res.status(403).json({ error: 'Administrator access required.' });
  req.customerId = id;
  next();
}

/* -------------------- Validation helpers ------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?\d[\d\s-]{6,19})$/;

function validateCustomerBody(b, { requirePassword = true } = {}) {
  const errors = [];
  if (!b.full_name || String(b.full_name).trim().length < 2)
    errors.push('Full name is required (at least 2 characters).');
  if (!b.email || !EMAIL_RE.test(String(b.email).trim()))
    errors.push('A valid email address is required (e.g. name@example.com).');
  if (b.phone && !PHONE_RE.test(String(b.phone).trim()))
    errors.push('Phone number must contain digits and may start with + (e.g. +63 917 123 4567).');
  if (requirePassword && (!b.password || String(b.password).length < 6))
    errors.push('Password is required and must be at least 6 characters.');
  return errors;
}

function validateProductBody(b) {
  const errors = [];
  if (!b.name || !String(b.name).trim()) errors.push('Product name is required.');
  if (b.category_id === undefined || !Number.isInteger(Number(b.category_id)))
    errors.push('A valid category is required.');
  if (b.price === undefined || isNaN(Number(b.price)) || Number(b.price) < 0)
    errors.push('Price is required and cannot be negative.');
  if (b.stock_status && !['in_stock', 'out_of_stock'].includes(b.stock_status))
    errors.push("Stock status must be 'in_stock' or 'out_of_stock'.");
  return errors;
}

function validateReservationBody(b) {
  const errors = [];
  if (!b.full_name || String(b.full_name).trim().length < 2)
    errors.push('Name is required.');
  if (!b.email || !EMAIL_RE.test(String(b.email).trim()))
    errors.push('A valid email address is required.');
  if (!b.shoe_model || !String(b.shoe_model).trim())
    errors.push('Shoe model is required.');
  if (!b.reserved_date) {
    errors.push('Pick-up / reservation date is required.');
  } else {
    const d = new Date(b.reserved_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime())) errors.push('Reservation date is not a valid date.');
    else if (d < today) errors.push('Reservation date cannot be in the past.');
  }
  return errors;
}

/* =================== AUTH endpoints ====================== */

// CREATE + READ: register a new customer
app.post('/api/register', async (req, res) => {
  try {
    const errors = validateCustomerBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const [dup] = await pool.query('SELECT customer_id FROM customers WHERE email = ?',
      [req.body.email.trim()]);
    if (dup.length) return res.status(409).json({ errors: ['That email is already registered.'] });

    const hash = await bcrypt.hash(req.body.password, 10);
    const [r] = await pool.query(
      'INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?,?,?,?)',
      [req.body.full_name.trim(), req.body.email.trim(), req.body.phone ? req.body.phone.trim() : null, hash]);
    res.status(201).json({ message: 'Registration successful!', customerId: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error during registration.' }); }
});

// Login (creates the session cookie)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !EMAIL_RE.test(String(email).trim()))
      return res.status(400).json({ errors: ['A valid email address is required.'] });
    if (!password) return res.status(400).json({ errors: ['Password is required.'] });

    const [rows] = await pool.query('SELECT * FROM customers WHERE email = ?', [email.trim()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password.' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    res.cookie('sneakr_session',
      Buffer.from(String(rows[0].customer_id)).toString('base64'),
      { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.json({
      message: 'Logged in!',
      user: {
        customerId: rows[0].customer_id, fullName: rows[0].full_name,
        email: rows[0].email, isAdmin: !!rows[0].is_admin,
      },
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error during login.' }); }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('sneakr_session');
  res.json({ message: 'Logged out.' });
});

// READ: who am I?
app.get('/api/me', async (req, res) => {
  const id = currentUser(req);
  if (!id) return res.json({ user: null });
  const [rows] = await pool.query(
    'SELECT customer_id, full_name, email, phone, is_admin FROM customers WHERE customer_id = ?', [id]);
  res.json({ user: rows[0] || null });
});

/* ================== PRODUCT endpoints ==================== */

// READ products (optional ?category=N & ?search=text)
app.get('/api/products', async (req, res) => {
  try {
    let sql = `SELECT p.*, c.name AS category_name FROM products p
               JOIN categories c ON c.category_id = p.category_id WHERE 1=1`;
    const params = [];
    if (req.query.category) { sql += ' AND p.category_id = ?'; params.push(req.query.category); }
    if (req.query.search) {
      sql += ' AND (p.name LIKE ? OR p.variation LIKE ? OR c.name LIKE ?)';
      const like = `%${req.query.search}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY p.product_id';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load products.' }); }
});

// READ one product
app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Could not load product.' }); }
});

// CREATE product (admin)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const errors = validateProductBody(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const b = req.body;
    const [r] = await pool.query(
      `INSERT INTO products (category_id,name,variation,sizes,description,price,image,stock_status,featured)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [Number(b.category_id), b.name.trim(), b.variation || null, b.sizes || null,
       b.description || null, Number(b.price), b.image || null,
       b.stock_status || 'in_stock', b.featured ? 1 : 0]);
    res.status(201).json({ message: 'Product added.', productId: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not add product.' }); }
});

// UPDATE product (admin)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const errors = validateProductBody(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const b = req.body;
    const [r] = await pool.query(
      `UPDATE products SET category_id=?, name=?, variation=?, sizes=?, description=?,
       price=?, image=?, stock_status=?, featured=? WHERE product_id=?`,
      [Number(b.category_id), b.name.trim(), b.variation || null, b.sizes || null,
       b.description || null, Number(b.price), b.image || null,
       b.stock_status || 'in_stock', b.featured ? 1 : 0, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product updated.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not update product.' }); }
});

// DELETE product (admin)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not delete product.' }); }
});

// READ categories
app.get('/api/categories', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Could not load categories.' }); }
});

/* =================== CART / ORDERS ======================= */

// Server-side price verification: recompute totals from the DB
// so tampered client prices are ignored.
app.post('/api/orders', requireLogin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ errors: ['Your cart is empty.'] });

    for (const it of items) {
      if (!Number.isInteger(Number(it.productId)) || Number(it.quantity) < 1 || Number(it.quantity) > 99)
        return res.status(400).json({ errors: ['Every order line needs a valid product and a quantity between 1 and 99.'] });
    }

    await conn.beginTransaction();
    let total = 0;
    const verified = [];
    for (const it of items) {
      const [rows] = await conn.query('SELECT * FROM products WHERE product_id = ?', [it.productId]);
      if (!rows.length) throw Object.assign(new Error('A product in your cart no longer exists.'), { code: 400 });
      if (rows[0].stock_status === 'out_of_stock')
        throw Object.assign(new Error(`${rows[0].name} is out of stock.`), { code: 400 });
      const unit = Number(rows[0].price);
      total += unit * Number(it.quantity);
      verified.push({ productId: it.productId, quantity: Number(it.quantity), unit });
    }

    const [r] = await conn.query(
      'INSERT INTO orders (customer_id, total_amount, status) VALUES (?,?,"pending")',
      [req.customerId, total.toFixed(2)]);
    for (const v of verified) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?,?,?,?)',
        [r.insertId, v.productId, v.quantity, v.unit]);
    }
    await conn.commit();
    res.status(201).json({ message: 'Order placed successfully!', orderId: r.insertId, total });
  } catch (e) {
    await conn.rollback();
    if (e.code === 400) return res.status(400).json({ errors: [e.message] });
    console.error(e); res.status(500).json({ error: 'Could not place order.' });
  } finally { conn.release(); }
});

// READ own orders (with items) - customer dashboard
app.get('/api/orders', requireLogin, async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, c.full_name AS customer_name FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       WHERE o.customer_id = ? ORDER BY o.ordered_at DESC`, [req.customerId]);
    const [items] = await pool.query(
      `SELECT oi.order_id, oi.quantity, oi.unit_price, p.name, p.image
       FROM order_items oi JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id IN (SELECT order_id FROM orders WHERE customer_id = ?)`,
      [req.customerId]);
    res.json(orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.order_id) })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load orders.' }); }
});

// READ all orders (admin)
app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, c.full_name AS customer_name FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id ORDER BY o.ordered_at DESC`);
    const [items] = await pool.query(
      `SELECT oi.order_id, oi.quantity, oi.unit_price, p.name FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id`);
    res.json(orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.order_id) })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load orders.' }); }
});

// UPDATE order status (admin)
app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const allowed = ['pending', 'confirmed', 'shipped', 'cancelled'];
    if (!allowed.includes(req.body.status))
      return res.status(400).json({ errors: [`Status must be one of: ${allowed.join(', ')}.`] });
    const [r] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?',
      [req.body.status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Order not found.' });
    res.json({ message: 'Order status updated.' });
  } catch (e) { res.status(500).json({ error: 'Could not update order.' }); }
});

// DELETE order (customer cancels own pending order, admin deletes any)
app.delete('/api/orders/:id', requireLogin, async (req, res) => {
  try {
    const [me] = await pool.query('SELECT is_admin FROM customers WHERE customer_id = ?', [req.customerId]);
    const admin = me.length && me[0].is_admin;
    const [own] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [req.params.id]);
    if (!own.length) return res.status(404).json({ error: 'Order not found.' });
    if (!admin && own[0].customer_id !== req.customerId)
      return res.status(403).json({ error: 'You can only cancel your own orders.' });
    if (!admin && own[0].status !== 'pending')
      return res.status(400).json({ errors: ['Only pending orders can be cancelled.'] });
    await pool.query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
    res.json({ message: admin ? 'Order deleted.' : 'Order cancelled.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not delete order.' }); }
});

/* ================= CUSTOMER CRUD (admin) ================= */

// READ all customers
app.get('/api/admin/customers', requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT customer_id, full_name, email, phone, is_admin, created_at FROM customers ORDER BY customer_id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Could not load customers.' }); }
});

// UPDATE own profile
app.put('/api/profile', requireLogin, async (req, res) => {
  try {
    const errors = validateCustomerBody({ ...req.body, password: 'x'.repeat(6) }, { requirePassword: false });
    if (errors.length) return res.status(400).json({ errors });
    const [r] = await pool.query(
      'UPDATE customers SET full_name=?, email=?, phone=? WHERE customer_id=?',
      [req.body.full_name.trim(), req.body.email.trim(),
       req.body.phone ? req.body.phone.trim() : null, req.customerId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Profile updated.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not update profile.' }); }
});

// UPDATE a customer (admin)
app.put('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  try {
    const errors = validateCustomerBody(req.body, { requirePassword: false });
    if (errors.length) return res.status(400).json({ errors });
    const [r] = await pool.query(
      'UPDATE customers SET full_name=?, email=?, phone=? WHERE customer_id=?',
      [req.body.full_name.trim(), req.body.email.trim(),
       req.body.phone ? req.body.phone.trim() : null, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Customer updated.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ errors: ['That email is already used.'] });
    console.error(e); res.status(500).json({ error: 'Could not update customer.' });
  }
});

// DELETE a customer (admin)
app.delete('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.customerId)
      return res.status(400).json({ errors: ['You cannot delete your own admin account.'] });
    const [r] = await pool.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Customer deleted.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not delete customer.' }); }
});

/* ==================== RESERVATIONS ======================== */

// CREATE reservation (public form on contact.html)
app.post('/api/reservations', async (req, res) => {
  try {
    const errors = validateReservationBody(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const [r] = await pool.query(
      'INSERT INTO reservations (full_name, email, shoe_model, reserved_date) VALUES (?,?,?,?)',
      [req.body.full_name.trim(), req.body.email.trim(),
       req.body.shoe_model.trim(), req.body.reserved_date]);
    res.status(201).json({ message: 'Reservation saved successfully!', reservationId: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not save reservation.' }); }
});

// READ reservations (admin)
app.get('/api/admin/reservations', requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Could not load reservations.' }); }
});

// UPDATE reservation status - cancel/reschedule (admin)
app.put('/api/admin/reservations/:id', requireAdmin, async (req, res) => {
  try {
    const fields = [];
    const params = [];
    if (req.body.status) {
      if (!['active', 'cancelled'].includes(req.body.status))
        return res.status(400).json({ errors: ['Status must be active or cancelled.'] });
      fields.push('status=?'); params.push(req.body.status);
    }
    if (req.body.reserved_date) {
      if (isNaN(new Date(req.body.reserved_date).getTime()))
        return res.status(400).json({ errors: ['New date is not valid.'] });
      fields.push('reserved_date=?'); params.push(req.body.reserved_date);
    }
    if (!fields.length) return res.status(400).json({ errors: ['Nothing to update.'] });
    params.push(req.params.id);
    const [r] = await pool.query(`UPDATE reservations SET ${fields.join(',')} WHERE reservation_id=?`, params);
    if (!r.affectedRows) return res.status(404).json({ error: 'Reservation not found.' });
    res.json({ message: 'Reservation updated.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not update reservation.' }); }
});

// DELETE reservation (admin)
app.delete('/api/admin/reservations/:id', requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM reservations WHERE reservation_id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Reservation not found.' });
    res.json({ message: 'Reservation deleted.' });
  } catch (e) { res.status(500).json({ error: 'Could not delete reservation.' }); }
});

/* ===================== REVIEWS ============================ */

// READ reviews
app.get('/api/reviews', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reviews ORDER BY review_id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Could not load reviews.' }); }
});

// CREATE review (logged-in customers)
app.post('/api/reviews', requireLogin, async (req, res) => {
  try {
    const errors = [];
    if (!req.body.comment || !String(req.body.comment).trim()) errors.push('Review comment is required.');
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push('Rating must be between 1 and 5.');
    if (errors.length) return res.status(400).json({ errors });
    const [me] = await pool.query('SELECT full_name FROM customers WHERE customer_id=?', [req.customerId]);
    const [r] = await pool.query('INSERT INTO reviews (reviewer, rating, comment) VALUES (?,?,?)',
      [me[0].full_name, rating, String(req.body.comment).trim()]);
    res.status(201).json({ message: 'Thank you! Your review has been posted.', reviewId: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not save review.' }); }
});

// DELETE review (admin)
app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM reviews WHERE review_id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Review not found.' });
    res.json({ message: 'Review deleted.' });
  } catch (e) { res.status(500).json({ error: 'Could not delete review.' }); }
});

/* ================= NEWSLETTER (messages) ================== */

app.post('/api/newsletter', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ errors: ['Please enter a valid email address.'] });
    await pool.query(
      'INSERT INTO messages (email) VALUES (?) ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP',
      [email]);
    res.status(201).json({ message: 'Subscribed! Watch out for our newest drops.' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not subscribe.' }); }
});

/* ------------------- Page shortcuts ---------------------- */
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'home.html')));

/* ------------------------ Start --------------------------- */
if (require.main === module) {
  app.listen(PORT, () => console.log(`Sneakr.mnl server running on http://localhost:${PORT}`));
}
module.exports = app;
