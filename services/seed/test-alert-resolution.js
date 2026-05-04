/**
 * Test script to verify alert resolution improvements
 * Expected: Alert resolution should check device status and update device state
 * Run: MONGO_URI=mongodb://mongo:27017/hostelDB node test-alert-resolution.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:27017/hostelDB";

async function testAlertResolution() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;

  console.log("Testing alert resolution improvements...\n");

  try {
    // Create test data
    const Device = require("../../devices/models/Device");
    const Alert = require("../models/Alert");
    
    // Clean up test data
    await db.collection("devices").deleteMany({});
    await db.collection("alerts").deleteMany({});

    // Create test device
    const testDevice = await Device.create({
      deviceId: "TEST001",
      type: "Light",
      status: true, // Device is ON
      roomId: new mongoose.Types.ObjectId()
    });

    // Create test alert for ON device
    const testAlert1 = await Alert.create({
      message: "Test alert - device is ON",
      level: "warning",
      deviceId: testDevice._id,
      resolved: false
    });

    // Test 1: Try to resolve alert when device is ON (should succeed)
    console.log("\n=== TEST 1: Resolving alert for device that is ON ===");
    try {
      const response = await fetch(`http://localhost:5003/alerts/${testAlert1._id}/resolve`, {
        method: 'PATCH'
      });
      const result = await response.json();
      
      if (result.resolved) {
        console.log("✅ PASS: Alert resolved successfully");
      } else {
        console.log("❌ FAIL: Alert should have been resolved");
      }
    } catch (err) {
      console.error("Test 1 failed:", err.message);
    }

    // Turn device OFF
    await Device.findByIdAndUpdate(testDevice._id, { status: false });

    // Create test alert for OFF device
    const testAlert2 = await Alert.create({
      message: "Test alert - device is OFF",
      level: "critical",
      deviceId: testDevice._id,
      resolved: false
    });

    // Test 2: Try to resolve alert when device is OFF (should be blocked)
    console.log("\n=== TEST 2: Resolving alert for device that is OFF ===");
    try {
      const response = await fetch(`http://localhost:5003/alerts/${testAlert2._id}/resolve`, {
        method: 'PATCH'
      });
      const result = await response.json();
      
      if (result.error && result.error.includes("Cannot resolve alert for device that is currently OFF")) {
        console.log("✅ PASS: Correctly blocked resolution for OFF device");
      } else {
        console.log("❌ FAIL: Should have blocked resolution for OFF device");
      }
    } catch (err) {
      console.error("Test 2 failed:", err.message);
    }

    // Test 3: Verify device state after resolution
    console.log("\n=== TEST 3: Verifying device state after alert resolution ===");
    const finalDevice = await Device.findById(testDevice._id);
    if (finalDevice.status === false) {
      console.log("✅ PASS: Device correctly turned OFF after alert resolution");
    } else {
      console.log("❌ FAIL: Device should be OFF after alert resolution");
    }

    console.log("\n=== ALERT RESOLUTION TEST RESULTS ===");
    const tests = [
      testAlert1.resolved !== undefined, // Alert 1 was resolved
      result.error && result.error.includes("Cannot resolve alert for device that is currently OFF"), // Alert 2 was correctly blocked
      finalDevice.status === false // Device state is correct
    ];

    const allPassed = tests.every(test => test);
    console.log(allPassed ? "✅ PASS: All alert resolution tests passed!" : "❌ FAIL: Some alert resolution tests failed!");

    if (!allPassed) {
      console.log("\n=== ISSUES FOUND ===");
      if (!testAlert1.resolved) console.log("- Alert 1 was not resolved");
      if (!(result.error && result.error.includes("Cannot resolve alert for device that is currently OFF"))) console.log("- Alert 2 should have been blocked");
      if (finalDevice.status !== false) console.log("- Device was not turned OFF after resolution");
    }

  } catch (err) {
    console.error("Test failed:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(allPassed ? 0 : 1);
  }
}

testAlertResolution().catch((err) => {
  console.error("Test execution failed:", err.message);
  process.exit(1);
});
