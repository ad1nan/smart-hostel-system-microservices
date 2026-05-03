const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://localhost:1883");

const devices = [
  "fan_101",
  "light_101",
  "fan_102",
  "light_102",
  "fan_103",
  "light_103"
];

client.on("connect", () => {
  console.log("MQTT Publisher connected");

  setInterval(() => {
    const randomDevice = devices[Math.floor(Math.random() * devices.length)];

    const payload = {
      deviceId: randomDevice,
      power: Math.floor(Math.random() * 100),
      status: Math.random() > 0.3, // 70% ON
      timestamp: Date.now()
    };

    client.publish("hostel/devices", JSON.stringify(payload));

    console.log("Published:", payload);
  }, 3000);
});