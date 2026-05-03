require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");

const app = express();

// --- HELMET: sets 14 security headers in one line ---
app.use(helmet());

// --- CORS: only allow the React frontend, not * ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (curl, Postman, health checks)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());

// --- RATE LIMITERS ---

// General limiter (configurable):
// Defaults are higher for local microservice polling workloads.
const GENERAL_RATE_WINDOW_MS = Number(process.env.GENERAL_RATE_WINDOW_MS || 15 * 60 * 1000);
const GENERAL_RATE_MAX = Number(process.env.GENERAL_RATE_MAX || 2000);
const generalLimiter = rateLimit({
  windowMs: GENERAL_RATE_WINDOW_MS,
  max: GENERAL_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // In local docker setups, all browser traffic appears from one IP.
  // Skipping localhost avoids accidental lockouts during normal dashboard polling.
  skip: (req) => req.ip === "::1" || req.ip === "127.0.0.1" || req.ip === "::ffff:127.0.0.1",
  message: { error: "Too many requests, please try again later." }
});

// Strict limiter for auth: 10 attempts / 15 min per IP (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again in 15 minutes." }
});

app.use(generalLimiter);

const ROOMS_SERVICE     = process.env.ROOMS_SERVICE_URL;
const DEVICES_SERVICE   = process.env.DEVICES_SERVICE_URL;
const ALERTS_SERVICE    = process.env.ALERTS_SERVICE_URL;
const ANALYTICS_SERVICE = process.env.ANALYTICS_SERVICE_URL;
const AUTH_SERVICE      = process.env.AUTH_SERVICE_URL;

/* ---------- AUTH (public, strict rate limit) ---------- */
app.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE}/auth/login`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error("Login error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Auth service error" });
  }
});

app.post("/auth/register", authLimiter, async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE}/auth/register`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error("Register error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Auth service error" });
  }
});

// Refresh token route — passes through to auth service
app.post("/auth/refresh", authLimiter, async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE}/auth/refresh`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Refresh failed" });
  }
});

// Logout — invalidates refresh token
app.post("/auth/logout", authMiddleware, async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE}/auth/logout`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Logout failed" });
  }
});

/* ---------- ROOMS ---------- */
app.get("/rooms", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ROOMS_SERVICE}/rooms`);
    res.json(response.data);
  } catch (err) {
    console.error("Rooms error:", err.message);
    res.status(500).json({ error: "Rooms service error" });
  }
});

/* ---------- DEVICES ---------- */
app.get("/devices", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${DEVICES_SERVICE}/devices`);
    res.json(response.data);
  } catch (err) {
    console.error("Devices error:", err.message);
    res.status(500).json({ error: "Devices service error" });
  }
});

app.post("/devices/toggle/:id", authMiddleware, roleMiddleware(["admin"]), async (req, res) => {
  try {
    const response = await axios.post(`${DEVICES_SERVICE}/devices/toggle/${req.params.id}`);
    res.json(response.data);
  } catch (err) {
    console.error("Toggle error:", err.response?.data || err.message);
    res.status(500).json({ error: "Toggle failed" });
  }
});

/* ---------- ALERTS ---------- */
app.get("/alerts", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ALERTS_SERVICE}/alerts`);
    res.json(response.data);
  } catch (err) {
    console.error("Alerts error:", err.message);
    res.status(500).json({ error: "Alerts service error" });
  }
});

app.patch("/alerts/:id/resolve", authMiddleware, roleMiddleware(["admin"]), async (req, res) => {
  try {
    const response = await axios.patch(`${ALERTS_SERVICE}/alerts/${req.params.id}/resolve`);
    res.json(response.data);
  } catch (err) {
    console.error("Resolve error:", err.message);
    res.status(500).json({ error: "Alert resolve error" });
  }
});

/* ---------- ANALYTICS ---------- */
app.get("/analytics/heatmap", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ANALYTICS_SERVICE}/analytics/heatmap`);
    res.json(response.data);
  } catch (err) {
    console.error("Heatmap error:", err.message);
    res.status(500).json({ error: "Analytics heatmap error" });
  }
});

app.get("/analytics/devices", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ANALYTICS_SERVICE}/analytics/devices`);
    res.json(response.data);
  } catch (err) {
    console.error("Devices analytics error:", err.message);
    res.status(500).json({ error: "Analytics devices error" });
  }
});

app.get("/analytics/timeseries", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ANALYTICS_SERVICE}/analytics/timeseries`);
    res.json(response.data);
  } catch (err) {
    console.error("Timeseries error:", err.message);
    res.status(500).json({ error: "Analytics timeseries error" });
  }
});

/* ---------- HEALTH ---------- */
app.get("/health", (req, res) => res.json({ status: "ok", service: "api-gateway" }));
app.get("/", (req, res) => res.send("API Gateway running"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));