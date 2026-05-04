const mqtt = require("mqtt");
const mongoose = require("mongoose");
const mqttUrl = process.env.MQTT_URL || "mqtt://mqtt:1883";
if (process.env.NODE_ENV === "production" && !mqttUrl.startsWith("mqtts://")) {
  throw new Error("In production, MQTT_URL must use mqtts://");
}

const client = mqtt.connect(mqttUrl, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  reconnectPeriod: 3000,
  connectTimeout: 10000
});

const ENERGY_THRESHOLD = 500; // room energy threshold (Wh)
const DEVICE_TIME_LIMIT = 60 * 1000; // 1 min
const HIGH_POWER_THRESHOLD = 100; // optional device power alert

client.on("connect", () => {
  console.log("📡 Analytics connected to MQTT");
  client.subscribe("energy/data");
});

client.on("message", async (topic, message) => {
  try {
    const db = mongoose.connection;
    const data = JSON.parse(message.toString());

    // ✅ Ensure ObjectIds
    const deviceId =
      typeof data.deviceId === "string"
        ? new mongoose.Types.ObjectId(data.deviceId)
        : data.deviceId;

    const roomId =
      typeof data.roomId === "string"
        ? new mongoose.Types.ObjectId(data.roomId)
        : data.roomId;

    // ⚡ convert power (W) over 3s → Wh
    const usage = (data.power * 3) / 3600;

    /* =========================
       1. STORE ENERGY
    ========================= */
    await db.collection("energy").insertOne({
      deviceId,
      roomId,
      usage,
      timestamp: new Date(data.timestamp)
    });

    /* =========================
       2. FETCH CONTEXT
    ========================= */
    const [device, room] = await Promise.all([
      db.collection("devices").findOne({ _id: deviceId }),
      db.collection("rooms").findOne({ _id: roomId })
    ]);

    const deviceName = device?.type || "Device";
    const roomName = room?.name || "Room";


    /* =========================
       3. ROOM ENERGY ALERT (TIME WINDOW FIX)
    ========================= */

    const roomAgg = await db.collection("energy").aggregate([
      {
        $match: {
          roomId,
          timestamp: {
            $gte: new Date(Date.now() - 5 * 60 * 1000) // last 5 min
          }
        }
      },
      {
        $group: {
          _id: "$roomId",
          total: { $sum: "$usage" }
        }
      }
    ]).toArray();

    const total = roomAgg[0]?.total || 0;

    const existingRoomAlert = await db.collection("alerts").findOne({
      roomId,
      type: "ROOM_HIGH",
      resolved: false
    });

    // 🔴 CREATE ROOM ALERT
    // K8s safety: upsert with filter to prevent duplicate alerts from multiple replicas
    if (total > ENERGY_THRESHOLD && !existingRoomAlert) {
      await db.collection("alerts").updateOne(
        { type: "ROOM_HIGH", roomId, resolved: false },
        { $setOnInsert: { type: "ROOM_HIGH", message: `${roomName} high energy usage (${total.toFixed(2)} Wh)`, roomId, level: "high", resolved: false, createdAt: new Date() } },
        { upsert: true }
      );
    }

    // 🟢 AUTO RESOLVE ROOM ALERT
    if (total <= ENERGY_THRESHOLD && existingRoomAlert) {
      await db.collection("alerts").updateOne(
        { _id: existingRoomAlert._id },
        { $set: { resolved: true } }
      );
    }

    /* =========================
       4. DEVICE LONG-RUN ALERT (FIXED OFF LOGIC)
    ========================= */

    const existingDeviceAlert = await db.collection("alerts").findOne({
      deviceId,
      type: "DEVICE_LONG",
      resolved: false
    });

    // 🔴 DEVICE OFF → FORCE RESOLVE
    if (!device?.status && existingDeviceAlert) {
      await db.collection("alerts").updateOne(
        { _id: existingDeviceAlert._id },
        { $set: { resolved: true } }
      );
    }

    // 🟢 DEVICE ON → CHECK DURATION
    if (device?.status && device?.startTime) {
      const duration =
        Date.now() - new Date(device.startTime).getTime();

      if (duration > DEVICE_TIME_LIMIT && !existingDeviceAlert) {
        // K8s safety: upsert with filter to prevent duplicate alerts from multiple replicas
        await db.collection("alerts").updateOne(
          { type: "DEVICE_LONG", deviceId, resolved: false },
          { $setOnInsert: { type: "DEVICE_LONG", message: `${deviceName} in ${roomName} running too long`, deviceId, roomId, level: "high", resolved: false, createdAt: new Date() } },
          { upsert: true }
        );
      }
    }

    /* =========================
       5. DEVICE HIGH POWER ALERT
    ========================= */

    if (data.power > HIGH_POWER_THRESHOLD) {
      const existingPowerAlert = await db.collection("alerts").findOne({
        deviceId,
        type: "DEVICE_POWER",
        resolved: false
      });

      if (!existingPowerAlert) {
        // K8s safety: upsert with filter to prevent duplicate alerts from multiple replicas
        await db.collection("alerts").updateOne(
          { type: "DEVICE_POWER", deviceId, resolved: false },
          { $setOnInsert: { type: "DEVICE_POWER", message: `${deviceName} in ${roomName} consuming high power`, deviceId, roomId, level: "high", resolved: false, createdAt: new Date() } },
          { upsert: true }
        );
      }
    }

  } catch (err) {
    console.error("MQTT processing error:", err.message);
  }
});

module.exports = client;