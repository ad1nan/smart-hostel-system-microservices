/**
 * Test script to verify room distribution
 * Expected: 10 rooms total (5 on floor 1, 5 on floor 2)
 * Run: MONGO_URI=mongodb://mongo:27017/hostelDB node test-room-distribution.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/hostelDB";

async function testRoomDistribution() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;

  console.log("Testing room distribution...\n");

  try {
    // Get all rooms and devices
    const rooms = await db.collection("rooms").find().toArray();
    const devices = await db.collection("devices").find().toArray();

    console.log(`Total rooms found: ${rooms.length}`);
    console.log(`Total devices found: ${devices.length}`);

    // Group rooms by floor
    const roomsByFloor = {};
    rooms.forEach(room => {
      const floor = room.floor;
      if (!roomsByFloor[floor]) {
        roomsByFloor[floor] = [];
      }
      roomsByFloor[floor].push(room);
    });

    // Group devices by room
    const devicesByRoom = {};
    devices.forEach(device => {
      const roomId = device.roomId.toString();
      if (!devicesByRoom[roomId]) {
        devicesByRoom[roomId] = [];
      }
      devicesByRoom[roomId].push(device);
    });

    // Test results
    console.log("\n=== ROOM DISTRIBUTION TEST RESULTS ===");
    console.log("Expected: 10 rooms total (5 on floor 1, 5 on floor 2)");
    console.log(`Actual: ${rooms.length} rooms total`);

    // Check each floor
    Object.keys(roomsByFloor).sort((a, b) => a - b).forEach(floor => {
      const floorRooms = roomsByFloor[floor];
      console.log(`\nFloor ${floor}: ${floorRooms.length} rooms`);
      floorRooms.forEach(room => {
        const deviceCount = devicesByRoom[room._id.toString()]?.length || 0;
        const status = deviceCount > 0 ? "✓" : "✗";
        console.log(`  ${status} ${room.name}: ${deviceCount} devices`);
      });
    });

    // Device distribution summary
    console.log("\n=== DEVICE DISTRIBUTION SUMMARY ===");
    const roomsWithDevices = rooms.filter(room => {
      const deviceCount = devicesByRoom[room._id.toString()]?.length || 0;
      return deviceCount > 0;
    }).length;

    const roomsWithoutDevices = rooms.length - roomsWithDevices;
    const totalDeviceCount = devices.length;
    const avgDevicesPerRoom = rooms.length > 0 ? (totalDeviceCount / rooms.length).toFixed(1) : 0;

    console.log(`Rooms with devices: ${roomsWithDevices}/${rooms.length}`);
    console.log(`Rooms without devices: ${roomsWithoutDevices}/${rooms.length}`);
    console.log(`Average devices per room: ${avgDevicesPerRoom}`);
    console.log(`Expected total devices: ${rooms.length * 5}`);
    console.log(`Actual total devices: ${totalDeviceCount}`);

    // Test pass/fail criteria
    const testPassed = 
      rooms.length === 10 && // Exactly 10 rooms
      roomsWithDevices === rooms.length && // All rooms have devices
      totalDeviceCount === rooms.length * 5 && // Each room has 5 devices
      Object.keys(roomsByFloor).length === 2; // Exactly 2 floors

    console.log(`\n=== TEST RESULT ===`);
    console.log(testPassed ? "✅ PASS: Room distribution test passed!" : "❌ FAIL: Room distribution test failed!");
    
    if (!testPassed) {
      console.log("\n=== ISSUES FOUND ===");
      if (rooms.length !== 10) console.log(`- Expected 10 rooms, found ${rooms.length}`);
      if (roomsWithDevices !== rooms.length) console.log(`- ${roomsWithoutDevices} rooms without devices`);
      if (totalDeviceCount !== rooms.length * 5) console.log(`- Expected ${rooms.length * 5} devices, found ${totalDeviceCount}`);
      if (Object.keys(roomsByFloor).length !== 2) console.log(`- Expected 2 floors, found ${Object.keys(roomsByFloor).length}`);
    }

  } catch (err) {
    console.error("Test failed:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(testPassed ? 0 : 1);
  }
}

testRoomDistribution().catch((err) => {
  console.error("Test execution failed:", err.message);
  process.exit(1);
});
