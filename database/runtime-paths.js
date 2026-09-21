const fs = require('fs');
const path = require('path');

function resolveDir(envName, fallback) {
  const raw = process.env[envName];
  const dir = raw ? path.resolve(raw) : fallback;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const defaultDataDir = path.join(__dirname, '..', 'data');
const dataDir = resolveDir('DATA_DIR', defaultDataDir);
const backupDir = process.env.BACKUP_DIR
  ? resolveDir('BACKUP_DIR', path.join(dataDir, 'backups'))
  : path.join(dataDir, 'backups');

module.exports = {
  dataDir,
  backupDir,
  storeDbPath: path.join(dataDir, 'store.db'),
  sessionDbPath: path.join(dataDir, 'sessions.db'),
};
