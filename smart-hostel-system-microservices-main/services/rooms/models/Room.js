const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  floor: { type: Number, default: 1 },
  roomType: {
    type: String,
    enum: ["2ppl", "4ppl", "single", "suite"],
    default: "2ppl"
  },
  capacity: { type: Number, default: 2, min: 1 },
  occupancy: { type: Number, default: 0, min: 0 }
});

module.exports = mongoose.model("Room", schema);