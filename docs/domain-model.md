# Domain model

Products have variants. Inventory balances are variant/location records and movements are immutable ledger entries. Purchase orders and inbound parcels have explicit item rows. Orders own one or more order items; each line stores price, allocations, COGS, and quantities. Listings are marketplace records separate from products. Transactions are the finance ledger.

The authoritative database schema is `supabase/migrations/001` through `003`.
