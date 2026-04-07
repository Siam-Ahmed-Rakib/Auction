# 🏷️ AuctionHub — Full-Stack Auction Platform

A production-ready, eBay-inspired online auction system with **proxy bidding**, real-time updates, payment processing, shipping, feedback/ratings, and dispute resolution.

**Live Demo:**
- Frontend: _Deploy to Vercel_ → `https://auctionhub-frontend.vercel.app`
- Backend API: _Deploy to Render_ → `https://auctionhub-api.onrender.com`
- Database: _Hosted on Neon_ (PostgreSQL)

---

## 📸 Screenshots

The UI is inspired by eBay's auction platform — see the `/files/` directory for reference images.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (via Prisma ORM) |
| Real-time | Socket.io (WebSocket) |
| Auth | JWT (JSON Web Tokens) |
| Scheduling | node-cron (auction end processing) |
| Icons | Lucide React |

---

## 🗂️ Project Structure

```
Auction/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema (9 models, 6 enums)
│   │   └── seed.js              # Seed data (users, auctions, bids)
│   ├── src/
│   │   ├── config/db.js         # Prisma client singleton
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication + optional auth
│   │   │   └── errorHandler.js  # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.js          # Register, login, profile
│   │   │   ├── auctions.js      # CRUD, filters, watchlist
│   │   │   ├── bids.js          # Place bid, proxy bidding
│   │   │   ├── orders.js        # Order lifecycle
│   │   │   ├── payments.js      # Payment processing, coupons
│   │   │   ├── feedback.js      # DSR-style ratings
│   │   │   ├── disputes.js      # Dispute management
│   │   │   ├── notifications.js # Real-time notifications
│   │   │   ├── users.js         # Profile, watchlist, stats
│   │   │   └── search.js        # Full-text search with facets
│   │   ├── services/
│   │   │   ├── biddingEngine.js      # Proxy bid logic
│   │   │   ├── notificationService.js # Socket + DB notifications
│   │   │   └── auctionScheduler.js   # Cron: end auctions, create orders
│   │   ├── socket/index.js      # Socket.io initialization
│   │   └── server.js            # Express entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.js        # Root layout (auth, socket, navbar)
│   │   │   ├── page.js          # Homepage
│   │   │   ├── auth/login/      # Login page
│   │   │   ├── auth/register/   # Registration
│   │   │   ├── auctions/[id]/   # Auction detail + bid modals
│   │   │   ├── auctions/create/ # Create listing
│   │   │   ├── search/          # Search with filters
│   │   │   ├── checkout/[id]/   # Checkout + payment
│   │   │   ├── payment-success/ # Order confirmation
│   │   │   ├── notifications/   # Notification center
│   │   │   └── dashboard/
│   │   │       ├── page.js      # Dashboard summary
│   │   │       ├── bids/        # Bids & Offers
│   │   │       ├── purchases/   # Order history
│   │   │       ├── selling/     # Seller management
│   │   │       └── watchlist/   # Watched items
│   │   ├── components/
│   │   │   ├── Navbar.js        # eBay-style navigation
│   │   │   ├── Footer.js        # Site footer
│   │   │   ├── AuctionCard.js   # Listing card component
│   │   │   └── CountdownTimer.js # Live countdown
│   │   ├── context/
│   │   │   ├── AuthContext.js   # Auth state management
│   │   │   └── SocketContext.js # Socket.io connection
│   │   └── lib/
│   │       ├── api.js           # API client (all endpoints)
│   │       └── utils.js         # Formatters, constants
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
└── README.md
```

---

## ⚡ Features

### Auction Lifecycle (BPMN)
```
┌─────────┐   ┌─────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐
│  CREATE  │──▷│  ACTIVE  │──▷│  BIDDING  │──▷│  AUCTION   │──▷│ PAYMENT  │
│ LISTING  │   │  LISTED  │   │  PERIOD   │   │   ENDED    │   │ PROCESS  │
└─────────┘   └─────────┘   └──────────┘   └────────────┘   └──────────┘
                                  │                │               │
                            proxy bids        winner found     order created
                            auto-outbid       order auto       payment held
                            notifications     -created         14 days
                                                                   │
              ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
              │ FEEDBACK  │◁──│DELIVERED │◁──│ SHIPPED  │◁──│  SELLER  │
              │ & RATING  │   │          │   │          │   │  SHIPS   │
              └──────────┘   └──────────┘   └──────────┘   └──────────┘
                    │
              ┌──────────┐
              │ DISPUTE?  │──▷ Resolution / Refund
              └──────────┘
```

### Core Features
- **Proxy Bidding** — Set your maximum; the system bids incrementally on your behalf
- **Real-time Updates** — Socket.io pushes bid updates, notifications instantly
- **Countdown Timers** — Live remaining time with urgency colors
- **Buy It Now** — Optional instant-purchase price alongside auction
- **Reserve Price** — Hidden minimum; auction won't sell below it
- **Watchlist** — Track auctions you're interested in
- **Search & Filters** — Full-text search, category facets, sort, grid/list views

### Seller Features
- Create listings with images, pricing, duration
- Manage active/sold/ended auctions
- Ship items with tracking numbers
- Revenue dashboard and stats

### Buyer Features
- Bids & Offers dashboard (Active / Won / Lost tabs)
- Proxy bidding with automatic outbid notifications
- Checkout with multiple payment methods
- Order tracking and delivery confirmation

