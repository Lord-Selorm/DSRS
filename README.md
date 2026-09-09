# DSRS — Disused Sealed Radioactive Sources Inventory & Tracking

A full-stack inventory and traceability system for registering, categorizing and tracking disused sealed radioactive sources (DSRS) held by facilities (hospitals, industry, research).

It implements the workflow of the reference *DSRS Software System Summary* (End Users register/search, DSRS entry, traceability via QR + barcode, inventory statistics) against the real Ghana NRA *DSRS Inventory Database* schema, with automatic source categorization using the IAEA D-value method (A/D ratios, IAEA Tables II.1 and II.2).

Runs as a web app served on one port, with an optional Electron desktop shell.

## Features

- **Login** — JWT-based, role-aware (admin / operator). Unauthenticated users get bounced to `/login`.
- **End Users** — register and search the facilities that hold sources (name, license number, RPO/RPE contact, address).
- **DSRS Entry** — register new sources with the full 40-field registry. Category 1–5 is auto-calculated from activity ÷ D-value and cannot be entered by hand. Includes filters and Excel export.
- **Inventory Preview** — live-search + filterable table of all sources with Excel export (category colored badges, high-risk (Cat 1–2) shortcut filter).
- **Traceability** — click any source for its complete audit trail: every create/update/transfer/measurement/leak-test/conditioning/disposal event with who and when. Each source also renders a downloadable **QR code** (`dsrs://source/<id>`) and a **Code128 barcode** (from the registered barcode, falling back to the source serial). Photo, current status and endpoint (capsule / concrete drum / borehole disposal intention) shown.
- **Statistics** — filters (end user, radionuclide, category, location, receipt year, conditioning status) over a per-location pie chart and an activity-vs-year scatter with a summary table; exports the chart panel as PNG via html2canvas.
- **Users (admin)** — manage operator accounts, roles, deactivation.

## Tech stack

| Layer | Technology |
|---|---|
| Front end | React 18, Vite 5, Tailwind CSS 3, Chart.js + react-chartjs-2, html2canvas, react-table, XLSX |
| Back end | Node.js ≥ 18, Express 4, mysql2 (pooled), JWT (jsonwebtoken), bcryptjs, multer (photo uploads), qrcode, bwip-js (barcodes) |
| Desktop shell | Electron 28 (loads `http://localhost:5000`) |
| Database | MySQL 8 / MariaDB 10.4 (XAMPP for local development) |

## Architecture

```
Electron (optional desktop shell)
        │
        ▼
React SPA  (client/, built by Vite into client/dist)
        │  fetch /api/*
        ▼
Express API  (server/, port 5000)  ──►  MySQL pool  ──►  dsrs_db
   ├─ /api/auth            login, current user
   ├─ /api/sources         CRUD, search, history, uploads,
   │                       /d-values, /calculate-category,
   │                       /:id/qrcode, /:id/barcode
   ├─ /api/institutions    end-user facilities
   ├─ /api/users           admin-only user management
   └─ /api/dashboard       aggregate statistics
```

In production the Express server serves `client/dist` as static files, so the whole application runs on a single port (`http://localhost:5000`). In dev, Vite's HMR server proxies `/api` to the API.

## Database schema

`server/database/schema.sql` defines:

- **`users`** — app accounts (admin + operators), bcrypt password hashes.
- **`institutions`** — end-user facilities (add/update; soft-deleted to keep history).
- **`d_values`** — the per-radionuclide IAEA Table II.2 D-values (32 radionuclides).
- **`sources`** — the registry itself, one row per DSRS, grouped by:
  - *Unique ID*: `device_serial_no`, `source_serial_no`, `nra_registration_no`, `source_barcode` (all indexed)
  - *Radionuclide*: `radionuclide_id`, half-life value/unit, original/current activity + dates + units (TBq…uCi)
  - *Classification*: `source_classification` (1–5, always computed)
  - *Physical*: form, length, diameter, mass; manufacturer, country, certificate no.
  - *Ownership & usage*: original/current owner, license/transfer dates, applications, reason, authorization, transporter
  - *Location & control*: facility unit, cage address, dates, responsible officer
  - *Radiological characterization*: radiation type, dose rates (1 m / surface), background, measurement date, instrument(s) with calibration due dates
  - *Integrity*: leak-test method/result/date, integrity, contamination, visual inspection
  - *Endpoint*: `conditioning_status` (none/conditioned/disposed), capsule details, `concrete_drum_no`, `borehole_disposal_intention`, return-to-supplier, reuse
