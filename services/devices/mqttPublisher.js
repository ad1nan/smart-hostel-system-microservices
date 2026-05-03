/**
 * mqttPublisher.js — standalone simulator
 * Run with: node mqttPublisher.js
 * Uses env vars so it works both locally and inside Docker/K8s.
 */
require("dotenv").config();

const mqtt     = require("mqtt");
const mongoose = require("mongoose");

const MQTT_URL  = process.env.MQTT_URL  || "mqtt://mqtt:1883";
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/hostelDB";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Publisher connected to MongoDB");

  const devices = await mongoose.connection
    .collection("devices")
    .find({})
    .toArray();

  if (devices.length === 0) {
    console.error("No devices found in DB — run the seed script first.");
    process.exit(1);
  }

  const client = mqtt.connect(MQTT_URL);

  client.on("connect", () => {
    console.log("MQTT Publisher connected to", MQTT_URL);

    setInterval(() => {
      const d = devices[Math.floor(Math.random() * devices.length)];

      const payload = {
        deviceId:  d._id.toString(),
        roomId:    d.roomId.toString(),
        power:     Math.floor(Math.random() * 100) + 10,
        status:    Math.random() > 0.3,   // 70% ON
        timestamp: Date.now()
      };

      // Must publish to energy/data — that is what the analytics
      // mqttSubscriber listens to.
      client.publish("energy/data", JSON.stringify(payload));
      console.log("Published:", payload);
    }, 3000);
  });

  client.on("error", (err) => {
    console.error("MQTT Publisher error:", err.message);
  });
}

run().catch((err) => {
  console.error("Publisher startup failed:", err.message);
  process.exit(1);
});