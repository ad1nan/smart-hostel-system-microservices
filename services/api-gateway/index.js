global.crypto = require('crypto');
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const ROOMS_SERVICE = process.env.ROOMS_SERVICE_URL;
const DEVICES_SERVICE = process.env.DEVICES_SERVICE_URL;
const ALERTS_SERVICE = process.env.ALERTS_SERVICE_URL;
const ANALYTICS_SERVICE = process.env.ANALYTICS_SERVICE_URL;
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL;

/* ---------- AUTH (public — no authMiddleware) ---------- */
app.post("/auth/login", async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE}/auth/login`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error("Login error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Auth service error" });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE}/auth/register`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error("Register error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Auth service error" });
  }
});

/* ---------- ROOMS (USER + ADMIN) ---------- */
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

/* USER + ADMIN can view */
app.get("/devices", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${DEVICES_SERVICE}/devices`);
    res.json(response.data);
  } catch (err) {
    console.error("Devices error:", err.message);
    res.status(500).json({ error: "Devices service error" });
  }
});

/* 🔥 ADMIN ONLY can toggle */
app.post(
  "/devices/toggle/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const response = await axios.post(
        `${DEVICES_SERVICE}/devices/toggle/${req.params.id}`
      );
      res.json(response.data);
    } catch (err) {
      console.error("Toggle error:", err.response?.data || err.message);
      res.status(500).json({ error: "Toggle failed" });
    }
  }
);

/* ---------- ALERTS ---------- */

/* USER + ADMIN can view */
app.get("/alerts", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`${ALERTS_SERVICE}/alerts`);
    res.json(response.data);
  } catch (err) {
    console.error("Alerts error:", err.message);
    res.status(500).json({ error: "Alerts service error" });
  }
});

/* 🔥 ADMIN ONLY can resolve */
app.patch(
  "/alerts/:id/resolve",
  authMiddleware,
  roleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const response = await axios.patch(
        `${ALERTS_SERVICE}/alerts/${req.params.id}/resolve`
      );
      res.json(response.data);
    } catch (err) {
      console.error("Resolve error:", err.message);
      res.status(500).json({ error: "Alert resolve error" });
    }
  }
);

/* ---------- ANALYTICS (USER + ADMIN) ---------- */

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

app.get("/", (req, res) => {
  res.send("API Gateway running");
});

/* ---------- START ---------- */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});