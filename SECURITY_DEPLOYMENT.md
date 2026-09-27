# Secure backend deployment

The mobile app no longer contains an SMS-provider credential or accepts a
client-generated OTP. Complete these steps before testing sign-in.

1. In the Firebase project, install the Functions dependencies:

   ```powershell
   Set-Location functions
   npm install
   ```

2. Store the Fast2SMS key only as a Firebase secret (never in `.env` or an Expo
   public variable):

   ```powershell
   firebase functions:secrets:set FAST2SMS_API_KEY
   firebase deploy --only functions:api,firestore:rules
   ```

3. Set `EXPO_PUBLIC_API_BASE_URL` in the local `.env` to the deployed function
   URL, for example `https://asia-south1-PROJECT_ID.cloudfunctions.net/api`.

4. Use the Firebase Admin SDK to add the `seller: true` custom claim only after
   a canteen owner has been approved. The deployed Firestore rules allow menu
   changes only for that approved seller's own canteen.

5. Deploy the order endpoints before enabling live ordering. Cash deposits,
   wallet deductions, pickup refunds, bans, and no-show penalties are handled by
   authenticated Cloud Function transactions. The rules intentionally reject
   direct client writes to `orders`; this prevents modified apps from changing
   payment or order state.

6. After reviewing a seller request, grant the seller claim from a trusted
   Admin SDK process. The app refreshes that claim on sign-in and then enables
   the seller POS. Never grant this claim from the client.

Rotate the previously exposed Fast2SMS key in the provider console before this
deployment. Removing it from source does not invalidate a copied key.
