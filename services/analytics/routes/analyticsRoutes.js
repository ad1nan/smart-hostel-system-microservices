const express = require("express");
const router = express.Router();
const controller = require("../controllers/analyticsController");

router.get("/heatmap", controller.getHeatmap);
router.get("/devices", controller.getDeviceAnalytics);
router.get("/timeseries", controller.getTimeseries);

module.exports = router;