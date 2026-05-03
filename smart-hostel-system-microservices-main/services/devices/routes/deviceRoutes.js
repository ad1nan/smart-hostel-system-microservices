const express = require("express");
const router = express.Router();
const controller = require("../controllers/deviceController");

router.get("/", controller.getDevices);
router.post("/toggle/:id", controller.toggleDevice);

module.exports = router;