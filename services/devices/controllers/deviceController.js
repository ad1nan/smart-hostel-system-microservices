const Device = require("../models/Device");
const mongoose = require("mongoose");
const mqttClient = require("../mqttClient");

const activeIntervals = {}; // in-memory tracking

exports.getDevices = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;
    const [devices, total] = await Promise.all([
      Device.find().populate('roomId').skip(skip).limit(limit),
      Device.countDocuments()
    ]);
    res.json({ data: devices, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Device fetch error:", err.message);
    res.status(500).json({ error: "Error fetching devices" });
  }
};

exports.resumePublishingForActiveDevices = async () => {
  const activeDevices = await Device.find({ status: true });
  activeDevices.forEach((device) => {
    if (activeIntervals[device._id]) return;
    activeIntervals[device._id] = setInterval(() => {
      const payload = {
        deviceId: device._id.toString(),
        roomId: device.roomId.toString(),
        power: device.power,
        timestamp: new Date()
      };
      mqttClient.publish("energy/data", JSON.stringify(payload));
    }, 3000);
  });
};

exports.toggleDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    const io = req.app.get("io");
    const db = mongoose.connection;

    if (!device) {
      return res.status(404).json({ msg: "Device not found" });
    }

    // 🔁 TOGGLE
    device.status = !device.status;

    // ✅ FIX: TRACK START TIME
    if (device.status) {
      device.startTime = new Date();
    } else {
      device.startTime = null;
    }

    await device.save();

    // 🟢 IF TURNED ON → START MQTT
    if (device.status) {
      if (!activeIntervals[device._id]) {
        activeIntervals[device._id] = setInterval(() => {
          const payload = {
            deviceId: device._id.toString(), // ensure string
            roomId: device.roomId.toString(),
            power: device.power,
            timestamp: new Date()
          };

          mqttClient.publish("energy/data", JSON.stringify(payload));
        }, 3000);
      }
    }

    // 🔴 IF TURNED OFF → STOP MQTT + RESOLVE ALERTS
    else {
      if (activeIntervals[device._id]) {
        clearInterval(activeIntervals[device._id]);
        delete activeIntervals[device._id];
      }

      // ✅ resolve ALL device alerts
      await db.collection("alerts").updateMany(
        {
          deviceId: device._id,
          resolved: false
        },
        {
          $set: { resolved: true }
        }
      );
    }

    if (io) {
      io.emit("device_update");
      io.emit("analytics_update");
    }

    res.json(device);
  } catch (err) {
    console.error("Toggle device error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
};