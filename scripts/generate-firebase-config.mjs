import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const outPath = path.join(root, "config", "firebase.runtime.js");

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

if (!fs.existsSync(envPath)) {
  console.error("Missing .env file. Create it from .env.example before deploy.");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const required = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_APP_ID"
];

const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Missing required .env keys: ${missing.join(", ")}`);
  process.exit(1);
}

const config = {
  apiKey: env.FIREBASE_API_KEY || "",
  authDomain: env.FIREBASE_AUTH_DOMAIN || "",
  projectId: env.FIREBASE_PROJECT_ID || "",
  storageBucket: env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "",
  messagingVapidKey: env.FIREBASE_MESSAGING_VAPID_KEY || "",
  appId: env.FIREBASE_APP_ID || "",
  measurementId: env.FIREBASE_MEASUREMENT_ID || ""
};

const js = `window.FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, js, "utf8");
console.log("Generated config/firebase.runtime.js from .env");
