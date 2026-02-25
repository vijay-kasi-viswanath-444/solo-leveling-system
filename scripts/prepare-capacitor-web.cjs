const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outDir = path.join(root, "www");

const files = [
  "index.html",
  "home.html",
  "quests.html",
  "analytics.html",
  "achievements.html",
  "404.html",
  "manifest.webmanifest",
  "sw.js",
];

const dirs = ["assets"];
const configFiles = ["firebase.public.js", "firebase.runtime.js"];

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSafe(srcPath, destPath);
    }
  }
}

rmrf(outDir);
ensureDir(outDir);

for (const file of files) {
  copyFileSafe(path.join(root, file), path.join(outDir, file));
}

for (const dir of dirs) {
  copyDirRecursive(path.join(root, dir), path.join(outDir, dir));
}

for (const file of configFiles) {
  copyFileSafe(
    path.join(root, "config", file),
    path.join(outDir, "config", file),
  );
}

console.log("Prepared Capacitor web assets in ./www");
