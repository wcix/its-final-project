# Sneakr.mnl — Step-by-Step Implementation Guide

This guide documents how the full stack sneaker store was built on top of the
existing static front-end (Bootstrap 5 + HTML/CSS pages: `home.html`, `nike.html`,
`air.html`, `nb.html`, `others.html`, `about.html`, `reviews.html`, `contact.html`).

**Stack:** HTML/CSS/Bootstrap (frontend) · Node.js + Express 5 (backend) · MySQL (`mysql2`) · bcryptjs · cookie-parser

---

## Step 1 — Install backend dependencies

```bash
npm install express mysql2 bcryptjs cookie-parser
```

Result (`package.json`):
```json
{ "dependencies": {
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "express": "^5.2.1",
    "mysql2": "^3.24.5"
} }
```

## Step 2 — Design and create the MySQL database (`database/sneakr_mnl.sql`)

Seven tables with foreign-key relationships and cascade rules:

| Table | Purpose | Key relationships |
|---|---|---|
| `customers` | Accounts + login (`password_hash`, `is_admin`) | parent of `orders` |
| `categories` | Brand sections (Nike, Air Jordan, New Balance, Others) | parent of `products` |
| `products` | Sneaker listings (price CHECK ≥ 0, `stock_status` ENUM, `featured`) | FK → `categories` |
| `orders` | One row per checkout (`total_amount`, `status` ENUM pending/confirmed/shipped/cancelled) | FK → `customers` |
| `order_items` | Line items (`quantity` CHECK > 0, `unit_price`) | FK → `orders` **and** `products` (many-to-many bridge) |
| `reservations` | "Reserve a Shoe" form submissions (`reserved_date`, status active/cancelled) | standalone |
| `reviews` | Testimonials (`rating` CHECK 1–5) | standalone |
| `messages` | Newsletter sign-ups (unique email) | standalone |

All FKs use `ON DELETE CASCADE ON UPDATE CASCADE`. The file also seeds:
3 customers (admin + 2 demo users, all with bcrypt hash of `sneakr123`),
4 categories, 17 products (matching the images already in the repo), and 4 reviews.

Import it:
```bash
mysql -u root -p < database/sneakr_mnl.sql
```

## Step 3 — Set up the Express server skeleton (`server.js`)

```js
const app = express();
app.use(express.json());                          // parse JSON bodies from fetch()
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());                          // read the auth cookie
app.use(express.static(__dirname));               // serves home.html, style.css, images…

const pool = mysql.createPool({                   // connection pooling
  host: process.env.DB_HOST     || 'localhost',
  user: process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sneakr_mnl',
  connectionLimit: 10,
});
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.listen(process.env.PORT || 3000);
```

Key decision: because `express.static(__dirname)` serves the original HTML pages,
the front-end needed **no rewrite** — the new JS modules are simply added to them.

## Step 4 — Implement authentication & session middleware

- **Register** `POST /api/register`: validate → check duplicate email → `bcrypt.hash(password, 10)` → INSERT.
- **Login** `POST /api/login`: look up by email → `bcrypt.compare` → set cookie
  `sneakr_session = base64(customer_id)` (hash never leaves the server).
- **Logout** `POST /api/logout`: clears the cookie.
- **Who am I** `GET /api/me`: returns the logged-in profile (used by navbar & dashboards).
- Two guard middlewares protect routes:
  - `requireLogin` → 401 if no valid cookie; sets `req.customerId`.
  - `requireAdmin` → 401/403 unless the customer row has `is_admin = 1`.

## Step 5 — Build the REST API (full CRUD)

| Resource | Endpoints | Guard |
|---|---|---|
| Products | `GET /api/products?search=&category=&sort=` · `GET /api/products/:id` · `POST` · `PUT /:id` · `DELETE /:id` | writes = admin |
| Categories | `GET /api/categories` | public |
| Orders | `POST /api/orders` (checkout) · `GET /api/orders` (mine) · `DELETE /api/orders/:id` | login |
| Admin orders | `GET /api/admin/orders` · `PUT /api/admin/orders/:id/status` | admin |
| Customers | `GET /api/admin/customers` · `PUT /api/admin/customers/:id` · `DELETE /:id` · `PUT /api/profile` | admin / self |
| Reservations | `POST /api/reservations` (public form) · `GET /api/admin/reservations` · `PUT /:id` (reschedule/cancel) · `DELETE /:id` | reads/writes = admin |
| Reviews | `GET /api/reviews` · `POST` (login) · `DELETE /:id` (admin) | mixed |
| Newsletter | `POST /api/newsletter` (upsert into `messages`) | public |