### Trust & Safety
- DSR-style feedback (communication, shipping, description sub-ratings)
- Dispute resolution system
- Money Back Guarantee messaging
- Payment held for 14 days until delivery confirmed

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (or [Neon](https://neon.tech) free tier)
- npm or yarn

### 1. Clone & Install

```bash
git clone <repository-url>
cd Auction

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/auctionhub"
JWT_SECRET="your-super-secret-jwt-key-change-this"
FRONTEND_URL="http://localhost:3000"
PORT=5000
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 3. Database Setup

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma db push

# Seed demo data
npx prisma db seed
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:3000

### Demo Accounts
| Email | Password | Role |
|---|---|---|
| john@example.com | password123 | Seller |
| jane@example.com | password123 | Seller |
| bob@example.com | password123 | Seller |
| alice@example.com | password123 | Buyer |
| charlie@example.com | password123 | Buyer |

---

## 📡 API Documentation

**Base URL:** `http://localhost:5000/api`

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user |
| PUT | `/auth/profile` | Update profile |

### Auctions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/auctions` | List auctions (with filters) |
| GET | `/auctions/:id` | Get auction detail |
| POST | `/auctions` | Create auction (auth) |
| PUT | `/auctions/:id` | Update auction (seller) |
| DELETE | `/auctions/:id` | Delete auction (seller) |
| POST | `/auctions/:id/watch` | Toggle watchlist |
| GET | `/auctions/seller/me` | Seller's auctions |

### Bidding
| Method | Endpoint | Description |
|---|---|---|
| POST | `/bids` | Place bid (proxy) |
| GET | `/bids/auction/:id` | Bids for auction |
| GET | `/bids/me` | User's bid history |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/orders/buyer` | Buyer's orders |
| GET | `/orders/seller` | Seller's orders |
| PUT | `/orders/:id/ship` | Mark as shipped |
| PUT | `/orders/:id/deliver` | Confirm delivery |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| POST | `/payments/process` | Process payment |
| POST | `/payments/refund` | Process refund |

### Feedback
| Method | Endpoint | Description |
|---|---|---|
| POST | `/feedback` | Leave feedback |
| GET | `/feedback/user/:id` | User's feedback |
| GET | `/feedback/order/:id` | Order feedback |

### Disputes
| Method | Endpoint | Description |
|---|---|---|
| POST | `/disputes` | Open dispute |
| GET | `/disputes` | User's disputes |
| GET | `/disputes/:id` | Dispute detail |
| PUT | `/disputes/:id/resolve` | Resolve dispute |

### Search
| Method | Endpoint | Description |
|---|---|---|
| GET | `/search?q=&category=&sort=` | Search auctions |
| GET | `/search/categories` | Category list with counts |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | User's notifications |
| PUT | `/notifications/:id/read` | Mark as read |
| PUT | `/notifications/read-all` | Mark all read |

---

## 🗄️ Database Schema

### Models
- **User** — username, email, password (hashed), name, address, phone, rating, positiveRate
- **Auction** — title, description, images[], category, condition, startPrice, reservePrice, buyNowPrice, currentPrice, shippingCost, startTime, endTime, status, sellerId
- **Bid** — amount, maxBid, isProxy, isWinning, auctionId, bidderId
- **Order** — orderNumber, totalAmount, shippingAddress, trackingNumber, status, auctionId, buyerId, sellerId
- **Payment** — amount, method, status, transactionId, couponCode, couponDiscount, heldUntil, orderId
- **Feedback** — rating (1-5), comment, communication, shipping, description, type (BUYER/SELLER), orderId, fromUserId, toUserId
- **Dispute** — reason, status, resolution, resolvedAt, orderId, raisedById
- **Notification** — type, message, read, auctionId, userId
- **Watchlist** — userId, auctionId

### Enums
- `AuctionStatus`: DRAFT, ACTIVE, ENDED, SOLD, CANCELLED, RESERVE_NOT_MET
- `OrderStatus`: PENDING_PAYMENT, PAID, SHIPPED, DELIVERED, COMPLETED, DISPUTED, CANCELLED
- `PaymentStatus`: PENDING, HELD, COMPLETED, RELEASED, REFUNDED, FAILED

---

## 🌐 Deployment

### Frontend → Vercel
1. Push frontend to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = Render backend URL + `/api`
   - `NEXT_PUBLIC_SOCKET_URL` = Render backend URL

### Backend → Render
1. Push backend to GitHub
2. Create Web Service on [Render](https://render.com)
3. Build command: `npm install && npx prisma generate`
4. Start command: `npm start`
5. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`

### Database → Neon
1. Create free PostgreSQL database at [Neon](https://neon.tech)
2. Copy connection string to `DATABASE_URL`
3. Run: `npx prisma db push && npx prisma db seed`

---

## 🌿 Git Branching Strategy

```
main
├── frontend    ← All frontend code (Next.js, React, Tailwind)
├── backend     ← All backend code (Express, Prisma, Socket.io)
├── database    ← Schema, migrations, seed data
├── deployment  ← Deployment configs, environment templates
└── features    ← Feature branches merged into main
```

---

## 🔐 Security

- Passwords hashed with bcrypt (10 rounds)
- JWT authentication with 7-day expiry
- Input validation via express-validator on all routes
- CORS restricted to frontend origin
- Rate limiting ready (add express-rate-limit)
- Payment amounts server-validated
- Authorization checks on all protected routes

---

## 📄 License

MIT

---

Built with ❤️ as a full-stack auction platform demonstrating real-time bidding, payment processing, and complete e-commerce lifecycle management.
