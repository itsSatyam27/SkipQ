# SkipQ on Firebase Spark

The active app uses Firebase Google Authentication and rule-validated Firestore transactions. It does not call Cloud Functions, require Blaze, or use `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_ORDERS_API_URL` or `EXPO_PUBLIC_WEB_AUTH_URL`. Spark quotas still apply; this is not unlimited hosting or database usage.

## Current project

- Firebase project: `skipyourqueue`.
- Android package: `com.skipq.app`; registered as **SkipQ Android**.
- Native public config: root `google-services.json` (gitignored), connected by `app.config.js`.
- Web OAuth client ID: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in root `.env`.
- Rules: root `firestore.rules`. Latest tested rules were published during this session.

## Publish rules

```powershell
npx.cmd firebase deploy --only firestore:rules --project skipyourqueue
```

Or open [Firebase Firestore Rules](https://console.firebase.google.com/project/skipyourqueue/firestore/rules), paste the **entire** `firestore.rules` file and choose Publish. Do not deploy `functions` on Spark. Profiles and the unique phone claim are created together. A previously used number shows the duplicate-number alert. Saved phone, email and account type cannot be changed by a client.

After code or environment changes, stop the old Metro process and run:

```powershell
npm.cmd run start:clean
```

New-user setup is Google sign-in → campus selection → profile/role → location, followed by canteen setup for sellers. Only Silver Oak University (`sou`) is available in the first rollout. The chosen campus ID is saved with the profile and used to filter canteens. Back preserves entered details; completed returning accounts enter the app directly.

## Google login on web

Enable Google in Firebase Authentication and include your website domain (and `localhost` for local development) in Authorized domains. Google accounts are selected using Firebase's popup. Existing and new users use the same button.

```powershell
npm.cmd run web
```

## Google login in Expo Go

Expo Go cannot load the native Google Sign-In SDK. For Expo Go development/testing, SkipQ falls back to Expo AuthSession, opens Google in the system browser, and exchanges the returned ID token directly with Firebase Authentication. Native development/release builds continue to use the native SDK.

Enable Google in Firebase Authentication, confirm `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is the Web OAuth client ID, then add this exact URI to that client's **Authorized redirect URIs** in Google Cloud Console:

```text
https://auth.expo.io/@skipqofficial/skipq-app
```

The Expo owner in `app.json` must match the redirect URI. Restart Metro after updating environment/configuration:

```powershell
npm.cmd run start:clean
```

The Expo AuthSession proxy is intended for Expo Go development/testing, not production. Use a development or release build for production sign-in.

## Android login: final-build configuration

Android now uses the free Original module from `@react-native-google-signin/google-signin`. The Google ID token is exchanged directly with Firebase Authentication; it is never saved to Firestore, placed in a URL, or sent through a custom backend.

The native SDK **does not run in Expo Go**. Expo Go uses the separate AuthSession flow above. A development or release build containing the native SDK is required for production. No APK has been created; the user's final-build step remains deferred.

Before that final build:

1. Register the build signing certificate's **SHA-1 and SHA-256** under Firebase Project settings → Your apps → SkipQ Android. Development and release signing certificates may differ. Add the Play App Signing fingerprint too if distributing through Google Play.
2. Download `google-services.json` again after adding fingerprints. Its package must be `com.skipq.app` and project must be `skipyourqueue`.
3. Use the **Web application** OAuth client ID as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, not the Android OAuth client ID. The current Web client ID has already been populated from this project's Android configuration.
4. Run `node scripts/check-release.cjs --android`. This deliberately fails until the native OAuth/signing config is present.
5. Put the same public Firebase variables and Web OAuth client ID into EAS's production environment. Supply `google-services.json` through an EAS **file** variable named `GOOGLE_SERVICES_JSON`; do not upload service-account credentials to the app.
6. At the deferred build step, verify account selection, cancellation, logout/re-login, duplicate phone rejection, and orders on a physical Android device. JavaScript exports do not verify native login or certificate matching.

## Seller approval without a paid backend

Review `sellerRequests/UID` in Firebase Console. To approve a real seller, create `sellerApprovals/UID` with boolean `approved: true`, and mark the corresponding request `status: APPROVED`. Only a trusted operator may write approval records; clients cannot approve themselves. After signing out and in, the seller can finish canteen setup. Set `approved: false` to revoke access.

Alternatively, from a trusted administrator workstation with Application Default Credentials:

```powershell
npm.cmd --prefix functions run approve-seller -- skipyourqueue UID
```

This is a local administrative script, not a deployed function. The script now creates the approval record used by the Spark rules.

## Orders and limitations

GPS is configured through device/browser location services; no additional Maps API key is used. Explore and Cart include Enable/Retry controls, permission guidance and native Settings recovery. Web location requires HTTPS or localhost; a plain HTTP LAN address cannot request GPS in modern browsers. Enable precise device location and allow the site's/app's location permission. Fresh fixes (up to two minutes old, accuracy within 100m) are required before checkout; reported distance is still checked against the canteen perimeter. Location subscriptions are stopped on logout/unmount, and no background-location permission is requested.

- Cash at pickup and seller-confirmed UPI only; no wallet top-ups or automatic UPI refunds.
- Up to **5 different dishes**, each quantity 1–20. This keeps transactions within Firestore's rule-evaluation budget. Rules validate each dish against the current canteen menu and recalculate the total. Approval and reported campus location are checked.
- Checkout retries reuse the order ID. Terminal orders cannot be reopened.
- Pickup PINs live in buyer-only secret documents. Sellers submit a PIN through an atomic attempt record; rules compare it with the private PIN before permitting completion. Five failures lock further attempts for five minutes. UPI pickup requires merchant payment confirmation.
- Marking unclaimed requires 45 minutes after ready. In this Spark version it records a no-show for operator review; it does **not** automatically impose temporary or permanent bans. Existing `users/UID` bans continue to block access, and clients cannot reset them.
- Phone numbers are linked but not SMS-verified. This prevents the same number being reused; it cannot prove ownership or prevent users supplying a different/false number. Keep claims when blocking or deleting an account.
- Background push and spoof-resistant location verification are not implemented.

## Existing data

Before allowing new signups against legacy data, review every existing phone, including blocked users. Backfill `phoneClaims/10_DIGIT_PHONE` with `claimed: true` and a creation timestamp from a trusted operator context. These availability records contain no UID, name or email and cannot be listed by clients. The migration helper `functions/check-phone-links.js` now checks both the legacy private index and Spark claims; dry-run first, resolve conflicts, then apply. It does not merge accounts or clear bans.

Old orders with inline PINs need reviewed migration to `users/BUYER_UID/pickupSecrets/ORDER_ID`; remove the inline PIN and initialize attempt/lock fields before operating them with the Spark pickup workflow. Do not delete legitimate orders or payment history.

## Verification

```powershell
npm.cmd test
npm.cmd run test:rules
npm.cmd run check:release
npx.cmd expo install --check
```

Rules tests require Java 21+ and use isolated `demo-skipq`, not live data. Unit tests also retain regression coverage for the older server implementation; the emulator tests exercise the active Spark transactions and rules.

Web hosting after staging checks:

```powershell
npm.cmd run build:web
npx.cmd firebase deploy --only hosting --project skipyourqueue
```

Native references: [Expo Google authentication](https://docs.expo.dev/guides/google-authentication/), [Google SDK Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo). Rules reference: [Firestore atomic operations](https://firebase.google.com/docs/firestore/manage-data/transactions).
