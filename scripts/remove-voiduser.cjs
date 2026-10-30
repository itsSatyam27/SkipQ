const cliAuth = require('C:/Users/itsme/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const PROJECT = 'skipyourqueue';
const UID = '7on4xkZQcpZd0WtbX2BJfvz1vr33';
const EMAIL = 'voiduser.404x@gmail.com';
const PHONE = '9632587410';
const base = `projects/${PROJECT}/databases/(default)/documents`;

async function accessToken() {
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('Firebase CLI account is not signed in.');
  return (await cliAuth.getAccessToken(account.tokens.refresh_token, [])).access_token;
}
async function jsonFetch(url, options, token) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Request failed (${response.status}).`);
  return body;
}

(async () => {
  const token = await accessToken();
  const user = await jsonFetch(`https://firestore.googleapis.com/v1/${base}/users/${UID}`, {}, token);
  if (user.fields?.email?.stringValue !== EMAIL || user.fields?.phone?.stringValue !== PHONE
    || user.fields?.userType?.stringValue !== 'faculty' || user.fields?.universityStatus?.stringValue !== 'LEFT') {
    throw new Error('Target account no longer matches the approved faculty test account. Nothing was deleted.');
  }
  const orderRows = await jsonFetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`, {
    method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'orders' }], where: { fieldFilter: {
      field: { fieldPath: 'buyerId' }, op: 'EQUAL', value: { stringValue: UID }
    } } } })
  }, token);
  const active = orderRows.filter(row => ['Preparing', 'Ready for Pickup'].includes(row.document?.fields?.orderStatus?.stringValue));
  if (active.length) throw new Error(`Account has ${active.length} active order(s). Resolve them before deletion.`);

  await jsonFetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`, {
    method: 'POST', body: JSON.stringify({ localId: UID })
  }, token);

  const deletes = [
    `users/${UID}`, `phoneClaims/${PHONE}`, `facultyRequests/${UID}`,
    `facultyApprovals/${UID}`, `locationTestAccess/${UID}`
  ].map(path => ({ delete: `${base}/${path}` }));
  await jsonFetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST', body: JSON.stringify({ writes: deletes })
  }, token);
  console.log(JSON.stringify({ removed: true, uid: UID, email: EMAIL, historicalOrdersPreserved: true }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
