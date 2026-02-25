const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();

async function collectUserDeviceTokens(userId) {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("devices")
    .get();
  const devices = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const token = String(data.token || "").trim();
    if (!token) {
      return;
    }
    devices.push({
      ref: doc.ref,
      token,
      platform: String(data.platform || ""),
    });
  });
  return devices;
}

function isInvalidTokenError(code) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}

exports.sendUserPush = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};
  const targetUserId = String(payload.userId || callerUid).trim();
  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};

  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }
  if (targetUserId !== callerUid) {
    throw new HttpsError(
      "permission-denied",
      "You can only send pushes to your own account.",
    );
  }
  if (!title || !body) {
    throw new HttpsError("invalid-argument", "title and body are required.");
  }

  const devices = await collectUserDeviceTokens(targetUserId);
  if (devices.length === 0) {
    return {
      success: true,
      sent: 0,
      failed: 0,
      removedTokens: 0,
      message: "No registered device tokens.",
    };
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens: devices.map((d) => d.token),
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [String(k), String(v)]),
    ),
    android: {
      priority: "high",
      notification: {
        channelId: "task-reminders",
      },
    },
  });

  const invalidRefs = [];
  response.responses.forEach((res, idx) => {
    if (res.success) {
      return;
    }
    const code = res.error?.code || "";
    if (isInvalidTokenError(code)) {
      invalidRefs.push(devices[idx].ref);
    }
  });

  if (invalidRefs.length > 0) {
    const batch = db.batch();
    invalidRefs.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return {
    success: true,
    sent: response.successCount,
    failed: response.failureCount,
    removedTokens: invalidRefs.length,
  };
});
