# Greenovation

Greenovation coordinates verified recyclable-material collections from waste owners to collectors and recycling partners, with configurable points, rewards, custody tracking, and audit events.

## MVP scope

- Manual digital-scale weight entry; no Bluetooth or IoT hardware is required.
- Backend GPS arrival verification using a configurable radius.
- Two-party weight confirmation and dispute preservation.
- Points calculated from verified actual weight and database material rules.
- Material batches with recycling-partner receiving weight and configurable variance flags.
- Configurable rewards and atomic coupon redemption. Coupon lookup never consumes a coupon.
- JWT sessions and role checks on the secure `/api/v2` workflow.
- Audit records for important workflow, weight, points, batch, and coupon events.

## Run locally

1. Create `back/db.env` with `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, and `JWT_SECRET`.
2. Create the PostgreSQL database and run the existing base schema in `back/setup-database.sql` if starting from an empty database.
3. Run `cd back && npm run db:migrate`.
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
- `POST /api/v2/rewards/:rewardId/issue` as `user`
- `POST /api/v2/merchant/coupons/lookup` as `merchant`
- `POST /api/v2/merchant/coupons/redeem` as `merchant`
- `GET /api/v2/admin/overview` as `admin`

Send the token as `Authorization: Bearer <token>`.

## Tests

Run `cd back && npm test`. Critical pure business rules cover actual-weight points, valid status transitions, GPS tolerance, material variance, permissions, and coupon separation between lookup and redemption.

## Configuration principles

Point rates, rounding, arrival tolerance, and acceptable material variance are stored in PostgreSQL rather than hard-coded. Funding model, merchant benefit, sponsor, and settlement fields are represented separately; the platform does not assume a merchant subsidy, tax benefit, or fixed revenue split.
