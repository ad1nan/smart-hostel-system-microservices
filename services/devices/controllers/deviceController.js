const Device = require("../models/Device");
const mongoose = require("mongoose");
const mqttClient = require("../mqttClient");

const activeIntervals = new Map(); // better memory management
const deviceLocks = new Map(); // prevent race conditions

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
    res.status(500).json({ error: "Error fetching devices", details: err.message });
  }
};

exports.resumePublishingForActiveDevices = async () => {
  try {
    const activeDevices = await Device.find({ status: true });
    activeDevices.forEach((device) => {
      const deviceId = device._id.toString();
      if (activeIntervals.has(deviceId)) return;
      
      const intervalId = setInterval(() => {
        const payload = {
          deviceId: deviceId,
          roomId: device.roomId?.toString() || "unknown",
          power: device.power || 0,
          timestamp: new Date()
        };
        
        try {
          mqttClient.publish("energy/data", JSON.stringify(payload));
        } catch (mqttErr) {
          console.error(`MQTT publish error for device ${deviceId}:`, mqttErr.message);
        }
      }, 3000);
      
      activeIntervals.set(deviceId, intervalId);
    });
  } catch (err) {
    console.error("Resume publishing error:", err.message);
  }
};

exports.toggleDevice = async (req, res) => {
  try {
    // Input validation
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid device ID" });
    }

    const deviceId = req.params.id;
    
    // Prevent race conditions
    if (deviceLocks.has(deviceId)) {
      return res.status(429).json({ error: "Device operation in progress" });
    }
    
    deviceLocks.set(deviceId, true);
    
    try {
      const device = await Device.findById(deviceId);
      const io = req.app.get("io");
      const Alert = require("../../alerts/models/Alert");

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      // Toggle device status
      device.status = !device.status;
      device.startTime = device.status ? new Date() : null;
      await device.save();

      const deviceIdStr = device._id.toString();

      // Start MQTT publishing if device turned on
      if (device.status) {
        if (!activeIntervals.has(deviceIdStr)) {
          const intervalId = setInterval(() => {
            const payload = {
              deviceId: deviceIdStr,
              roomId: device.roomId?.toString() || "unknown",
              power: device.power || 0,
              timestamp: new Date()
            };
            
            try {
              mqttClient.publish("energy/data", JSON.stringify(payload));
            } catch (mqttErr) {
              console.error(`MQTT publish error for device ${deviceIdStr}:`, mqttErr.message);
            }
          }, 3000);
          
          activeIntervals.set(deviceIdStr, intervalId);
        }
      }
      // Stop MQTT publishing and resolve alerts if device turned off
      else {
        if (activeIntervals.has(deviceIdStr)) {
          clearInterval(activeIntervals.get(deviceIdStr));
          activeIntervals.delete(deviceIdStr);
        }

        // Resolve all device alerts using proper model
        try {
          await Alert.updateMany(
            { deviceId: device._id, resolved: false },
            { resolved: true, resolvedAt: new Date() }
          );
        } catch (alertErr) {
          console.error("Alert resolution error:", alertErr.message);
        }
      }

      // Emit socket events
      if (io) {
        io.emit("device_update");
        io.emit("analytics_update");
      }

      res.json(device);
    } finally {
      deviceLocks.delete(deviceId);
    }
  } catch (err) {
    console.error("Toggle device error:", err);
    res.status(500).json({ error: "Toggle failed", details: err.message });
  }
};