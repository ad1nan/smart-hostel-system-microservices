const Alert = require("../models/Alert");

exports.getActiveAlerts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;
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
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true },
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
    await Alert.updateMany({ resolved: false }, { resolved: true });
    res.json({ msg: "All alerts cleared" });
  } catch (err) {
    console.error("Alert clear error:", err);
    res.status(500).json({ error: "Failed to clear alerts" });
  }
};