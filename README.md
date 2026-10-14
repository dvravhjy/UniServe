# UniServe

A web-based student services system for enrollment, clearance, grade viewing and document requests. It replaces repeated trips to several windows with one system, and it runs the face-to-face queue in an orderly way.

**Live prototype:** https://universe-frontend-black.vercel.app
**API:** https://universebackend-production.up.railway.app/api

## What it does

- **Walk-in queue.** Staff issue queue tickets (for example R-001). A public "Now Serving" board at `/board` shows who is being served in each office. Each office has its own numbering that restarts every day.
- **Counter enrollment.** Online sign-up is closed. The Registrar creates the student's account at the window and enrolls the student, with automatic capacity checks, duplicate checks and tuition computation.
- **Cashier.** Records payments and issues receipt numbers.
- **Clearance.** Library, Laboratory, Guidance and Dean offices approve or hold clearance items for their own office only.
- **Grades.** Instructors encode grades. Students see them only after the Registrar releases them.
- **Documents.** Students request a document, pay, and track it from Submitted to Released. A printable copy is available when it is Ready.
- **Admin.** User management, settings and audit logs.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios |
| Backend | Node.js, Express, Sequelize, JSON Web Tokens, bcryptjs, Helmet, express-validator |
| Database | SQLite (development), PostgreSQL (production) |
| Tests | Jest and Supertest (backend, 30 tests), Vitest and React Testing Library (frontend, 4 tests) |
| Hosting | Vercel (frontend), Railway (backend and database) |

## Project structure

```
backend/    Express API, database models, routes, tests, seed script
frontend/   React app (pages, components, hooks, services, tests)
```

## Run it locally

You need Node.js 18 or newer.

```bash
# Backend
cd backend
npm install
cp .env.example .env      # on Windows PowerShell: Copy-Item .env.example .env
npm run seed              # creates the demo data
npm run dev               # http://localhost:4000
npm test                  # runs the backend tests

# Frontend (in a second terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
npm test                  # runs the frontend tests
```

## Demo accounts

Password for all: `Password123`. These are for demonstration only.

| Role | Email |
|---|---|
| Admin | admin@uniserve.edu |
| Registrar | registrar@uniserve.edu |
| Cashier | cashier@uniserve.edu |
| Department staff | library@, laboratory@, guidance@, dean@ uniserve.edu |
| Instructor | instructor1@, instructor2@ uniserve.edu |
| Student | student@uniserve.edu |

## Try the main flow

1. Sign in as the Registrar, open **Queue Window**, and issue a walk-in ticket.
2. Press **Call next**, then open **Counter Desk**, create a student account and enroll the student.
3. Sign in as the Cashier and record the payment.
4. Sign in as the new student with the temporary password and view the schedule and balance.
5. Open `/board` to see the Now Serving screen.

## Security

Passwords are hashed with bcrypt. Logins lock after 5 failed attempts. Routes are protected by role, and department staff can only act on their own office. Requests are rate limited, input is validated and escaped, and important actions are written to an audit log. Known limitations: the login token is kept in browser storage, and there is no multi-factor sign-in.

## Deployment

- **Backend:** Railway, Root Directory `/backend`, with a PostgreSQL database. See `backend/.env.example` for the environment variables.
- **Frontend:** Vercel, Root Directory `frontend`, with `VITE_API_URL` set to the API address.

## Team

| Member | Area | Main files |
|---|---|---|
| [Member 1] | Backend: accounts, registrar, database | `backend/src/models`, `routes/auth.js`, `routes/registrar.js`, tests |
| [Member 2] | Backend: queue, documents, cashier, setup | `routes/queue.js`, `routes/documents.js`, config, seeders |
| [Member 3] | Frontend: student pages, login, layout | `pages/StudentPages.jsx`, `pages/Auth.jsx`, `App.jsx` |
| [Member 4] | Frontend: staff, admin and queue pages, styling | `pages/StaffPages.jsx`, `pages/QueuePages.jsx`, `ui.jsx` |

## Course

[Course code and title], [School name], [Instructor name], [School year and term].
