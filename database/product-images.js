// Curated product-image mappings for the imported brand catalog.
// Keys intentionally match the normalized brand/name values from TAHA.xlsx.
// Add new entries in small verified batches to avoid assigning the wrong bottle.

const PRODUCT_IMAGES = [
  {
    brand: 'REVE',
    name: 'NOW BLACK',
    image: 'https://www.alex.com.py/storage/sku/fragancias-perfume-lattafa-rave-now-black-for-men-100ml-1-1-1751636997.jpg',
  },
  {
    brand: 'REVE',
    name: 'NOW WHITE',
    image: 'https://mero.ma/cdn/shop/files/RAVENOWWHITEEAUDEPARFUMUnisexe-100ml2.jpg?v=1761217693',
  },
  {
    brand: 'REVE',
    name: 'NOW PINK',
    image: 'https://sheesha.pk/cdn/shop/files/lattafa-rave-now-women-eau-de-parfum-100ml-1__54226.jpg?v=1768508343&width=1946',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L ZEST',
    image: 'https://labbanperfume.com/cdn/shop/files/ZEST___NOTES___1_under_70KB_1280x.webp?v=1771323684',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L ROSA',
    image: 'https://labbanperfume.com/cdn/shop/files/ROSA___NOTES___1_under_70KB_1280x.webp?v=1771323636',
  },
];

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

const IMAGE_BY_KEY = new Map(
  PRODUCT_IMAGES.map(({ brand, name, image }) => [`${normalize(brand)}|${normalize(name)}`, image])
);

function getProductImage(brand, name) {
  return IMAGE_BY_KEY.get(`${normalize(brand)}|${normalize(name)}`) || null;
}

module.exports = { PRODUCT_IMAGES, getProductImage };
