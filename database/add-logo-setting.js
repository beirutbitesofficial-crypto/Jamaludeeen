const db = require('./db');
db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('logo_path','')").run();
console.log('logo_path key ready');
