const express = require("express");
const router = express.Router();
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_TOKEN_EXPIRY  = "15m";   // short-lived
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function hashRefreshToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Access denied" });
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ---------- REGISTER ---------- */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: "Username is required and must be a string" });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: "Password is required and must be a string" });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters long" });
    }
    if (username.length > 30) {
      return res.status(400).json({ error: "Username must be less than 30 characters" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (password.length > 128) {
      return res.status(400).json({ error: "Password must be less than 128 characters" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const hashed = await bcrypt.hash(password, 12); // bumped from 10 to 12
    const user = new User({
      username,
      password: hashed,
      role: "user"
    });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Register failed" });
  }
});

/* ---------- LOGIN ---------- */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: "Username is required and must be a string" });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: "Password is required and must be a string" });
    }
    if (username.trim().length === 0) {
      return res.status(400).json({ error: "Username cannot be empty" });
    }
    if (password.length === 0) {
      return res.status(400).json({ error: "Password cannot be empty" });
    }

    const user = await User.findOne({ username });
    // Always run bcrypt even if user not found — prevents timing attacks
    const dummyHash = "$2a$12$invalidsaltinvalidsaltinvalidsa";
    const valid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !valid) {
      // Single vague message — don't reveal whether user exists
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Issue access token (short-lived)
    const accessToken = generateAccessToken(user);

    // Issue refresh token (random 64-byte hex, stored in DB)
    const rawRefresh = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = hashRefreshToken(rawRefresh);
    await RefreshToken.create({
      tokenHash: refreshTokenHash,
      userId: user._id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
    });

    res.json({
      token: accessToken,           // frontend keeps using this as "token"
      refreshToken: rawRefresh,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ---------- REFRESH ---------- */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: "Refresh token is required and must be a string" });
    }
    if (refreshToken.length === 0) {
      return res.status(400).json({ error: "Refresh token cannot be empty" });
    }

    const stored = await RefreshToken.findOne({ tokenHash: hashRefreshToken(refreshToken) });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const user = await User.findById(stored.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Rotate: revoke old, issue new refresh token
    stored.revoked = true;
    await stored.save();

    const newRawRefresh = crypto.randomBytes(64).toString("hex");
    const newRefreshTokenHash = hashRefreshToken(newRawRefresh);
    await RefreshToken.create({
      tokenHash: newRefreshTokenHash,
      userId: user._id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY)
    });

    const accessToken = generateAccessToken(user);

    res.json({
      token: accessToken,
      refreshToken: newRawRefresh,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    console.error("Refresh error:", err.message);
    res.status(500).json({ error: "Refresh failed" });
  }
});

/* ---------- LOGOUT ---------- */
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      if (typeof refreshToken !== 'string') {
        return res.status(400).json({ error: "Refresh token must be a string" });
      }
      await RefreshToken.updateOne({ tokenHash: hashRefreshToken(refreshToken) }, { revoked: true });
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.message);
    res.status(500).json({ error: "Logout failed" });
  }
});

router.patch("/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    // Input validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: "Role is required and must be a string" });
    }
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'user' or 'admin'" });
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: "_id username role" }
    );
    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Role update failed" });
  }
});

module.exports = router;