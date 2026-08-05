/**
 * Add unisex local perfumes (type='local', category='unisex')
 * Run: node database/replace-unisex.js
 */
const Database = require('better-sqlite3');
const path     = require('path');

const db = require.main === module
  ? new Database(path.join(__dirname, '../data/store.db'))
  : null;

const DEMO_PRICE = 50000;

const UNISEX = [
  // A
  { n: "Absolute Aphrodisiac",                brand: "Initio" },
  { n: "Accento Overdose",                    brand: "Xerjoff" },
  { n: "Accento Sospiro",                     brand: "Sospiro" },
  { n: "African Leather",                     brand: "Other" },
  { n: "Afternoon Swim",                      brand: "Louis Vuitton" },
  { n: "Alexandria 2",                        brand: "Xerjoff" },
  { n: "Alexandria Orientale",                brand: "Xerjoff" },
  { n: "Alf Layla & Layla",                   brand: "Other" },
  { n: "Al Amaken",                           brand: "Other" },
  { n: "Al Wissam",                           brand: "Other" },
  { n: "Ambar",                               brand: "Other" },
  { n: "Amber Nuit",                          brand: "Dior" },
  { n: "Amber Oud Roja",                      brand: "Roja Parfums" },
  { n: "Ameer Al Oud Intense",                brand: "Lattafa" },
  { n: "Amore Caffe",                         brand: "Mancera" },
  { n: "Amouage Purpose 50",                  brand: "Amouage" },
  { n: "Ana & Shouk",                         brand: "Other" },
  { n: "Ana Al Abyad",                        brand: "Lattafa" },
  { n: "Ana Al Abyad Red",                    brand: "Lattafa" },
  { n: "Angel's Share",                       brand: "By Kilian" },
  { n: "Angel's Share Paradise",              brand: "By Kilian" },
  { n: "Anfar Musk",                          brand: "Other" },
  { n: "Aqua Celestia",                       brand: "Maison Francis Kurkdjian" },
  { n: "Aqua Media Cologne Forte",            brand: "Maison Francis Kurkdjian" },
  { n: "Arabian Tonka",                       brand: "Other" },
  { n: "Armani Privé Rose d'Arabie",          brand: "Giorgio Armani" },
  { n: "Armure Mara",                         brand: "Paco Rabanne" },
  // B
  { n: "Baccarat Rouge 540",                  brand: "Maison Francis Kurkdjian" },
  { n: "Baccarat Rouge 540 Oud",              brand: "Maison Francis Kurkdjian" },
  { n: "Badee Al Oud Pink",                   brand: "Lattafa" },
  { n: "Badee Al Oud Amethyst",               brand: "Lattafa" },
  { n: "Badee Al Oud For Glory",              brand: "Lattafa" },
  { n: "Bal d'Afrique",                       brand: "Byredo" },
  { n: "Bamboo Harmony",                      brand: "By Kilian" },
  { n: "Banafsaj",                            brand: "Other" },
  { n: "Beast Love",                          brand: "Montale" },
  { n: "Beauty",                              brand: "Other" },
  { n: "Bianco Latte",                        brand: "Giardini di Toscana" },
  { n: "Black Oud",                           brand: "Montale" },
  { n: "Black Stone Extrait",                 brand: "Other" },
  { n: "Blamage",                             brand: "Nasomatto" },
  { n: "Blanche Absolute",                    brand: "Byredo" },
  { n: "Blonde Amber",                        brand: "Clive Christian" },
  { n: "Blue Talisman",                       brand: "Ex Nihilo" },
  { n: "BMW",                                 brand: "BMW" },
  { n: "Bois Corse",                          brand: "Diptyque" },
  { n: "Bois Imperial",                       brand: "Other" },
  { n: "Bois Marocain",                       brand: "Tom Ford" },
  { n: "Bois Talisman",                       brand: "Other" },
  { n: "Bonbon Dior Blanc",                   brand: "Dior" },
  { n: "Born for Eternity",                   brand: "Other" },
  // C
  { n: "Caban",                               brand: "Yves Saint Laurent" },
  { n: "Caftan",                              brand: "Yves Saint Laurent" },
  { n: "California Dream",                    brand: "Louis Vuitton" },
  { n: "Cactus Garden",                       brand: "Louis Vuitton" },
  { n: "Capri Concentrated",                  brand: "Other" },
  { n: "Carlisle",                            brand: "Parfums de Marly" },
  { n: "City of Stars",                       brand: "Louis Vuitton" },
  { n: "Creed Centaurus",                     brand: "Creed" },
  { n: "Creed Millesime Imperial",            brand: "Creed" },
  { n: "Creed Royal Oud",                     brand: "Creed" },
  { n: "Crush On Me",                         brand: "Other" },
  { n: "Cuir Elysées",                        brand: "Pierre Balmain" },
  { n: "Cuir Majesto",                        brand: "Giorgio Armani" },
  // D
  { n: "De Marly Kalan",                      brand: "Parfums de Marly" },
  { n: "Derham",                              brand: "Other" },
  { n: "Dhan Al Oud",                         brand: "Other" },
  { n: "Dior New Look",                       brand: "Dior" },
  { n: "Doua Al Janna",                       brand: "Other" },
  { n: "Dohen Oud Red",                       brand: "Other" },
  // E
  { n: "Eghraa",                              brand: "Other" },
  { n: "Elie Saab Oud 4",                     brand: "Elie Saab" },
  { n: "Erbabora",                            brand: "Other" },
  // F
  { n: "Fetiche La Rose",                     brand: "Other" },
  { n: "Fire Place",                          brand: "Other" },
  { n: "Fleur du Desert",                     brand: "Other" },
  { n: "Fleur Orange",                        brand: "Other" },
  { n: "Fleur Susan",                         brand: "Other" },
  // G
  { n: "Gardenia",                            brand: "Other" },
  { n: "Ghoubar Al Fodda",                    brand: "Other" },
  { n: "Ghoubar Al Zahab",                    brand: "Other" },
  { n: "Gissah Solar Musk",                   brand: "Gissah" },
  { n: "Golden Dallah",                       brand: "Xerjoff" },
  { n: "Gold Oud Edition",                    brand: "Lattafa" },
  { n: "Gold Oud Intensive",                  brand: "Other" },
  { n: "Grand Soir",                          brand: "Maison Francis Kurkdjian" },
  { n: "Gucci Guilty Elixir",                 brand: "Gucci" },
  { n: "Gucci Oud Intense",                   brand: "Gucci" },
  { n: "Guidance",                            brand: "Amouage" },
  // H
  { n: "Hekayat Al Sharek",                   brand: "Other" },
  { n: "Hibiscus Mahajad",                    brand: "Maison Crivelli" },
  { n: "Hudson Valley",                       brand: "Gissah" },
  // I
  { n: "Impadia",                             brand: "Other" },
  { n: "Imperid Valky",                       brand: "Gissah" },
  { n: "Ingrate Oud",                         brand: "Ahmed Al Maghribi" },
  { n: "Iric Intense",                        brand: "Montale" },
  { n: "Italic",                              brand: "Xerjoff" },
  // K
  { n: "Kahramana",                           brand: "Other" },
  { n: "Kalimat",                             brand: "Arabian Oud" },
  { n: "Karagoz",                             brand: "Nishane" },
  { n: "Kayali 11 Elixir",                    brand: "Kayali" },
  { n: "Kayali 12 Musk",                      brand: "Kayali" },
  { n: "Kayali 25 Sweet Diamond Pink Pepper", brand: "Kayali" },
  { n: "Kayali 33 Yum Pistachio Gelato",      brand: "Kayali" },
  { n: "Kayali 36 Oudgasm Intense",           brand: "Kayali" },
  { n: "Kayali 48 Lovefest Burning Cherry",   brand: "Kayali" },
  { n: "Kayali 57 Déjà Vu White Flower",      brand: "Kayali" },
  { n: "Kayali 64 Vanille Royale Patchouli",  brand: "Kayali" },
  { n: "Kayali Eden Juicy Apple",             brand: "Kayali" },
  { n: "Kayali Vanille 28",                   brand: "Kayali" },
  { n: "Khamra",                              brand: "Lattafa" },
  { n: "Khamra Kahwa",                        brand: "Lattafa" },
  // L
  { n: "Layle Al Khamis",                     brand: "Other" },
  { n: "Layton",                              brand: "Parfums de Marly" },
  { n: "Les Sablés Roses",                    brand: "Louis Vuitton" },
  { n: "Lost Cherry",                         brand: "Tom Ford" },
  { n: "Lotus",                               brand: "Other" },
  // M
  { n: "Madawi Arabian Oud",                  brand: "Arabian Oud" },
  { n: "Mahyoube",                            brand: "Other" },
  { n: "Maison Francis 724",                  brand: "Maison Francis Kurkdjian" },
  { n: "Mancera Rose",                        brand: "Mancera" },
  { n: "Mancera Rose & Chocolate",            brand: "Mancera" },
  { n: "Mancera Tobacco Red",                 brand: "Mancera" },
  { n: "Medyan",                              brand: "The Spirit of Dubai" },
  { n: "Megamare",                            brand: "Orto Parisi" },
  { n: "Mloud Mokalat",                       brand: "Other" },
  { n: "Mojave Ghost",                        brand: "Byredo" },
  { n: "Molecule 01",                         brand: "Escentric Molecules" },
  { n: "Mont Blanc Signature",                brand: "Mont Blanc" },
  { n: "Musk Abyad",                          brand: "Other" },
  { n: "Musk Al Shoyoukh",                    brand: "Other" },
  { n: "Musk Al Tahara",                      brand: "Other" },
  { n: "Musk Damm Al Ghazel",                 brand: "Other" },
  { n: "Musk Silk",                           brand: "Ajmal" },
  // N
  { n: "Narcotic Delight",                    brand: "Other" },
  { n: "Narjess",                             brand: "Other" },
  { n: "Naxos",                               brand: "Xerjoff" },
  { n: "Nebras",                              brand: "Lattafa" },
  { n: "Night Soul",                          brand: "Paco Rabanne" },
  { n: "Nishane Hacivat",                     brand: "Nishane" },
  { n: "Nuit de Feu",                         brand: "Louis Vuitton" },
  // O
  { n: "Old Fashioned",                       brand: "By Kilian" },
  { n: "Ombre Nomade",                        brand: "Louis Vuitton" },
  { n: "On the Beach",                        brand: "Louis Vuitton" },
  { n: "Oud Abyad",                           brand: "Other" },
  { n: "Oud Al Mubakher",                     brand: "Other" },
  { n: "Oud Amber",                           brand: "Other" },
  { n: "Oud and Bergamot",                    brand: "Other" },
  { n: "Oud Bouquet",                         brand: "Lancôme" },
  { n: "Oud Cambodi",                         brand: "Other" },
  { n: "Oud for Greatness",                   brand: "Initio" },
  { n: "Oud Gucci",                           brand: "Gucci" },
  { n: "Oud Ispahan",                         brand: "Dior" },
  { n: "Oud Khachab",                         brand: "Other" },
  { n: "Oud Maracuja",                        brand: "Other" },
  { n: "Oud Montale",                         brand: "Montale" },
  { n: "Oud Musc",                            brand: "Other" },
  { n: "Oud Royal",                           brand: "Other" },
  { n: "Oud Royal Armani Privé",              brand: "Giorgio Armani" },
  { n: "Oud Royale Shoubader",                brand: "Other" },
  { n: "Oud Satin Mood",                      brand: "Maison Margiela" },
  { n: "Oud Sweet",                           brand: "Other" },
  { n: "Oud White",                           brand: "Other" },
  { n: "Oud Wood Sapparort",                  brand: "Montale" },
  { n: "Oud Zanrian",                         brand: "Creed" },
  // P
  { n: "Pacific Chill",                       brand: "Louis Vuitton" },
  { n: "Patchouli Musk",                      brand: "Other" },
  { n: "Poppy and Barley",                    brand: "Jo Malone" },
  { n: "Pure Oud",                            brand: "Louis Vuitton" },
  // Q
  { n: "Qaed Al Forsan",                      brand: "Lattafa" },
  // R
  { n: "Richwood",                            brand: "Xerjoff" },
  { n: "Rouge Malachite",                     brand: "Other" },
  { n: "Rose Musk",                           brand: "Montale" },
  { n: "Rose Oud",                            brand: "Other" },
  { n: "Rose Oud Musc",                       brand: "Other" },
  { n: "Rose Vanille",                        brand: "Other" },
  // S
  { n: "Safran Secret",                       brand: "Maison Crivelli" },
  { n: "Sahara Noir",                         brand: "Bvlgari" },
  { n: "Santal 33",                           brand: "Le Labo" },
  { n: "Sandal",                              brand: "Other" },
  { n: "Sexy Scent",                          brand: "Other" },
  { n: "Shagaf Oud",                          brand: "Swiss Arabian" },
  { n: "Shams Al Emarat",                     brand: "Ard Al Zaafaran" },
  { n: "Sun Song",                            brand: "Louis Vuitton" },
  { n: "Smoking Hot",                         brand: "By Kilian" },
  { n: "Sole Patchouli",                      brand: "Vertus" },
  { n: "Soultan Sheikh Al Jabal",             brand: "Other" },
  { n: "Spicy Oud",                           brand: "Montale" },
  { n: "Spiky Muse",                          brand: "Other" },
  { n: "Splendid Vanille",                    brand: "Roberto Cavalli" },
  { n: "Stellar Times",                       brand: "Louis Vuitton" },
  { n: "Stronger with You Sandalwood",        brand: "Giorgio Armani" },
  { n: "Supreme Bouquet",                     brand: "Yves Saint Laurent" },
  { n: "Symphony",                            brand: "Louis Vuitton" },
  // T
  { n: "Taif Rose",                           brand: "Jo Malone" },
  { n: "Teriaq",                              brand: "Lattafa" },
  { n: "Tilia",                               brand: "Marc-Antoine Barrois" },
  { n: "Tobacco Honey",                       brand: "Other" },
  { n: "Tom Ford Amber Leather",              brand: "Tom Ford" },
  { n: "Tom Ford Bitter Peach",               brand: "Tom Ford" },
  { n: "Tom Ford Black Lacquer",              brand: "Tom Ford" },
  { n: "Tom Ford Café Rose",                  brand: "Tom Ford" },
  { n: "Tom Ford Electric Cherry",            brand: "Tom Ford" },
  { n: "Tom Ford Noir",                       brand: "Tom Ford" },
  { n: "Tom Ford Oud Wood",                   brand: "Tom Ford" },
  { n: "Tom Ford Rose Prick",                 brand: "Tom Ford" },
  { n: "Tom Ford Soleil Blanc",               brand: "Tom Ford" },
  { n: "Tom Ford Tobacco Oud",                brand: "Tom Ford" },
  { n: "Tom Ford Tuscan Leather",             brand: "Tom Ford" },
  { n: "Tom Ford Vanille Fatale",             brand: "Tom Ford" },
  { n: "Tom Ford Vanille Sex",                brand: "Tom Ford" },
  { n: "Tuxedo",                              brand: "Yves Saint Laurent" },
  { n: "Tulip",                               brand: "Other" },
  // U
  { n: "Upside",                              brand: "Other" },
  // V
  { n: "Vanilla",                             brand: "Other" },
  { n: "Vanilla Diorama",                     brand: "Dior" },
  { n: "Vanilla Musc",                        brand: "Other" },
  { n: "Vanille Cake",                        brand: "Montale" },
  { n: "Vanille Caviar",                      brand: "BDK Parfums" },
  { n: "Vanille Haze",                        brand: "Other" },
  { n: "Vanille Powder",                      brand: "Matière Première" },
  { n: "Vercesa Amber Nectar",                brand: "Other" },
  { n: "Vert Malachite",                      brand: "Other" },
  { n: "Viprato",                             brand: "Sospiro" },
  { n: "Voyage",                              brand: "Hermès" },
  // W
  { n: "Ward Ahmar",                          brand: "Other" },
  { n: "Ward Jouri",                          brand: "Other" },
  { n: "Waw Anfasak Dokhan",                  brand: "Other" },
  { n: "White Patchouli",                     brand: "Other" },
  { n: "Wisal",                               brand: "Arabian Oud" },
  { n: "Wisal Gold",                          brand: "Arabian Oud" },
  { n: "Wood Mystique",                       brand: "Estée Lauder" },
  // Z
  { n: "Zaafran",                             brand: "Other" },
  { n: "Zahret Al Khaleej",                   brand: "Other" },
  { n: "Zanbak",                              brand: "Other" },
];

