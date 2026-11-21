# Local Application and Operating Rules

The first working version uses Next.js, Supabase PostgreSQL, authentication, private file storage and a local ClamAV scanner. It is an internal staff application in English, with AED amounts and Asia/Dubai business dates. Conversation with the user remains in Roman Hinglish.

## Running locally

```powershell
.\scripts\pnpm.ps1 db:start
docker compose -f compose.services.yaml up -d
.\scripts\pnpm.ps1 exec supabase migration up
.\scripts\pnpm.ps1 exec node --env-file=.env.local scripts/bootstrap-demo.mjs
.\scripts\pnpm.ps1 dev --port 3200
```

For a background preview using an optimized build, run `scripts/preview-local.ps1 -OpenBrowser`. It starts dependencies, applies migrations, prepares the demo, builds the app and opens the local URL. Stop that frontend with `scripts/stop-preview.ps1`; its database and files remain intact.

Open http://127.0.0.1:3200. The local preview provides an Explore demo workspace button. Its generated password stays in ignored `.env.local`; it is not embedded in browser code. Demo sign in requires explicit `LOCAL_DEMO=true`, a loopback backend, a loopback configured app origin and a loopback request host. It is unavailable on an externally hosted app. The seeded portfolio is fictional and labelled as demo data. Running the seed again preserves existing records.

Create an empty workspace from Settings to try entering a separate portfolio. A workspace selector switches between workspaces to which the signed-in user belongs. This local preview is for evaluation; provision named staff accounts and disable the local demo before using real customer documents in production.

## Implemented workflows

- Dashboard with database-derived property totals, occupancy, rental collections, upcoming cheques and activity.
- Property creation and editing, automatically created ground and upper floors, additional floors, and individual flat creation and editing.
- Studio, 1 BHK, 2 BHK and 3 BHK categories, monthly asking rent, amenities, area and maintenance availability.
- Tenant creation and editing, contact details, opening balances and rental history.
- Annual agreement creation with 1, 2, 3, 4, 6 or 12 cheques. Four and six are the main supported business cases.
- Agreement detail with a printable unsigned internal summary and private signed-contract uploads. The summary is not an approved Ajman tenancy contract template.
- Cheque tracking, bank and number updates, clearance, bounce and cancellation records. Security cheques are separate.
- Tenant accounts with account adjustments, cash or bank payments, opening balances and an immutable entry history.
- Separate refundable cash deposits and security cheque records, including return status.
- Private document upload, preview, download and version replacement for properties, floors, flats, tenants and agreements.
- Occupancy and collection reports, account balance exports, CSV downloads and browser printing.
- Workspace settings, role-based access and personal reminder read status.

## Financial conventions used in this version

These conventions make the application reviewable while the remaining business questions are discussed:

- Store money as integer fils. A positive account balance means the tenant owes the company; a negative balance means tenant credit.
- The opening balance is a previously existing amount, entered once when creating the tenant. It is separate from the new agreement's rent.
- Creating an agreement adds its annual rent charge on the start date. Future-dated entries do not affect an earlier account balance.
- Generate exact installment totals, allocating any remaining fils to the final cheque. Dates advance by calendar months and clamp to valid month ends.
- Generated rent cheques start as scheduled. Receiving a cheque is separate from its actual bank clearance.
- A cleared rent cheque creates exactly one payment entry. Retrying the same clearance cannot duplicate the payment.
- Cash and bank-transfer payments use an idempotency key. They do not automatically clear or cancel a bank cheque.
- Held deposits and security cheques do not change rental account balances.
- Overdue cheque amounts and total tenant balances are different measures. An annual rent balance includes future installments.
- Agreement date ranges for the same flat cannot overlap, including concurrent creation requests. The unit row is locked while checking and saving.
- Flat occupancy uses active agreement dates for today. Future agreements show as reserved; expired agreements stop counting as occupied.
- Closing an agreement is supported at or after its term ends. Early termination and prorated settlement need agreed business rules before implementation.

## Reminders

A PostgreSQL Cron job runs at 04:00 UTC daily, equivalent to 08:00 in Dubai. It creates reminders for pending rental cheques due within seven days and for overdue cheques. Agreement creation and cheque status changes also generate reminders. Reminder records are unique per cheque and type; read status is personal to each staff user. Finalized cheques are filtered out of the attention list.

The database job runs independently of the browser. The visible application refreshes data once per minute and on returning to the tab. A cheque appears once in the attention list, with an overdue reminder taking priority over its earlier due reminder. External email, WhatsApp and push delivery are not configured; notifications appear in the application.

## Document handling and access

- Accept PDF, JPEG, PNG and WebP up to 20 MB. Validate actual file signatures and image decoding; image pixel count is limited.
- Scan originals with ClamAV before storing them. Scanner unavailability fails closed with a retry message.
- Store files and generated WebP previews in a private bucket. Originals keep their original bytes; a SHA256 digest is recorded.
- Direct authenticated storage access is not granted. The server authenticates the request and checks record-level permissions before issuing a file link valid for 60 seconds.
- Tenant identity documents and contracts are restricted to owners, managers and accountants. Viewers can read property photos and floor plans, but cannot access private tenant files or mutate records.
- Replacement creates a new version. Previous versions remain downloadable to permitted users.
- Upload request keys prevent a retry from creating a second committed attachment. Failed metadata writes trigger storage cleanup.
- Enforce workspace isolation in PostgreSQL row-level security and composite foreign keys. A document URL or UUID alone does not grant access.
- Authentication cookies are HTTP-only. Write routes check the browser origin. The development application, scanner and backend bind to loopback.

## Backups

```powershell
.\scripts\pnpm.ps1 exec node --env-file=.env.local scripts/backup-local.mjs
.\scripts\pnpm.ps1 exec node --env-file=.env.local scripts/backup-local.mjs --verify backups/<backup-directory>
```

The backup command streams the database archive and private storage archive directly into AES-256-GCM encrypted files under ignored `backups/`. It generates a backup key in ignored `.env.local` on first use. Keep that key separately; encrypted backups cannot be recovered without it. Verification decrypts and authenticates both archives and checks their archive listings without modifying the live database. A full disaster-recovery drill and scheduled off-device backups remain deployment work.

## Validation and production work

The automated tests use isolated verification workspaces and fictional records. They cover tenant and property forms, agreement overlap, exact installments, payment idempotency, security separation, private file upload and replacement, cross-workspace and viewer access, CSV export, mobile layout, keyboard focus and reduced motion.

Before production: confirm wallet and settlement rules; approve the official tenancy template; configure staff onboarding, hosted Supabase and its region, HTTPS, scanner hosting, monitoring, retention, automatic off-device backups and a verified restoration procedure. Decide external reminder channels and provider accounts. Do not use the local demo account as a production staff account.

## Brand and paid parking update

The application now includes the company brand redesign, editable floor uses, private company inventory and paid parking control. Annual parking charges share the tenancy cheque schedule and have separate ledger debits. See [Design and parking workflows](design-and-parking.md) for reservation constraints, amendments and validation.
