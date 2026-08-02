const db = require('./db');
try {
  db.exec("ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'local'");
  console.log('Added type column');
} catch(e) {
  console.log('Column already exists:', e.message);
}
const r = db.prepare("UPDATE products SET type='brand' WHERE type='local'").run();
console.log('Marked', r.changes, 'products as brand type');
