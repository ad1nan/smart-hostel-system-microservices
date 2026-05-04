module.exports = function (roles = []) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.role || !roles.includes(user.role)) {
        return res.status(403).json({
          error: "Access denied: insufficient permissions"
        });
      }

      next();
    } catch (err) {
      console.error("Role middleware error:", err.message);
      res.status(500).json({ error: "Role check failed" });
    }
  };
};