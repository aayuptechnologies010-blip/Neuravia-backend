const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const Notification = require('../models/Notification');
const Customer = require('../models/Customer');

let firebaseInitialized = false;

function initFirebaseAdmin() {
  if (firebaseInitialized) return true;
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (projectId && clientEmail && privateKey) {
      if (getApps().length === 0) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
      }
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized from .env for FCM Push Notifications');
      return true;
    } else {
      console.log('ℹ️ Firebase Admin env vars missing — notifications saved to DB only');
      return false;
    }
  } catch (err) {
    console.log('ℹ️ firebase-admin init skipped:', err.message);
    return false;
  }
}

/**
 * Save notification to MongoDB AND broadcast via FCM to all customers with fcmToken
 */
async function createAndBroadcastNotification({ title, body, type = 'offer', targetId = '' }) {
  try {
    const notif = await Notification.create({ title, body, type, targetId });

    if (initFirebaseAdmin()) {
      const customers = await Customer.find({ fcmToken: { $exists: true, $ne: '' } }).select('fcmToken');
      const tokens = customers.map((c) => c.fcmToken).filter(Boolean);
      if (tokens.length > 0) {
        const res = await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: { type, targetId: String(targetId || '') }
        });
        console.log(`📲 FCM sent: ${res.successCount} success, ${res.failureCount} failed`);
      }
    }

    return notif;
  } catch (err) {
    console.error('Notification broadcast error:', err.message);
    return null;
  }
}

/**
 * Send notification ONLY to a specific customer's fcmToken
 */
async function sendNotificationToCustomer({ customerId, title, body, type = 'offer' }) {
  try {
    const notif = await Notification.create({ title, body, type, targetId: String(customerId) });

    if (initFirebaseAdmin()) {
      const customer = await Customer.findById(customerId).select('fcmToken');
      if (customer && customer.fcmToken) {
        await getMessaging().send({
          token: customer.fcmToken,
          notification: { title, body },
          data: { type, targetId: String(customerId) }
        });
        console.log(`📲 Targeted FCM sent to customer ${customerId}`);
      }
    }

    return notif;
  } catch (err) {
    console.error('Targeted notification error:', err.message);
    return null;
  }
}

module.exports = { createAndBroadcastNotification, sendNotificationToCustomer };
