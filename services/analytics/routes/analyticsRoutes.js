const express = require("express");
const router = express.Router();
const controller = require("../controllers/analyticsController");

router.get("/heatmap", controller.getHeatmap);
router.get("/devices", controller.getDeviceAnalytics);
router.get("/timeseries", controller.getTimeseries);
router.get("/forecast", controller.getForecast);
router.get("/room-costs", controller.getRoomCosts);
router.get("/peak-hours", controller.getPeakHours);
router.get("/reports/:granularity", controller.getReports);
router.get("/reports/:granularity/export", controller.exportReports);

module.exports = router;