- **`source_measurements`** — dose-rate measurement history.
- **`source_leak_tests`** — leak-test history.
- **`source_history`** — the audit log: `change_type` ∈ create, update, transfer, measurement, leak_test, conditioning, disposal, with field, old/new value, notes and who.

All `sources`/history tables use foreign keys back to `d_values`, `institutions`, and `users`.

## Source categorization

On every create/update the server converts activity to TBq and computes `A/D`:

```
A  = current activity (any unit, converted to TBq)
D  = radionuclide D-value (TBq) from d_values (IAEA Table II.2)
```

| Category | Condition (A/D) |
|---|---|
| 1 | `A/D ≥ 1000` |
| 2 | `1000 > A/D ≥ 10` |
| 3 | `10 > A/D ≥ 1` |
| 4 | `1 > A/D ≥ 0.01` |
| 5 | `A/D < 0.01` |

The same threshold logic lives in `server/models/DValue.js` and (for instant form feedback) `client/src/utils/unitConversion.js`.

## Setup

### Prerequisites

- Node.js ≥ 18
- A running MySQL/MariaDB server, e.g. XAMPP (defaults assumed: host `localhost`, port `3306`, user `root`, empty password)

### 1. Install dependencies

```bash
npm run install:all
```

(or `npm install` in the repo root, `server/`, and `client/` individually)

### 2. Configure environment

Copy the example and edit:

```bash
cp server/.env.example server/.env
```

Required variables:

| Variable | Meaning | Local default |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | *(empty)* |
| `DB_NAME` | Database name | `dsrs_db` |
| `JWT_SECRET` | Token signing secret — **set a real value** | — |
| `PORT` | API port | `5000` |
| `DB_SSL` | `true` when DB requires TLS (cloud) | unset |

Provisioning-only variables: `ADMIN_PASSWORD` (sets the admin password; required in cloud), `DEMO_USERNAME` (default `demo`), `DEMO_PASSWORD` (default `demo2026`, override e.g. `Demo2026!`), `SEED_SAMPLE_SOURCES` (`0` to skip sample rows).

### 3. Create schema and seed data

```bash
npm run db:init       # create the tables
npm run db:seed       # reference data (d_values + sample institutions)
npm run db:provision  # idempotent: schema + reference data + users + optional sample inventory
```

`db:provision` is the one-stop command used for fresh setups and cloud deploys.

### 4. Run

```bash
npm run build:client        # Vite build into client/dist
npm start                   # Express serves API + built client on http://localhost:5000
```

- Dev mode (server nodemon + client Vite HMR): `npm run dev`
- Desktop app: `npm run start:electron` (opens the built UI in Electron)

### 5. Login

After provisioning:

- `admin` — password from `ADMIN_PASSWORD` (if set; otherwise the existing admin password is kept)
- `demo` — password from `DEMO_PASSWORD` (default `demo2026`; the demo deployment uses `Demo2026!`)

Operators can enter sources and view everything; user administration requires the admin account.

## Tests

```bash
cd server
npm test
```

An integration suite (`node:test`) that boots the Express app on an ephemeral port against the live database and asserts:

- health endpoint and auth (401 without token, wrong password rejected, demo login)
- the `d_values` table has all 32 radionuclides with the documented D-values (spot-checked)
- A/D category boundaries at exactly 1000 / 10 / 1 / 0.01 and mid-ranges
- source create with GBq→TBq conversion auto-classifies, detail returns join data + a `create` audit event
- update recalculates category and appends history
- search by radionuclide and partial NRA registration
- QR and Code128 barcode render valid PNGs (including the serial fallback) and 404 for missing sources
- non-admin is denied `/api/users`

Test rows are created with a `TEST-` prefix and removed on completion.

## Deployment

Because it is plain Node + MySQL, the app can run on any host. A zero-cost path used for the demo:

- MySQL on **TiDB Cloud Serverless** (free 5 GiB tier, TLS required → set `DB_SSL=true`)
- Express on **Render** (free web service, 750 hrs/month, sleeps after ~15 min idle)
- Provision the cloud DB with `npm run db:provision` using the cloud environment variables

The root `package.json` ships `start`, `db:provision` and an `engines` field for Node ≥ 18 (`serve`-style hosts can also use Start Command `node server/index.js`).