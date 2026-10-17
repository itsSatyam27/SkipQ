# Temporary location-free testing

Development builds can skip ordering GPS checks for an explicitly enabled test account. Other accounts and normal orders retain the existing location rules. Release builds do not expose this mode.

A trusted project operator grants access for 24 hours:

`node scripts/location-test-access.cjs skipyourqueue TEST_EMAIL --apply`

Revoke early:

`node scripts/location-test-access.cjs skipyourqueue TEST_EMAIL --revoke`

Without a flag, the script only verifies the existing account. Credentials stay in memory and are sent only to Google's Firebase project APIs. Clients and dashboard admins cannot create these grants through Firestore rules.

The grant is stored in `locationTestAccess/{uid}` with `enabled` and `expiresAt`. Firestore checks expiry for each order. The development app listens for the grant and displays “Location test mode”; expiry/revocation returns it to normal location checks. Reload after signing into the selected account if necessary.

Test orders have `testOrder: true` and `location: null` rather than fake campus coordinates. The seller order card labels them. They are real database orders: prices, approved canteens, account bans, cash/UPI confirmation and pickup verification remain enforced. Payment behavior is unchanged. Test orders may appear in operational totals.

Security tests cover denied self-grants, missing/expired access, normal location validation, bans, seller approval, and maximum-size normal/test checkouts. UI verification covers add-to-cart and checkout without GPS prompts.
