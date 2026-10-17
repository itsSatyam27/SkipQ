# Spark security and release status

Follow [SPARK_SETUP.md](SPARK_SETUP.md).

- Google-verified email is required. Profile creation and unique phone claims are atomic; client rules lock saved email, phone and account type. Phone ownership is not yet SMS-verified.
- Orders use menu-validated prices, scoped reads, immutable ownership, seller approval and terminal-state checks. Clients cannot approve sellers, set wallet balances, or reset bans.
- Pickup secrets are buyer-only. Rules compare the seller's submitted PIN with the secret before completion; attempts are persisted and limited. Merchant-confirmed UPI is required before UPI pickup.
- Cancellation records merchant refund requirements; the app never transfers refunds. No-show records need operator review and do not automatically ban users in this Spark version.
- Native Google sign-in exchanges credentials directly with Firebase Authentication. Expo Go uses the AuthSession proxy for development/testing; no Google tokens are stored in Firestore or passed through the legacy API. Native final-build/device testing is pending.
- Old functions remain as legacy source/test coverage and are not deployed or called by the Spark app. No paid API endpoints are required.

Review and migrate legacy phone claims and pickup secrets before accepting registrations against older data. Existing ban records and phone claims must be retained. Rules tests run against the isolated emulator; native JavaScript bundling does not validate OAuth certificate configuration.
