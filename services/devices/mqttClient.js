const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://mqtt:1883"); // docker service name

client.on("connect", () => {
  console.log("📡 Devices connected to MQTT broker");
});

client.on("error", (err) => {
  console.error("MQTT error:", err.message);
});

module.exports = client;