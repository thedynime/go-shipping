# GoShipping — Operations & Deployment Manual

Operational guide for system provisioning, deployment to Hostinger, database management, and maintenance.

---

## 1. Hosting & Runtime Topology

| Layer | Hostinger Production Specification |
|---|---|
| **Runtime** | Node.js v20+ / v22+ (LTS) |
| **Server Process** | Single process executing `node ./dist/server/entry.mjs` |
| **Port** | Driven by `PORT` env var (Default: `4321`) |
| **Reverse Proxy** | Nginx / Apache handled by Hostinger Cloud |
| **Database** | Hostinger Managed MySQL / MariaDB (Port `3306`) |
| **Connection Pool** | Bounded pool (`connectionLimit: 10`) via `mysql2/promise` |

---

## 2. Environment Catalog

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Node environment |
| `PORT` | No | `4321` | Application HTTP listening port |
| `APP_URL` | Yes | `https://goshipping.com` | Base URL for links and CORS |
| `DB_HOST` | Yes | `127.0.0.1` | Hostinger MySQL hostname or IP |
| `DB_PORT` | Yes | `3306` | Database listening port |
| `DB_USER` | Yes | — | Database username |
| `DB_PASSWORD` | Yes | — | Database password |
| `DB_NAME` | Yes | `goshipping` | Master database name |
| `DB_CONNECTION_LIMIT`| No | `10` | Max concurrent pool connections |
| `SESSION_SECRET` | Yes | — | Minimum 32-character encryption key |
| `JWT_SECRET` | Yes | — | Token signing secret |
| `TRACKING_POLL_INTERVAL_MS` | No | `25000` | Client polling frequency (ms) |

---

## 3. Database Migration & Seeding Runbook

1. **Push Schema Directly**:
   ```bash
   npm run db:push
   ```
2. **Generate Migration Files**:
   ```bash
   npm run db:generate
   ```
3. **Seed Initial Records**:
   ```bash
   npm run db:seed
   ```
4. **Launch Drizzle Studio**:
   ```bash
   npm run db:studio
   ```

---

## 4. Background Scheduled Tasks (Cron)

In Hostinger Control Panel (hPanel) -> Advanced -> Cron Jobs:

| Frequency | Command / Endpoint Trigger | Purpose |
|---|---|---|
| `*/15 * * * *` | `curl -s -X POST https://goshipping.com/api/cron/sync-carriers` | Sync external airline / vessel API statuses |
| `0 2 * * *` | `curl -s -X POST https://goshipping.com/api/cron/cleanup-sessions` | Purge expired user sessions |
| `0 3 * * *` | `curl -s -X POST https://goshipping.com/api/cron/archive-quotes` | Archive expired quotations past validity date |

---

## 5. Health Verification & Smoke Testing

- **API Health Endpoint**: `GET /api/health`
  - Returns `status: "online"`, server timestamp, and live MySQL ping status.
- **Tracking Endpoint**: `GET /api/tracking/:query`
  - Supports tracking code, carrier waybill / BOL, importer email, or consignee phone number. Returns single tracking data or multi-shipment consignment history (`matchingShipments`) with HTTP 304 conditional caching.
- **User Management & Masquerade Endpoints**:
  - `GET /api/admin/users`: Lists accounts, roles, active shipment count, and tariff quotes count.
  - `POST /api/admin/users`: Creates a user profile with role, company, phone, and BIN credentials.
  - `PUT /api/admin/users/:id`: Modifies user details and contact coordinates.
  - `PATCH /api/admin/users/:id/status`: Toggles active or suspended account status.
  - `DELETE /api/admin/users/:id`: Permanently purges user account.
  - `POST /api/admin/impersonate/:id`: Authenticates Super Admin as the target user without credentials (masquerade session).
  - `POST /api/auth/exit-impersonation`: Destroys masquerade session and returns Super Admin to `/admin?tab=users`.
- **POS Ledger & Sourcing Terminal Endpoints**:
  - `GET /api/admin/pos-ledger`: Lists POS orders with search and filter parameters (`serviceType`, `paymentStatus`, `supplier`).
  - `GET /api/admin/pos-ledger/stats`: Aggregates real-time KPIs (total orders, RMB purchase, BDT purchase, freight, revenue, collected, due, profit, weight).
  - `POST /api/admin/pos-ledger`: Creates order with automatic server-side recalculations.
  - `PUT /api/admin/pos-ledger/:id`: Updates order with synchronized auto-computations.
  - `DELETE /api/admin/pos-ledger/:id`: Removes record from active ledger.
  - `POST /api/admin/pos-ledger/import`: Parses and imports raw 30-column CSV data from Google Sheets.
  - `GET /api/admin/pos-ledger/export`: Streams 1:1 compatible CSV export for Excel/Google Sheets.
- **Resend Email & Transactional Telemetry Endpoints**:
  - `POST /api/contact`: Public contact form submission triggering ops lead notification to `ops@goshipping.com.bd`.
  - `GET /api/admin/email/status`: Returns Resend SDK domain status for `send.goshipping.com.bd` (verified), region, and DKIM/SPF DNS records.
  - `POST /api/admin/email/verify`: Triggers DNS verification check on Resend API.
  - `POST /api/admin/email/test`: Dispatches a live diagnostic test email to any recipient.

---

## 6. Hostinger SSH Deployment Playbook

For automated or remote terminal deployment to Hostinger Cloud / VPS:

### Connection Parameters
- **Host / IP**: `195.35.62.136`
- **SSH Port**: `65002`
- **SSH User**: `u398667964`
- **SSH Password**: `[REDACTED]` (Stored securely in local environment / secrets vault)

### Quick Connection
```bash
ssh -p 65002 u398667964@195.35.62.136
```

### Standard Deployment Runbook (When Ready to Deploy)
1. **Local Build**:
   ```bash
   npm run build
   ```
2. **Synchronize Code / Artifacts**:
   ```bash
   rsync -avz -e 'ssh -p 65002' --exclude 'node_modules' --exclude '.git' ./dist/ package.json u398667964@195.35.62.136:~/public_html/
   ```
3. **Remote Dependency & Restart**:
   ```bash
   ssh -p 65002 u398667964@195.35.62.136 "cd ~/public_html && npm install --omit=dev && pm2 restart goshipping || node ./dist/server/entry.mjs"
   ```

