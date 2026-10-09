# zpluslimo Booking Desk

Internal booking operations portal for `admin` and `booking_manager` users. It uses the existing core `Trip` records, drivers, vehicles, partners and authentication rather than maintaining a second booking database.

## Local development

1. Copy `.env.example` to `.env` and point `VITE_API_BASE_URL` at the core API.
2. Run `npm install`.
3. Run `npm run dev` and open `http://127.0.0.1:5174`.

The core service must be migrated to the latest Alembic revision and configured with the `BOOKING_PUBLIC_BASE_URL`, `CCAVENUE_MERCHANT_ID`, `CCAVENUE_ACCESS_CODE`, `CCAVENUE_ENCRYPTION_KEY`, and `CCAVENUE_WEBHOOK_SECRET` environment values. The CCAvenue Dynamic Event Notification URL is:

`{BOOKING_PUBLIC_BASE_URL}/public/booking-payments/webhooks/ccavenue?token={CCAVENUE_WEBHOOK_SECRET}`

Payment links are hosted by the core service and redirect customers to CCAvenue. CCAvenue credentials never reach the browser.

## AWS Amplify deployment

1. Connect the `shibashis148/zpl-booking` repository and deploy the `main` branch.
2. Amplify will use the included `amplify.yml` (`npm ci`, `npm run build`, output directory `dist`).
3. Add `VITE_API_BASE_URL` in Amplify environment variables. Its value must be the public HTTPS URL of the core API, without a trailing slash.
4. In **Rewrites and redirects**, add a `200 (Rewrite)` rule to `/index.html` for routes that do not contain a file extension. This keeps browser refreshes on portal routes working while leaving JavaScript, CSS, fonts and images untouched.
5. Redeploy after adding the environment variable and rewrite.

The core API must allow the Amplify hostname in `BACKEND_CORS_ORIGINS` when `CORS_ALLOW_ALL=false`.

## Core production checklist

- Run `alembic upgrade head` before starting the updated API.
- Set `BOOKING_PUBLIC_BASE_URL` to the public HTTPS API host. For branded links, point a hostname such as `pay.zpluslimo.com` to the same backend and use that value.
- Set `BOOKING_FRONTEND_URL` to the Amplify portal URL.
- Add the CCAvenue merchant ID, access code, encryption key and a new high-entropy webhook secret as backend environment variables.
- Configure both CCAvenue Dynamic Event notifications to the webhook URL shown above.
- Keep `CCAVENUE_GATEWAY_URL` and `CCAVENUE_STATUS_API_URL` at their UAE production defaults unless CCAvenue provides different account-specific URLs.
- Confirm `/health`, create one low-value test booking, open its `/p/<token>` link, test success/cancel callbacks, and verify the invoice PDF.

Do not put CCAvenue credentials in Amplify or in any `VITE_` variable; all payment secrets belong only in the backend environment.
