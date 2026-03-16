# CA Engine - Enterprise Resource Planning (ERP) Platform

[![Academic Project](https://img.shields.io/badge/Academic-BSc%20(Hons)%20Software%20Engineering-blue.svg)](#)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black.svg)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase%20(PostgreSQL)-3ecf8e.svg)](https://supabase.com/)

## Project Overview

**CA Engine** is a high-performance Enterprise Resource Planning (ERP) platform designed specifically to automate and modernize Chartered Accounting workflows. Developed as a final-year University assessment for a **BSc (Honours) in Software Engineering**, this platform transitions from simple CRUD-based data entry to a sophisticated financial engine governed by strict double-entry accounting principles.

The system serves as a central source of truth for corporate financials, ensuring that every debit is matched by a corresponding credit, thereby maintaining a perfectly balanced ledger. It streamlines complex business processes such as inventory-integrated sales, bank reconciliation, and predictive financial modeling.

---

## Tech Stack & Architecture

The application employs a modern, serverless architecture designed for scalability, security, and high availability.

### Frontend Layer
- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/) utilizing React 19 Server Components for optimized performance.
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) for a highly performant, utility-first UI design system.
- **Component Library:** [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives) ensuring accessible and premium user interface elements.
- **Visualization:** [Recharts](https://recharts.org/) for dynamic, svg-based financial data visualization.

### Backend & Infrastructure (Supabase)
- **Database:** [PostgreSQL](https://www.postgresql.org/) relational database hosting the complex schema of ledger accounts, transactions, and inventory.
- **Business Logic Layer:** [Remote Procedure Calls (RPC)](https://supabase.com/docs/guides/database/functions) used to manage atomic transactions (e.g., selling inventory while simultaneously updating both the asset and income ledgers).
- **Security & Authorization:** [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security) coupled with a custom Role-Based Access Control (RBAC) engine ensures that sensitive financial data is only accessible to authorized company personnel.

---

## Core Modules & Engineering Excellence

### 1. Atomic Double-Entry Ledger
At the heart of the CA Engine is a robust Double-Entry Ledger. Every transaction recorded—whether manual journal entry or automated sale—is validated to ensure fundamental accounting equilibrium:
`Assets = Liabilities + Equity`
The system strictly prevents unposted or unbalanced entries from affecting the primary financial reports.

### 2. Automated Inventory & COGS Engine
Unlike standard e-commerce trackers, the Sales Terminal in CA Engine is a "Full-Stack" financial module. When a sale is processed:
- **Inventory Reduction:** Real-time stock levels are updated using SQL constraints to prevent over-selling.
- **COGS Valuation:** The system calculates the Cost of Goods Sold based on historical purchase prices.
- **Automatic Journaling:** A multi-line journal entry is automatically generated, debiting 'Cash/Bank', debiting 'COGS', crediting 'Revenue', and crediting 'Inventory Asset'—executing in a single atomic database transaction.

### 3. Bank Reconciliation Algorithm
The reconciliation engine streamlines the verification of internal records against external bank statements.
- **CSV Processing:** Utilizes [Papaparse](https://www.papaparse.com/) for high-speed client-side parsing.
- **Matching Heuristics:** A custom algorithm pairs ledger entries with bank records based on exact amount matching, significantly reducing human error in monthly financial closings.

### 4. Predictive Financial Forecasting
CA Engine leverages historical transaction data to model future performance.
- **Cash Flow Runways:** Using linear interpolation and historical run-rates, the Recharts-powered dashboard generates a 6-month predictive model.
- **Scenario Planning:** Users can model 'Extra Monthly Expenses' to see an immediate impact on their projected treasury runway.

### 5. Dynamic Financial Reporting
Full financial transparency is provided through real-time generation of mission-critical reports:
- **Income Statement (P&L):** Dynamic calculation of revenue minus expenses.
- **Balance Sheet:** Real-time snapshot of the company's financial position.
- **Trial Balance:** An auditing tool to verify ledger balance across all accounts.
- **PDF Artifacts:** Professional PDF generation using [jsPDF](https://github.com/parallax/jsPDF) and [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) for corporate-ready documentation.

---

## Corporate Governance & Security

### Role-Based Access Control (RBAC)
The platform implements three distinct security tiers via a custom `useUserRole` React Hook:
- **Admin:** Full system control, including Chart of Accounts management and factory reset capabilities.
- **Data Entry:** Permission to record sales and upload bank statements, but restricted from altering core configurations.
- **Auditor:** Read-only access to all financial reports and the Audit Log for compliance verification.

### Tamper-Proof Audit Logging
Any modification to the Chart of Accounts or sensitive records is automatically logged in the `system_logs`. This provides an immutable trail of "Who did what and when," essential for corporate governance and external audits.

---

## Use Case Diagram

The following diagram outlines the primary interactions between system actors and the core business logic:

```mermaid
useCaseDiagram
    actor "Admin" as admin
    actor "Junior Accountant" as accountant
    actor "System Engine" as engine

    package "CA Engine ERP" {
        usecase "Manage Chart of Accounts" as UC1
        usecase "Record Transaction / Sale" as UC2
        usecase "Perform Bank Reconciliation" as UC3
        usecase "Generate Financial Reports" as UC4
        usecase "View Predictive Forecasting" as UC5
        usecase "Factory Reset System" as UC6
    }

    admin --> UC1
    admin --> UC2
    admin --> UC3
    admin --> UC4
    admin --> UC5
    admin --> UC6

    accountant --> UC2
    accountant --> UC3
    accountant --> UC4

    UC2 ..> engine : "Triggers COGS Calculation"
    UC3 ..> engine : "Runs Match Algorithm"
    engine --> UC4 : "Feeds Real-time Data"
    engine --> UC5 : "Generates Projections"
```

---

## Local Setup & Installation

### Prerequisites
- Node.js (v18.x or higher)
- A Supabase Project (PostgreSQL + Auth)

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/ca-dashboard.git
cd ca-dashboard
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory and populate it with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000` to view the application.

---

## License & Credits
Developed by **Your Name** as a final year assessment for the **BSc (Hons) in Software Engineering**.  
*This software is intended for academic and demonstration purposes.*
