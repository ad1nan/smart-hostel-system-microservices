const mongoose = require("mongoose");
const db = mongoose.connection;

/* ---------- HEATMAP ---------- */
exports.getHeatmap = async (req, res) => {
  try {
    const data = await db.collection("energy").aggregate([
      {
        $group: {
          _id: "$roomId",
          totalEnergy: { $sum: "$usage" }
        }
      }
    ]).toArray();

    const result = data.map((d) => ({
      roomId: d._id,
      totalEnergy: d.totalEnergy
    }));

    res.json(result);
  } catch (err) {
    console.error("Heatmap error:", err);
    res.status(500).json({ error: "Heatmap error" });
  }
};


/* ---------- DEVICE ANALYTICS ---------- */
exports.getDeviceAnalytics = async (req, res) => {
  try {
    const data = await db.collection("energy").aggregate([
      {
        $group: {
          _id: "$deviceId",
          totalEnergy: { $sum: "$usage" }
        }
      }
    ]).toArray();

    // attach device type
    const devices = await db.collection("devices").find().toArray();

    const map = {};
    devices.forEach((d) => {
      map[d._id.toString()] = d.type;
    });

    const result = data.map((d) => ({
      deviceType: map[d._id.toString()] || "Unknown",
      totalEnergy: d.totalEnergy
    }));

    res.json(result);
  } catch (err) {
    console.error("Device analytics error:", err);
    res.status(500).json({ error: "Device analytics error" });
  }
};


/* ---------- TIMESERIES ---------- */
exports.getTimeseries = async (req, res) => {
  try {
    const data = await db.collection("energy").aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%H:%M", date: "$timestamp" }
          },
          totalEnergy: { $sum: "$usage" }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    const result = data.map((d) => ({
      period: d._id,
      totalEnergy: d.totalEnergy
    }));

    res.json(result);
  } catch (err) {
    console.error("Timeseries error:", err);
    res.status(500).json({ error: "Timeseries error" });
  }
};