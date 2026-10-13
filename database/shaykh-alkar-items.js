// Shaykh Alkar pyramid incense, incense sticks and reed diffusers, from the owner's box photos (October 2026).
// Added once at a default price; the owner sets the real prices from the admin.
const SHAYKH_ALKAR_ITEMS = [
  { name: 'SILVER OUD', name_ar: 'نسائم عود الفضة', image: '/images/brands/shaykh-alkar/silver-oud.webp' },
  { name: 'WISAL', name_ar: 'نسائم عود وصال', image: '/images/brands/shaykh-alkar/wisal.webp' },
  { name: 'ROSE', name_ar: 'نسائم الجوري', image: '/images/brands/shaykh-alkar/rose.webp' },
  { name: 'DAMASCUS JASMINE', name_ar: 'نسائم الياسمين الدمشقي', image: '/images/brands/shaykh-alkar/damascus-jasmine.webp' },
  { name: 'GULF', name_ar: 'نسائم الخليج', image: '/images/brands/shaykh-alkar/gulf.webp' },
  { name: 'VANILLA', name_ar: 'نسائم الفانيليا', image: '/images/brands/shaykh-alkar/vanilla.webp' },
  { name: 'OUD & ANBER', name_ar: 'عود وعنبر', image: '/images/brands/shaykh-alkar/oud-anber.webp' },
  { name: 'OLD OUD', name_ar: 'نسائم عود عتيق', image: '/images/brands/shaykh-alkar/old-oud.webp' },
  { name: 'ROYAL AMBER', name_ar: 'نسائم عنبر ملكي', image: '/images/brands/shaykh-alkar/royal-amber.webp' },
  { name: 'ROYAL AMBER PREMIUM BLEND', name_ar: 'بسلام عبير ملكي', image: '/images/brands/shaykh-alkar/royal-amber-premium-blend.webp' },
  { name: 'ALHARAM GOLD', name_ar: 'نسائم ذهب الحرم', image: '/images/brands/shaykh-alkar/alharam-gold.webp' },
  { name: 'LAVENDER', name_ar: 'نسائم اللافندر', image: '/images/brands/shaykh-alkar/lavender.webp' },
  { name: 'POMEGRANATE', name_ar: 'نسائم مسك الرمان', image: '/images/brands/shaykh-alkar/pomegranate.webp' },
  { name: 'OUD WOOD', name_ar: 'نسائم خشب العود', image: '/images/brands/shaykh-alkar/oud-wood.webp' },
  { name: 'TULIP', name_ar: 'نسائم التوليب', image: '/images/brands/shaykh-alkar/tulip.webp' },
  { name: 'BURNER OUD', name_ar: 'نسائم عود مبخر', image: '/images/brands/shaykh-alkar/burner-oud.webp' },
  // Incense sticks (boxes of 10; Tulip Breezes holds 8).
  { name: 'INCENSE STICKS OUD SAFFRON', name_ar: 'أعواد بخور عود الزعفران', image: '/images/brands/shaykh-alkar/incense-sticks-oud-saffron.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS GARDENIA', name_ar: 'أعواد بخور نسائم غاردينيا', image: '/images/brands/shaykh-alkar/incense-sticks-gardenia.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS SAFFRON', name_ar: 'أعواد بخور نسائم الزعفران', image: '/images/brands/shaykh-alkar/incense-sticks-saffron.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS LAVENDER', name_ar: 'أعواد بخور نسائم اللافندر', image: '/images/brands/shaykh-alkar/incense-sticks-lavender.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS TULIP BREEZES', name_ar: 'أعواد بخور نسائم التوليب (8 أعواد)', image: '/images/brands/shaykh-alkar/incense-sticks-tulip-breezes.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS POMEGRANATE', name_ar: 'أعواد بخور مسك الرمان', image: '/images/brands/shaykh-alkar/incense-sticks-pomegranate.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS VIOLETS', name_ar: 'أعواد بخور البنفسج', image: '/images/brands/shaykh-alkar/incense-sticks-violets.webp', kind: 'sticks' },
  { name: 'INCENSE STICKS TULIP', name_ar: 'أعواد بخور نسائم التوليب', image: '/images/brands/shaykh-alkar/incense-sticks-tulip.webp', kind: 'sticks' },
  // Reed diffusers.
  { name: 'REED DIFFUSER BLUEBERRY', name_ar: 'معطر فواح بلوبيري', image: '/images/brands/shaykh-alkar/reed-diffuser-blueberry.webp', kind: 'reed' },
  { name: 'REED DIFFUSER LILAC', name_ar: 'معطر فواح الليلك', image: '/images/brands/shaykh-alkar/reed-diffuser-lilac.webp', kind: 'reed' },
  { name: 'REED DIFFUSER ROSE', name_ar: 'معطر فواح الورد الجوري', image: '/images/brands/shaykh-alkar/reed-diffuser-rose.webp', kind: 'reed' },
  { name: 'REED DIFFUSER OUD & ANBER', name_ar: 'معطر فواح عود وعنبر', image: '/images/brands/shaykh-alkar/reed-diffuser-oud-anber.webp', kind: 'reed' },
  { name: 'REED DIFFUSER WISAL', name_ar: 'معطر فواح وصال', image: '/images/brands/shaykh-alkar/reed-diffuser-wisal.webp', kind: 'reed' },
  { name: 'REED DIFFUSER LOVE DAY', name_ar: 'معطر فواح سهرة الخميس', image: '/images/brands/shaykh-alkar/reed-diffuser-love-day.webp', kind: 'reed' },
  { name: 'REED DIFFUSER VANILLA', name_ar: 'معطر فواح فانيليا روز', image: '/images/brands/shaykh-alkar/reed-diffuser-vanilla.webp', kind: 'reed' },
  { name: 'REED DIFFUSER AL SULTAN', name_ar: 'معطر فواح السلطان', image: '/images/brands/shaykh-alkar/reed-diffuser-al-sultan.webp', kind: 'reed' },
  { name: 'REED DIFFUSER POMEGRANATE', name_ar: 'معطر فواح مسك الرمان', image: '/images/brands/shaykh-alkar/reed-diffuser-pomegranate.webp', kind: 'reed' },
  { name: 'REED DIFFUSER TUTTI FRUTTI', name_ar: 'معطر فواح توتي فروتي', image: '/images/brands/shaykh-alkar/reed-diffuser-tutti-frutti.webp', kind: 'reed' },
];

module.exports = { SHAYKH_ALKAR_ITEMS };
