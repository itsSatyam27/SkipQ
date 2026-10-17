// Trusted migration helper. Dry-run is the default; duplicate legacy records are never overwritten.
const admin = require('firebase-admin');
const { normalizePhone, phoneKey } = require('./accounts');
async function main() {
  const projectId = process.argv[2];
  if (!projectId) throw new Error('Usage: node check-phone-links.js PROJECT_ID [--apply]');
  const apply = process.argv.includes('--apply');
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  const db = admin.firestore();
  let cursor;
  let count = 0;
  const seen = new Map();
  do {
    let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(250);
    if (cursor) query = query.startAfter(cursor);
    const batch = await query.get();
    if (batch.empty) break;
    for (const snapshot of batch.docs) {
      if (!snapshot.data().phone) continue;
      let phone;
      try { phone = normalizePhone(snapshot.data().phone); }
      catch { throw new Error(`Invalid legacy phone in users/${snapshot.id}; review it before deployment.`); }
      const ref = db.collection('phoneLinks').doc(phoneKey(phone));
      const claimRef = db.collection('phoneClaims').doc(phone);
      const key = phoneKey(phone);
      if (seen.has(key) && seen.get(key) !== snapshot.id) throw new Error(`Duplicate legacy phone ownership in users/${snapshot.id}; resolve it before deployment.`);
      seen.set(key, snapshot.id);
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        const claim = (await tx.get(claimRef)).data();
        if (current && current.uid !== snapshot.id) throw new Error(`Conflicting phone ownership for users/${snapshot.id}; no link was overwritten.`);
        if (claim && claim.claimed !== true) throw new Error(`Invalid Spark phone claim for users/${snapshot.id}; review it before deployment.`);
        if (apply && !current) tx.set(ref, { uid: snapshot.id, createdAt: admin.firestore.Timestamp.now(), migrated: true });
        if (apply && !claim) tx.set(claimRef, { claimed: true, createdAt: admin.firestore.Timestamp.now() });
      });
      count++;
    }
    cursor = batch.docs[batch.docs.length - 1];
  } while (true);
  console.log(`${apply ? 'Linked' : 'Reviewed'} ${count} existing phone records. No phone numbers were printed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
