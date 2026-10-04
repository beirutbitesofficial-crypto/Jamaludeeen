// Card-sized thumbnails live in public/images/thumbs/<same relative path>.webp
// (560px WebP). Lists, cart and checkout use them; product pages keep the full image.
// Uploaded images (/uploads/...) and anything without a thumbnail fall back to the original.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'public', 'images');
const thumbsDir = path.join(root, 'thumbs');
const available = new Set();

(function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else available.add('/images/thumbs/' + path.relative(thumbsDir, p).split(path.sep).join('/'));
  }
})(thumbsDir);

function thumbOf(src) {
  if (!src || !src.startsWith('/images/') || src.startsWith('/images/thumbs/')) return src;
  const t = '/images/thumbs/' + src.slice('/images/'.length).replace(/\.(png|jpe?g|webp)$/i, '.webp');
  return available.has(t) ? t : src;
}

module.exports = { thumbOf };
