# Germany Sales Decline Dashboard — Report Docs

One file per report. Each covers: purpose, build logic, SQL rules, tables used, known limitations.

| File | Hub Label | Report Page |
|---|---|---|
| [report-1a-amazon-de.md](report-1a-amazon-de.md) | Report 1A | Amazon DE OOS + PPC Spend |
| [report-1b-ebay-de.md](report-1b-ebay-de.md) | Report 1B | eBay DE OOS + Promoted Listings |
| [report-1c-shopify-de.md](report-1c-shopify-de.md) | Report 1C | Shopify DE OOS + Google Ads |
| [report-2-channel-wise.md](report-2-channel-wise.md) | Report 2 | Cross-Channel Stock Impact |
| [report-3-slow-restock.md](report-3-slow-restock.md) | Report 3 | Slow Restock / Lost Revenue |
| [report-4-never-oos.md](report-4-never-oos.md) | Report 4 | Fast-Moving / Never OOS List |
| [report-5b-marketplace-gap.md](report-5b-marketplace-gap.md) | Report 5 | Marketplace Gap — DE In-Stock SKUs |

## Core Rules Applied Across All Reports

- `order_management.orders.market_place = 10` — Germany DE only
- `orders.status = 'Completed'` — excludes Refunded and Cancelled
- INNER JOIN `inventory.local_inventory_current_stock_location_wise WHERE warehouse_location = 'Germany'` — strict DE warehouse rows only
- OOS = `licsl.stock = 0` | In-stock = `licsl.stock > 0`
- OOS date proxy = `MAX(order_date)` per SKU
- Lost sales = `(annual_sales / 365) × days_oos`
- PPC waste = spend on dates `> last_order_date` per SKU
