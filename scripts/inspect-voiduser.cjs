const cliAuth = require('C:/Users/itsme/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');

async function token() {
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI account is not signed in.');
  return (await cliAuth.getAccessToken(account.tokens.refresh_token, [])).access_token;
}
const value = field => field?.stringValue ?? field?.integerValue ?? field?.booleanValue ?? null;

(async () => {
  const accessToken = await token();
  const response = await fetch('https://firestore.googleapis.com/v1/projects/skipyourqueue/databases/(default)/documents:runQuery', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }], where: { fieldFilter: {
      field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: 'voiduser.404x@gmail.com' }
    } }, limit: 2 } })
  });
  if (!response.ok) throw new Error(`Firestore lookup failed (${response.status}).`);
  const rows = await response.json();
  const matches = rows.filter(row => row.document).map(row => ({
    uid: row.document.name.split('/').pop(), email: value(row.document.fields.email),
    phone: value(row.document.fields.phone), role: value(row.document.fields.userType),
    universityStatus: value(row.document.fields.universityStatus)
  }));
  console.log(JSON.stringify(matches));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
