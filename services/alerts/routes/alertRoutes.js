const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alertController");

router.get("/", alertController.getActiveAlerts);
router.patch("/:id/resolve", alertController.resolveAlert);
router.delete("/clear", alertController.clearAlerts);

module.exports = router;
