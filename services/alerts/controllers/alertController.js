const Alert = require("../models/Alert");

exports.getActiveAlerts = async (req, res) => {
  try {
    const alerts = await Alert.collection
  .find({
    $or: [
      { resolved: false },
      { resolved: { $exists: false } }
    ]
  })
  .sort({ createdAt: -1 })
  .toArray();
    console.log("Alerts fetched:", alerts.length);

    res.json(alerts);
  } catch (err) {
    console.error("🔥 REAL ERROR:", err); // ← THIS LINE IMPORTANT
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