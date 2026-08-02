const db = require('./db');
db.prepare("UPDATE settings SET value='/images/logo.png' WHERE key='logo_path'").run();
console.log('Logo path set to /images/logo.png');
