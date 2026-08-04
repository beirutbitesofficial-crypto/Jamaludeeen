/**
 * Replace men's products with the actual local inventory.
 * Run: node database/replace-men.js
 */
require('dotenv').config();
const Database = require('better-sqlite3');
const path    = require('path');

const db = require.main === module
  ? new Database(path.join(__dirname, '../data/store.db'))
  : null;

const DEMO_PRICE = 50000; // 50,000 LBP demo price

// ── Full men's product list with auto-assigned brands ────────
const MEN = [
  // A
  { n: "A* Men Fantasm Mugler",                brand: "Thierry Mugler" },
  { n: "Adidas Game Spirit",                   brand: "Adidas" },
  { n: "Adidas Sport",                         brand: "Adidas" },
  { n: "Ajwad Lattafa",                        brand: "Lattafa" },
  { n: "Akira",                                brand: "Akira" },
  { n: "Al Haybe",                             brand: "Arabian Oud" },
  { n: "Allure Homme Sport",                   brand: "Chanel" },
  { n: "Althaïr de Marly",                     brand: "Parfums de Marly" },
  { n: "Amarige",                              brand: "Givenchy" },
  { n: "Angel",                                brand: "Thierry Mugler" },
  { n: "Antonio Banderas",                     brand: "Antonio Banderas" },
  { n: "Antonio Banderas The Golden Secret",   brand: "Antonio Banderas" },
  { n: "Aqua Bvlgari",                         brand: "Bvlgari" },
  { n: "Acqua di Gio",                         brand: "Giorgio Armani" },
  { n: "Acqua di Gio Giorgio Armani",          brand: "Giorgio Armani" },
  { n: "Acqua di Gio Profondo",                brand: "Giorgio Armani" },
  { n: "Acqua di Gio Profumo",                 brand: "Giorgio Armani" },
  { n: "Acqua di Parma Blue",                  brand: "Acqua di Parma" },
  { n: "Aqua Silva",                           brand: "Other" },
  { n: "Aramis",                               brand: "Aramis" },
  { n: "Armani Black Code",                    brand: "Giorgio Armani" },
  { n: "Armani Code Absolute",                 brand: "Giorgio Armani" },
  { n: "Armani Code Colonia",                  brand: "Giorgio Armani" },
  { n: "Armani Code Profumo",                  brand: "Giorgio Armani" },
  { n: "Armani Code Ultimate",                 brand: "Giorgio Armani" },
  { n: "Armani Oud Royal Privé",               brand: "Giorgio Armani" },
  { n: "Armani You",                           brand: "Giorgio Armani" },
  { n: "Asad Lattafa",                         brand: "Lattafa" },
  { n: "Asad Lattafa Bourbon",                 brand: "Lattafa" },
  { n: "Azzaro Chrome",                        brand: "Azzaro" },
  { n: "Azzaro Chrome Extreme",                brand: "Azzaro" },
  { n: "Azzaro Forever Wanted Elixir",         brand: "Azzaro" },
  { n: "Azzaro Pour Homme",                    brand: "Azzaro" },
  { n: "Azzaro Silver Black",                  brand: "Azzaro" },
  { n: "Azzaro Wanted",                        brand: "Azzaro" },
  { n: "Azzaro Wanted By Night",               brand: "Azzaro" },
  { n: "Azzaro Wanted The Most",               brand: "Azzaro" },
  // B
  { n: "Bad Boy Carolina Herrera",             brand: "Carolina Herrera" },
  { n: "Bad Boy Cobalt Elixir Carolina Herrera", brand: "Carolina Herrera" },
  { n: "Bentley Azure",                        brand: "Bentley" },
  { n: "Black Afghano",                        brand: "Nasomatto" },
  { n: "Black Orchid Tom Ford",                brand: "Tom Ford" },
  { n: "Black Seduction",                      brand: "Antonio Banderas" },
  { n: "Black XS",                             brand: "Paco Rabanne" },
  { n: "Black XS L'Aphrodisiaque",             brand: "Paco Rabanne" },
  { n: "Black XS L'Excess",                    brand: "Paco Rabanne" },
  { n: "Black XS Top Legend",                  brand: "Paco Rabanne" },
  { n: "Bleu de Chanel",                       brand: "Chanel" },
  { n: "Blue Ajmal",                           brand: "Ajmal" },
  { n: "Blue Channel",                         brand: "Channel" },
  { n: "Blue Channel Exclusive",               brand: "Channel" },
  { n: "Blue Jeans",                           brand: "Versace" },
  { n: "Blue Polo",                            brand: "Ralph Lauren" },
  { n: "Blue Seduction",                       brand: "Antonio Banderas" },
  { n: "Blue for Man",                         brand: "Bvlgari" },
  { n: "Bois d'Argent Dior",                   brand: "Dior" },
  { n: "Boss Bottled",                         brand: "Hugo Boss" },
  { n: "Boss Bottled Absolute",                brand: "Hugo Boss" },
  { n: "Boss Bottled Elixir",                  brand: "Hugo Boss" },
  { n: "Boss Bottled Triumph Elixir",          brand: "Hugo Boss" },
  { n: "Boss Orange",                          brand: "Hugo Boss" },
  { n: "Brut",                                 brand: "Brut" },
  { n: "Burberry",                             brand: "Burberry" },
  { n: "Bvlgari Blue Man",                     brand: "Bvlgari" },
  { n: "Bvlgari Man",                          brand: "Bvlgari" },
  { n: "Bvlgari Man in Black",                 brand: "Bvlgari" },
  { n: "Bvlgari Tygar",                        brand: "Bvlgari" },
  // C
  { n: "Caron",                                brand: "Caron" },
  { n: "Carolina Herrera",                     brand: "Carolina Herrera" },
  { n: "Carolina Herrera 212 Silver",          brand: "Carolina Herrera" },
  { n: "Cartier Déclaration",                  brand: "Cartier" },
  { n: "Cartier Pasha",                        brand: "Cartier" },
  { n: "Cacharel",                             brand: "Cacharel" },
  { n: "Cerruti 1881",                         brand: "Cerruti" },
  { n: "Cigar",                                brand: "Rémy Latour" },
  { n: "CK Be",                                brand: "Calvin Klein" },
  { n: "CK Euphoria",                          brand: "Calvin Klein" },
  { n: "CK One",                               brand: "Calvin Klein" },
  { n: "CK One N2U",                           brand: "Calvin Klein" },
  { n: "Creed Aventus",                        brand: "Creed" },
  { n: "Creed Aventus Absolute",               brand: "Creed" },
  { n: "Creed Irish Tweed Black",              brand: "Creed" },
  // D
  { n: "Darej",                                brand: "Rasasi" },
  { n: "David Beckham",                        brand: "David Beckham" },
  { n: "Davidoff",                             brand: "Davidoff" },
  { n: "Davidoff Cool Water",                  brand: "Davidoff" },
  { n: "Diesel",                               brand: "Diesel" },
  { n: "Dior Homme",                           brand: "Dior" },
  { n: "Dior Homme Intense",                   brand: "Dior" },
  { n: "Dior Homme Parfum 2025",               brand: "Dior" },
  { n: "Dior Homme Sport",                     brand: "Dior" },
  { n: "Dolce & Gabbana",                      brand: "Dolce & Gabbana" },
  { n: "Dolce & Gabbana Devotion",             brand: "Dolce & Gabbana" },
  { n: "Dolce & Gabbana Intense",              brand: "Dolce & Gabbana" },
  { n: "Dolce & Gabbana K",                    brand: "Dolce & Gabbana" },
  { n: "Dolce & Gabbana The One",              brand: "Dolce & Gabbana" },
  { n: "Dolce & Gabbana The One Grey",         brand: "Dolce & Gabbana" },
  { n: "Dolce & Gabbana The One Royal Night",  brand: "Dolce & Gabbana" },
  { n: "Drakkar Noir",                         brand: "Guy Laroche" },
  { n: "Dunhill Blue",                         brand: "Dunhill" },
  { n: "Dunhill Desire",                       brand: "Dunhill" },
  { n: "Dunhill Fresh",                        brand: "Dunhill" },
  { n: "Dunhill Icon Absolute",                brand: "Dunhill" },
  { n: "Dupont ST",                            brand: "S.T. Dupont" },
  // E
  { n: "Elie Saab L'Homme",                    brand: "Elie Saab" },
  { n: "Emotion Rasasi Men",                   brand: "Rasasi" },
  { n: "Encre Noire Lalique",                  brand: "Lalique" },
  { n: "Escada Pour Homme",                    brand: "Escada" },
  { n: "Eternity",                             brand: "Calvin Klein" },
  { n: "Elysium Roja",                         brand: "Roja Parfums" },
  // F
  { n: "Fahrenheit",                           brand: "Dior" },
  { n: "Fakher Extrait",                       brand: "Fakher" },
  { n: "Fendi",                                brand: "Fendi" },
  { n: "Ferrari Black",                        brand: "Ferrari" },
  { n: "Ferrari Extreme",                      brand: "Ferrari" },
  { n: "Ferrari Red",                          brand: "Ferrari" },
  { n: "Fiero Xerjoff",                        brand: "Xerjoff" },
  { n: "Fuel for Life Homme Diesel",           brand: "Diesel" },
  // G
  { n: "Gianfranco Ferré",                     brand: "Gianfranco Ferré" },
  { n: "Givenchy Blue Label",                  brand: "Givenchy" },
  { n: "Givenchy Gentleman",                   brand: "Givenchy" },
  { n: "Givenchy Gentleman Only",              brand: "Givenchy" },
  { n: "Givenchy Gentleman Réserve Privée",    brand: "Givenchy" },
  { n: "Givenchy Gentleman Society",           brand: "Givenchy" },
  { n: "Givenchy Pour Homme",                  brand: "Givenchy" },
  { n: "Gucci Guilty Absolute",                brand: "Gucci" },
  { n: "Gucci Guilty Black",                   brand: "Gucci" },
  { n: "Gucci Guilty Elixir",                  brand: "Gucci" },
  // H
  { n: "H24 Hermès",                           brand: "Hermès" },
  { n: "Hamlet",                               brand: "Other" },
  { n: "Hawas Rasasi",                         brand: "Rasasi" },
  { n: "Herrera for Men",                      brand: "Carolina Herrera" },
  { n: "His Confession",                       brand: "Other" },
  { n: "Hugo Boss",                            brand: "Hugo Boss" },
  { n: "Hugo Boss Bottled",                    brand: "Hugo Boss" },
  { n: "Hugo Boss Bottled Absolute",           brand: "Hugo Boss" },
  { n: "Hugo Boss Bottled Elixir",             brand: "Hugo Boss" },
  { n: "Hugo Boss Dark Blue",                  brand: "Hugo Boss" },
  { n: "Hugo Boss Energies",                   brand: "Hugo Boss" },
  { n: "Hugo Boss K.Y",                        brand: "Hugo Boss" },
  { n: "Hugo Boss The Scent Elixir",           brand: "Hugo Boss" },
  { n: "Hugo Boss Ultimated",                  brand: "Hugo Boss" },
  { n: "Hummer",                               brand: "Hummer" },
  // I
  { n: "Ideal Guerlain L'Homme",               brand: "Guerlain" },
  { n: "Ideal Homme",                          brand: "Guerlain" },
  { n: "Imagination",                          brand: "Jacques Bogart" },
  { n: "Invictus",                             brand: "Paco Rabanne" },
  { n: "Invictus Aqua",                        brand: "Paco Rabanne" },
  { n: "Invictus Parfum",                      brand: "Paco Rabanne" },
  { n: "Invictus Platinum",                    brand: "Paco Rabanne" },
  { n: "Invictus Victory",                     brand: "Paco Rabanne" },
  { n: "Invictus Victory Absolute",            brand: "Paco Rabanne" },
  { n: "Invictus Victory Elixir",              brand: "Paco Rabanne" },
  { n: "Invincible New Brand",                 brand: "New Brand" },
  { n: "Issey Miyake",                         brand: "Issey Miyake" },
  { n: "Issey Miyake Le Sel d'Issey",          brand: "Issey Miyake" },
  // J
  { n: "Jaguar for Men",                       brand: "Jaguar" },
  { n: "Jaguar Black Classic",                 brand: "Jaguar" },
  { n: "Jimmy Choo Man Ice",                   brand: "Jimmy Choo" },
  { n: "Joop Homme",                           brand: "Joop" },
  { n: "Joop Nightflight",                     brand: "Joop" },
  { n: "Just Cavalli",                         brand: "Roberto Cavalli" },
  // K
  { n: "Kaher Al Nisaa",                       brand: "Rasasi" },
  { n: "Kashmir Arabian Oud",                  brand: "Arabian Oud" },
  { n: "Kenzo",                                brand: "Kenzo" },
  { n: "Kenzo Jungle Homme",                   brand: "Kenzo" },
  { n: "Kenzo Night",                          brand: "Kenzo" },
  { n: "Kenzo Santal Marin",                   brand: "Kenzo" },
  { n: "Kobra",                                brand: "Lattafa" },
  { n: "Kobra Bvlgari",                        brand: "Lattafa" },
  // L
  { n: "Lacoste Challenge",                    brand: "Lacoste" },
  { n: "Lacoste Essential",                    brand: "Lacoste" },
  { n: "Lacoste Grey",                         brand: "Lacoste" },
  { n: "Lacoste Match Point",                  brand: "Lacoste" },
  { n: "Lacoste Noir",                         brand: "Lacoste" },
  { n: "Lacoste Red",                          brand: "Lacoste" },
  { n: "Lacoste White",                        brand: "Lacoste" },
  { n: "La Nuit de L'Homme",                   brand: "Yves Saint Laurent" },
  { n: "La Nuit de L'Homme Électrique",        brand: "Yves Saint Laurent" },
  { n: "Lanvin L'Homme",                       brand: "Lanvin" },
  { n: "Le Beau",                              brand: "Jean Paul Gaultier" },
  { n: "Le Beau Le Parfum",                    brand: "Jean Paul Gaultier" },
  { n: "Le Beau Paradise Garden",              brand: "Jean Paul Gaultier" },
  { n: "Le Mâle",                              brand: "Jean Paul Gaultier" },
  { n: "Le Mâle Elixir",                       brand: "Jean Paul Gaultier" },
  { n: "Le Mâle Elixir Absolute",              brand: "Jean Paul Gaultier" },
  { n: "Le Mâle Le Parfum",                    brand: "Jean Paul Gaultier" },
  { n: "Le Mâle Lover",                        brand: "Jean Paul Gaultier" },
  { n: "Light Blue",                           brand: "Dolce & Gabbana" },
  { n: "L'Immensité Louis Vuitton",            brand: "Louis Vuitton" },
  { n: "L'Homme",                              brand: "Yves Saint Laurent" },
  { n: "L'Homme Libre",                        brand: "Yves Saint Laurent" },
  { n: "Lamborghini",                          brand: "Lamborghini" },
  { n: "Lucky Man",                            brand: "Azzaro" },
  { n: "Luna Rossa Prada",                     brand: "Prada" },
  { n: "Luna Rossa Prada Carbon",              brand: "Prada" },
  { n: "Luna Rossa Prada Sport",               brand: "Prada" },
  // M
  { n: "Malizia",                              brand: "Malizia" },
  { n: "Moschino Toy Boy",                     brand: "Moschino" },
  { n: "Mercedes Benz",                        brand: "Mercedes-Benz" },
  { n: "Miracle Homme",                        brand: "Lancôme" },
  { n: "Mont Blanc Emblem",                    brand: "Mont Blanc" },
  { n: "Mont Blanc Explorer",                  brand: "Mont Blanc" },
  { n: "Mont Blanc Explorer Ultra Blue",       brand: "Mont Blanc" },
  { n: "Mont Blanc Individual",                brand: "Mont Blanc" },
  { n: "Mont Blanc Legend",                    brand: "Mont Blanc" },
  { n: "Mont Blanc Legend Blue",               brand: "Mont Blanc" },
  { n: "Mont Blanc Legend Red",                brand: "Mont Blanc" },
  { n: "Mont Blanc Legend Spirit",             brand: "Mont Blanc" },
  { n: "Mont Blanc Starwalker",                brand: "Mont Blanc" },
  { n: "Monsieur Claud",                       brand: "Other" },
  { n: "Myself",                               brand: "Cacharel" },
  { n: "Myself Absolute",                      brand: "Cacharel" },
  // N
  { n: "Narciso Rodriguez Blue Noir",          brand: "Narciso Rodriguez" },
  { n: "Narciso Rodriguez Vetiver Musk",       brand: "Narciso Rodriguez" },
  { n: "Nio Xerjoff",                          brand: "Xerjoff" },
  { n: "Nouveau Monde Louis Vuitton",          brand: "Louis Vuitton" },
  // O
  { n: "Old Spice",                            brand: "Old Spice" },
  { n: "One Man Show",                         brand: "Jacques Bogart" },
  { n: "One Million",                          brand: "Paco Rabanne" },
  { n: "One Million Elixir",                   brand: "Paco Rabanne" },
  { n: "One Million Gold",                     brand: "Paco Rabanne" },
  { n: "One Million Gold Elixir",              brand: "Paco Rabanne" },
  { n: "One Million Lucky",                    brand: "Paco Rabanne" },
  { n: "One Million Privé",                    brand: "Paco Rabanne" },
  { n: "Only for Men",                         brand: "Azzaro" },
  { n: "Opium",                                brand: "Yves Saint Laurent" },
  { n: "Orange Louis Vuitton",                 brand: "Louis Vuitton" },
  // P
  { n: "Paco Rabanne",                         brand: "Paco Rabanne" },
  { n: "Phantom",                              brand: "Paco Rabanne" },
  { n: "Phantom Intense",                      brand: "Paco Rabanne" },
  { n: "Phantom Legend",                       brand: "Paco Rabanne" },
  { n: "Play Givenchy",                        brand: "Givenchy" },
  { n: "Play Givenchy Intense",                brand: "Givenchy" },
  { n: "Polo Red",                             brand: "Ralph Lauren" },
  { n: "Polo Supreme Cashmere",                brand: "Ralph Lauren" },
  { n: "Polo Supreme Oud",                     brand: "Ralph Lauren" },
  { n: "Prada L'Homme",                        brand: "Prada" },
  { n: "Prada Milano",                         brand: "Prada" },
  { n: "Pure XS",                              brand: "Paco Rabanne" },
  { n: "Purple Label Ralph Lauren",            brand: "Ralph Lauren" },
  // R
  { n: "Rasasi Darej",                         brand: "Rasasi" },
  { n: "Rêve Dior",                            brand: "Dior" },
  { n: "Rochas Man",                           brand: "Rochas" },
  { n: "Roberto Cavalli",                      brand: "Roberto Cavalli" },
  { n: "Roma",                                 brand: "Laura Biagiotti" },
  { n: "Romance",                              brand: "Ralph Lauren" },
  { n: "Royal Blue",                           brand: "Other" },
  { n: "Royal Man",                            brand: "Other" },
  // S
  { n: "Sauvage",                              brand: "Dior" },
  { n: "Sauvage Elixir",                       brand: "Dior" },
  { n: "Sculpture",                            brand: "Nikos" },
  { n: "Sexy 212",                             brand: "Carolina Herrera" },
  { n: "Sheikh Al Shouyoukh Black",            brand: "Lattafa" },
  { n: "Sheikh Al Shouyoukh Final",            brand: "Lattafa" },
  { n: "Sheikh Al Shouyoukh Luxe Edition",     brand: "Lattafa" },
  { n: "Shirley May Darknet",                  brand: "Shirley May" },
  { n: "Silver Scent",                         brand: "Jacques Bogart" },
  { n: "Silver Scent Midnight",                brand: "Jacques Bogart" },
  { n: "Silver Shadow",                        brand: "Davidoff" },
  { n: "Soltan Al Otur",                       brand: "Ajmal" },
  { n: "Spicebomb",                            brand: "Viktor & Rolf" },
  { n: "Spicebomb Extreme",                    brand: "Viktor & Rolf" },
  { n: "Spicebomb Infrared",                   brand: "Viktor & Rolf" },
  { n: "Stronger With You",                    brand: "Emporio Armani" },
  { n: "Stronger With You Absolute",           brand: "Emporio Armani" },
  { n: "Stronger With You Amber",              brand: "Emporio Armani" },
  { n: "Stronger With You Freeze",             brand: "Emporio Armani" },
  { n: "Stronger With You Intensely",          brand: "Emporio Armani" },
  { n: "Stronger With You Leather",            brand: "Emporio Armani" },
  { n: "Stronger With You Oud",                brand: "Emporio Armani" },
  { n: "Stronger With You Parfum",             brand: "Emporio Armani" },
  { n: "Stronger With You Tobacco",            brand: "Emporio Armani" },
  { n: "Sur La Route Louis Vuitton",           brand: "Louis Vuitton" },
  // T
  { n: "Tabac",                                brand: "Mäurer & Wirtz" },
  { n: "Terre d'Hermès",                       brand: "Hermès" },
  { n: "The One Grey",                         brand: "Dolce & Gabbana" },
  { n: "The Scent",                            brand: "Hugo Boss" },
  { n: "Tom Ford",                             brand: "Tom Ford" },
  { n: "Tom Ford Fucking Fabulous",            brand: "Tom Ford" },
  { n: "Tom Ford Grey Vetiver",                brand: "Tom Ford" },
  { n: "Tom Ford Noir Extreme",                brand: "Tom Ford" },
  { n: "Tom Ford Ombré Leather",               brand: "Tom Ford" },
  { n: "Tom Ford Neroli Portofino",            brand: "Tom Ford" },
  { n: "Tom Ford Tobacco Vanille",             brand: "Tom Ford" },
  { n: "Top Way",                              brand: "Other" },
  { n: "Trussardi Uomo",                       brand: "Trussardi" },
  // U
  { n: "Ultra Mâle Jean Paul Gaultier",        brand: "Jean Paul Gaultier" },
  // V
  { n: "Valentino Uomo",                       brand: "Valentino" },
  { n: "Valentino Uomo Born in Roma",          brand: "Valentino" },
  { n: "Valentino Uomo Born in Roma Intense",  brand: "Valentino" },
  { n: "Valentino Uomo Born in Roma Extradose",brand: "Valentino" },
  { n: "Valentino Homme Intense",              brand: "Valentino" },
  { n: "Versace Eros",                         brand: "Versace" },
  { n: "Versace Eros Energy",                  brand: "Versace" },
  { n: "Versace Eros Flame",                   brand: "Versace" },
  { n: "Versace Eros Najim",                   brand: "Versace" },
  { n: "Versace Pour Homme Dylan Blue",        brand: "Versace" },
  { n: "Versace Eau Fraîche",                  brand: "Versace" },
  { n: "VIP 212",                              brand: "Carolina Herrera" },
  { n: "VIP 212 Black",                        brand: "Carolina Herrera" },
  // Y
  { n: "Y Yves Saint Laurent",                 brand: "Yves Saint Laurent" },
  { n: "Y Le Parfum",                          brand: "Yves Saint Laurent" },
  { n: "Y Intense",                            brand: "Yves Saint Laurent" },
  // Z
  { n: "Zara",                                 brand: "Zara" },
  { n: "Zara Night",                           brand: "Zara" },
];

