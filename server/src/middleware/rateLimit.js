const stores = new Map();

function trimWindow(entries, now, windowMs) {
  return entries.filter((timestamp) => now - timestamp < windowMs);
}

export function createRateLimit({ id, windowMs, max, keyFn, message }) {
  const store = new Map();
  stores.set(id, { store, windowMs, max });

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip || "anonymous";
    const entries = trimWindow(store.get(key) || [], now, windowMs);
    entries.push(now);
    store.set(key, entries);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(max - entries.length, 0)));

    if (entries.length > max) {
      const error = new Error(message || "Rate limit exceeded. Please slow down and try again.");
      error.statusCode = 429;
      return next(error);
    }

    return next();
  };
}

export function describeRateLimits() {
  return Array.from(stores.entries()).map(([id, value]) => ({
    id,
    windowMs: value.windowMs,
    max: value.max,
    trackedKeys: value.store.size
  }));
}
