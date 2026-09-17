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

// Static files. Explicit mounts and headers keep Hostinger/CDN from serving
// stale HTML or treating stylesheets as generic downloads.
const publicDir = path.join(__dirname, 'public');
app.use('/css', express.static(path.join(publicDir, 'css'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  }
}));
app.use('/js', express.static(path.join(publicDir, 'js'), {
  setHeaders: res => res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate')
}));
app.use(express.static(publicDir));

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

// Lightweight health endpoint registered before database initialization.
app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

// Bind the Hostinger-provided port immediately. Some first-run database/catalog
// initialization is synchronous and may take a few seconds; binding first keeps
// the platform from marking the service unavailable during startup.
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n──────────────────────────────────');
  console.log('  JAMALUDEEN Perfume Store');
  console.log(`  Listening on 0.0.0.0:${PORT}`);
  console.log(`  Admin : /admin`);
  console.log('──────────────────────────────────\n');
});

server.on('error', (error) => {
  console.error('Server listen error:', error);
  process.exit(1);
});

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

// Routes. These imports initialize SQLite/catalog data on first run, so they
// intentionally come after app.listen().
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
