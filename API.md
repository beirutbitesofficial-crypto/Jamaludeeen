# JAMALUDEEN Products API

Read-only JSON API for other apps and partners. It returns each item's name, description, price, stock and photo.

## Turning it on

Go to **Admin › Settings › API** and click **Turn on API (create key)**. The page then shows:

- the key
- the products link

**New key** replaces the key, and the old one stops working straight away. **Turn off API** disables the API.

## Authentication

Send the key with every request in one of these ways:

```
X-API-Key: jm_xxxxxxxx
Authorization: Bearer jm_xxxxxxxx
https://<site>/api/v1/products?key=jm_xxxxxxxx
```

Prefer the header, and keep the key on a server. Anyone who has it can read products and stock.

## Endpoints

### `GET /api/v1/products`

| Query | Meaning |
|---|---|
| `section` | `men`, `women`, `unisex` or `brands` |
| `brand` | Brand name, for example `LATTAFA` |
| `q` | Search in name and brand |
| `available=1` | Only items that can be sold now |
| `updated_since` | Only items changed since this time (`2026-11-01` or an ISO time) |
| `page`, `limit` | Paging. `limit` defaults to 50; the maximum is 200 |

```json
{
  "page": 1, "limit": 50, "total": 353, "pages": 8,
  "items": [ { …item… } ]
}
```

### `GET /api/v1/products/:id`

Returns a single item. If there is no item with that id, it returns `404`.

## Item

```json
{
  "id": 882,
  "name": "MONTAIGNE VANILLE",
  "name_ar": null,
  "description": null,
  "description_ar": null,
  "brand": "LATTAFA",
  "section": "brands",
  "price": { "currency": "LBP", "lbp": 1800000, "usd": 20 },
  "stock": { "available": true, "quantity": 4, "unit": "units" },
  "photo": "https://<site>/images/brands/lattafa/montaigne-vanille.webp",
  "url": "https://<site>/shop/item/882",
  "updated_at": "2026-10-30T15:58:10.000Z"
}
```

- **Brand products:**
  - `price` is the LBP price plus its USD value at the store's current rate.
  - `price` is `null` when no price is set.
- **Signature refills (men, women, unisex):** these are sold in sizes, so `price` is:
  `{ "currency": "LBP", "sizes": [ { "size_ml": 50, "lbp": 630000, "usd": 7 }, { "size_ml": 100, "lbp": 1170000, "usd": 13 } ] }`
- **`stock.quantity`:**
  - It is `null` when the store doesn't count that item.
  - For refills it is counted in `ml`; for brand products it is counted in `units`.
- **`stock.available`** says whether the item can be bought right now. It is `false` when the item is switched off or its counted stock has run out.
- **Errors** come back as JSON:
  - `{ "error": "…" }`
  - `401` for a missing or wrong key
  - `404` for not found