module.exports = { UNISEX };

if (require.main === module) {

const khaleejiSet = new Set(['Lattafa', 'Rasasi', 'Arabian Oud', 'Ajmal', 'Asdaaf', 'Ard Al Zaafaran', 'Swiss Arabian']);

const insertBrand   = db.prepare("INSERT OR IGNORE INTO brands (name, type) VALUES (?, ?)");
const insertProduct = db.prepare(`
  INSERT INTO products (name_en, category, brand, price, in_stock, featured, type)
  VALUES (?, 'unisex', ?, ?, 1, 0, 'local')
`);

console.log("Adding unisex products...");

const run = db.transaction(() => {
  const del = db.prepare("DELETE FROM products WHERE category='unisex' AND type='local'").run();
  console.log(`  ✓ Removed ${del.changes} old unisex products`);

  // Local Unisex products must not create or modify storefront Brand records.

  for (const p of UNISEX) insertProduct.run(p.n, p.brand, DEMO_PRICE);
  console.log(`  ✓ Inserted ${UNISEX.length} unisex products`);
  console.log(`  ✓ Demo price: ${DEMO_PRICE.toLocaleString()} LBP`);
});

run();
console.log('\n✅ Done! Open http://localhost:3000/shop?category=unisex to verify.');
db.close();
}
