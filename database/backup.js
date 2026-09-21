const fs = require('fs');
const path = require('path');

function rotateBackups(dir, keep = 14) {
  const files = fs.readdirSync(dir)
    .filter(name => /^store-\d{8}-\d{6}\.db$/.test(name))
    .map(name => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a,b) => b.time - a.time);
  for (const file of files.slice(keep)) {
    try { fs.unlinkSync(path.join(dir, file.name)); } catch (_) {}
  }
}

function backupName(now = new Date()) {
  const p = n => String(n).padStart(2,'0');
  return `store-${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.db`;
}

async function backupNow(db, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const destination = path.join(backupDir, backupName());
  await db.backup(destination);
  rotateBackups(backupDir, Number(process.env.BACKUP_KEEP || 14));
  console.log(`Database backup created: ${destination}`);
  return destination;
}

function startBackupSchedule(db, backupDir) {
  const intervalHours = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 6));
  const run = () => backupNow(db, backupDir).catch(error => console.error('Database backup failed:', error.message));
  setTimeout(run, 5000).unref?.();
  const timer = setInterval(run, intervalHours * 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { backupNow, startBackupSchedule };
