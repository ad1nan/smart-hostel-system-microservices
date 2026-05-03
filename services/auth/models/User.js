const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, minlength: 3 },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);