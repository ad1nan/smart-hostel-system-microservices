global.crypto = require('crypto');

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", require("./routes/authRoutes"));

app.get("/", (req, res) => res.send("Auth Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "auth" }));

const PORT = process.env.PORT || 5005;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Auth Service DB Connected");
  } catch (err) {
    console.error(`Auth DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    await delay(3000);
    return connectMongo(attempt + 1);
  }
};

connectMongo()
  .then(() => app.listen(PORT, () => console.log(`Auth Service running on ${PORT}`)))
  .catch((err) => {
    console.error("Auth Service failed to start:", err);
    process.exit(1);
  });
