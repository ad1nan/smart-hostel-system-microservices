const mongoose = require("mongoose");

const db = mongoose.connection;

const RATE_PER_KWH = Number(process.env.ELECTRICITY_RATE_PER_KWH || 8);

const startOfDayUtc = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const startOfWeekUtc = (date) => {
  const d = startOfDayUtc(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
};

const aggregatePeriod = async (granularity, start, end) => {
  const byRoom = await db.collection("energy").aggregate([
    { $match: { timestamp: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$roomId",
        totalUsageWh: { $sum: "$usage" }
      }
    }
  ]).toArray();

  const rooms = await db.collection("rooms").find().toArray();
  const roomMap = {};
  rooms.forEach((r) => {
    roomMap[r._id.toString()] = r;
  });

  const roomSummaries = byRoom.map((r) => {
    const room = roomMap[r._id.toString()] || {};
    const totalUsageWh = Number(r.totalUsageWh || 0);
    return {
      roomId: r._id,
      roomName: room.name || "Unknown",
      floor: room.floor ?? null,
      totalUsageWh: Number(totalUsageWh.toFixed(2)),
      estimatedCostINR: Number(((totalUsageWh / 1000) * RATE_PER_KWH).toFixed(2))
    };
  });

  const totalUsageWh = roomSummaries.reduce((sum, r) => sum + r.totalUsageWh, 0);

  await db.collection("energy_reports").updateOne(
    { granularity, periodStart: start, periodEnd: end },
    {
      $set: {
        granularity,
        periodStart: start,
        periodEnd: end,
        totalUsageWh: Number(totalUsageWh.toFixed(2)),
        totalCostINR: Number(((totalUsageWh / 1000) * RATE_PER_KWH).toFixed(2)),
        roomSummaries,
        generatedAt: new Date()
      }
    },
    { upsert: true }
  );
};

const aggregateReports = async () => {
  const now = new Date();
  const dayStart = startOfDayUtc(now);
  const weekStart = startOfWeekUtc(now);
  await aggregatePeriod("daily", dayStart, now);
  await aggregatePeriod("weekly", weekStart, now);
};

const startReportScheduler = () => {
  aggregateReports().catch((err) => {
    console.error("Initial report aggregation failed:", err.message);
  });

  setInterval(() => {
    aggregateReports().catch((err) => {
      console.error("Scheduled report aggregation failed:", err.message);
    });
  }, 60 * 60 * 1000);
};

module.exports = { startReportScheduler };
