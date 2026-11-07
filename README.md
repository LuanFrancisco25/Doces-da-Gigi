# Doces da Gigi

**An offline-first mini-ERP for a home bakery, built with React Native, Expo and SQLite.**

Doces da Gigi helps a small confectionery business answer the questions that matter every day: _How much does each sweet really cost to make? What is in stock? Which orders are due this week? How much money came in and out?_ It replaces notebooks and scattered spreadsheets with one app that lives on the owner's iPhone and works with no internet connection at all.

## Features

**Ingredients and costing**

- Register ingredients by package size, unit (`g`, `ml`, `un`) and price paid; the cost per base unit is calculated automatically.
- Each purchase is recorded in the cash ledger as an expense.

**Sweets and technical sheets**

- Build a recipe from catalog ingredients and see the batch cost, the unit cost (batch cost ÷ yield) and the estimated profit margin in real time.
- Duplicate a sweet with its full recipe to create variations quickly.

**Stock**

- Track ready-to-sell units per sweet, with a colour indicator when a product falls below its minimum.
- Register production batches, optionally deducting the production cost from the cash balance (with a remembered preference).

**Orders**

- Customer, optional phone, delivery date chosen on a calendar, items, quantities and payment method (Pix, cash or card).
- Orders follow a small state machine (see below) and the Orders tab shows only the current month, keeping daily production organized.

**Cash ledger**

- The balance is always the sum of recorded transactions, never a loose number.
- Manual deposits and withdrawals with a reason, plus a live summary of today's income and expenses.

**Calendar and history**

- Browse past orders and cash movements by **day, week, month or a custom date range**, with income, expenses and net balance for the selected period.

**Backup and reports**

- Export a full **JSON backup** and restore it later (validated first, applied atomically).
- Generate **PDF** and **CSV** reports for any period and share them through the iOS share sheet (WhatsApp, Files/iCloud Drive, AirDrop, e-mail).
- CSV files are formatted for Excel/Numbers in Portuguese (`;` separator, decimal comma, UTF-8).

## Order lifecycle

| Status              | Stock                                                 | Cash balance                             |
| :------------------ | :---------------------------------------------------- | :--------------------------------------- |
| **Pending payment** | Units are deducted immediately (reservation)          | No credit                                |
| **Completed**       | Stays deducted                                        | Order total is credited                  |
| **Canceled**        | The user chooses whether to return the items to stock | Reversed if the order had been completed |

## Key design decisions

- **Offline-first.** All data lives in a local SQLite database on the device. There are no servers, accounts or network calls.
- **Ledger as the source of truth.** The balance is derived from `financial_transactions`, so every real-world event (a sale, a purchase, a refund, a manual adjustment) leaves a traceable record.
- **Atomic operations.** Anything that touches more than one table (creating an order and reserving stock, buying an ingredient and booking the expense, restoring a backup) runs inside a single `withTransactionAsync`, so it either happens completely or not at all.
- **History is never rewritten.** A sweet stores its unit cost when it is saved and order items keep the price at the time of sale, so changing an ingredient's price does not alter past results.
- **Layered structure.** `app/` contains only routes and screens; business and infrastructure code lives in `src/` (database, repositories, services, utilities).
- **Testable logic.** Backup and report logic is pure and separated from file access and sharing, which made it possible to test export and restore against a real SQLite database.
- **Safe imports and exports.** Backup files are validated before restoring, and only known columns are accepted. Exported text is escaped, so customer names cannot break the PDF or turn into spreadsheet formulas.

## Tech stack

| Area              | Technology                                                                       |
| :---------------- | :------------------------------------------------------------------------------- |
| Framework         | React Native with Expo (SDK 58)                                                  |
| Language          | TypeScript                                                                       |
| Navigation        | Expo Router (file-based)                                                         |
| Database          | `expo-sqlite` (async API with transactions)                                      |
| UI                | React Native Paper (Material Design 3), custom pink theme                        |
| Calendar          | `react-native-calendars`                                                         |
| Files and sharing | `expo-file-system`, `expo-sharing`, `expo-print`, `expo-document-picker`         |
| Other             | `expo-crypto` (UUIDs), `@react-native-async-storage/async-storage` (preferences) |

## Project structure

```
app/                          Routes and screens only (Expo Router)
├── _layout.tsx               Root stack, providers and theme
├── backup.tsx                Backup, restore and reports
├── (tabs)/
│   ├── _layout.tsx           Bottom tabs
│   ├── index.tsx             Cash balance and recent movements
│   ├── ingredients.tsx       Ingredient catalog
│   ├── stock.tsx             Sweets, stock and production
│   └── orders.tsx            Current-month orders
├── orders/
│   ├── new.tsx               New order
│   └── history.tsx           Calendar: day, week, month and period views
└── products/
    └── new.tsx               New sweet with technical sheet

src/
├── components/               Reusable UI (modal, text input, date picker, status badge)
├── database/
│   ├── schema.ts             Tables, constraints and indexes
│   └── repositories/         Data access (ingredients, products, orders, transactions)
├── services/                 Backup/report logic, file sharing, settings
├── theme/                    Colour palette and Paper/navigation themes
├── types/                    Shared TypeScript types
└── utils/                    Currency and date helpers, calendar locale
```

## Getting started

**Requirements:** Node.js (LTS), and either the **Expo Go** app on an iPhone or an iOS/Android simulator.

```bash
git clone https://github.com/luanfrancisco25/doces-da-gigi.git
cd doces-da-gigi
npm install
npx expo start
```

Scan the QR code with the iPhone camera to open the app in Expo Go. If something looks stale after pulling changes, restart with a clean cache:

```bash
npx expo start -c
```

## Data and privacy

Everything is stored locally in the app's private storage. Nothing is uploaded anywhere. Backups and reports are ordinary files that the user decides where to save or send.
