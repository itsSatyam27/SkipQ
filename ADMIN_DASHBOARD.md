# SkipQ admin dashboard

Production URL: https://skipyourqueue-admin.web.app

Sign in with the owner Google account `skipqueue.official@gmail.com`. Access is granted by the trusted `admins/{Firebase UID}` document with `enabled: true`; the website and mobile app cannot create or modify admin grants. Normal student, faculty and seller roles stay unchanged.

## Features

- Overview: total accounts, student/faculty/seller breakdown, active orders, pending seller requests, permanent blocks, activity in the past 24 hours.
- Users: role filter, current-page search, temporary/permanent block, unblock, reasons and expiry.
- Seller requests: approve, reject or revoke approval. Approval requires an active seller profile. When the approved seller opens the updated app, saved registration details automatically create/link their canteen; existing menus are preserved.
- Canteens and orders: paginated read-only operational records. No pickup secret access is granted to admins.
- History: immutable audit records for every dashboard approval or block action. Rules require the action and audit record in the same atomic transaction.

Lists fetch at most 50 records per page. Search applies to the current page; role/status filters run against Firestore. Overview uses server aggregation counts. Refresh explicitly reloads dashboard data to avoid persistent listeners for all users/orders on Spark.

Active users means profiles with `lastActiveAt` in the previous 24 hours. The app records activity after login and every 15 minutes while running. Older app versions are not included until updated. This is recorded activity, not exact live presence, and clients can report their own activity.

## Local use

Run `npm run admin`, then open http://localhost:8097 (use localhost for Google login). The build reads only six allowlisted public Firebase config variables from `.env`. Never place service account keys in the website.

`admin/dist` is generated and ignored. Source lives in `admin/`. Firebase SDK browser modules are loaded from Google's official CDN.

## Deploy

1. `npm run build:admin`
2. `npx firebase deploy --only firestore:rules --project skipyourqueue`
3. `npx firebase deploy --only hosting --config firebase.admin.json --project skipyourqueue`

The dashboard uses a separate hosting site. Deploying it does not replace the customer app. Hosting domains must be in Firebase Authentication's authorized domains (configured for both admin hosting domains).

## Trusted owner provisioning

The owner must have signed in with Google to this Firebase project first. With a project operator signed into Firebase CLI:

`node scripts/bootstrap-admin.cjs skipyourqueue OWNER_EMAIL`

This verifies the account without changing access. Add `--apply` to grant access. The utility uses the local Firebase CLI credential in memory and calls only Google's project APIs. Do not expose the script as a public endpoint. To revoke admin access, a trusted project operator sets the admin document's `enabled` field to false in Firebase Console.

## Verification

`npm run test:rules` covers admin isolation, grant escalation denial, atomic audit enforcement, block restrictions, seller approval and activity writes, alongside existing order/profile rules. The browser UI was checked with isolated Firebase transport fixtures; real account login requires selecting the owner Google account in the browser.
