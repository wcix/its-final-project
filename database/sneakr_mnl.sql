-- ============================================================
--  Sneakr.mnl - Full Stack Sneaker Store
--  MySQL Database Export (schema + seed data)
--  Import with:  mysql -u root -p < database/sneakr_mnl.sql
-- ============================================================

DROP DATABASE IF EXISTS sneakr_mnl;
CREATE DATABASE sneakr_mnl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sneakr_mnl;

-- ------------------------------------------------------------
-- Customers (also used for simple login)
-- ------------------------------------------------------------
CREATE TABLE customers (
  customer_id   INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100)  NOT NULL,
  email         VARCHAR(120)  NOT NULL UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(100)  NOT NULL,
  is_admin      TINYINT(1)    NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Categories (brand sections of the shop)
-- ------------------------------------------------------------
CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  page_file   VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Products (the sneaker listings)
-- ------------------------------------------------------------
CREATE TABLE products (
  product_id    INT AUTO_INCREMENT PRIMARY KEY,
  category_id   INT NOT NULL,
  name          VARCHAR(120) NOT NULL,
  variation     VARCHAR(80),
  sizes         VARCHAR(120),
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  image         VARCHAR(120),
  stock_status  ENUM('in_stock','out_of_stock') NOT NULL DEFAULT 'in_stock',
  featured      TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Orders (one per checkout from the shopping cart)
-- ------------------------------------------------------------
CREATE TABLE orders (
  order_id     INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status       ENUM('pending','confirmed','shipped','cancelled')
               NOT NULL DEFAULT 'pending',
  ordered_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Order items (line items, related to both orders & products)
-- ------------------------------------------------------------
CREATE TABLE order_items (
  item_id    INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Reservations (from the "Reserve a Shoe" form on contact.html)
-- ------------------------------------------------------------
CREATE TABLE reservations (
  reservation_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  shoe_model     VARCHAR(120) NOT NULL,
  reserved_date  DATE NOT NULL,
  status         ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Reviews (customer testimonials shown on reviews.html)
-- ------------------------------------------------------------
CREATE TABLE reviews (
  review_id   INT AUTO_INCREMENT PRIMARY KEY,
  reviewer    VARCHAR(100) NOT NULL,
  rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Messages (newsletter subscriptions from the footer form)
-- ------------------------------------------------------------
CREATE TABLE messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

-- bcrypt hash below is for password: sneakr123
INSERT INTO customers (full_name, email, phone, password_hash, is_admin) VALUES
('Admin User',     'admin@sneakr.mnl', '+63 917 000 0001', '$2b$10$J4RnpII2OUi/.fkpMGzrgO9nV/J1EhZMdWWaaLKQwAPbXfsyRZ.Rq', 1),
('Noah Dela Cruz', 'noah@example.com',  '+63 917 123 4501', '$2b$10$J4RnpII2OUi/.fkpMGzrgO9nV/J1EhZMdWWaaLKQwAPbXfsyRZ.Rq', 0),
('Mika Lim',       'mika@example.com',  '+63 917 123 4502', '$2b$10$J4RnpII2OUi/.fkpMGzrgO9nV/J1EhZMdWWaaLKQwAPbXfsyRZ.Rq', 0);

INSERT INTO categories (name, page_file) VALUES
('Nike',        'nike.html'),
('Air Jordan',  'air.html'),
('New Balance', 'nb.html'),
('Others',      'others.html');

INSERT INTO products (category_id, name, variation, sizes, description, price, image, stock_status, featured) VALUES
(1,'Nike Air Force 1','Triple White','7, 8, 9, 10, 11','Comfortable, durable and timeless - it''s number one for a reason. The classic ''80s construction pairs with bold details for style that tracks whether you''re on court or on the go.',9995,'af1.jpg','in_stock',0),
(1,'Kobe 5 Protro','Halloween','8, 9, 10, 11','The Nike Kobe 5 Protro X-Ray is a vibrant homage to Kobe Bryant''s legendary career, taking inspiration from the iconic X-ray T-shirt.',13995,'protro.jpg','out_of_stock',0),
(1,'Sabrina 2','Colour Vision','7, 8, 9, 10','The Sabrina 2 by Nike is the second signature shoe for WNBA star Sabrina Ionescu. This edition features a sleek black base, complemented by striking purple overlays.',9495,'sabrina.jpg','in_stock',0),
(1,'Nike Vomero 5','Platinum Tint','8, 9, 10, 11','A breathable runner-inspired silhouette with plush cushioning and reflective details for all-day comfort.',7495,'vomero.jpg','in_stock',0),
(1,'Nike SB Dunk Low x Futura Laboratories',NULL,'7, 8, 9, 10, 11','This special-edition Dunk Low is a collaboration between design studio Futura Laboratories and Nike''s storied skateboarding division. Bleached canvas backdrop, colourful overlays and puff-print details.',29995,'futura.jpg','in_stock',1),
(2,'Air Jordan 1 Low OG','Mocha','6, 6.5, 7, 7.5, 8, 9, 10','Classic AJ1 Low build in a rich mocha colourway with premium leather overlays.',9995,'mocha.jpg','in_stock',0),
(2,'Air Jordan 1 Low OG x Travis Scott','Canary','5, 6, 6.5, 7, 7.5, 8, 9','The highly coveted collaboration in a bright canary yellow with reverse swoosh.',19995,'canary.jpg','in_stock',0),
(2,'Air Jordan 11 Low','Space Jam','7, 8, 9, 10','An iconic performance silhouette inspired by the 1996 film, featuring white and deep royal blue panels with a translucent outsole.',9495,'spacejam.jpg','in_stock',0),
(2,'Air Jordan 1 Low OG','Unc (W)','8, 9, 10, 11','Pay homage to North Carolina with this collegiate palette on the timeless AJ1 Low.',7995,'unc.jpg','in_stock',0),
(2,'Air Jordan 4','Metallic Gold (W)','7, 7.5, 8, 9, 10','The AJ4 returns with metallic gold accents on the winged eyelets and heel tab.',14995,'gold.jpg','in_stock',0),
(3,'New Balance 1906AD','Tech Explosion','7, 8, 9, 10, 11','A running silhouette reimagined for the streets with ABZORBER and ACTEVA cushioning.',10995,'tech.jpg','in_stock',0),
(3,'New Balance 327 Moonbeam','Outerspace','8, 9, 10, 11','Retro-inspired low profile with an oversized N and wavy lugged outsole.',6495,'moonbeam.jpg','in_stock',0),
(3,'New Balance 327 Moonbeam','Burgundy','8, 9, 10, 11','Slim 70s runner silhouette reworked with modern materials in deep burgundy.',6495,'burgundy.jpg','in_stock',0),
(4,'On Cloudtilt','Pearl Ice','7, 8, 9, 10, 11','Your lightweight, ultra-cushioned hero. Built with CloudTec Phase for smooth, lightweight movement.',11495,'pearl.jpg','in_stock',1),
(4,'On Cloud Monster','Triple White','7, 8, 9, 10, 11','Explosive energy return with triple CloudTec pods - race day speed, daily comfort.',10495,'monster.jpg','in_stock',0),
(4,'Converse x Comme Des Garcons Play','White','7, 8, 9, 10','Chuck Taylor All Star low topped canvas sneaker with the iconic CDG PLAY heart logo.',8995,'comme.jpg','in_stock',0),
(4,'Puma x One Piece Luffy Gear 5','White','8, 9, 10, 11','Official One Piece collaboration Speedcat inspired by Monkey D. Luffy''s Gear 5 awakening.',8995,'luffy.jpg','in_stock',0);

INSERT INTO reviews (reviewer, rating, comment) VALUES
('Noah D.',  5,'Solid and trusted seller! Shoes were original and brand-new. Will definitely buy more from here.'),
('Mika L.',  5,'Been trying to find these Vejo Campo Chrome Free shoes locally for a long time now and I finally stumbled upon this store which had them! Recommended store for not-easy-to-find shoe models.'),
('Ema A.',   5,'Got these Sambas for cheaper than retail price. Thank you seller!'),
('Lance R.', 5,'Fast delivery! Received my shoes the next day after I placed my order in great condition. Thank you!');
