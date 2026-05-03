const mongoose = require("mongoose");

async function seed() {
  await mongoose.connect("mongodb://localhost:27018/hostelDB");

  const db = mongoose.connection;

  console.log("Seeding CLEAN + ENERGY data...");

  await db.collection("rooms").deleteMany({});
  await db.collection("devices").deleteMany({});
  await db.collection("energy").deleteMany({}); // ✅ NEW

  let deviceCounter = 1;

  for (let i = 1; i <= 3; i++) {
    const roomNumber = (100 + i).toString();

    const room = {
      name: "Room " + roomNumber
    };

    const insertedRoom = await db.collection("rooms").insertOne(room);
    const roomId = insertedRoom.insertedId;

    const devices = [
      {
        deviceId: "D" + deviceCounter++,
        type: "Fan",
        roomId,
        status: true,
        power: 70
      },
      {
        deviceId: "D" + deviceCounter++,
        type: "Light",
        roomId,
        status: true,
        power: 40
      }
    ];

    const insertedDevices = await db.collection("devices").insertMany(devices);

    // ✅ CREATE ENERGY LOGS (IMPORTANT)
    const energyLogs = [];

    insertedDevices.insertedIds &&
      Object.values(insertedDevices.insertedIds).forEach((devId) => {
        for (let t = 1; t <= 6; t++) {
          energyLogs.push({
            deviceId: devId,
            roomId,
            usage: Math.floor(Math.random() * 50) + 20,
            timestamp: new Date(Date.now() - (6 - t) * 3600000)
          });
        }
      });

    await db.collection("energy").insertMany(energyLogs);
  }

  console.log("✅ CLEAN + ENERGY SEEDED");
  process.exit();
}

seed();