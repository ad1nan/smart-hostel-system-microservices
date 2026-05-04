/**
 * Seed script — creates realistic rooms, devices, and energy history.
 * Run locally:  MONGO_URI=mongodb://localhost:27018/hostelDB node seed.js
 * Run in K8s:   kubectl run seed --image=<your-seed-image> --restart=Never
 */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/hostelDB";

async function seed() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;

  console.log("Seeding database at", MONGO_URI);

  await db.collection("rooms").deleteMany({});
  await db.collection("devices").deleteMany({});
  await db.collection("energy").deleteMany({});

  await db.collection("energy_reports").deleteMany({});

  const floors = [1, 2]; // Only floors 1 and 2
  const rooms = [];
  const roomTypes = ["2ppl", "4ppl"];

  floors.forEach((floor) => {
    // Create only 5 rooms per floor
    for (let i = 1; i <= 5; i += 1) {
      const roomNum = floor * 100 + i;
      const roomType = i % 3 === 0 ? roomTypes[1] : roomTypes[0];
      const capacity = roomType === "4ppl" ? 4 : 2;
      const occupancy = Math.max(0, Math.min(capacity, capacity - (i % 2 === 0 ? 0 : 1)));
      rooms.push({
        name: `Room ${roomNum}`,
        floor,
        roomType,
        capacity,
        occupancy
      });
    }
  });

  const insertedRooms = await db.collection("rooms").insertMany(rooms);
  const roomIds = Object.values(insertedRooms.insertedIds);

  let deviceCounter = 1;
  const allDevices = [];

  roomIds.forEach((roomId, index) => {
    const roomDeviceBlueprint = [
      { type: "Light", power: 24, label: "Ceiling Light", x: 0.5, y: 0.2 },
      { type: "Fan", power: 75, label: "Ceiling Fan", x: 0.5, y: 0.5 },
      { type: "AC", power: 1300, label: "AC Unit", x: 0.85, y: 0.15 },
      { type: "Heater", power: 1000, label: "Wall Heater", x: 0.15, y: 0.82 },
      { type: "Desk Plug", power: 120, label: "Study Plug", x: 0.7, y: 0.78 }
    ];

    roomDeviceBlueprint.forEach((bp, bpIdx) => {
      // Enable all devices except heaters (which are seasonal), with some variety
      const enabled = bp.type !== "Heater" ? Math.random() > 0.3 : Math.random() > 0.8;
      allDevices.push({
        deviceId: `D${String(deviceCounter).padStart(3, "0")}`,
        type: bp.type,
        roomId,
        status: enabled,
        power: bp.power,
        startTime: enabled ? new Date(Date.now() - (index + bpIdx) * 120000) : null,
        location: {
          label: bp.label,
          x: bp.x,
          y: bp.y
        }
      });
      deviceCounter += 1;
    });
  });

  const insertedDevices = await db.collection("devices").insertMany(allDevices);
  const insertedDeviceDocs = await db.collection("devices").find().toArray();
  const deviceById = {};
  insertedDeviceDocs.forEach((d) => {
    deviceById[d._id.toString()] = d;
  });

  // Create 14 days of realistic 15-min interval energy history
  const now = new Date();
  const historyStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const stepMs = 15 * 60 * 1000;
  const energyDocs = [];

  const randomMultiplier = () => 0.85 + Math.random() * 0.35;
  const occupancyFactor = (room) => (room.occupancy || 0) / Math.max(room.capacity || 1, 1);
  const roomById = {};
  const insertedRoomDocs = await db.collection("rooms").find().toArray();
  insertedRoomDocs.forEach((r) => {
    roomById[r._id.toString()] = r;
  });

  for (let ts = historyStart.getTime(); ts <= now.getTime(); ts += stepMs) {
    const dt = new Date(ts);
    const hour = dt.getHours();
    const day = dt.getDay(); // 0 Sun
    const isWeekend = day === 0 || day === 6;

    Object.values(insertedDevices.insertedIds).forEach((devId) => {
      const device = deviceById[devId.toString()];
      const room = roomById[device.roomId.toString()];

      // Time-based usage profile to support forecasting and peak detection
      let activeProbability = 0.12;
      if (hour >= 6 && hour <= 9) activeProbability = 0.42;   // morning peak
      if (hour >= 18 && hour <= 23) activeProbability = 0.64; // evening peak
      if (hour >= 11 && hour <= 16) activeProbability = 0.25; // afternoon moderate
      if (isWeekend) activeProbability += 0.08;

      if (device.type === "Light" && (hour < 6 || hour >= 19)) activeProbability += 0.2;
      if (device.type === "AC" && hour >= 12 && hour <= 18) activeProbability += 0.15;
      if (device.type === "Heater" && (hour <= 7 || hour >= 22)) activeProbability += 0.1;
      if (device.type === "Desk Plug" && hour >= 19 && hour <= 23) activeProbability += 0.18;

      activeProbability *= 0.6 + occupancyFactor(room) * 0.8;

      if (Math.random() > Math.min(activeProbability, 0.95)) return;

      const powerW = device.power * randomMultiplier();
      const usageWh = (powerW * 15) / 60;
      energyDocs.push({
        deviceId: device._id,
        roomId: device.roomId,
        usage: Number(usageWh.toFixed(3)),
        timestamp: dt
      });
    });

    if (energyDocs.length >= 5000) {
      await db.collection("energy").insertMany(energyDocs.splice(0, energyDocs.length));
    }
  }

  if (energyDocs.length > 0) {
    await db.collection("energy").insertMany(energyDocs);
  }

  const roomCount = await db.collection("rooms").countDocuments();
  const deviceCount = await db.collection("devices").countDocuments();
  const energyCount = await db.collection("energy").countDocuments();
  console.log(`Seeding complete. Rooms=${roomCount}, Devices=${deviceCount}, EnergyLogs=${energyCount}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});