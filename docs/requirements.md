# Property and Rental Management Requirements Draft

Status: Initial discussion draft, pending business decisions.

Date: 21 November 2026.

Build one system to manage the company's buildings in Ajman, their flats, tenants, annual rental agreements, tenant balances, documents and rental cheques. Complete and review requirements before starting application development. The company name and its English spelling remain to be confirmed.

## Confirmed requirements

### Buildings, floors and flats

- The portfolio currently contains approximately 9 or 10 buildings; the exact count is pending. The system must allow additional buildings.
- Each building contains floors, including ground, first, second and subsequent floors as applicable.
- Each floor contains individually identified flats.
- Flat categories include Studio, 1 BHK, 2 BHK and 3 BHK.
- Record each flat's rent and offered amenities, including parking where applicable.
- Upload real property photographs and maps or floor plans. Confirm which files belong to a building, floor or individual flat during detailed design.
- Track whether each flat is rented or vacant.

### Tenants and documents

- Maintain a customer or tenant profile and contact details.
- Keep passport, Emirates ID, bank statements and other relevant customer documents within that customer's profile.
- Link the tenant, rented flat, rental agreement and related payments.
- Keep the rental agreement in the system. The process for preparing a new agreement is still to be decided.

### Rental agreements and cheques

- Support annual rental agreements.
- Record rent payable in four or six cheques, as applicable to the agreement.
- Capture each cheque's amount, date and identifying details, linked to its tenant and agreement.
- Record a security cheque where one has been taken.
- Track cheques and notify the relevant user seven days before the cheque date.
- Keep the annual rental amount, payment schedule and monthly rent information understandable together. The contractual source of the amount is an open question.

### Tenant wallet and balance

- Provide a tenant wallet or account showing the opening balance and subsequent activity.
- Show rental payment cheques and security instruments associated with the tenant.
- Confirm the meaning and direction of the opening balance before defining calculations.

### Reports

- Show the total number of flats in each building.
- Show rented and vacant flat counts by building and across the portfolio.
- Show the number of customers or tenants; define active and historical counts separately during review.
- Support reviewing rental and cheque records across all buildings.

### Simplicity, speed and secure file handling

- Images, maps, customer documents and contracts are core application records. Plan their storage and access before application development.
- Keep routine property, tenant and document management simple to use.
- Keep the application responsive as the number of records and uploaded files grows.
- Protect private documents and contracts with authenticated, authorized access.

## Proposed operating rules for discussion

These are proposed requirements, not approved business decisions.

### Separate balances from cheque custody

- Treat the wallet as an account history; whether tenants can make payments through it is a separate decision.
- Distinguish rent charged, payments actually received, advances, adjustments and opening balances.
- Keep refundable cash security deposits separate from rental receivables.
- Track security cheques separately from rent cheques and received cash.
- Receiving a cheque must not automatically mark rent as paid. Confirm the event that records a successful payment, such as confirmed cheque clearance.
- Proposed rent cheque states: received, submitted to bank, cleared, bounced, replaced and cancelled. Return or release of a security cheque needs its own record.
- Agree how cheque replacement, partial payments, refunds and corrections affect balances before implementation.

### Agreements and occupancy

- Record agreement dates, agreed rent, installment amounts and due dates explicitly.
- Check that the rental installment schedule agrees with the contracted rent; handle separately approved charges separately.
- Prevent overlapping active agreements for the same flat.
- Preserve prior tenant and agreement history when a flat is rented again.
- Confirm whether reserved or maintenance flats need their own availability states and how they appear in vacancy reports.
- Include renewal and move-out rules in the detailed requirements if needed for the first release.

### Reminders and reports

- Make the seven-day cheque reminder visible in the system. Email or WhatsApp delivery and recipients require a decision.
- Use an agreed business timezone for due dates; Asia/Dubai is the proposed default.
- Confirm handling of late-entered cheques, bounced cheques, duplicate reminders and reminder delivery failures.
- Proposed additional reports: upcoming cheques, cleared and bounced cheques, overdue balances, rent collected and occupancy percentage.
- Agree report definitions, date filters and export requirements before building them.

