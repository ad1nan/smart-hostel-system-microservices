/**
 * Seed script — creates rooms, devices, and initial energy logs.
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

  let deviceCounter = 1;

  for (let i = 1; i <= 3; i++) {
    const roomNumber = (100 + i).toString();

    const insertedRoom = await db.collection("rooms").insertOne({
      name: "Room " + roomNumber
    });
    const roomId = insertedRoom.insertedId;

    const devices = [
      { deviceId: "D" + deviceCounter++, type: "Fan",   roomId, status: true, power: 70 },
      { deviceId: "D" + deviceCounter++, type: "Light", roomId, status: true, power: 40 }
    ];

    const insertedDevices = await db.collection("devices").insertMany(devices);

    const energyLogs = [];
    Object.values(insertedDevices.insertedIds).forEach((devId) => {
      for (let t = 1; t <= 6; t++) {
        energyLogs.push({
          deviceId:  devId,
          roomId,
          usage:     Math.floor(Math.random() * 50) + 20,
          timestamp: new Date(Date.now() - (6 - t) * 3600000)
        });
      }
    });
    await db.collection("energy").insertMany(energyLogs);
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});