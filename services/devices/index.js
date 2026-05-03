global.crypto = require('crypto');

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const Device = require("./models/Device");

app.use("/devices", require("./routes/deviceRoutes"));

app.get("/", (req, res) => res.send("Devices Service running"));
app.get("/health", (req, res) => res.json({ status: "ok", service: "devices" }));

const PORT = process.env.PORT || 5002;

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
  .then(() => {
    app.listen(PORT, () => console.log(`Devices Service running on ${PORT}`));
    startMqtt();
  })
  .catch((err) => {
    console.error("Devices Service failed to start:", err);
    process.exit(1);
  });

// ================= MQTT =================

function startMqtt() {
  const mqtt = require("mqtt");
  const mqttClient = mqtt.connect("mqtt://mqtt:1883");

  mqttClient.on("connect", () => {
    console.log("Devices service connected to MQTT");
    mqttClient.subscribe("hostel/devices");
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log("Received MQTT:", data);

      const device = await Device.findOne({ deviceId: data.deviceId });

      if (!device) {
        console.log("Device not found in DB for:", data.deviceId);
        return;
      }

      device.power = data.power;
      device.status = data.status;
      await device.save();

      console.log(`Device ${data.deviceId} updated`);
    } catch (err) {
      console.error("MQTT error:", err.message);
    }
  });
}
