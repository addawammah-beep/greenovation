# Greenovation

Greenovation coordinates verified recyclable-material collections from waste owners to collectors and recycling partners, with configurable points, custody tracking, and audit events.

## MVP scope

- Manual digital-scale weight entry; no Bluetooth or IoT hardware is required.
- Backend GPS arrival verification using a configurable radius.
- Two-party weight confirmation and dispute preservation.
- Points calculated from verified actual weight and database material rules.
- Product orders reserve the user's points immediately; pending orders can be cancelled and expire after 24 hours if the seller does not confirm.
- Confirmed product orders are collected from the seller; the app does not arrange delivery.
- Fulfilled seller product orders are aggregated as tax-deduction points; an admin verifies each completed order once. Currency tax calculations remain subject to the applicable accounting rules.
- Environmental photo reports are checked for visible discarded trash. Images from accepted reports are stored in `back/report-images` and served only through an authenticated admin endpoint; rejected images are not saved. Report details and analysis results, including device GPS coordinates, GPS accuracy, and capture time (or selection time for an uploaded image), are stored in the reports table.
- Material batches with recycling-partner receiving weight and configurable variance flags.
- JWT sessions and role checks on the secure `/api/v2` workflow.
- Audit records for important workflow, weight, points, and batch events.

## Run locally

1. Create `back/db.env` with `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `JWT_SECRET`, and `GEMINI_API_KEY` (from Google AI Studio). The image-analysis model defaults to `gemini-3.8-flash`; set `GEMINI_MODEL` to another model available to your API key's project if needed. Keep API keys private and never commit `db.env`.
2. Create the PostgreSQL database and run the existing base schema in `back/setup-database.sql` if starting from an empty database.
3. Run `cd back && npm run db:migrate`. Migration 008 permanently deletes existing coupon, discount-reward, and related coupon-audit data; migration 009 enables product-order cancellation and expiry states; migration 010 records admin-verified seller tax-deduction points.
4. Start the API with `cd back && npm start`.
5. Start the React app with `cd front && npm start`.

The API listens on `http://localhost:4000`; the React development server normally listens on `http://localhost:3000`.

## Admin seller verification

Seller applications can be reviewed at `http://localhost:3000/admin`. Admins sign in with a dedicated account; seller accounts cannot approve themselves.

To create the first admin locally, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment used by the backend, optionally set `ADMIN_NAME`, then run `cd back && npm run admin:create`. Use a unique password of at least 12 characters. The admin account is stored with a bcrypt password hash. Do not commit admin credentials or share them with sellers.

## Secure API workflow

The login response now contains a short-lived JWT. The secure workflow is under `/api/v2`:

- `POST /api/v2/requests` as `user`
- `POST /api/v2/requests/:id/trip/start` as `collector`
- `POST /api/v2/requests/:id/arrival` as `collector`
- `POST /api/v2/requests/:id/weight` as `collector`
- `POST /api/v2/requests/:id/weight-confirmation` as `user`
- `POST /api/v2/batches/:id/receive` as `recycler`
- `GET /api/v2/admin/overview` as `admin`

Send the token as `Authorization: Bearer <token>`.

## Tests

Run `cd back && npm test`. Critical pure business rules cover actual-weight points, valid status transitions, GPS tolerance, material variance, and permissions.

## Configuration principles

Point rates, rounding, arrival tolerance, and acceptable material variance are stored in PostgreSQL rather than hard-coded. Funding model, merchant benefit, sponsor, and settlement fields are represented separately; the platform does not assume a merchant subsidy, tax benefit, or fixed revenue split.
