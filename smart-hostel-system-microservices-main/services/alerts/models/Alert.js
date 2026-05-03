const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  message: String,
  level: String,
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room"
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device"
  },
  resolved: { type: Boolean, default: false }
}, { timestamps: true });

schema.index({ deviceId: 1, resolved: 1 });

module.exports = mongoose.model("Alert", schema);
