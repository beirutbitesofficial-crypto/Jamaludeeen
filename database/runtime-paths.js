const fs = require('fs');
const os = require('os');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const insideApp = dir => dir === appRoot || dir.startsWith(appRoot + path.sep);

// Hostinger replaces the whole app folder on every deploy, so in production the
// database, backups and uploads must live outside it. Anything that resolves
// inside the app folder is moved to ~/jamaludeen-data (ALLOW_DATA_IN_APP=1 opts out).
const persistentRoot = path.resolve(process.env.PERSISTENT_ROOT || path.join(os.homedir(), 'jamaludeen-data'));
const keepInApp = !IS_PRODUCTION || process.env.ALLOW_DATA_IN_APP === '1' || insideApp(persistentRoot);

function pick(envName, fallback, persistentName) {
  const raw = process.env[envName];
  const dir = raw ? path.resolve(raw) : fallback;
  if (keepInApp || !insideApp(dir)) return { dir, legacy: null };
  const safe = persistentName ? path.join(persistentRoot, persistentName) : persistentRoot;
  console.warn(`[data] ${envName || 'data'} (${dir}) is inside the app folder and would be wiped on deploy; using ${safe}`);
  return { dir: safe, legacy: dir };
}

function copyMissing(from, to) {
  if (!from || !fs.existsSync(from)) return;
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name), dst = path.join(to, name);
    if (fs.existsSync(dst)) continue;
    fs.cpSync(src, dst, { recursive: true });
  }
}

const data = pick('DATA_DIR', path.join(appRoot, 'data'), '');
const dataDir = data.dir;
fs.mkdirSync(dataDir, { recursive: true });
// First boot at the safe location: bring over whatever the old in-app folder still has.
if (data.legacy && !fs.existsSync(path.join(dataDir, 'store.db'))) {
  copyMissing(data.legacy, dataDir);
  console.warn(`[data] copied existing data from ${data.legacy}`);
}

const backups = pick('BACKUP_DIR', path.join(dataDir, 'backups'), 'backups');
const uploads = pick('UPLOADS_DIR', path.join(dataDir, 'uploads'), 'uploads');
for (const d of [backups, uploads]) {
  fs.mkdirSync(d.dir, { recursive: true });
  if (d.legacy && d.legacy !== d.dir) copyMissing(d.legacy, d.dir);
}

module.exports = {
  dataDir,
  backupDir: backups.dir,
  uploadsDir: uploads.dir,
  storeDbPath: path.join(dataDir, 'store.db'),
  sessionDbPath: path.join(dataDir, 'sessions.db'),
};
