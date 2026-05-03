import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import API from "./api";
import Login from "./Login";
import { jwtDecode } from "jwt-decode";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend,
  LineElement, PointElement
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("dash_theme") !== "light");
  const [compactView, setCompactView] = useState(() => localStorage.getItem("dash_layout") === "compact");

  // Decode token once; re-derive on every render so logout clears it immediately
  let user = null;
  try {
    const token = localStorage.getItem("token");
    user = token ? jwtDecode(token) : null;
  } catch { /* invalid token */ }

  const isAdmin = user?.role === "admin";

  // Data states
  const [rooms,              setRooms]              = useState([]);
  const [devices,            setDevices]            = useState([]);
  const [alerts,             setAlerts]             = useState([]);
  const [roomAnalytics,      setRoomAnalytics]      = useState([]);
  const [deviceAnalytics,    setDeviceAnalytics]    = useState([]);
  const [timeSeriesAnalytics,setTimeSeriesAnalytics]= useState([]);
  const [forecastData,       setForecastData]       = useState([]);
  const [roomCosts,          setRoomCosts]          = useState([]);
  const [peakHours,          setPeakHours]          = useState([]);
  const [dailyReports,       setDailyReports]       = useState([]);
  const [weeklyReports,      setWeeklyReports]      = useState([]);
  const [ratePerKwh,         setRatePerKwh]         = useState(() => Number(localStorage.getItem("rate_per_kwh") || 8));
  const [selectedRoom,       setSelectedRoom]       = useState(null);
  const [activeSection,      setActiveSection]      = useState("overview");
  const [selectedFloor,      setSelectedFloor]      = useState("all");
  const [kpi, setKpi] = useState({ totalEnergy: 0, activeDevices: 0, activeAlerts: 0, topRoom: "" });
  const fetchInFlight = useRef(false);
  const analyticsFetchInFlight = useRef(false);
  const unwrapList = (payload) => (Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []);

  const fetchData = useCallback(async () => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const [roomsRes, devicesRes, alertsRes, heatmapRes, devAnalRes, tsRes] =
        await Promise.all([
          API.get("/rooms"),
          API.get("/devices"),
          API.get("/alerts"),
          API.get("/analytics/heatmap"),
          API.get("/analytics/devices"),
          API.get("/analytics/timeseries")
        ]);
      setRooms(unwrapList(roomsRes.data));
      setDevices(unwrapList(devicesRes.data));
      setAlerts(unwrapList(alertsRes.data));
      setRoomAnalytics(unwrapList(heatmapRes.data));
      setDeviceAnalytics(unwrapList(devAnalRes.data));
      setTimeSeriesAnalytics(unwrapList(tsRes.data));
    } catch (err) {
      console.error("Fetch error:", err.response?.data || err.message);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
      }
    } finally {
      fetchInFlight.current = false;
    }
  }, []);

  const fetchAdvancedAnalytics = useCallback(async () => {
    if (analyticsFetchInFlight.current) return;
    analyticsFetchInFlight.current = true;
    try {
      const [
        forecastRes,
        costsRes,
        peakRes,
        dailyRes,
        weeklyRes
      ] = await Promise.all([
        API.get("/analytics/forecast", { params: { method: "linear" } }),
        API.get("/analytics/room-costs", { params: { ratePerKwh, windowHours: 24 } }),
        API.get("/analytics/peak-hours"),
        API.get("/analytics/reports/daily", { params: { limit: 7 } }),
        API.get("/analytics/reports/weekly", { params: { limit: 6 } })
      ]);
      setForecastData(forecastRes.data || []);
      setRoomCosts(costsRes.data || []);
      setPeakHours(peakRes.data || []);
      setDailyReports(dailyRes.data || []);
      setWeeklyReports(weeklyRes.data || []);
    } catch (err) {
      console.error("Advanced analytics fetch error:", err.response?.data || err.message);
    } finally {
      analyticsFetchInFlight.current = false;
    }
  }, [ratePerKwh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAdvancedAnalytics();
    const interval = setInterval(fetchAdvancedAnalytics, 60000);
    return () => clearInterval(interval);
  }, [fetchAdvancedAnalytics, isAuthenticated]);

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  useEffect(() => {
    localStorage.setItem("dash_theme", darkMode ? "dark" : "light");
    document.body.style.background = darkMode ? "#0f172a" : "#e2e8f0";
    document.body.style.color = darkMode ? "#f8fafc" : "#0f172a";
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("dash_layout", compactView ? "compact" : "expanded");
  }, [compactView]);

  useEffect(() => {
    localStorage.setItem("rate_per_kwh", String(ratePerKwh));
  }, [ratePerKwh]);

  // Energy helpers
  const getRoomEnergy = useCallback((roomId) => {
    const row = roomAnalytics.find(
      (r) => r.roomId === roomId || r.roomId?._id === roomId || r._id === roomId
    );
    return Number(row?.totalUsage ?? row?.totalEnergy ?? 0);
  }, [roomAnalytics]);

  const energies   = rooms.map((r) => getRoomEnergy(r._id));
  const maxEnergy  = Math.max(...energies, 1);

  // KPI
  useEffect(() => {
    const totalEnergy  = roomAnalytics.reduce((s, r) => s + Number(r.totalUsage ?? r.totalEnergy ?? 0), 0);
    const activeDevices = devices.filter((d) => d.status).length;
    let topRoom = ""; let topVal = 0;
    roomAnalytics.forEach((r) => {
      const v = Number(r.totalUsage ?? r.totalEnergy ?? 0);
      if (v > topVal) {
        topVal = v;
        const match = rooms.find((rm) => rm._id === r.roomId || rm._id === r._id);
        topRoom = match?.name || "";
      }
    });
    setKpi({ totalEnergy: totalEnergy.toFixed(2), activeDevices, activeAlerts: alerts.length, topRoom });
  }, [roomAnalytics, devices, alerts, rooms]);

  // Actions (admin-only)
  const dismissAlert = async (id) => {
    try {
      await API.patch(`/alerts/${id}/resolve`);
      fetchData();
    } catch (err) {
      if (err.response?.status === 403) alert("Access denied: admin only.");
      else console.error("Resolve failed:", err.message);
    }
  };

  const toggleDevice = async (id) => {
    try {
      await API.post(`/devices/toggle/${id}`);
      fetchData();
    } catch (err) {
      if (err.response?.status === 403) alert("Access denied: admin only.");
      else console.error("Toggle failed:", err.message);
    }
  };

  // Chart data
  const deviceChartData = {
    labels: deviceAnalytics.map((d) => d.deviceType),
    datasets: [{
      label: "Energy (Wh)",
      data: deviceAnalytics.map((d) => Number(d.totalUsage ?? d.totalEnergy ?? 0)),
      backgroundColor: "#3b82f6"
    }]
  };
  const timeSeriesChartData = {
    labels: timeSeriesAnalytics.map((t) => t.period),
    datasets: [{
      label: "Energy (Wh)",
      data: timeSeriesAnalytics.map((t) => Number(t.totalUsage ?? t.totalEnergy ?? 0)),
      borderColor: "#22c55e",
      tension: 0.3
    }]
  };

  const alertRoomIds = useMemo(
    () => new Set(alerts.map((a) => a.roomId?._id || a.roomId).filter(Boolean)),
    [alerts]
  );

  const roomDevicesMap = useMemo(() => {
    const map = new Map();
    devices.forEach((device) => {
      const roomId = typeof device.roomId === "object" ? device.roomId?._id : device.roomId;
      if (!roomId) return;
      if (!map.has(roomId)) map.set(roomId, []);
      map.get(roomId).push(device);
    });
    return map;
  }, [devices]);

  const floorRooms = useMemo(() => {
    const sortedRooms = [...rooms].sort((a, b) => {
      const aNum = Number(String(a.name || "").replace(/[^\d]/g, ""));
      const bNum = Number(String(b.name || "").replace(/[^\d]/g, ""));
      if (Number.isNaN(aNum) || Number.isNaN(bNum)) return String(a.name).localeCompare(String(b.name));
      return aNum - bNum;
    });

    return sortedRooms.map((room, idx) => {
      const deviceList = roomDevicesMap.get(room._id) || [];
      const activeCount = deviceList.filter((d) => d.status).length;
      const roomEnergy = getRoomEnergy(room._id);
      const intensity = Math.min(1, roomEnergy / maxEnergy);
      return {
        ...room,
        roomEnergy,
        deviceList,
        activeCount,
        intensity,
        gridRow: Math.floor(idx / 4) + 1,
        gridCol: (idx % 4) + 1
      };
    });
  }, [rooms, roomDevicesMap, maxEnergy, getRoomEnergy]);

  const floorCards = useMemo(() => {
    const byFloor = new Map();
    floorRooms.forEach((room) => {
      const floorKey = Number(room.floor) || 0;
      if (!byFloor.has(floorKey)) byFloor.set(floorKey, []);
      byFloor.get(floorKey).push(room);
    });
    return [...byFloor.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([floor, entries]) => {
        const occupied = entries.reduce((sum, r) => sum + Number(r.occupancy || 0), 0);
        const capacity = entries.reduce((sum, r) => sum + Number(r.capacity || 0), 0);
        const consumption = entries.reduce((sum, r) => sum + Number(r.roomEnergy || 0), 0);
        const twoPpl = entries.filter((r) => r.roomType === "2ppl").length;
        const fourPpl = entries.filter((r) => r.roomType === "4ppl").length;
        return { floor, entries, occupied, capacity, consumption, twoPpl, fourPpl };
      });
  }, [floorRooms]);

  const visibleRooms = useMemo(() => {
    if (selectedFloor === "all") return floorRooms;
    return floorRooms.filter((room) => Number(room.floor) === Number(selectedFloor));
  }, [floorRooms, selectedFloor]);

  const energySeries = useMemo(
    () => timeSeriesAnalytics.map((t) => Number(t.totalUsage ?? t.totalEnergy ?? 0)),
    [timeSeriesAnalytics]
  );

  const totalEnergyNow = energySeries[energySeries.length - 1] || 0;
  const totalEnergyPrev = energySeries[energySeries.length - 2] || 0;
  const trendDelta = totalEnergyNow - totalEnergyPrev;
  const trendDirection = trendDelta > 0 ? "up" : trendDelta < 0 ? "down" : "flat";

  const totalDevices = devices.length;
  const offlineDevices = Math.max(totalDevices - kpi.activeDevices, 0);
  const avgEnergyPerRoom = rooms.length ? Number(kpi.totalEnergy) / rooms.length : 0;
  const criticalAlerts = alerts.filter((a) => String(a.level).toLowerCase() === "critical").length;

  const topRoomRows = useMemo(() => {
    return [...rooms]
      .map((room) => ({
        id: room._id,
        name: room.name,
        energy: getRoomEnergy(room._id),
        devices: (roomDevicesMap.get(room._id) || []).length
      }))
      .sort((a, b) => b.energy - a.energy)
      .slice(0, 6);
  }, [rooms, roomDevicesMap, getRoomEnergy]);

  const statusDoughnutData = {
    labels: ["Active Devices", "Inactive Devices"],
    datasets: [
      {
        data: [kpi.activeDevices, offlineDevices],
        backgroundColor: ["#22c55e", "#64748b"],
        borderColor: "transparent"
      }
    ]
  };

  const roomBarData = {
    labels: topRoomRows.map((r) => r.name),
    datasets: [
      {
        label: "Energy (Wh)",
        data: topRoomRows.map((r) => Number(r.energy.toFixed(2))),
        backgroundColor: "#3b82f6"
      }
    ]
  };

  const forecastChartData = {
    labels: forecastData.map((f) => f.roomName),
    datasets: [{
      label: "Next Hour Forecast (Wh)",
      data: forecastData.map((f) => Number(f.forecastNextHourWh || 0)),
      backgroundColor: "#22c55e"
    }]
  };

  const peakChartData = {
    labels: peakHours.map((h) => h.label),
    datasets: [{
      label: "Avg Usage (Wh)",
      data: peakHours.map((h) => Number(h.avgWh || 0)),
      backgroundColor: peakHours.map((h) =>
        h.band === "high" ? "#ef4444" : h.band === "idle" ? "#334155" : "#3b82f6"
      )
    }]
  };

  const downloadReport = async (granularity, format) => {
    try {
      const response = await API.get(`/analytics/reports/${granularity}/export`, {
        params: { format, ratePerKwh, limit: granularity === "daily" ? 14 : 12 },
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: response.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${granularity}-energy-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Report download failed:", err.response?.data || err.message);
    }
  };

  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className={`app ${darkMode ? "theme-dark" : "theme-light"} ${compactView ? "compact" : "expanded"}`}>
      <div className="layout-shell">
        <aside className="side-nav">
          <div className="brand-block">
            <span className="dash-logo">⚡</span>
            <div>
              <h1 className="dash-title">Smart Hostel</h1>
              <p className="brand-subtitle">Energy Command Center</p>
            </div>
          </div>
          <nav className="nav-menu">
            {[
              ["overview", "Overview"],
              ["flooring", "Floor Planner"],
              ["operations", "Operations"],
              ["analytics", "Analytics"],
              ["reports", "Reports"]
            ].map(([id, label]) => (
              <button
                key={id}
                className={`nav-link ${activeSection === id ? "active" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="nav-footer">
            <div className="user-pill">
              <span className={`role-badge ${isAdmin ? "admin" : "user"}`}>{isAdmin ? "Admin" : "User"}</span>
              <span className="username-label">{user?.username || "–"}</span>
            </div>
            <button className="toggle-pill" onClick={() => setDarkMode((prev) => !prev)}>{darkMode ? "Dark" : "Light"} Mode</button>
            <button className="toggle-pill" onClick={() => setCompactView((prev) => !prev)}>{compactView ? "Compact" : "Expanded"}</button>
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </aside>
        <main className="main-panel">
          {/* ── HEADER ── */}
          <header className="dash-header">
            <div className="dash-header-left">
              <h2 className="section-title">Live Building Operations</h2>
            </div>
            <div className="dash-header-right">
              <div className="rate-control">
                <label htmlFor="ratePerKwh">Rate (Rs/kWh)</label>
                <input
                  id="ratePerKwh"
                  type="number"
                  min="1"
                  step="0.5"
                  value={ratePerKwh}
                  onChange={(e) => setRatePerKwh(Number(e.target.value) || 1)}
                />
              </div>
            </div>
          </header>

      {/* ── KPI STRIP ── */}
      {activeSection === "overview" && (
      <section>
        <h2 className="section-title">Overview</h2>
        <div className="kpi-container">
          <div className="kpi-card">
            <h3>Total Energy</h3>
            <p>{kpi.totalEnergy} Wh</p>
          </div>
          <div className="kpi-card">
            <h3>Active Devices</h3>
            <p>{kpi.activeDevices}</p>
          </div>
          <div className="kpi-card">
            <h3>Active Alerts</h3>
            <p style={{ color: kpi.activeAlerts > 0 ? "#ef4444" : "#22c55e" }}>
              {kpi.activeAlerts}
            </p>
          </div>
          <div className="kpi-card">
            <h3>Top Room</h3>
            <p style={{ fontSize: 16 }}>{kpi.topRoom || "N/A"}</p>
          </div>
        </div>
      </section>
      )}

      {/* ── EXECUTIVE ANALYTICS ── */}
      {activeSection === "overview" && (
      <section>
        <h2 className="section-title">Executive Analytics</h2>
        <div className="insight-grid">
          <div className="insight-card">
            <span>Energy Trend</span>
            <strong className={`trend-${trendDirection}`}>
              {trendDelta >= 0 ? "+" : ""}
              {trendDelta.toFixed(2)} Wh
            </strong>
            <small>vs previous interval</small>
          </div>
          <div className="insight-card">
            <span>Avg / Room</span>
            <strong>{avgEnergyPerRoom.toFixed(2)} Wh</strong>
            <small>{rooms.length} total rooms</small>
          </div>
          <div className="insight-card">
            <span>Device Availability</span>
            <strong>{totalDevices ? Math.round((kpi.activeDevices / totalDevices) * 100) : 0}%</strong>
            <small>{kpi.activeDevices}/{totalDevices} active</small>
          </div>
          <div className="insight-card">
            <span>Critical Alerts</span>
            <strong>{criticalAlerts}</strong>
            <small>{alerts.length} total active alerts</small>
          </div>
        </div>
      </section>
      )}

      {/* ── FLOOR BLUEPRINT ── */}
      {activeSection === "flooring" && (
      <section>
        <h2 className="section-title">Floor Blueprint</h2>
        <div className="floor-filter">
          <button className={`toggle-pill ${selectedFloor === "all" ? "selected" : ""}`} onClick={() => setSelectedFloor("all")}>
            All Floors
          </button>
          {floorCards.map((f) => (
            <button
              key={f.floor}
              className={`toggle-pill ${Number(selectedFloor) === f.floor ? "selected" : ""}`}
              onClick={() => setSelectedFloor(f.floor)}
            >
              Floor {f.floor}
            </button>
          ))}
        </div>
        <div className="floor-cards-grid">
          {floorCards.map((floorCard) => (
            <div key={floorCard.floor} className="card floor-card">
              <h3>Floor {floorCard.floor}</h3>
              <p>{floorCard.entries.length} rooms · {floorCard.occupied}/{floorCard.capacity} occupants</p>
              <p>2-sharing: {floorCard.twoPpl} · 4-sharing: {floorCard.fourPpl}</p>
              <strong>{floorCard.consumption.toFixed(1)} Wh total</strong>
            </div>
          ))}
        </div>
        <div className="blueprint-grid">
          {visibleRooms.map((room) => (
            <button
              key={room._id}
              className={`blueprint-cell ${alertRoomIds.has(room._id) ? "has-alert" : ""}`}
              style={{ "--room-intensity": room.intensity }}
              onClick={() => setSelectedRoom(room)}
            >
              <div className="cell-head">
                <h4>{room.name}</h4>
                <span>{room.roomEnergy.toFixed(1)} Wh</span>
              </div>
              <div className="cell-meta">
                <span>
                  F{room.floor || "-"} · {room.roomType || "-"} · {room.occupancy ?? 0}/{room.capacity ?? 0} occupants
                </span>
                <div className="device-dots">
                  {(room.deviceList || []).slice(0, 8).map((d) => (
                    <span
                      key={d._id}
                      className={`device-dot ${d.status ? "on" : "off"}`}
                      title={`${d.type} - ${d.status ? "ON" : "OFF"}`}
                    />
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* ── ALERTS ── */}
      {activeSection === "operations" && (
      <section>
        <div className="section-header">
          <h2 className="section-title">Alerts</h2>
          {!isAdmin && (
            <span className="read-only-hint">🔒 Read-only — admin can resolve</span>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="empty-state">No active alerts</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert._id} className={`alert ${alert.level}`}>
              <div className="alert-info">
                <span className="alert-type">{alert.type || alert.level?.toUpperCase()}</span>
                <span>{alert.message}</span>
              </div>
              {isAdmin ? (
                <button className="resolve-btn" onClick={() => dismissAlert(alert._id)}>
                  Resolve
                </button>
              ) : (
                <span className="lock-icon" title="Admin only">🔒</span>
              )}
            </div>
          ))
        )}
      </section>
      )}

      {/* ── ADVANCED ANALYTICS ── */}
      {activeSection === "analytics" && (
      <section className="analytics-grid">
        <div className="card chart-card">
          <h2>Energy by Top Rooms</h2>
          <Bar data={roomBarData} />
        </div>
        <div className="card chart-card">
          <h2>Device Availability</h2>
          <Doughnut data={statusDoughnutData} />
        </div>
        <div className="card chart-card wide">
          <h2>Energy Over Time</h2>
          <Line data={timeSeriesChartData} />
        </div>
        <div className="card chart-card wide">
          <h2>Device Type Consumption</h2>
          <Bar data={deviceChartData} />
        </div>
        <div className="card chart-card wide">
          <h2>Peak Hours (24h Heatmap Bars)</h2>
          <Bar data={peakChartData} />
        </div>
        <div className="card chart-card wide">
          <h2>Forecast Next Hour by Room</h2>
          <Bar data={forecastChartData} />
        </div>
      </section>
      )}

      {activeSection === "analytics" && (
      <section>
        <h2 className="section-title">Energy Cost per Room (24h)</h2>
        <div className="table-wrap">
          <table className="elite-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Floor</th>
                <th>Usage (Wh)</th>
                <th>Cost (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {roomCosts
                .sort((a, b) => b.costINR - a.costINR)
                .slice(0, 12)
                .map((row) => (
                  <tr key={row.roomId}>
                    <td>{row.roomName}</td>
                    <td>{row.floor ?? "-"}</td>
                    <td>{row.totalWh.toFixed(2)}</td>
                    <td>{row.costINR.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeSection === "analytics" && (
      <section>
        <h2 className="section-title">Top Energy Rooms</h2>
        <div className="table-wrap">
          <table className="elite-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Energy (Wh)</th>
                <th>Devices</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {topRoomRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.energy.toFixed(2)}</td>
                  <td>{row.devices}</td>
                  <td>{alertRoomIds.has(row.id) ? "Active" : "Clear"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeSection === "reports" && (
      <section>
        <div className="section-header">
          <h2 className="section-title">Daily / Weekly Reports</h2>
          <div className="report-actions">
            <button className="toggle-pill" onClick={() => downloadReport("daily", "csv")}>Daily CSV</button>
            <button className="toggle-pill" onClick={() => downloadReport("daily", "pdf")}>Daily PDF</button>
            <button className="toggle-pill" onClick={() => downloadReport("weekly", "csv")}>Weekly CSV</button>
            <button className="toggle-pill" onClick={() => downloadReport("weekly", "pdf")}>Weekly PDF</button>
          </div>
        </div>
        <div className="report-grid">
          <div className="card">
            <h3>Last 7 Days</h3>
            {(dailyReports || []).slice(0, 7).map((r) => (
              <p key={r._id}>
                {new Date(r.periodStart).toLocaleDateString()} - {Number(r.totalUsageWh || 0).toFixed(2)} Wh
              </p>
            ))}
          </div>
          <div className="card">
            <h3>Last 6 Weeks</h3>
            {(weeklyReports || []).slice(0, 6).map((r) => (
              <p key={r._id}>
                {new Date(r.periodStart).toLocaleDateString()} - {Number(r.totalUsageWh || 0).toFixed(2)} Wh
              </p>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── ROOM MODAL ── */}
      {selectedRoom && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setSelectedRoom(null)}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{selectedRoom.name}</h2>
              <button className="modal-close" onClick={() => setSelectedRoom(null)}>✕</button>
            </div>

            {!isAdmin && (
              <div className="modal-role-notice">
                🔒 You have read-only access. Admins can toggle devices.
              </div>
            )}

            {devices
              .filter((d) => {
                const rid = typeof d.roomId === "object" ? d.roomId._id : d.roomId;
                return rid === selectedRoom._id;
              })
              .map((device) => (
                <div key={device._id} className="device-row">
                  <div className="device-info">
                    <span className="device-type">{device.type}</span>
                    <span className={`device-status ${device.status ? "on" : "off"}`}>
                      {device.status ? "ON" : "OFF"}
                    </span>
                    {device.power != null && (
                      <span className="device-power">{device.power}W</span>
                    )}
                    {device.location?.label && (
                      <span className="device-power">{device.location.label}</span>
                    )}
                  </div>
                  {isAdmin ? (
                    <button
                      className={`toggle-btn ${device.status ? "active" : ""}`}
                      onClick={() => toggleDevice(device._id)}
                    >
                      {device.status ? "Turn Off" : "Turn On"}
                    </button>
                  ) : (
                    <span className="lock-icon" title="Admin only">🔒</span>
                  )}
                </div>
              ))}

            <button className="modal-close-btn" onClick={() => setSelectedRoom(null)}>
              Close
            </button>
          </div>
        </div>
      )}

        </main>
      </div>
    </div>
  );
}

export default App;