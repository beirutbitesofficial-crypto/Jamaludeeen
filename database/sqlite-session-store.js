const session = require('express-session');
const Database = require('better-sqlite3');

class SQLiteSessionStore extends session.Store {
  constructor({ filename, ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    super();
    if (!filename) throw new Error('SQLiteSessionStore requires a filename.');
    this.ttlMs = ttlMs;
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);
    this.getStmt = this.db.prepare('SELECT sess, expires_at FROM sessions WHERE sid=?');
    this.setStmt = this.db.prepare(`
      INSERT INTO sessions(sid,sess,expires_at,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expires_at=excluded.expires_at,updated_at=excluded.updated_at
    `);
    this.destroyStmt = this.db.prepare('DELETE FROM sessions WHERE sid=?');
    this.cleanupStmt = this.db.prepare('DELETE FROM sessions WHERE expires_at<=?');
    this.cleanupTimer = setInterval(() => {
      try { this.cleanupStmt.run(Date.now()); } catch (_) {}
    }, 60 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  expiry(sess) {
    const cookieExpiry = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : NaN;
    if (Number.isFinite(cookieExpiry)) return cookieExpiry;
    const maxAge = Number(sess?.cookie?.maxAge);
    return Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : this.ttlMs);
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.destroyStmt.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) { callback(error); }
  }

  set(sid, sess, callback = () => {}) {
    try {
      this.setStmt.run(sid, JSON.stringify(sess), this.expiry(sess), Date.now());
      callback(null);
    } catch (error) { callback(error); }
  }

  destroy(sid, callback = () => {}) {
    try { this.destroyStmt.run(sid); callback(null); }
    catch (error) { callback(error); }
  }

  touch(sid, sess, callback = () => {}) {
    this.set(sid, sess, callback);
  }

  clear(callback = () => {}) {
    try { this.db.prepare('DELETE FROM sessions').run(); callback(null); }
    catch (error) { callback(error); }
  }
}

module.exports = SQLiteSessionStore;
