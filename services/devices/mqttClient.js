const mqtt = require("mqtt");

const MQTT_URL = process.env.MQTT_URL || "mqtt://mqtt:1883";

const client = mqtt.connect(process.env.MQTT_URL || "mqtt://mqtt:1883", {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  reconnectPeriod: 3000,
  connectTimeout: 10000
});

client.on("connect", () => {
  console.log("Devices service connected to MQTT broker at", MQTT_URL);
});

client.on("error", (err) => {
  console.error("MQTT client error:", err.message);
});

module.exports = client;