# Android background notifications (Firebase FCM + Render)

FCM delivers the notification. Render hosts the trusted sender. Firebase stays
on Spark; do not put a service-account key or FCM server credential in the app.

## Deployment

1. In Firebase Project settings > Service accounts, create a private key for a
   dedicated backend service account with Firestore read/write and Firebase
   Cloud Messaging send permissions. Keep this JSON outside the repository.
2. Create a Render Blueprint using `render.yaml`, or a free Node web service
   with root directory `push-server`, build `npm install`, start `npm start`.
3. Set the Render secret `FIREBASE_SERVICE_ACCOUNT_JSON` to the JSON contents.
   The server refuses to start without it. Never use an `EXPO_PUBLIC_` variable
   for this credential.
4. Set `EXPO_PUBLIC_PUSH_API_URL=https://YOUR-SERVICE.onrender.com` in the app's
   environment. Restart Metro. The app registers its Android FCM token only
   after sign-in and completed account setup.
5. The Android build must include `expo-notifications`, image-picker,
   image-manipulator, and `google-services.json` for this Firebase Android app.
   Installing a JavaScript update alone cannot add native modules.

## Behavior and limits

- Order creation notifies the assigned approved seller. Ready for Pickup
  notifies that order's buyer. The backend derives recipient/title/body from
  Firestore and never trusts caller-provided recipients or message text.
- Google ID tokens are verified server-side, blocked profiles are denied,
  and Firestore delivery records prevent repeated sends for the same event.
- Tokens and delivery records are server-only under `pushDevices` and
  `pushDeliveries`; existing catch-all deny rules keep them inaccessible from
  clients. Do not add public access rules for these collections.
- Free Render services sleep after idle periods. A first request may take
  around a minute; notifications can be delayed. A force-stopped Android app
  must be opened again, and Android notification permissions must be enabled.
- This is best-effort delivery triggered by an authenticated app request after
  an order write; interruption before that request can miss a notification.
  Production delivery should use a durable server-side order event/outbox.
- Web push and iOS credentials are not configured by this setup.

## Verification

Run `node --test push-server/policy.test.js`. For a real background test, install
the rebuilt Android app on two signed-in devices, allow notifications, deploy
the backend, register both accounts, background the recipient, and create/ready
an order. Do not claim background delivery tested until this succeeds.
