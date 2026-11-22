# Agents and direct customer commission

Commission is recorded once against an annual rental agreement. The amount is entered manually: there is no default amount, suggested rate or percentage calculation. An unentered amount remains `null` and is shown as **Amount not entered**. An explicitly entered zero means no commission. New and renewed agreements start with an empty agent/commission section.

The customer pays the agent directly. These are tracking records only: they never post to tenant rent balances, company collections, property expenses, rent cheques or security. Property, customer and agreement screens show the related agent commission separately. Agent wallet totals are agreed commissions, confirmed direct receipts and outstanding amounts; unentered amounts are excluded and identified.

## Use

1. Open **Agents → Add agent** to register a name and optional contact/company details.
2. Choose the agent while creating an agreement, or use **Agreement → Agent commission → Record commission** for an existing agreement. Leave the amount blank until agreed, or enter it yourself.
3. Use **Record payment** for a confirmed direct customer payment. Record the amount, date, method and reference. A cheque is recorded only after it clears. A confirmation checkbox is required.
4. Supporting PDF/image receipts use the existing private scanned document service, linked to the agreement. Upload a receipt, then select it before saving the payment. Other workspaces' documents cannot be linked.
5. The agent profile contains the wallet history and a CSV statement. Commission tables support property/search filters and filtered CSV export. Property and tenant profiles link the same commission records.

## Corrections and access

- Owners, managers and accountants can manage and read agent records. Viewer accounts cannot read the underlying agent/commission tables or mutate them. No agent login or online payment service is introduced.
- Changing an existing commission requires a reason and the latest revision. Old/new amounts and agent references remain in the change history.
- A commission cannot be reduced below net recorded receipts. Reverse an incorrect receipt first. Agent attribution cannot change once any payment history exists.
- Reversing a receipt creates a separate entry and keeps the original. It does not transfer or refund money. A receipt can be reversed once.
- Workspace transactions serialize edits/payments across processes, enforce the pending balance and prevent concurrent overpayment. Request keys make retries idempotent, and duplicate references for the same commission are rejected.
- Supporting files referenced by recorded receipts cannot be archived. Original superseded document versions remain downloadable for historical evidence.

## Upgrade

Back up the dedicated assets database and private files first. Migration `003_agent_commissions` adds `agents`, `agent_commissions`, `agent_receipts` and `agent_commission_events`. Versions 001 and 002 remain unchanged. No existing agreement is assigned an agent, no commission amount is backfilled, and no sample agent or payment is inserted. Grant migration privileges only on the assets database and restore runtime CRUD privileges before activation. The encrypted backup includes these tables automatically; any future restore must insert original receipt rows before their linked reversals.
