require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/rooms", require("./routes/roomRoutes"));

app.get("/", (req, res) => res.send("Rooms Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "rooms" }));

const PORT = process.env.PORT || 5001;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Rooms Service DB Connected");
  } catch (err) {
    console.error(`Rooms DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    await delay(3000);
    return connectMongo(attempt + 1);
  }
};

connectMongo()
  .then(() => app.listen(PORT, () => console.log(`Rooms Service running on ${PORT}`)))
  .catch((err) => {
    console.error("Rooms Service failed to start:", err);
    process.exit(1);
  });