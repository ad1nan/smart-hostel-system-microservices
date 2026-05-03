require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters long.");
  process.exit(1);
}

app.use("/alerts", require("./routes/alertRoutes"));

app.get("/", (req, res) => res.send("Alerts Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "alerts" }));

const PORT = process.env.PORT || 5003;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Alerts Service DB Connected");
  } catch (err) {
    console.error(`Alerts DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    await delay(3000);
    return connectMongo(attempt + 1);
  }
};

connectMongo()
  .then(() => app.listen(PORT, () => console.log(`Alerts Service running on ${PORT}`)))
  .catch((err) => {
    console.error("Alerts Service failed to start:", err);
    process.exit(1);
  });