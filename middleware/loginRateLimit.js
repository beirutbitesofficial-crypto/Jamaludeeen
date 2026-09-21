const attempts = new Map();

function key(req, scope) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return scope + ':' + ip;
}

function loginRateLimit(scope, { maxAttempts = 8, windowMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const k = key(req, scope);
    const entry = attempts.get(k);
    if (!entry || entry.resetAt <= now) {
      attempts.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      if (req.path.startsWith('/api/')) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
      req.flash?.('error', 'Too many login attempts. Try again later.');
      return res.redirect(req.originalUrl.includes('/system') ? '/system/login' : '/admin/login');
    }
    entry.count += 1;
    next();
  };
}

function clearLoginAttempts(req, scope) {
  attempts.delete(key(req, scope));
}

module.exports = { loginRateLimit, clearLoginAttempts };
