const db = require('./db');

const upsert = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const MAP_SRC = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3322.676184657905!2d35.47305577569776!3d33.61370537332519!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151ee5004db6d4af%3A0x47c108ca339d16fb!2sJMR%20MALL!5e0!3m2!1sen!2slb!4v1782478681758!5m2!1sen!2slb';

const settings = [
  ['store_whatsapp',  '76927146'],
  ['store_phone',     '76927146'],
  ['whish_number',    '78812338'],
  ['store_address',   'JMR Mall, Lebanon'],
  ['instagram',       'jamaludeen_perfums'],
  ['tiktok',          'jamaludeen_perfums'],
  ['google_maps_embed', MAP_SRC],
];

db.transaction(() => {
  for (const [key, value] of settings) upsert.run(key, value);
})();

console.log('Settings updated:');
db.prepare('SELECT key, value FROM settings').all().forEach(r => console.log(' ', r.key, '=', r.value));