### Files and access

- Store actual passports, Emirates IDs, bank statements, cheque images and signed agreements in private application storage with authenticated access. Do not put these files in the public GitHub repository.
- Use dedicated private file storage for uploaded content; keep file metadata and record relationships in the database. Choose the provider during technical planning.
- Link each file to the correct tenant, agreement or property record.
- Define staff permissions for viewing documents, changing rent, recording payments and exporting reports.
- Check permissions on every upload, preview, download, replacement and deletion, including direct file requests. Knowing a file identifier or URL must not grant access. Any temporary download links must expire.
- Protect file transfers with HTTPS and encrypt stored files, database records and backups. Keep storage credentials on the server.
- Validate allowed file formats, actual file contents and size limits on the server. Keep new uploads unavailable until validation and malware checks pass. Confirm supported formats and limits from the actual documents before implementation.
- Preserve original documents and signed agreements. Record replacements as new versions with their author and time rather than silently overwriting history.
- Keep previews, thumbnails and derived files private under the same access rules as their originals. Avoid recording document contents, credentials or temporary access links in logs.
- Keep a history of material financial and agreement changes, with the responsible user and time.
- Back up both the database and file storage, preserving their relationships. Define backup frequency, retention, recovery expectations and deletion rules during technical planning, and verify restoration before storing real customer documents.

### Performance and reliability

- Load property photo thumbnails in lists and galleries; fetch full files only when requested. Keep original documents and contracts unchanged when generating previews.
- Paginate large lists and load document contents on demand instead of downloading all attachments with each customer or property record.
- Run costly file scanning and preview generation in background jobs, with visible pending or failed states and safe retries.
- Show upload progress and recoverable errors. An interrupted upload must not appear as a successfully saved document or create duplicate attachments when retried.
- Complete storage and metadata updates consistently, and reconcile incomplete uploads or missing files so that records do not silently point to unavailable content.
- Run cheque reminders as durable scheduled work independently of whether a user has the application open.
- Agree measurable page response, upload and report performance targets after confirming expected file sizes, total records, concurrent users and hosting. Verify them with representative data before launch.

## Initial workflow

1. Register a building, its floors, flats, categories, rent, amenities and property files.
2. Create a tenant profile and attach the tenant's documents.
3. Select a vacant flat and enter the proposed agreement dates and financial terms.
4. Record the opening balance according to the approved rule, security received and rent cheque schedule.
5. Prepare or upload the agreement using the agreed process, then activate the rental.
6. Review upcoming cheques and record their actual outcomes and related account entries.
7. Review occupancy, customers, balances and collections through reports.
8. Renew the rental or close it on move-out, keeping the historical records.

## Decisions needed next

1. Who will use the application: owner, property manager, accountant, other staff or tenants? What should each role be allowed to do?
2. Is rent agreed as an annual total, or as monthly rent multiplied by the agreement term? Can cheque amounts and payment dates vary?
3. Does opening balance mean existing unpaid rent, a new agreement's rent due, an advance already received or another amount? Can a tenant start with either an amount payable or a credit?
4. Which additional amounts must be tracked: cash deposit, security cheque, parking, maintenance, commission or other charges? Which are refundable or included in rent?
5. Who receives reminders, and through which channels: application, email or WhatsApp?
6. Are there existing property or tenant spreadsheets, a rental agreement format and receipt samples to use as references?

Proposed starting assumptions, pending confirmation: an internal web application usable on desktop and mobile, AED amounts and Asia/Dubai business dates. Interface language, the official company name and initial data import format remain open.

## Planning sequence

1. Resolve the questions above and confirm the first release scope.
2. Document roles, business rules, field lists and worked examples for rent, opening balances, deposits and cheque outcomes.
3. Agree the data relationships, screen flows, reports, agreement process and document access model.
4. Choose the technical stack, hosting and storage based on the approved scope.
5. Review interface designs and acceptance criteria before coding.

The user has authorized selecting and installing the latest stable compatible development tools. The selected toolchain and local setup are documented in [Development Toolchain and Setup](development-setup.md). Business schema, balance calculations, contract templates and application features remain to be finalized and implemented.
