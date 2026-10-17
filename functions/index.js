const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { createHandlers } = require('./production');
admin.initializeApp();
const handlers = createHandlers({ db: admin.firestore(), auth: admin.auth(), Timestamp: admin.firestore.Timestamp });
const options = { region: 'asia-south1', timeoutSeconds: 30, maxInstances: 10 };
exports.api = onRequest(options, handlers.api);
exports.ordersApi = onRequest(options, handlers.orders);
