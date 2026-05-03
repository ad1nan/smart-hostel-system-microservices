const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  type: String,
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room"
  },
  status: { type: Boolean, default: false },
  power: Number,

  deviceId: { type: String, unique: true },

  startTime: Date
});

module.exports = mongoose.model("Device", deviceSchema);