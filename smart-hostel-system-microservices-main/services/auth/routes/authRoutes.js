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

/* ---------- REGISTER ---------- */
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const hashed = await bcrypt.hash(password, 12); // bumped from 10 to 12
    const user = new User({
      username,
      password: hashed,
      role: role === "admin" ? "admin" : "user"
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

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
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
    await RefreshToken.create({
      token: rawRefresh,
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
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const stored = await RefreshToken.findOne({ token: refreshToken });

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
    await RefreshToken.create({
      token: newRawRefresh,
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
      await RefreshToken.updateOne({ token: refreshToken }, { revoked: true });
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.message);
    res.status(500).json({ error: "Logout failed" });
  }
});

module.exports = router;