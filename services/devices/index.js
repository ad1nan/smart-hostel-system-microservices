require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Device model must be imported so Mongoose registers it before routes use it
require("./models/Device");

// Room model must be imported for device population to work
// Define Room model directly to ensure proper registration
const Room = mongoose.model("Room", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  floor: { type: Number, default: 1 },
  roomType: {
    type: String,
    enum: ["2ppl", "4ppl", "single", "suite"],
    default: "2ppl"
  },
  capacity: { type: Number, default: 2, min: 1 },
  occupancy: { type: Number, default: 0, min: 0 }
}));

app.use("/devices", require("./routes/deviceRoutes"));

app.get("/", (req, res) => res.send("Devices Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "devices" }));

const PORT = process.env.PORT || 5002;
const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters long.");
  process.exit(1);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const connectMongo = async (attempt = 1) => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Devices Service DB Connected");
  } catch (err) {
    console.error(`Devices DB connect failed (attempt ${attempt}):`, err.message);
    if (attempt >= 10) throw err;
    await delay(3000);
    return connectMongo(attempt + 1);
  }
};

connectMongo()
  .then(async () => {
    const controller = require("./controllers/deviceController");
    await controller.resumePublishingForActiveDevices();
    app.listen(PORT, () => console.log(`Devices Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error("Devices Service failed to start:", err);
    process.exit(1);
  });

// NOTE: MQTT publishing is handled by deviceController.js via mqttClient.js
// when a device is toggled ON. There is no subscriber here — the analytics
// service handles the energy/data topic independently.