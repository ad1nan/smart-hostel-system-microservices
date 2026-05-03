require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
const { startReportScheduler } = require("./reportScheduler");

app.use("/analytics", require("./routes/analyticsRoutes"));

app.get("/", (req, res) => res.send("Analytics Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "analytics" }));

const PORT = process.env.PORT || 5004;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Analytics Service DB Connected");
  } catch (err) {
    console.error(`Analytics DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    await delay(3000);
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