module.exports = function adminAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  req.flash('error', 'Please log in to access the admin panel.');
  res.redirect('/admin/login');
};
