const { translator } = require('../helpers/back-office-i18n');

module.exports = function adminAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  req.flash('error', translator(req.session.lang)('please_login'));
  res.redirect('/admin/login');
};
