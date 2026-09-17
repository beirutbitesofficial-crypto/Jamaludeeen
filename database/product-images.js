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
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L VANILLA TWILIGHT',
    image: 'https://labbanperfume.com/cdn/shop/files/VANILLA_TWILIGHT_-_VANILLA_NOTE_1280x.webp?v=1771323858',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L NEW OUD',
    image: 'https://labbanperfume.com/cdn/shop/files/NEW_OUD_under_100KB_1280x.webp?v=1770028988',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L WHITE MUSK',
    image: 'https://labbanperfume.com/cdn/shop/files/WHITE_MUSK_FLOAT_under_100KB_1280x.webp?v=1771323794',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L CODE',
    image: 'https://labbanperfume.com/cdn/shop/files/CODE_1280x.webp?v=1745582492',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L SENORITA',
    image: 'https://labbanperfume.com/cdn/shop/files/SENORITA_NOTES_under_70KB_1280x.webp?v=1771323879',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L INTENSE OCEAN',
    image: 'https://labbanperfume.com/cdn/shop/files/INTENSE_OCEAN___NOTES___1_under_70KB_1280x.webp?v=1771323611',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L ROYAL OUD',
    image: 'https://labbanperfume.com/cdn/shop/files/ROYAL_OUD___NOTES___1_under_70KB_1280x.webp?v=1771323697',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L WARM AMBER',
    image: 'https://labbanperfume.com/cdn/shop/files/WARM_AMBER___NOTES___1_under_70KB_1280x.webp?v=1771323670',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L ROSELLA',
    image: 'https://labbanperfume.com/cdn/shop/files/ROSELLA___NOTES___1_under_70KB_1280x.webp?v=1771323951',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L SWEET OUD',
    image: 'https://labbanperfume.com/cdn/shop/files/SWEET_OUD___NOTES___1_under_70KB_1280x.webp?v=1771323655',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L SIENNA',
    image: 'https://labbanperfume.com/cdn/shop/files/d92333e8f0f91e25c4caf7913efe22e7_1280x.webp?v=1757752764',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L INFINITY',
    image: 'https://labbanperfume.com/cdn/shop/files/INFINITY___NOTES___1_under_70KB_1280x.webp?v=1771323661',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L MYSTERY',
    image: 'https://labbanperfume.com/cdn/shop/files/MYSTERY_1280x.webp?v=1768038386',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L LEGEND',
    image: 'https://labbanperfume.com/cdn/shop/files/LEGEND___NOTES___1_under_70KB_1280x.webp?v=1771323618',
  },
  {
    brand: 'HAMZA AL LABBAN',
    name: 'H.L ROMANCE',
    image: 'https://medaid.ae/cdn/shop/files/Romance-for-Women_e2007861-8638-4f50-b7af-82a8e37c3586.webp?v=1746880660&width=1946',
  },
  {
    brand: 'JUNAID',
    name: 'MOATTAR DHAHAB',
    image: 'https://witr.com.au/cdn/shop/files/Moattar_Dhahab_1.webp?v=1780840090&width=1000',
  },
  {
    brand: 'JUNAID',
    name: 'THULOOJ INTENSE',
    image: 'https://world.junaidperfumes.com/cdn/shop/files/Thulooj_Intense.jpg?v=1756129998&width=1445',
  },
  {
    brand: 'JUNAID',
    name: 'THULOOJ',
    image: 'https://witr.com.au/cdn/shop/files/thulooj_gents_junaid.jpg?v=1780877392&width=1000',
  },
  {
    brand: 'JUNAID',
    name: 'FUTAINA',
    image: 'https://world.junaidperfumes.com/cdn/shop/files/Futaina_20_2_20copy_b435f513-3e1c-4bb8-ac0d-62b8eb0b8c63.jpg?v=1756130109&width=1946',
  },
  {
    brand: 'JUNAID',
    name: 'MUSK OCEAN',
    image: 'https://world.junaidperfumes.com/cdn/shop/files/Ocean-Musk.jpg?v=1756130054&width=1445',
  },
  {
    brand: 'JUNAID',
    name: 'MUSK',
    image: 'https://world.junaidperfumes.com/cdn/shop/files/Musk-10-0-4146.jpg?v=1756129991&width=1946',
  },
  {
    brand: 'JUNAID',
    name: 'NASHWA',
    image: 'https://world.junaidperfumes.com/cdn/shop/files/Nashwa.jpg?v=1756129995&width=1946',
  },
  {
    brand: 'FRENCH AVENUE',
    name: 'ATLANTIS EXTRAIT',
    image: 'https://frenchavenue.com/cdn/shop/files/1-2025-08-20T113257.096.jpg?v=1755675237&width=416',
  },
  {
    brand: 'FRENCH AVENUE',
    name: 'IRIDA EXTRAIT',
    image: 'https://orioudh.com/cdn/shop/files/irida-extrait-de-parfum-100ml-by-french-avenue-women-perfume-extrait-de-parfum-100ml-french-avenue-309937-1191457790.jpg?crop=center&height=2048&v=1757064936&width=2048',
  },
  {
    brand: 'FRENCH AVENUE',
    name: "ROSES D'EMOTION",
    image: 'https://cdn.notinoimg.com/detail_main_hq/french_avenue/6290360370217_02-o/roses-demotion___250109.jpg',
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
