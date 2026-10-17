# Google login setup

Use [SPARK_SETUP.md](SPARK_SETUP.md) for the current setup.

Web uses Firebase Google popup. Android/iOS development and release builds use the native Google Sign-In SDK. Expo Go uses an AuthSession browser flow and exchanges its Google ID token directly with Firebase Authentication.

For Expo Go, enable Google in Firebase Authentication, set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and add `https://auth.expo.io/@skipqofficial/skipq-app` as an authorized redirect URI on that Web OAuth client in Google Cloud Console. The Expo owner in `app.json` must remain `skipqofficial`. The Expo AuthSession proxy is for development/testing; use a development or release build for production.

Cloud Functions URLs and the former hosted login handoff are no longer used. Google credentials are not stored in Firestore. Native Android builds still require the app signing fingerprints and physical-device validation described in [SPARK_SETUP.md](SPARK_SETUP.md).
