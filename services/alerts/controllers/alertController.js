const Alert = require("../models/Alert");
const mongoose = require("mongoose");

exports.getActiveAlerts = async (req, res) => {
  try {
    // Input validation
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;
    
    if (page > 1000) {
      return res.status(400).json({ error: "Page number cannot exceed 1000" });
    }
    const filter = {
      $or: [
        { resolved: false },
        { resolved: { $exists: false } }
      ]
    };
    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Alert.countDocuments(filter)
    ]);
    res.json({ data: alerts, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Alert fetch error:", err);
    res.status(500).json({ error: "Failed to fetch alerts", details: err.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    // Input validation
    const alertId = req.params.id;
    if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }
    
    // Get alert first
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    // Check if alert is already resolved
    if (alert.resolved) {
      return res.status(400).json({ error: "Alert is already resolved" });
    }

    // Resolve alert
    const resolvedAlert = await Alert.findByIdAndUpdate(
      alertId,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.emit("alert_resolved", {
        alertId: alertId,
        deviceId: alert.deviceId,
        resolved: true,
        timestamp: new Date()
      });
      io.emit("device_update"); // Refresh device states in frontend
    }

    res.json(resolvedAlert);
  } catch (err) {
    console.error("Alert resolve error:", err);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
};

exports.clearAlerts = async (req, res) => {
  try {
    const result = await Alert.updateMany(
      { resolved: false }, 
      { resolved: true, resolvedAt: new Date() }
    );
    
    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.emit("alerts_cleared", {
        clearedCount: result.modifiedCount,
        timestamp: new Date()
      });
      io.emit("device_update"); // Refresh device states in frontend
    }
    
    res.status(200).json({ 
      message: "All alerts cleared", 
      clearedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error("Alert clear error:", err);
    res.status(500).json({ error: "Failed to clear alerts", details: err.message });
  }
};