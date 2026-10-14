# UniServe Frontend

React 18 + Vite + Tailwind CSS web app for UniServe (student, registrar, cashier, department and admin portals, plus the public Now Serving queue board).

## Run locally
```
cp .env.example .env
npm install
npm run dev
```

## Scripts
- `npm run dev` - start the dev server
- `npm run build` - production build into `dist/`
- `npm test` - run the Vitest suite

## Environment
- `VITE_API_URL` - base URL of the backend API (e.g. `https://your-backend.up.railway.app/api`)
- `VITE_UNIVERSITY_NAME` - name shown in the header

## Deploy
Vercel with Root Directory `frontend`, or build the included Dockerfile (nginx).
