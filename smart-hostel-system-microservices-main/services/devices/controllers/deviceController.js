const Device = require("../models/Device");
const mongoose = require("mongoose");
const mqttClient = require("../mqttClient");

const activeIntervals = {}; // in-memory tracking

exports.getDevices = async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    console.error("Device fetch error:", err.message);
    res.status(500).json({ error: "Error fetching devices" });
  }
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