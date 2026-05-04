require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters long.");
  process.exit(1);
}

app.use("/auth", require("./routes/authRoutes"));

app.get("/", (req, res) => res.send("Auth Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "auth" }));

const PORT = process.env.PORT || 5005;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    const waitTime = Math.min(30000, 1000 * Math.pow(2, attempt)); // Exponential backoff with 30s max
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log("Auth Service DB Connected");
  } catch (err) {
    console.error(`Auth DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    console.log(`Retrying in ${waitTime}ms...`);
    await delay(waitTime);
    return connectMongo(attempt + 1);
  }
};

connectMongo()
  .then(() => app.listen(PORT, () => console.log(`Auth Service running on ${PORT}`)))
  .catch((err) => {
    console.error("Auth Service failed to start:", err);
    process.exit(1);
  });