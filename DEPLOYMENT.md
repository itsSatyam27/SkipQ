# SkipQ deployment

Follow [SPARK_SETUP.md](SPARK_SETUP.md) for the current Firebase Spark release. Do not deploy Cloud Functions or upgrade to Blaze for this implementation.

The active app uses Google Authentication and Firestore transactions guarded by the root `firestore.rules`. Publish rules with `npx.cmd firebase deploy --only firestore:rules --project skipyourqueue`.

Web: run `npm.cmd run build:web`, then `npx.cmd firebase deploy --only hosting --project skipyourqueue` after staging checks. Android APK creation is deferred until the user requests the final build. Native Google login requires matching package, OAuth client ID and signing fingerprints, plus a development/release build containing the native SDK.

Test checkout, cash collection, seller-confirmed UPI, pickup PINs, cancellation/refunds, retry behavior, bans, duplicate phones, seller approval and lost network before public release. Test camera and location on a real Android device. Local bundles and emulator tests do not prove live OAuth or device behavior.

Review dependency advisories before public release. Do not use `npm audit fix --force` to downgrade Expo across SDK versions. Publish operator contact and privacy/retention policies. Preserve legitimate legacy account, order and payment records during migration.
