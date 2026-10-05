# Sneakr.mnl — Full Stack Sneaker Store

Front-end: the original static HTML/CSS/Bootstrap pages (home, nike, air, nb, others, about, reviews, contact).
Back-end: **Node.js + Express** API with a **MySQL** database (`sneakr_mnl`).

## Setup
1. Install MySQL and start it.
2. Import the database export:
   `mysql -u root -p < database/sneakr_mnl.sql`
3. Configure credentials if needed via environment variables
   (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) — defaults: localhost/root/no password.
4. Install dependencies & run:
   ```
   npm install
   node server.js
   ```
5. Open http://localhost:3000

## Accounts (password for all seeded users: sneakr123)
- Admin: admin@sneakr.mnl  → logs into admin.html
- Customer: noah@example.com, mika@example.com → dashboard.html

## Features
- **CRUD**: products, customers, orders/order items, reservations, reviews, newsletter messages.
- **Relationships**: orders ↔ order_items ↔ products ↔ categories; customers ↔ orders (FKs, cascade delete).
- **Shopping cart** (localStorage) with quantity controls, dynamic price calculation, checkout that saves orders to MySQL (prices re-verified server-side), order confirmation page.
- **Search bar** queries the DB (`/api/products?search=`) on catalog.html with brand filter + price sort.
- **Reserve a Shoe form** (contact.html) validates name/email/model/date client-side AND server-side, then INSERTs into `reservations`.
- **Admin dashboard** (admin.html): manage products (add/edit/delete), order statuses, reservations (cancel/reschedule/delete), customers.
- **Validation**: required fields, email format, phone format, non-negative prices, future reservation dates, quantity ranges — enforced on both client and server.
