const mongoose = require("mongoose");

const energySchema = new mongoose.Schema({
  deviceId: mongoose.Schema.Types.ObjectId,
  roomId: mongoose.Schema.Types.ObjectId,
  usage: Number, // Wh
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Energy", energySchema);