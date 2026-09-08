# Somali Star Academy

A full-stack school management system for Somali Star Academy. The application is organized as a React frontend and an Express/Mongoose backend, with MongoDB as the only database.

## Project structure

```text
frontend/   React 19, TypeScript, Vite, Tailwind CSS
backend/    Express 5, Mongoose, JWT sessions, WebSocket realtime, file storage
docs/       System discovery and audit records
```

## Requirements

- Node.js 22 or newer
- MongoDB 7 or newer, available locally or through MongoDB Atlas

## Local setup

1. Install all workspace dependencies with `npm install`.
2. Copy `backend/.env.example` to `backend/.env`. Vite automatically uses the committed development or production API endpoint for its current mode.
3. Set a strong `JWT_SECRET` and the manager bootstrap values in `backend/.env`.
4. Set `SEED_DEFAULT_PASSWORD`, then run `npm run seed` to create the academic foundation and initial role accounts. The command is idempotent and preserves existing records.
5. Run `npm run dev:backend` and `npm run dev:frontend` in separate terminals.

The production frontend is `https://somalistaracedemy.elivateict.com` and its API endpoint is `https://somalistaracedemy.elivateict.com/api`. Local development runs the frontend at `http://localhost:5173` and the backend at `http://localhost:5000/api`. Login uses the school-issued user ID and password.

## Validation

```bash
npm run check
npm test
npm run build
```

The integration suite starts an isolated MongoDB process, exercises authentication and authorization, verifies persistence and server-side quiz scoring, and tests destructive-operation safeguards. `backend/scripts/browser-audit.ts` provides a role-aware Playwright audit of the application routes.

## Data and security

- Passwords are hashed with bcrypt and never returned by the API.
- Access and refresh sessions are signed, rotated, revocable, and stored with expiry metadata.
- Every data request passes through centralized role and ownership policies.
- Administrative writes create audit records.
- Uploaded files are validated, size-limited, stored outside the frontend, and served through controlled API routes.
- Quiz answers are scored on the server; answer keys are withheld until submission.
- Secrets belong only in local environment files. Commit the example templates, never real credentials.

## Importing existing data

Place a JSON export in a local path and run:

```bash
npm run import --workspace backend -- path/to/export.json
```

The importer validates collection names and normalizes records before inserting them into MongoDB. Back up the target database before importing production data.
