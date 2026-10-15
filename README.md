# TrailMate

**Plan, match and book group treks, with held seats, test payments and a waitlist.**

- Live app: ADD_VERCEL_URL
- API health: ADD_RENDER_URL/api/health
- Demo video: ADD_VIDEO_URL
- Demo logins: `asha@trailmate.dev` (trekker) and `admin@trailmate.dev` (admin). Password is shared in the submission form.

## Problem Statement
Group treks run in fixed-date batches with limited seats. Trekkers struggle to compare treks, judge which suit their experience, and secure a seat reliably. Organisers lose money and safety margin when batches are overbooked, unpaid seats stay blocked, or cancelled seats are never reused.

## Target Users
- **Trekkers** from beginners to experienced hikers, booking group batches.
- **Organisers (admins)** who publish treks and batches and track demand.

## Solution
TrailMate matches treks to a user's experience, lets them hold seats for 10 minutes while paying, and gives full batches a waitlist. Seats freed by cancellations or unpaid holds go to the oldest waiting trekker automatically.

## Key Features
1. **Auth and roles:** register and log in (bcrypt, JWT); `trekker` and `admin` roles.
2. **Discover:** full-text search; filters for difficulty, season, days, open batches; "good fit / stretch / too hard" label from the user's experience, altitude and duration.
3. **Booking with payment hold:** seats are reserved atomically and held for 10 minutes; paying within the timer confirms the booking, otherwise seats are released. Payment is a **simulated test-mode gateway**: no real money moves.
4. **Waitlist:** full batches accept waitlist entries; freed seats are offered to the oldest entry first with a 30 minute payment window.
5. **Cancellation:** held bookings anytime; paid bookings until 48 hours before start. Seats return to the batch and the waitlist.
6. **Trek readiness:** packing list that adapts to season, difficulty and altitude; progress is saved per booking.
7. **Admin:** add, edit, delete treks and batches (deletes are blocked while active bookings exist); dashboard with revenue, occupancy per trek and nearly-full alerts.
8. **Elevation profile**, day-by-day itinerary, dark and light theme, responsive layout.

## Tech Stack
React 18, Vite, React Router (HTML, CSS, JavaScript) · Node.js, Express · MongoDB, Mongoose · JWT, bcryptjs, zod, express-rate-limit

## Architecture
```
React SPA (Vercel) --HTTPS--> Express API (Render) --> MongoDB Atlas
  pages: Treks, TrekDetail,     routes: auth, treks, bookings, admin
  MyBookings, Admin, Dashboard  services/seats.js: reserve, release, promote waitlist
                                background sweep: release expired holds every 30s
```
- **Atomic seat updates:** batches are embedded in each Trek, so one `findOneAndUpdate` with `$elemMatch` checks `seatsLeft >= n` and decrements in the same operation. Two people cannot take the last seats.
- **Booking states:** `held`, `confirmed`, `cancelled`, `expired`. A partial unique index on `(user, batchId, active)` blocks duplicate active bookings, including double clicks.
- **Hold expiry:** a 30 second background job plus a sweep on booking requests release unpaid holds, so expiry works even when the free server was asleep.
- **Waitlist promotion:** when seats are freed, the oldest waiting entry whose seat count fits is claimed atomically and converted into a held booking.
- **Failure handling:** a failed booking insert rolls back the reserved seats; every route validates input with zod and returns `{ error }` with proper status codes; the UI shows loading, empty and error states.

## Local Setup
Requires Node 18+ and MongoDB (local or Atlas).
```bash
cd server && cp .env.example .env     # set JWT_SECRET and MONGO_URI
npm install && npm run seed && npm run dev

cd client && npm install && npm run dev   # http://localhost:5173
```
Tests (needs local MongoDB): `cd server && npm test`

## Environment Variables
| Where | Variable | Purpose |
|---|---|---|
| server/.env | `MONGO_URI` | MongoDB connection string |
| server/.env | `JWT_SECRET` | Long random string for signing tokens |
| server/.env | `PORT`, `CLIENT_ORIGIN` | API port; allowed frontend origin |
| seed only | `SEED_PASSWORD` | Password for the seeded demo users |
| client | `VITE_API_URL` | Public API URL in production |



## Notes
Original work; no existing project was used as a base. Payments are simulated.