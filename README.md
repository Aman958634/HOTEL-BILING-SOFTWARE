# Enterprise Restaurant Management System

Production-ready full-stack restaurant management platform with role-based access, real-time order updates, payments, analytics, and modular architecture.

## Tech Stack
- Frontend: React, Vite, Redux Toolkit, React Router, Tailwind CSS, Framer Motion, Axios, React Hook Form, Recharts, Socket.IO client
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, Socket.IO, Stripe, Razorpay, Nodemailer, PDFKit, Winston, Helmet, CORS
- Deployment: Vercel (client), Render (server), MongoDB Atlas

## Architecture
- MVC backend with service and middleware layers
- Reusable component-driven frontend
- Role-based auth: admin, manager, chef, waiter, cashier, delivery, customer
- REST APIs for auth, resources, orders, reservations, payments, analytics
- Real-time events for order lifecycle via Socket.IO

## Project Structure
- client: frontend app
- server: backend API and realtime server
- Dockerfile.client / Dockerfile.server / docker-compose.yml
- .github/workflows/ci.yml

## Setup
### 1. Backend
1. Copy `server/.env.example` to `server/.env`
2. Fill MongoDB Atlas and JWT secrets
3. Run:
   - `cd server`
   - `npm install`
   - `npm run dev`

### 2. Frontend
1. Copy `client/.env.example` to `client/.env`
2. Run:
   - `cd client`
   - `npm install`
   - `npm run dev`

## Key Modules
- Authentication and profile
- Menu, categories, food management
- Cart and checkout
- Reservations and table management
- Orders, kitchen status, invoice PDF
- Payments (Stripe, Razorpay, Cash/UPI/Wallet workflows)
- Inventory, suppliers, offers, coupons
- Notifications and analytics dashboards

## API Docs
- OpenAPI file: `server/docs/openapi.json`
- Health: `GET /api/v1/health`

## Deployment
### Frontend (Vercel)
- Root: `client`
- Build: `npm run build`
- Output: `dist`
- **Environment variables (Production):**
  - `VITE_API_URL=https://hotel-biling-software.onrender.com/api/v1`
  - `VITE_SOCKET_URL=https://hotel-biling-software.onrender.com`
- Redeploy after changing any `VITE_*` variable (bundled at build time).
- See `client/.env.production.example`.

### Backend (Render)
- Root: `server`
- Build command: `npm install`
- Start command: `npm start`
- Add all variables from `server/.env.example`
- **Super Admin login:** On startup the server idempotently seeds `superadmin@restosphere.com` (password from `SUPER_ADMIN_PASSWORD`, default in `.env.example`) if no `super_admin` exists. Set `SUPER_ADMIN_SEED=false` to disable.
- Or run once: `npm run seed:super-admin`
- Verify: `GET /api/v1/public/seed-status` → `{ exists: true }`

### Database
- Create MongoDB Atlas cluster
- Add connection string in `MONGO_URI`

## Security Controls
- JWT access/refresh token flow
- Role-based authorization middleware
- Helmet hardening
- CORS policy
- Request rate limiting
- Express-validator input checks
- Password hashing with bcrypt

## Notes
- This implementation is production-oriented and modular.
- You can extend each resource module with additional domain workflows (attendance, payroll, multi-branch, etc.) using the same controller and route patterns.
