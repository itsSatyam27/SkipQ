# Production OTA updates

- Production EAS builds and production-apk inherit the production channel.
- app.json uses the project EAS Update URL and fingerprint runtime compatibility.
- Build a new production APK after adding/changing native OTA configuration. The older v4 APK cannot gain native OTA support from JavaScript alone.
- Updates check on launch, download without delaying startup, and apply on a later launch. Student/faculty: Profile > Help > App updates. Seller: Account > Profile > App updates (below operator details). Both offer a manual check and optional restart in a compatible production APK.
- Do not publish while a native build is pending. A native dependency/configuration change requires another APK; do not override fingerprint compatibility.

Before publishing, set the EXPO_PUBLIC_* values in the EAS production environment to match the production APK configuration (see production-apk.env in eas.json). Never upload a Firebase Admin service-account key as a client environment variable.

After checks and a compatible APK have been installed:

    eas update --channel production --environment production --platform android --message "Describe the change"

This command publishes to installed production users. Run it only when that release is authorized.

## Published 19 October 2026

- Production environment public client variables synchronized with the APK configuration.
- Android update `01a15398-8715-79e5-a7df-0c67e104b231`, group `3e1efdf3-08c7-40a4-b02c-4deaf9fde1ed`, published to production.
- Runtime `7ab7aa89472fbe7394f506b6c8f839ab4e6c622b` matches signed APK 8. No replacement APK is required for this JavaScript update.
- Includes verified per-dish ratings, checkout/strike/preparation fixes, rush ordering and seller update settings.
- Matching Firestore rules deployed and live contents verified against local tested rules.
- Existing APK 8 users should launch online, allow the update to download, then close and reopen. Actual installation on a physical phone remains unverified.
- 20 October verification: production manifest serves the expected update for APK 8's runtime; bundle download returned HTTP 206 using the manifest extension's asset authorization headers, matching the Android SDK flow. The earlier diagnostic 403 was caused by omitting those headers.
