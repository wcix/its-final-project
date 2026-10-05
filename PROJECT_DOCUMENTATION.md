# Sneakr.mnl — Full Stack Project Documentation

**Sneakr.mnl** is a full stack e-commerce web application for a Manila-based sneaker store. It combines a static HTML/CSS/Bootstrap front end with a Node.js + Express REST API backed by a MySQL relational database, delivering product browsing, shopping cart checkout, user accounts, and a complete administrator dashboard.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technologies Used](#2-technologies-used)
3. [System Architecture](#3-system-architecture)
4. [Frontend Design](#4-frontend-design)
5. [Database Design](#5-database-design)
6. [Backend Implementation](#6-backend-implementation)
7. [Feature Implementation](#7-feature-implementation)
8. [How the Technologies Interact](#8-how-the-technologies-interact)
9. [API Reference](#9-api-reference)
10. [Setup & Running Instructions](#10-setup--running-instructions)
11. [Security Considerations](#11-security-considerations)
12. [Project File Structure](#12-project-file-structure)

---

## 1. Project Overview

| Aspect | Description |
|---|---|
| **Application type** | E-commerce / sneaker storefront with admin back office |
| **Architecture** | Server-rendered static pages + client-side JS consuming a JSON REST API |
| **User roles** | Guest (browse/reserve), Registered customer (cart, checkout, dashboard), Administrator (full CRUD) |
| **Core flows** | Browse → search/filter catalog → add to cart → login → checkout → order confirmation; Admin manages products, orders, reservations, customers, reviews |

The project began as a purely static multi-page site (`home.html`, brand pages `nike.html` / `air.html` / `nb.html` / `others.html`, plus `about`, `reviews`, `contact`). The full stack layer (Express + MySQL) was added on top so that all data-driven features — catalog, cart/checkout, authentication, reservations, reviews, newsletter, and the admin panel — read from and write to a real database through a REST API, while preserving the original look and feel.

---

## 2. Technologies Used

### 2.1 Frontend

| Technology | Role | Where used |
|---|---|---|
| **HTML5** | Page structure for 14 pages | `*.html` files |
| **CSS3 (custom)** | Brand styling, layout, responsive rules | `style.css` (~934 lines) |
| **Bootstrap 5** | Grid, navbar, cards, forms, modals (via CDN) | All pages |
| **Bootstrap Icons** | Navbar cart/login icons, UI glyphs | Navbar, buttons |
| **Vanilla JavaScript (ES6+)** | DOM manipulation, `fetch()` API calls, `localStorage` cart | `js/*.js` (8 modules) |

No frontend framework or build step is used — plain scripts loaded with `<script src="js/main.js">` plus one page-specific module per dynamic page.

### 2.2 Backend

| Technology | Version | Role |
|---|---|---|
| **Node.js** | LTS runtime | Executes the server |
| **Express** | ^5.2.1 | HTTP server, routing, middleware pipeline, static file serving |
| **cookie-parser** | ^1.4.7 | Parses the session cookie on every request |
| **bcryptjs** | ^3.0.3 | One-way password hashing (cost factor 10) and comparison at login |
| **mysql2 (promise API)** | ^3.24.5 | Connection pooling and parameterized SQL queries against MySQL |

### 2.3 Database

| Technology | Role |
|---|---|
| **MySQL 8.x** | Relational store: 8 tables with foreign keys, seed data exported in `database/sneakr_mnl.sql` |

### 2.4 Supporting tools

- **Git** — version control of the project repository
- **npm** — dependency management (`package.json` / `package-lock.json`)

---

## 3. System Architecture

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  Static pages (HTML + Bootstrap + style.css)                        │
│  js/main.js (shared)  +  page module (catalog/cart/admin/login/…)   │
│       │  fetch('/api/...') JSON          │  localStorage (cart)      │
└───────┼──────────────────────────────────┼──────────────────────────┘
        │ HTTP  (same origin :3000)        │
┌───────▼──────────────────────────────────▼──────────────────────────┐
│                 Express server (server.js, port 3000)               │
│  express.static ──► serves *.html, style.css, js/, *.jpg images     │
│  express.json / urlencoded ──► parse request bodies                 │
│  cookie-parser ──► reads sneakr_session cookie                      │
│  requireLogin / requireAdmin middleware ──► route protection        │
│  Routes: /api/auth, /api/products, /api/orders, /api/reviews …      │
└───────┬─────────────────────────────────────────────────────────────┘
        │ mysql2 pool (max 10 connections, parameterized queries)
┌───────▼─────────────────────────────────────────────────────────────┐
│                     MySQL database: sneakr_mnl                      │
│  customers · categories · products · orders · order_items           │
│  reservations · reviews · messages                                  │
└──────────────────────────────────────────────────────────────────────┘
```

Key architectural decisions:

1. **Single-origin deployment.** Express serves both the static front end and the API from one process on port 3000, so no CORS configuration is needed and `fetch('/api/…')` works with relative URLs (`const API = ''`).
2. **Stateless-ish auth via cookie token.** The client receives a base64-encoded customer-id cookie (`sneakr_session`); the server never stores a password or hash on the client. Admin privilege is re-checked against the database on protected routes.
3. **Client-held cart, server-held orders.** The shopping cart lives only in `localStorage` until checkout, when it becomes an `orders` + `order_items` transaction in MySQL. This keeps guest browsing fast and DB writes meaningful.

---

## 4. Frontend Design

### 4.1 Page inventory

| Page | Purpose | JS modules loaded |
|---|---|---|
| `home.html` | Landing page: hero carousel, featured products, newsletter | `main.js` |
| `nike.html` | Nike brand showcase (5 product cards) | `main.js` |
| `air.html` | Air Jordan showcase | `main.js` |
| `nb.html` | New Balance showcase | `main.js` |
| `others.html` | Other brands (Puma, Adidas, Sabrina, etc.) | `main.js` |
| `catalog.html` | **Dynamic** vertical product list from MySQL — search, category filter, price sort, add-to-cart | `main.js`, `catalog.js` |
| `cart.html` | Cart table, quantity controls, totals, checkout form | `main.js`, `cart.js` |
| `confirmation.html` | Post-checkout order summary (reads `?order=` id) | `main.js`, `confirmation.js` |
| `login.html` | Login **and** registration tabs with validation | `main.js`, `login.js` |
| `dashboard.html` | Customer account: profile edit + order history | `main.js`, `dashboard.js` |
| `admin.html` | Admin CRUD panels: products, orders, reservations, customers, reviews | `main.js`, `admin.js` |
| `reviews.html` | Customer reviews (DB-backed) | `main.js` |
| `contact.html` | Contact / shoe reservation form → `/api/reservations` | `main.js`, `contact.js` |
| `about.html` | Static brand story | `main.js` |

### 4.2 Shared layout & components

- **Navbar** (identical markup across all pages): logo, live search bar, and a right-aligned icon group containing the **shopping cart** (with a red item-count badge) and the **login/account** link. The icon group uses a centered flexbox row (`.navbar-icons { display:flex; align-items:center; gap:… }`) so the cart and login icons stay vertically aligned whether they are bare icons or labeled links after login-state swaps.
- **Order Now buttons**: every product card on `nike.html`, `air.html`, `nb.html`, and `others.html` carries `.order-button`, which `main.js` wires to redirect to `catalog.html` on click.
- **Toast notifications**: `showToast(msg, type)` in `main.js` renders transient success/error feedback globally.
- **Currency formatting**: `peso(n)` helper formats prices as Philippine pesos (₱) using `toLocaleString('en-PH')`.

### 4.3 Responsive design

`style.css` implements mobile-first adjustments with media queries: the navbar collapses to Bootstrap's toggler, the catalog's horizontal product rows collapse into stacked vertical cards on small screens, and grids fall back to single columns.

### 4.4 Catalog layout (vertical orientation)

`catalog.html` presents products as a **single-column vertical list**: each product is a full-width horizontal row (thumbnail left, name/category/price/actions right) inside a centered container. Status text ("Loading products…", "No products match your search.") replaces the list when appropriate. Filters (category dropdown, price sort) sit above the list and re-fetch from the API without page reloads.

---

## 5. Database Design

Database: **`sneakr_mnl`** (schema + seed data in `database/sneakr_mnl.sql`). Eight InnoDB tables with referential integrity:

```
customers 1───* orders 1───* order_items *───1 products *───1 categories
customers 1───(orders)         products ─────(order_items)
             reservations (standalone, walk-in pick-ups)
             reviews      (standalone, optional reviewer link)
             messages     (newsletter signups, unique email)
```

| Table | Primary key | Key columns | Purpose |
|---|---|---|---|
| `customers` | `customer_id` | full_name, email (UNIQUE), phone, password_hash, `is_admin TINYINT(1)` | Accounts + role flag |
| `categories` | `category_id` | name (UNIQUE) | Product taxonomy (Nike, New Balance, Others…) |
| `products` | `product_id` | category_id (FK), name, brand, description, price, image, stock_status ENUM('in_stock','out_of_stock') | Catalog items |
| `orders` | `order_id` | customer_id (FK), total_amount, status ENUM(pending/confirmed/shipped/completed/cancelled), shipping name/address/phone/email | Checkout headers |
| `order_items` | `item_id` | order_id (FK), product_id (FK), quantity, unit_price | Line items snapshot |
| `reservations` | `reservation_id` | full_name, email, shoe_model, reserved_date, status | In-store pick-up bookings from contact page |
| `reviews` | `review_id` | reviewer, rating, comment, created_at | Testimonials shown on reviews page |
| `messages` | `message_id` | email (UNIQUE) | Newsletter subscriptions |

Design notes:

- **`ON DELETE CASCADE`** on `order_items.order_id` means deleting an order removes its line items automatically; `products.category_id` and `orders.customer_id` use restrictive/nullable strategies to protect history.
- **`unit_price` snapshot** in `order_items` preserves the price paid even if the product price later changes.
- **Seed data** includes an admin account (`admin@sneakr.mnl`) and demo customers; all seeded passwords are `sneakr123`, stored bcrypt-hashed.

---

## 6. Backend Implementation

`server.js` (~519 lines) is organized as:

1. **Database pool** — `mysql2/promise.createPool` with `connectionLimit: 10`; credentials come from env vars (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) with localhost/root defaults. Pooling avoids opening a connection per request.
2. **Middleware chain** — `express.json()` and `express.urlencoded()` parse fetch/form bodies; `cookieParser()` exposes `req.cookies`; `express.static(__dirname)` serves every front-end asset.
3. **Session helpers** —
   - `currentUser(req)` decodes the base64 `sneakr_session` cookie into a customer id (or `null`).
   - `requireLogin` returns **401** JSON unless a valid cookie exists, else attaches `req.customerId`.
   - `requireAdmin` additionally queries `customers.is_admin` and returns **403** for non-admins. Privilege is verified in the DB on every protected call, so revoking admin rights takes effect immediately.
4. **Validation helpers** — regexes for email/phone plus `validateCustomerBody`, `validateProductBody`, `validateReservationBody` return arrays of human-readable errors; endpoints respond **400** with `{ errors: [...] }` before touching SQL. Reservation dates must not be in the past.
5. **REST routes** — 27 `/api/...` endpoints implementing full CRUD (see §9). Every handler wraps queries in try/catch and returns JSON; SQL always uses **parameterized placeholders (`?`)**.
6. **Business transactions** — checkout runs `INSERT INTO orders`, then bulk-inserts `order_items` from the posted cart array inside a connection with `beginTransaction / commit / rollback`, guaranteeing an order never exists without its items.
7. **Fallback route** — `GET /` sends `home.html`.

---

## 7. Feature Implementation

### 7.1 Authentication (register / login / logout)
- **Front:** `login.html` has login and sign-up forms; `login.js` validates client-side, POSTs to `/api/register` or `/api/login`, shows field-level errors, and redirects to `dashboard.html` on success.
- **Back:** passwords hashed with `bcrypt.hash(pw, 10)`; login compares with `bcrypt.compare` and sets the `sneakr_session` cookie via `res.cookie`. Logout clears the cookie. `GET /api/me` returns `{ user: { id, name, email, is_admin } }` so `main.js` can swap the navbar login icon into an account/logout link.

### 7.2 Product catalog (READ + search/filter/sort)
- `catalog.js` fetches `/api/products` on load, renders the vertical list, and reacts to the category `<select>` and price-sort `<select>` by re-querying with query-string parameters (`?category=`, `?sort=`). The navbar search submits `catalog.html?search=term`, which the server filters with `LIKE %term%`.
- Each rendered row gets an **Add to cart** button (injected by `main.js`) that writes to `localStorage` and bumps the navbar badge.

### 7.3 Shopping cart (client state)
- `main.js` maintains `localStorage['sneakr_cart']` as `{ productId: qty }`, computes the badge count on every page, and exposes helpers consumed by `cart.js`.
- `cart.html` lists saved items (re-fetched from `/api/products/:id` for current names/prices), supports quantity +/− and remove, and shows subtotal + flat ₱200 shipping.

### 7.4 Checkout & orders (CREATE)
- Submitting the checkout form posts the cart + shipping details to `POST /api/orders` (protected by `requireLogin`). If the visitor is not logged in, `cart.js` shows a login hint instead. On success the browser goes to `confirmation.html?order=<id>`, which re-reads the order for display and empties the local cart.

### 7.5 Customer dashboard (READ/UPDATE own data)
- `dashboard.js` loads `/api/me`, `/api/orders` (own history with items), lets the user update the profile via `PUT /api/profile`, cancel orders (`DELETE /api/orders/:id` → soft-cancel to `status='cancelled'`), and log out.

### 7.6 Admin panel (full CRUD)
- `admin.js` guards the page client-side (`/api/me` → `is_admin`) while the server independently enforces `requireAdmin` on every admin endpoint. Tabs manage:
  - **Products:** create/edit/delete via `POST/PUT/DELETE /api/products` (form modal; delete asks confirm).
  - **Orders:** view all (`GET /api/admin/orders`), change status through the lifecycle (`PUT /api/admin/orders/:id/status`).
  - **Reservations:** list, reschedule/cancel (`PUT /api/admin/reservations/:id`), delete.
  - **Customers:** list, edit, delete (`/api/admin/customers`).
  - **Reviews:** moderate/delete.
- All injected HTML passes through an `esc()` XSS-escaping helper.

### 7.7 Reservations (contact page)
- `contact.js` validates and POSTs to `/api/reservations` (public, no login required); rows appear in the admin reservations tab.

### 7.8 Reviews & newsletter
- `GET/POST /api/reviews` power `reviews.html` (posting requires login); `POST /api/newsletter` stores home-page emails in `messages` with duplicate-email handling.

### 7.9 Order Now redirection
- `initOrderButtons()` in `main.js` attaches click handlers to every `.order-button` on the four brand pages, navigating to `catalog.html` — connecting the static showcase pages to the dynamic catalog.

---

## 8. How the Technologies Interact

A typical request cycle (adding to cart → checkout) demonstrates the full stack:

1. **Browser → Express (static):** The initial page load (`GET /catalog.html`) is answered by `express.static`, which streams HTML; the HTML references Bootstrap from CDN, `style.css`, and `js/main.js` + `js/catalog.js` from disk.
2. **JS → API (read):** On `DOMContentLoaded`, `catalog.js` calls `fetch('/api/products')`. Express routes it; the handler runs a parameterized `SELECT` through the **mysql2 pool**; results serialize to JSON and render as DOM rows.
3. **JS → localStorage (state):** Clicking *Add to cart* mutates `localStorage` only — no network round-trip — and updates the navbar badge instantly.
4. **Auth handshake:** At checkout, `POST /api/orders` carries the `sneakr_session` cookie set earlier by `/api/login`. `cookie-parser` surfaces it, `requireLogin` decodes the id, and bcrypt already guaranteed the credential check happened at login time.
5. **Transactional write:** Inside the order handler, `mysql2` opens a pooled connection, begins a transaction, inserts `orders` + `order_items`, commits, and returns the new `order_id` as JSON. A failure rolls everything back.
6. **Confirmation round-trip:** `confirmation.js` fetches the order by id, rendering the receipt; `main.js` clears the cart.
7. **Admin flow:** Identical mechanics but every mutation passes `requireAdmin`, which adds one extra `SELECT is_admin` per request — the DB remains the single source of truth for authorization.

Technology boundaries summarized:

| Interaction | Mechanism |
|---|---|
| HTML ↔ CSS | Class selectors (`navbar-icons`, `order-button`, `catalog-grid`) styled in `style.css`/Bootstrap |
| HTML ↔ JS | `DOMContentLoaded` listeners bind to element ids present in each page |
| JS ↔ Express | Same-origin `fetch()` with JSON bodies; cookies auto-attached |
| Express ↔ MySQL | `mysql2/promise` pool, parameterized queries, transactions |
| Express ↔ Auth | `bcryptjs` hash/compare + `cookie-parser` session token |
| JS ↔ Browser storage | `localStorage` for cart persistence across pages/sessions |

---

## 9. API Reference

Base URL: `http://localhost:3000` — all responses are JSON. 🔒 = `requireLogin`, 👑 = `requireAdmin`.

| Method & path | Access | Description |
|---|---|---|
| `POST /api/register` | public | Create customer (validated; bcrypt hash; sets cookie) |
| `POST /api/login` | public | Authenticate, set `sneakr_session` cookie |
| `POST /api/logout` | any | Clear session cookie |
| `GET /api/me` | any | Current user profile or `{user:null}` |
| `GET /api/products` | public | List products; `?search=`, `?category=`, `?sort=price_asc\|price_desc` |
| `GET /api/products/:id` | public | Single product |
| `POST /api/products` | 👑 | Create product |
| `PUT /api/products/:id` | 👑 | Update product |
| `DELETE /api/products/:id` | 👑 | Delete product |
| `GET /api/categories` | public | Category list (for filter dropdown) |
| `POST /api/orders` | 🔒 | Checkout: creates order + items transactionally |
| `GET /api/orders` | 🔒 | Own order history with items |
| `DELETE /api/orders/:id` | 🔒 | Cancel own pending order |
| `GET /api/admin/orders` | 👑 | All orders (with customer info) |
| `PUT /api/admin/orders/:id/status` | 👑 | Move order through status lifecycle |
| `GET /api/admin/customers` | 👑 | List customers |
| `PUT /api/admin/customers/:id` | 👑 | Edit customer |
| `DELETE /api/admin/customers/:id` | 👑 | Delete customer |
| `PUT /api/profile` | 🔒 | Update own name/phone/password |
| `POST /api/reservations` | public | Create in-store reservation |
| `GET /api/admin/reservations` | 👑 | List reservations |
| `PUT /api/admin/reservations/:id` | 👑 | Reschedule/update reservation |
| `DELETE /api/admin/reservations/:id` | 👑 | Delete reservation |
| `GET /api/reviews` | public | List reviews |
| `POST /api/reviews` | 🔒 | Add review |
| `DELETE /api/reviews/:id` | 👑 | Delete review |
| `POST /api/newsletter` | public | Subscribe email to `messages` |
| `GET /` | public | Serve `home.html` |

Status codes: `200/201` success, `400` validation errors (`{errors:[…]}`), `401` not logged in, `403` insufficient role, `404` missing resource, `500` server error.

---

## 10. Setup & Running Instructions

**Prerequisites:** Node.js ≥ 18, MySQL 8 running locally.

```bash
# 1. Import the schema + seed data
mysql -u root -p < database/sneakr_mnl.sql

# 2. Install backend dependencies
npm install

# 3. (Optional) override DB settings
export DB_HOST=localhost DB_USER=root DB_PASSWORD=secret DB_NAME=sneakr_mnl PORT=3000

# 4. Start the full stack app
node server.js
```

Open **http://localhost:3000**.

**Test accounts** (password for all seeded users: `sneakr123`):
- Admin: `admin@sneakr.mnl` → unlocks `admin.html`
- Demo customer → `dashboard.html`

---

## 11. Security Considerations

| Concern | Mitigation implemented |
|---|---|
| Password storage | bcrypt hashes (cost 10); plaintext never stored or sent to client |
| SQL injection | 100% parameterized queries (`?` placeholders) via mysql2 |
| XSS | Admin/catalog rendering escapes interpolated values (`esc()` helper) |
| Broken access control | Server-side `requireLogin`/`requireAdmin` on every mutating route; admin flag re-read from DB per request (client guard is UX only) |
| Input tampering | Dual validation: client-side for speed + server-side regex/business rules as authority |
| Session leakage | Cookie holds only an opaque base64 id, never credentials |
| Data consistency | Order creation wrapped in a DB transaction with rollback |

Known trade-offs (documented, acceptable for this coursework scope): the session token is unsigned base64 rather than a signed JWT/session-store entry, and cookies do not yet set `__Host-`/`Secure` flags for production HTTPS deployments.

---

## 12. Project File Structure

```
/workspace
├── server.js               # Express app: middleware, auth, 28 routes (~519 lines)
├── package.json            # express, mysql2, bcryptjs, cookie-parser
├── style.css               # Global custom stylesheet (~934 lines)
├── database/
│   └── sneakr_mnl.sql      # MySQL schema + seed data (8 tables)
├── js/
│   ├── main.js             # Shared: navbar state, search, cart badge, toasts, order buttons
│   ├── catalog.js          # Vertical product list: fetch, filter, sort, add-to-cart
│   ├── cart.js             # Cart table, quantities, totals, checkout submit
│   ├── confirmation.js     # Order receipt after checkout
│   ├── login.js            # Login + registration forms
│   ├── dashboard.js        # Customer profile & order history
│   ├── admin.js            # Admin CRUD panels (products/orders/reservations/customers/reviews)
│   └── contact.js          # Reservation form submission
├── *.html                  # 14 pages (see §4.1)
├── *.jpg / *.png / *.webp  # Product, carousel and logo images
├── README.md               # Quick-start guide
└── PROJECT_DOCUMENTATION.md# This document
```

---

*Document generated for the Sneakr.mnl full stack project — October 2026.*
