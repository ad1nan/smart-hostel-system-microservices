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
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;
    const [rooms, total] = await Promise.all([
      Room.find().skip(skip).limit(limit),
      Room.countDocuments()
    ]);
    res.json({ data: rooms, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
};