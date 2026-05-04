/**
 * Fix device assignment - ensure all rooms have 5 devices each
 * Run: MONGO_URI=mongodb://localhost:27018/hostelDB node fix-devices.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/hostelDB";

async function fixDevices() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;

  console.log("Connecting to database at", MONGO_URI);

  // Get all rooms
  const rooms = await db.collection("rooms").find().toArray();
  console.log(`Found ${rooms.length} rooms`);

  // Get all devices
  const devices = await db.collection("devices").find().toArray();
  console.log(`Found ${devices.length} devices`);

  // Group devices by room
  const devicesByRoom = {};
  devices.forEach(device => {
    const roomId = device.roomId.toString();
    if (!devicesByRoom[roomId]) {
      devicesByRoom[roomId] = [];
    }
    devicesByRoom[roomId].push(device);
  });

  // Check which rooms don't have enough devices
  const roomsNeedingDevices = [];
  rooms.forEach(room => {
    const roomId = room._id.toString();
    const deviceCount = devicesByRoom[roomId] ? devicesByRoom[roomId].length : 0;
    console.log(`Room ${room.name} (Floor ${room.floor}): ${deviceCount} devices`);
    
    if (deviceCount < 5) {
      roomsNeedingDevices.push({
        room,
        currentCount: deviceCount,
        needed: 5 - deviceCount
      });
    }
  });

  if (roomsNeedingDevices.length === 0) {
    console.log("All rooms already have 5 devices each!");
    process.exit(0);
  }

  console.log(`\n${roomsNeedingDevices.length} rooms need devices:`);

  // Create missing devices
  const deviceBlueprint = [
    { type: "Light", power: 24, label: "Ceiling Light", x: 0.5, y: 0.2 },
    { type: "Fan", power: 75, label: "Ceiling Fan", x: 0.5, y: 0.5 },
    { type: "AC", power: 1300, label: "AC Unit", x: 0.85, y: 0.15 },
    { type: "Heater", power: 1000, label: "Wall Heater", x: 0.15, y: 0.82 },
    { type: "Desk Plug", power: 120, label: "Study Plug", x: 0.7, y: 0.78 }
  ];

  let deviceCounter = devices.length + 1;
  const newDevices = [];

  for (const { room, needed } of roomsNeedingDevices) {
    console.log(`Adding ${needed} devices to Room ${room.name}`);
    
    // Get existing device types to avoid duplicates
    const existingDevices = devicesByRoom[room._id.toString()] || [];
    const existingTypes = existingDevices.map(d => d.type);
    
    // Find missing device types
    const missingTypes = deviceBlueprint.filter(bp => !existingTypes.includes(bp.type));
    
    // If we need more devices than missing types, add some extras
    const devicesToAdd = missingTypes.slice(0, needed);
    while (devicesToAdd.length < needed) {
      // Add extra devices (like additional lights or plugs)
      const extraType = Math.random() > 0.5 ? "Light" : "Desk Plug";
      devicesToAdd.push({
        type: extraType,
        power: extraType === "Light" ? 24 : 120,
        label: extraType === "Light" ? "Extra Light" : "Extra Plug",
        x: Math.random() * 0.8 + 0.1,
        y: Math.random() * 0.8 + 0.1
      });
    }
    
    devicesToAdd.forEach((bp, idx) => {
      const enabled = bp.type !== "Heater" ? Math.random() > 0.3 : Math.random() > 0.8;
      newDevices.push({
        deviceId: `D${String(deviceCounter).padStart(3, "0")}`,
        type: bp.type,
        roomId: room._id,
        status: enabled,
        power: bp.power,
        startTime: enabled ? new Date(Date.now() - (idx * 120000)) : null,
        location: {
          label: bp.label,
          x: bp.x,
          y: bp.y
        }
      });
      deviceCounter += 1;
    });
  }

  if (newDevices.length > 0) {
    await db.collection("devices").insertMany(newDevices);
    console.log(`\nCreated ${newDevices.length} new devices`);
  }

  const finalDeviceCount = await db.collection("devices").countDocuments();
  console.log(`\nFinal device count: ${finalDeviceCount}`);
  console.log("Device assignment fix complete!");
  
  process.exit(0);
}

fixDevices().catch((err) => {
  console.error("Fix failed:", err.message);
  process.exit(1);
});
