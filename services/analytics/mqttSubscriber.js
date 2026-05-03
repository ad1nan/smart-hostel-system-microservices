const mqtt = require("mqtt");
const Energy = require("./models/Energy");

const client = mqtt.connect("mqtt://mqtt:1883");

client.on("connect", () => {
  console.log("📡 Analytics connected to MQTT");
  client.subscribe("energy/data");
});

client.on("message", async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    // 🔥 Convert power → energy
    // interval = 3 sec → Wh calculation
    const usage = (data.power * 3) / 3600;

    await Energy.create({
      deviceId: data.deviceId,
      roomId: data.roomId,
      usage,
      timestamp: new Date(data.timestamp)
    });

  } catch (err) {
    console.error("MQTT processing error:", err.message);
  }
});

module.exports = client;