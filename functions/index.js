const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

const dayCode = {
  Sun: "SU",
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
};

function localParts(now, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") {
      parts[p.type] = p.value;
    }
  }
  return {
    year: Number.parseInt(parts.year || "0", 10),
    month: Number.parseInt(parts.month || "0", 10),
    day: Number.parseInt(parts.day || "0", 10),
    hour: Number.parseInt(parts.hour || "0", 10),
    minute: Number.parseInt(parts.minute || "0", 10),
    weekday: parts.weekday || "Sun",
  };
}

function parseTime24(value) {
  const m = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!m) {
    return null;
  }
  const hour = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2], 10);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

function shouldSendNow(task, nowLocal, windowMinutes) {
  if (!task || task.reminderOn !== true) {
    return false;
  }
  const parsed = parseTime24(task.reminderTime);
  if (!parsed) {
    return false;
  }
  const configured = String(task.reminderDays || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => dayCode[d])
    .filter(Boolean);
  const todayCode = dayCode[nowLocal.weekday] || "SU";
  if (configured.length > 0 && !configured.includes(todayCode)) {
    return false;
  }
  const nowTotal = nowLocal.hour * 60 + nowLocal.minute;
  const taskTotal = parsed.hour * 60 + parsed.minute;
  const lag = nowTotal - taskTotal;
  return lag >= 0 && lag < windowMinutes;
}

exports.sendDueTaskReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Etc/UTC",
    region: "us-central1",
  },
  async () => {
    const usersSnap = await db.collection("users").get();
    const now = new Date();
    const failures = [];
    let remindersSent = 0;

    for (const userDoc of usersSnap.docs) {
      const userRef = userDoc.ref;
      const profileSnap = await userRef.collection("profile").doc("main").get();
      if (!profileSnap.exists) {
        continue;
      }
      const profile = profileSnap.data() || {};
      const tasks = Array.isArray(profile.quests) ? profile.quests : [];
      const timeZone =
        typeof profile.timeZone === "string" && profile.timeZone
          ? profile.timeZone
          : "UTC";
      const localNow = localParts(now, timeZone);
      const due = tasks.filter((task) => shouldSendNow(task, localNow, 5));
      if (due.length === 0) {
        continue;
      }

      const slotKey = `${localNow.year}-${String(localNow.month).padStart(2, "0")}-${String(localNow.day).padStart(2, "0")}T${String(localNow.hour).padStart(2, "0")}:${String(localNow.minute).padStart(2, "0")}`;
      const stateRef = userRef.collection("notifications").doc("reminderState");
      const stateSnap = await stateRef.get();
      const lastSlotKey = String(stateSnap.data()?.lastSlotKey || "");
      if (lastSlotKey === slotKey) {
        continue;
      }

      const devicesSnap = await userRef
        .collection("devices")
        .where("pushEnabled", "==", true)
        .get();
      const deviceDocs = devicesSnap.docs.filter((d) => {
        const token = String(d.data()?.token || "");
        return token.length > 0;
      });
      if (deviceDocs.length === 0) {
        continue;
      }

      const tokens = deviceDocs.map((d) => String(d.data().token));
      const titles = due
        .map((t) => String(t.title || "").trim())
        .filter(Boolean);
      const body =
        titles.length <= 1
          ? `Time for: ${titles[0] || "your task"}`
          : `Due now: ${titles.slice(0, 3).join(", ")}${titles.length > 3 ? "..." : ""}`;

      const result = await admin.messaging().sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: "high" },
          notification: {
            title: "Hunter Quest Reminder",
            body,
            icon: "/assets/icons/icon-192.png",
            badge: "/assets/icons/icon-192.png",
            tag: `quest-${slotKey}`,
            renotify: true,
          },
          fcmOptions: {
            link: "/index.html#quests",
          },
        },
        data: {
          type: "quest_reminder",
          slotKey,
          body,
          screen: "quests",
        },
      });

      const invalidCodes = new Set([
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
      ]);
      const deleteOps = [];
      result.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error && invalidCodes.has(resp.error.code)) {
          deleteOps.push(deviceDocs[idx].ref.delete());
        }
      });
      if (deleteOps.length > 0) {
        await Promise.all(deleteOps);
      }

      await stateRef.set(
        {
          lastSlotKey: slotKey,
          dueCount: due.length,
          sentCount: result.successCount,
          timeZone,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      remindersSent += result.successCount;
      if (result.failureCount > 0) {
        failures.push({
          uid: userDoc.id,
          failureCount: result.failureCount,
        });
      }
    }

    logger.info("Reminder scheduler run complete.", {
      remindersSent,
      failureUsers: failures.length,
      failures,
    });
  },
);
