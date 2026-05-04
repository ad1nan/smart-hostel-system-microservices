/**
 * Check device distribution - verify all rooms have devices
 * Run: MONGO_URI=mongodb://localhost:27018/hostelDB node check-devices.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/hostelDB";

async function checkDevices() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;

  console.log("Checking device distribution...\n");

  // Get all rooms and devices
  const rooms = await db.collection("rooms").find().toArray();
  const devices = await db.collection("devices").find().toArray();

  console.log(`Total rooms: ${rooms.length}`);
  console.log(`Total devices: ${devices.length}\n`);

  // Group devices by room
  const devicesByRoom = {};
  devices.forEach(device => {
    const roomId = device.roomId.toString();
    if (!devicesByRoom[roomId]) {
      devicesByRoom[roomId] = [];
    }
    devicesByRoom[roomId].push(device);
  });

  // Check each room
  let roomsWithDevices = 0;
  let roomsWithoutDevices = 0;
  let totalDeviceCount = 0;

  console.log("Device distribution by room:");
  console.log("================================");

  rooms.forEach(room => {
    const roomId = room._id.toString();
    const roomDevices = devicesByRoom[roomId] || [];
    const deviceCount = roomDevices.length;
    
    if (deviceCount > 0) {
      roomsWithDevices++;
    } else {
      roomsWithoutDevices++;
    }
    
    totalDeviceCount += deviceCount;
    
    const status = deviceCount === 5 ? "✓" : deviceCount === 0 ? "✗" : "⚠";
    console.log(`${status} Room ${room.name} (Floor ${room.floor}): ${deviceCount} devices`);
    
    if (deviceCount > 0 && deviceCount < 5) {
      roomDevices.forEach(device => {
        console.log(`  - ${device.type} (${device.status ? "ON" : "OFF"})`);
      });
    }
  });

  console.log("\nSummary:");
  console.log("========");
  console.log(`Rooms with devices: ${roomsWithDevices}/${rooms.length}`);
  console.log(`Rooms without devices: ${roomsWithoutDevices}/${rooms.length}`);
  console.log(`Average devices per room: ${(totalDeviceCount / rooms.length).toFixed(1)}`);
  console.log(`Expected total devices: ${rooms.length * 5}`);
  console.log(`Actual total devices: ${totalDeviceCount}`);
  
  if (roomsWithoutDevices > 0) {
    console.log(`\n⚠️  ${roomsWithoutDevices} rooms have no devices! Run 'node fix-devices.js' to fix this.`);
  } else if (totalDeviceCount < rooms.length * 5) {
    console.log(`\n⚠️  Some rooms have fewer than 5 devices! Run 'node fix-devices.js' to fix this.`);
  } else {
    console.log("\n✅ All rooms have devices!");
  }
  
  process.exit(0);
}

checkDevices().catch((err) => {
  console.error("Check failed:", err.message);
  process.exit(1);
});