Notable implementation details:
- **Server-side validation helpers** (`validateCustomerBody`, `validateProductBody`,
  `validateReservationBody`): email regex, phone regex, non-negative prices,
  reservation date must be today-or-future, rating 1–5.
- **Checkout uses a transaction** (`pool.getConnection()` → `beginTransaction`):
  product prices are **re-read from the DB** (client prices are never trusted),
  totals recomputed server-side, then one `orders` row + many `order_items` rows
  are inserted atomically.

## Step 6 — Wire the frontend JavaScript modules (`js/`)

Shared module loaded by every page — **`main.js`**:
- `Cart` object: cart persisted in `localStorage` under key `sneakr_cart`
  (add / setQty clamped 1–99 / remove / clear / count / total), navbar badge updates.
- Live search bar → redirects to `catalog.html` with the query.
- Newsletter footer form → `POST /api/newsletter` with inline error handling.
- Auth-aware navbar (Login/Logout, Dashboard/Admin links via `GET /api/me`).
- Toast notifications + `₱` peso formatter.

Page-specific modules:
1. **`catalog.js`** – renders product cards from `GET /api/products` with brand filter, price sort and search.
2. **`cart.js`** – cart table with quantity controls, dynamic subtotal + ₱200 shipping, checkout form validation → `POST /api/orders`; redirects to confirmation.
3. **`confirmation.js`** – reads the order id from the URL and shows the receipt.
4. **`login.js`** – dual Login/Register forms, client-side validation mirroring the server rules.
5. **`dashboard.js`** – customer area: profile edit (`PUT /api/profile`) + own order history.
6. **`admin.js`** – admin panel: product add/edit/delete modals, order-status dropdowns, reservation reschedule/cancel/delete, customer management.
7. **`contact.js`** – "Reserve a Shoe" form: validates name/email/model/future date client-side, then `POST /api/reservations`.

Each existing HTML page was updated to include `<script src="js/main.js">` plus its page module, and new pages were created for the flows that didn't exist before: `login.html`, `catalog.html`, `cart.html`, `confirmation.html`, `dashboard.html`, `admin.html`.

## Step 7 — Run and verify

```bash
mysql -u root -p < database/sneakr_mnl.sql   # once
node server.js                               # http://localhost:3000
```

Test accounts (password `sneakr123`):
- `admin@sneakr.mnl` → lands on `admin.html`
- `noah@example.com` / `mika@example.com` → land on `dashboard.html`

Manual acceptance checklist mapped to the requirements:
- [x] **CRUD** – create/update/delete products, customers, orders, reservations, reviews, messages.
- [x] **Relationships** – orders ↔ order_items ↔ products ↔ categories, customers ↔ orders (FKs + cascade).
- [x] **Cart** – localStorage, quantity controls, dynamic price calc, checkout saves to MySQL, confirmation page.
- [x] **Search** – queries the DB (`LIKE %term%` on name/variation/description) with brand filter + price sort.
- [x] **Reservation form** – validated client-side AND server-side, INSERTs into `reservations`.
- [x] **Validation** – required fields, email/phone format, non-negative prices, future dates, quantity ranges enforced on both sides.
- [x] **Login system** – bcrypt-hashed passwords, cookie session, role-based guards (customer vs admin).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED` / `ER_ACCESS_DENIED_ERROR` | MySQL isn't running or wrong credentials — export `DB_HOST/DB_USER/DB_PASSWORD`. |
| `ER_BAD_DB_ERROR` | Import `database/sneakr_mnl.sql` first. |
| Cart empty after checkout | Expected — successful checkout calls `Cart.clear()`. |
| 403 on admin endpoints | Log in with the admin account (`is_admin = 1`). |
