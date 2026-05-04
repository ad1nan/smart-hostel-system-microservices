const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

const db = mongoose.connection;

const toRatePerKwh = (raw) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
};

const getWindowStart = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

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

    res.json(
      data.map((d) => ({
        roomId: d._id.toString(),
        totalEnergy: Number((d.totalEnergy || 0).toFixed(2))
      }))
    );
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

    const devices = await db.collection("devices").find().toArray();
    const map = {};
    devices.forEach((d) => {
      map[d._id.toString()] = d.type;
    });

    res.json(
      data.map((d) => ({
        deviceType: map[d._id.toString()] || "Unknown",
        totalEnergy: Number((d.totalEnergy || 0).toFixed(2))
      }))
    );
  } catch (err) {
    console.error("Device analytics error:", err);
    res.status(500).json({ error: "Device analytics error" });
  }
};

/* ---------- TIMESERIES (LAST 24 HOURS) ---------- */
exports.getTimeseries = async (req, res) => {
  try {
    const windowStart = getWindowStart(24);
    const data = await db.collection("energy").aggregate([
      { $match: { timestamp: { $gte: windowStart } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%H:00", date: "$timestamp" }
          },
          totalEnergy: { $sum: "$usage" }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    res.json(
      data.map((d) => ({
        period: d._id,
        totalEnergy: Number((d.totalEnergy || 0).toFixed(2))
      }))
    );
  } catch (err) {
    console.error("Timeseries error:", err);
    res.status(500).json({ error: "Timeseries error" });
  }
};

/* ---------- NEXT-HOUR FORECAST PER ROOM ---------- */
exports.getForecast = async (req, res) => {
  try {
    const method = req.query.method === "linear" ? "linear" : "rolling";
    const roomEnergy = await db.collection("energy").aggregate([
      { $match: { timestamp: { $gte: getWindowStart(48) } } },
      {
        $group: {
          _id: {
            roomId: "$roomId",
            hour: { $dateToString: { format: "%Y-%m-%dT%H:00:00Z", date: "$timestamp" } }
          },
          totalEnergy: { $sum: "$usage" }
        }
      },
      {
        $group: {
          _id: "$_id.roomId",
          points: {
            $push: {
              hour: "$_id.hour",
              totalEnergy: "$totalEnergy"
            }
          }
        }
      }
    ]).toArray();

    const rooms = await db.collection("rooms").find().toArray();
    const roomNameMap = {};
    rooms.forEach((r) => {
      roomNameMap[r._id.toString()] = r.name;
    });

    const response = roomEnergy.map((entry) => {
      const sorted = [...entry.points].sort((a, b) => a.hour.localeCompare(b.hour));
      const values = sorted.map((p) => Number(p.totalEnergy || 0));
      let predicted = 0;

      if (values.length === 0) {
        predicted = 0;
      } else if (method === "rolling" || values.length < 4) {
        const window = values.slice(-6);
        predicted = window.reduce((s, v) => s + v, 0) / window.length;
      } else {
        // Simple linear regression over hourly points
        const n = values.length;
        const xs = values.map((_, i) => i + 1);
        const sumX = xs.reduce((s, v) => s + v, 0);
        const sumY = values.reduce((s, v) => s + v, 0);
        const sumXY = xs.reduce((s, x, i) => s + x * values[i], 0);
        const sumXX = xs.reduce((s, x) => s + x * x, 0);
        const denom = n * sumXX - sumX * sumX;
        if (denom === 0) {
          predicted = values[values.length - 1];
        } else {
          const slope = (n * sumXY - sumX * sumY) / denom;
          const intercept = (sumY - slope * sumX) / n;
          predicted = intercept + slope * (n + 1);
        }
      }

      return {
        roomId: entry._id.toString(),
        roomName: roomNameMap[entry._id.toString()] || "Unknown",
        method,
        forecastNextHourWh: Number(Math.max(0, predicted).toFixed(2)),
        observedPoints: values.length
      };
    });

    res.json(response);
  } catch (err) {
    console.error("Forecast error:", err);
    res.status(500).json({ error: "Forecast error" });
  }
};

/* ---------- COST ESTIMATOR ---------- */
exports.getRoomCosts = async (req, res) => {
  try {
    const ratePerKwh = toRatePerKwh(req.query.ratePerKwh);
    const windowHours = Number(req.query.windowHours || 24);
    const windowStart = getWindowStart(windowHours);

    const costs = await db.collection("energy").aggregate([
      { $match: { timestamp: { $gte: windowStart } } },
      {
        $group: {
          _id: "$roomId",
          totalWh: { $sum: "$usage" }
        }
      }
    ]).toArray();

    const rooms = await db.collection("rooms").find().toArray();
    const roomMap = {};
    rooms.forEach((r) => {
      roomMap[r._id.toString()] = r;
    });

    res.json(
      costs.map((row) => {
        const room = roomMap[row._id.toString()] || {};
        const totalWh = Number(row.totalWh || 0);
        const costINR = (totalWh / 1000) * ratePerKwh;
        return {
          roomId: row._id.toString(),
          roomName: room.name || "Unknown",
          floor: room.floor ?? null,
          totalWh: Number(totalWh.toFixed(2)),
          costINR: Number(costINR.toFixed(2)),
          ratePerKwh
        };
      })
    );
  } catch (err) {
    console.error("Room costs error:", err);
    res.status(500).json({ error: "Room costs error" });
  }
};

/* ---------- 24H PEAK DETECTION ---------- */
exports.getPeakHours = async (req, res) => {
  try {
    const data = await db.collection("energy").aggregate([
      { $match: { timestamp: { $gte: getWindowStart(7 * 24) } } },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          avgWh: { $avg: "$usage" },
          totalWh: { $sum: "$usage" },
          samples: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    const hourMap = new Map();
    data.forEach((d) => hourMap.set(d._id, d));

    const series = [];
    for (let h = 0; h < 24; h += 1) {
      const row = hourMap.get(h);
      series.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        avgWh: Number((row?.avgWh || 0).toFixed(2)),
        totalWh: Number((row?.totalWh || 0).toFixed(2)),
        samples: row?.samples || 0
      });
    }

    const sorted = [...series].map((s) => s.avgWh).sort((a, b) => a - b);
    const q = (p) => sorted[Math.floor((sorted.length - 1) * p)] || 0;
    const lowCut = q(0.3);
    const highCut = q(0.7);

    res.json(
      series.map((s) => ({
        ...s,
        band: s.avgWh >= highCut ? "high" : s.avgWh <= lowCut ? "idle" : "normal"
      }))
    );
  } catch (err) {
    console.error("Peak hours error:", err);
    res.status(500).json({ error: "Peak hours error" });
  }
};

/* ---------- DAILY/WEEKLY REPORTS ---------- */
exports.getReports = async (req, res) => {
  try {
    const granularity = req.params.granularity === "weekly" ? "weekly" : "daily";
    const limit = Math.min(Number(req.query.limit || 14), 60);
    const docs = await db.collection("energy_reports")
      .find({ granularity })
      .sort({ periodStart: -1 })
      .limit(limit)
      .toArray();

    res.json(docs);
  } catch (err) {
    console.error("Reports fetch error:", err);
    res.status(500).json({ error: "Reports fetch error" });
  }
};

exports.exportReports = async (req, res) => {
  try {
    const granularity = req.params.granularity === "weekly" ? "weekly" : "daily";
    const format = req.query.format === "pdf" ? "pdf" : "csv";
    const ratePerKwh = toRatePerKwh(req.query.ratePerKwh);
    const limit = Math.min(Number(req.query.limit || 14), 60);
    const docs = await db.collection("energy_reports")
      .find({ granularity })
      .sort({ periodStart: -1 })
      .limit(limit)
      .toArray();

    if (format === "csv") {
      const header = "periodStart,periodEnd,totalUsageWh,totalCostINR,roomsCount,ratePerKwh";
      const rows = docs.map((d) => [
        new Date(d.periodStart).toISOString(),
        new Date(d.periodEnd).toISOString(),
        Number(d.totalUsageWh || 0).toFixed(2),
        Number(((d.totalUsageWh || 0) / 1000 * ratePerKwh).toFixed(2)),
        d.roomSummaries?.length || 0,
        ratePerKwh
      ].join(","));
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${granularity}-energy-report.csv`);
      return res.send(csv);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${granularity}-energy-report.pdf`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text(`Smart Hostel ${granularity.toUpperCase()} Energy Report`);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);

    docs.forEach((d, idx) => {
      const totalWh = Number(d.totalUsageWh || 0);
      const cost = (totalWh / 1000) * ratePerKwh;
      doc.fontSize(12).text(
        `${idx + 1}. ${new Date(d.periodStart).toLocaleDateString()} - ${new Date(d.periodEnd).toLocaleDateString()}`
      );
      doc.fontSize(10).text(`Total Usage: ${totalWh.toFixed(2)} Wh`);
      doc.text(`Estimated Cost: Rs. ${cost.toFixed(2)} (rate Rs. ${ratePerKwh}/kWh)`);
      doc.text(`Rooms: ${d.roomSummaries?.length || 0}`);
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (err) {
    console.error("Reports export error:", err);
    res.status(500).json({ error: "Reports export error" });
  }
};