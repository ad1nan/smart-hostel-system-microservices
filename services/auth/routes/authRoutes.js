const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* ---------- REGISTER ---------- */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashed
    });

    await user.save();

    res.json({ message: "User registered" });
  } catch (err) {
    res.status(500).json({ error: "Register failed" });
  }
});

/* ---------- LOGIN ---------- */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
  {
    userId: user._id,
    role: user.role   // ✅ VERY IMPORTANT
  },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

    res.json({ token });

  } catch (err) {
  console.error(err);   // 👈 ADD THIS
  res.status(500).json({ error: err.message }); // 👈 SHOW REAL ERROR
}
});

module.exports = router;