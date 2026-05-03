module.exports = function (roles = []) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          error: "Access denied: insufficient permissions"
        });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: "Role check failed" });
    }
  };
};