/**
 * Role gate. Use after `authenticate` on any route that should be
 * restricted, e.g. `router.delete('/products/:id', authenticate,
 * authorize('admin'), ...)`. Kept generic (accepts any role list) so
 * future roles beyond 'user'/'admin' don't require touching this file.
 */
function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = authorize;
