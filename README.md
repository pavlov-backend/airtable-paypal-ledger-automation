# Airtable Financial Engine (PayPal & Tax Automation)

A collection of high-performance scripts for Airtable that automate the entire accounting lifecycle for independent contractors and small businesses. This system transforms Airtable from a simple spreadsheet into a robust financial ledger.

## Core Features

- **PayPal API Integration:** Automated ingestion of both incoming payments (Revenue) and outgoing payouts (Expenses/Withdrawals) using OAuth 2.0.
- **Dynamic FX Rate Enrichment:** Real-time integration with the National Bank of Georgia (NBG) API to fetch official exchange rates for accurate multi-currency reporting (USD/GEL).
- **Automated Tax Logic:** Custom JavaScript engine to calculate the regional 1% Small Business tax based on monthly revenue, with automated record creation in a dedicated 'Tax' table.
- **Data Integrity & Deduplication:** Strict logic to prevent duplicate transaction entries using PayPal Transaction IDs and Set-based lookups.
- **Fee Management:** Automated calculation of PayPal processing fees (7.9% or custom) to track net versus gross income.

## Setup Instructions
1. Create an Airtable Base with tables: `Book Income | Expense` and `Paying Taxes`.
2. Set up PayPal Developer credentials (Client ID and Secret).
3. Use the Airtable 'Scripting' extension to run these scripts via Buttons or Automations.
