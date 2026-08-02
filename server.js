require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'jamaludeen-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Flash messages
app.use(flash());

// Global locals for every view
app.use((req, res, next) => {
  const lang = req.session.lang || 'en';
  res.locals.lang = lang;
  res.locals.t = require('./helpers/i18n')(lang);
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.isAdmin = req.session.isAdmin || false;
  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce((s, i) => s + i.qty, 0);
  // Store settings available in every template
  const db = require('./database/db');
  const sRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  sRows.forEach(r => settings[r.key] = r.value);
  res.locals.settings = settings;
  res.locals.logo = settings.logo_path || null;
  next();
});

// Language toggle
app.post('/set-lang', (req, res) => {
  req.session.lang = req.body.lang === 'ar' ? 'ar' : 'en';
  const back = req.headers.referer || '/';
  res.redirect(back);
});

// Routes
app.use('/', require('./routes/index'));
app.use('/shop', require('./routes/shop'));
app.use('/collections', require('./routes/collections'));
app.use('/cart', require('./routes/cart'));
app.use('/checkout', require('./routes/checkout'));
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404' });
});

app.listen(PORT, () => {
  console.log('\n──────────────────────────────────');
  console.log('  JAMALUDEEN Perfume Store');
  console.log(`  Store :  http://localhost:${PORT}`);
  console.log(`  Admin :  http://localhost:${PORT}/admin`);
  console.log('──────────────────────────────────\n');
});
