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
    
    const alert = await Alert.findByIdAndUpdate(
      alertId,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(alert);
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
    res.status(200).json({ 
      message: "All alerts cleared", 
      clearedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error("Alert clear error:", err);
    res.status(500).json({ error: "Failed to clear alerts", details: err.message });
  }
};