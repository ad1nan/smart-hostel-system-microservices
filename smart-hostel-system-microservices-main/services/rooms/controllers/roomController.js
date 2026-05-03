const Room = require("../models/Room");

exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRooms = async (req, res) => {
  const rooms = await Room.find();
  res.json(rooms);
};