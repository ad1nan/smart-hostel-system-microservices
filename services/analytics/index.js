require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:4000,http://localhost:3000").split(",");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters long.");
  process.exit(1);
}
const { startReportScheduler } = require("./reportScheduler");

app.use("/analytics", require("./routes/analyticsRoutes"));

app.get("/", (req, res) => res.send("Analytics Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "analytics" }));

const PORT = process.env.PORT || 5004;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log("Analytics Service DB Connected");
  } catch (err) {
    console.error(`Analytics DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    const waitTime = Math.min(30000, 1000 * Math.pow(2, attempt)); // Exponential backoff with 30s max
    console.log(`Retrying in ${waitTime}ms...`);
    await delay(waitTime);
    return connectMongo(attempt + 1);
  }
};

connectMongo()
  .then(() => {
    require("./mqttSubscriber");
    startReportScheduler();
    app.listen(PORT, () => console.log(`Analytics Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error("Analytics Service failed to start:", err);
    process.exit(1);
  });