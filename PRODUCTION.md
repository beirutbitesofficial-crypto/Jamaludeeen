# JAMALUDEEN Production Deployment

This branch is designed to run the storefront and Store System from one Node.js application.

## Required runtime

- Node.js 22.x
- Persistent filesystem directories for database, backups, and uploads
- HTTPS enabled at the public domain

## Required environment variables

```env
NODE_ENV=production
SESSION_SECRET=<random value at least 32 characters>
ADMIN_USERNAME=<owner username>
ADMIN_PASSWORD=<strong password at least 12 characters>

DATA_DIR=<absolute persistent directory>/jamaludeen-data
BACKUP_DIR=<absolute persistent directory>/jamaludeen-backups
UPLOADS_DIR=<absolute persistent directory>/jamaludeen-uploads
```

Optional store variables remain documented in `.env.example`.

Do not place `DATA_DIR`, `BACKUP_DIR`, or `UPLOADS_DIR` inside a deployment/release directory that Hostinger replaces during redeploys.

## Data safety

- Main DB: `DATA_DIR/store.db`
- Persistent sessions: `DATA_DIR/sessions.db`
- SQLite WAL and foreign keys are enabled.
- Database backups run automatically every 6 hours by default.
- Backup retention defaults to the latest 14 backups.
- Admin-uploaded product, brand, and settings images are stored in `UPLOADS_DIR`.

For stronger disaster recovery, periodically copy the backup directory to storage outside the same hosting account.

## Inventory rules

- Local refill perfumes use stock measured in **ml**.
- Only **50ml** and **100ml** sales are supported.
- A 50ml sale subtracts 50ml per bottle.
- A 100ml sale subtracts 100ml per bottle.
- Brand products use stock measured in units.
- Local perfume purchase quantities are entered in ml and purchase cost is cost per ml.
- Online orders reserve stock when the order is placed.
- Cancelling an online order releases its reserved stock.
- Delivered online orders enter the same sales/reporting ledger as POS sales.

## Cash rules

- POS cash sales require an open shift.
- Cash LBP and Cash USD are reconciled separately.
- Whish/Card do not alter drawer cash.
- Refunds and expenses paid from the drawer create cash-ledger movements.
- Shift expected cash is calculated from the cash ledger rather than gross sales totals.

## Security

- Production will not start if required security/environment values are missing.
- Default production admin credentials are not allowed.
- Sessions are server-side and persistent.
- Session cookies are HTTP-only, SameSite=Lax and Secure in production.
- Cross-site state-changing requests are blocked.
- Login attempts are rate limited.
- Admin/POS pages use no-store cache headers.
- Production dependency audit is a required CI check.

## Pre-launch checklist

1. Set every required environment variable in Hostinger.
2. Confirm the three persistent directories survive a redeploy.
3. Deploy Node.js 22.x.
4. Open `/healthz` and confirm it returns `{"ok":true}`.
5. Login at `/system`.
6. Enter real stock in ml for local perfumes and units for brand products.
7. Enter 50ml/100ml selling prices and costs.
8. Open a test shift.
9. Complete one 50ml cash sale and one 100ml non-cash sale.
10. Refund the test sale and verify stock.
11. Place one website order, then cancel it and verify stock returns.
12. Confirm a backup file appears in `BACKUP_DIR`.
13. Redeploy once and verify products, sales, sessions, stock, uploads, and database data remain present.

## CI gate

The Store System workflow checks:

- dependency installation
- production dependency audit
- JavaScript syntax
- EJS compilation
- fresh database schema
- production integration smoke flow
- automatic database backup creation
- session/database persistence across restart
- POS 50ml/100ml stock deductions
- refunds, expenses and shift reconciliation
- purchases
- online order reservation/delivery/cancellation
- server health endpoint

Do not merge a failing Store System workflow into production.
