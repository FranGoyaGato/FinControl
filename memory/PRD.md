# Personal Finance Tracker (FinControl)

## Original Problem Statement
Personal finance web application for a single user (Spanish, es-ES locale).
- Import `.csv`, `.xlsx`, `.xls` transaction statements (3-column: Date, Concept, Amount)
- CRUD for accounts, credit cards, categories, subcategories, rules
- Rule-based automatic categorization with retroactive application
- Mobile-first responsive UI with EUR formatting (1.339,71 €)

## Architecture
- Backend: FastAPI + Motor (async MongoDB) at `/app/backend/server.py`
- Frontend: React + Tailwind + shadcn/ui + Radix
- Database: MongoDB (Emergent-managed)
- Structure:
  - `/app/backend/server.py` — API (refactored 2026-02: import parsing split into `_parse_xlsx`, `_parse_xls`, `_parse_csv_text`, `_parse_amount`, `_build_preview_row`)
  - `/app/backend/tests/backend_test.py` + `conftest.py` — pytest suite (34 tests)
  - `/app/frontend/src/utils/format.js` — shared `formatCurrencyEUR` & `buildMonthRangeParams`
  - `/app/frontend/src/pages/` — Dashboard, Income, Expenses, CreditCards, ImportData, Settings

## Implemented (Changelog)
- 2026-02: **Clear Category** — added `clear_category` / `clear_subcategory` query params to `PUT /api/transactions/{id}` and `PUT /api/card-transactions/{id}`. Clearing the category cascades to clear subcategory. UI: a small **X** button (lucide-react) appears next to the inline category `Select` on the Income, Expenses and Credit Cards rows whenever a category is set — pressing it clears both category and subcategory for that single transaction and reloads. Verified via curl.
- 2026-02: `re.escape()` applied to `contains` in `POST/PUT /api/rules` — rules with regex metacharacters (`*`, `+`, `(`, `)`, etc.) now apply retroactively. Verified via curl: rule with concept `"COMPRA *ESPECIAL* +XYZ"` → `applied_to_existing=1`.
- 2026-02: Code-quality refactor
  - All `useEffect` deps fixed with `useCallback` (Dashboard, Income, Expenses, CreditCards, ImportData, Settings, use-toast)
  - All 25 `console.error` calls removed; errors surface via `toast.error`
  - Array-index-as-key in `ImportData` preview replaced with stable `_rowKey`
  - `useMemo` added to filtered/sorted/grouped computations in Income, Expenses, CreditCards, Settings
  - Extracted subcomponents: `TransactionRow` (Income), `ExpenseRow` + `CategoryGroup` (Expenses), `AccountsTab` / `CardsTab` / `CategoriesTab` / `SubcategoriesTab` / `RulesTab` (Settings)
  - Backend `parse_csv` decomposed into 5 helpers (200→~40 lines main function)
- Prior work (retained): "Sin categoría" filter, "Año actual" toggle, Year+Month selects, es-ES currency with dot thousand separator, retroactive rule engine.

## Backlog / Known Issues (P1, pre-existing — not refactor-caused)
1. `_parse_csv_text` can raise TypeError on rows shorter than the header (None values). Guard with `(v or '').strip()`.
2. Inline categorization creates a new rule per click without dedup — rules collection has grown unbounded (currently 51). Upsert by `(source, contains)`.
3. Optional splits: `server.py` (~880 lines) → per-domain routers. `Settings.js` (~800 lines) → move 5 tab components into own files.

## Backlog / Ideas (P2)
- Monthly budgets / savings goals with progress bars
- Charts (donut for expense mix, line for month-over-month cash flow)
- PDF/Excel monthly report export
- Bulk edit of transactions (multi-select + apply category)

## Test Credentials
No auth in this app (single-user). `/app/memory/test_credentials.md` intentionally absent.