module.exports = { MEN };

if (require.main === module) {

// ── Ensure brand exists ───────────────────────────────────
const khaleejiSet = new Set(['Lattafa','Rasasi','Arabian Oud','Ajmal','Fakher']);
const getBrandId = db.prepare('SELECT id FROM brands WHERE name = ?');
const insertBrand = db.prepare("INSERT OR IGNORE INTO brands (name, type) VALUES (?, ?)");

function ensureBrand(name) {
  if (!getBrandId.get(name)) {
    insertBrand.run(name, khaleejiSet.has(name) ? 'khaleeji' : 'western');
  }
}

// ── Run in a transaction ──────────────────────────────────
const run = db.transaction(() => {
  // 1. Remove old men's products
  const del = db.prepare("DELETE FROM products WHERE category = 'men' AND type = 'local'").run();
  console.log(`  ✓ Removed ${del.changes} old men's products`);

  // 2. Ensure all brands exist
  // Local Men products must not create or modify storefront Brand records.

  // 3. Insert new products
  const ins = db.prepare(`
    INSERT INTO products (name_en, category, brand, type, price, in_stock, featured)
    VALUES (?, 'men', ?, 'local', ?, 1, 0)
  `);
  for (const p of MEN) ins.run(p.n, p.brand, DEMO_PRICE);
  console.log(`  ✓ Inserted ${MEN.length} men's products`);
  console.log(`  ✓ Demo price: ${DEMO_PRICE.toLocaleString()} LBP`);

  // 4. Update settings with demo payment values (if not already set)
  const s = db.prepare("SELECT value FROM settings WHERE key = 'whish_number'").get();
  if (!s || !s.value) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('whish_number', '03000000')").run();
    console.log('  ✓ Demo ByWhish number set: 03000000');
  }
});

console.log('\nReplacing men\'s products...');
run();
console.log('\n✅ Done! Open http://localhost:3000/shop?category=men to verify.\n');
db.close();
}
