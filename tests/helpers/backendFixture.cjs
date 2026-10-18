const { createHandlers } = require('../../functions/production');
const Timestamp = { fromMillis: value => ({ toMillis: () => value }) };
function fixture() {
  let clock = 1800000000000;
  const store = new Map();
  let queue = Promise.resolve();
  const makeQuery = (name, filters = []) => ({ collection: name, filters, where: (field, operator, value) => makeQuery(name, [...filters, [field, operator, value]]) });
  const collection = name => ({ doc: id => ({ id, path: `${name}/${id}` }), where: (field, operator, value) => makeQuery(name, [[field, operator, value]]) });
  const matchesQuery = (doc, filters) => filters.every(([field, operator, value]) =>
    operator === '==' ? doc?.[field] === value : operator === 'in' ? value.includes(doc?.[field]) : false);
  const db = { collection, runTransaction: work => {
    const execute = async () => {
      const pending = new Map();
      const tx = {
        get: async ref => {
          if (ref.collection) {
            const docs = [...store.entries()].filter(([path, value]) => path.startsWith(`${ref.collection}/`) && !path.slice(ref.collection.length + 1).includes('/') && matchesQuery(value, ref.filters))
              .map(([path, data]) => ({ id: path.slice(ref.collection.length + 1), ref: { id: path.slice(ref.collection.length + 1), path }, exists: true, data: () => data }));
            return { docs, size: docs.length, empty: docs.length === 0 };
          }
          return { exists: store.has(ref.path), data: () => store.get(ref.path) };
        },
        set: (ref, value, options) => pending.set(ref.path, options?.merge ? { ...store.get(ref.path), ...value } : value),
        update: (ref, value) => pending.set(ref.path, { ...store.get(ref.path), ...value })
      };
      const result = await work(tx);
      for (const [key, value] of pending) store.set(key, value);
      return result;
    };
    const result = queue.then(execute);
    queue = result.catch(() => {});
    return result;
  } };
  const users = new Map([
    ['seller', { uid: 'seller', email: 'seller@example.com', emailVerified: true, providerData: [{ providerId: 'google.com' }], customClaims: { seller: true } }],
    ['buyer', { uid: 'buyer', email: 'buyer@example.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] }],
    ['admin', { uid: 'admin', email: 'admin@example.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] }]
  ]);
  let sentCode;
  let providerOk = true;
  const handlers = createHandlers({ db, Timestamp, now: () => clock, smsKey: () => 'test-secret',
    auth: {
      verifyIdToken: async token => { if (token === 'invalid') throw new Error('Invalid token'); const uid = token === 'admin-token' ? 'admin' : token; return token === 'anonymous' ? { uid: 'guest' } : { uid, email: `${uid}@example.com`, email_verified: token !== 'unverified', firebase: { sign_in_provider: 'google.com' }, auth_time: Math.floor(clock / 1000), seller: token === 'seller' }; },
      getUser: async uid => { if (!users.has(uid)) { const e = new Error('Missing'); e.code = 'auth/user-not-found'; throw e; } return users.get(uid); },
      updateUser: async (uid, values) => { const user = users.get(uid); if (!user) throw new Error('Missing'); Object.assign(user, values); return user; },
      createUser: async user => users.set(user.uid, user),
      createCustomToken: async uid => `verified-${uid}`
    }, fetchSms: async (_url, options) => { sentCode = JSON.parse(options.body).variables_values; return { ok: providerOk, json: async () => ({ return: providerOk }) }; }
  });
  store.set('users/buyer', { uid: 'buyer', name: 'Student', email: 'buyer@example.com', phone: '9876543210', userType: 'student', profileComplete: true, banStatus: 'active' });
  store.set('users/seller', { uid: 'seller', name: 'Seller', email: 'seller@example.com', phone: '8765432109', userType: 'seller', profileComplete: true, banStatus: 'active', universityId: 'sou' });
  store.set('admins/admin', { enabled: true, email: 'admin@example.com' });
  users.set('admin', { uid: 'admin', email: 'admin@example.com', emailVerified: true });
  store.set('canteens/shop', { name: 'Canteen', ownerId: 'seller', universityId: 'sou', status: 'Open', upiId: 'canteen@upi', lat: 23, lng: 72,
    menu: [{ id: 'dish', name: 'Lunch', price: 80, isAvailable: true }] });
  const buyer = { uid: 'buyer', email: 'buyer@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' }, auth_time: Math.floor(clock / 1000) };
  const seller = { uid: 'seller', email: 'seller@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' }, auth_time: Math.floor(clock / 1000), seller: true };
  const body = () => ({ shopId: 'shop', requestId: 'request_one', items: [{ id: 'dish', qty: 2 }], paymentMethod: 'Cash', location: { lat: 23, lng: 72, accuracy: 10 } });
  async function http(handler, path, data, token = 'buyer') {
    const result = { code: 200 };
    const res = { set() {}, status(code) { result.code = code; return this; }, json(data) { result.data = data; return result; }, send() { return result; } };
    await handler({ method: 'POST', path, body: data, ip: '127.0.0.1', get: () => token ? `Bearer ${token}` : '' }, res);
    return result;
  }
  return { store, users, handlers, buyer, seller, body, http, now: () => clock, advance: ms => { clock += ms; }, sentCode: () => sentCode, providerFailure: () => { providerOk = false; } };
}

module.exports = { fixture, Timestamp };
