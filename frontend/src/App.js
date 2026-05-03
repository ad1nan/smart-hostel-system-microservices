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
import { Pie, Bar, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend,
  LineElement, PointElement
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );

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
  const [selectedRoom,       setSelectedRoom]       = useState(null);
  const [kpi, setKpi] = useState({ totalEnergy: 0, activeDevices: 0, activeAlerts: 0, topRoom: "" });
  const fetchInFlight = useRef(false);

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
      setRooms(roomsRes.data               || []);
      setDevices(devicesRes.data           || []);
      setAlerts(alertsRes.data             || []);
      setRoomAnalytics(heatmapRes.data     || []);
      setDeviceAnalytics(devAnalRes.data   || []);
      setTimeSeriesAnalytics(tsRes.data    || []);
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

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData, isAuthenticated]);

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  // Energy helpers
  const getRoomEnergy = (roomId) => {
    const row = roomAnalytics.find(
      (r) => r.roomId === roomId || r.roomId?._id === roomId || r._id === roomId
    );
    return Number(row?.totalUsage ?? row?.totalEnergy ?? 0);
  };

  const energies   = rooms.map((r) => getRoomEnergy(r._id));
  const maxEnergy  = Math.max(...energies, 1);
  const getHeatColor = (v) => {
    const ratio = v / maxEnergy;
    if (ratio < 0.3) return "#22c55e";
    if (ratio < 0.6) return "#f97316";
    return "#ef4444";
  };

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
  const roomChartData = {
    labels: rooms.map((r) => r.name),
    datasets: [{ label: "Energy (Wh)", data: energies, backgroundColor: "#22c55e" }]
  };
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

  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="app">

      {/* ── HEADER ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-logo">⚡</span>
          <h1 className="dash-title">Smart Hostel</h1>
        </div>
        <div className="dash-header-right">
          <div className="user-pill">
            <span className={`role-badge ${isAdmin ? "admin" : "user"}`}>
              {isAdmin ? "Admin" : "User"}
            </span>
            <span className="username-label">{user?.username || "–"}</span>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* ── KPI ── */}
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

      {/* ── ALERTS ── */}
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

      {/* ── HEATMAP ── */}
      <section>
        <h2 className="section-title">Room Heatmap</h2>
        <div className="heatmap">
          {rooms.map((room) => {
            const energy = getRoomEnergy(room._id);
            return (
              <button
                key={room._id}
                className={`heat-card ${alertRoomIds.has(room._id) ? "has-alert" : ""}`}
                style={{ background: getHeatColor(energy) }}
                onClick={() => setSelectedRoom(room)}
              >
                <span>{room.name}</span>
                <strong>{energy.toFixed(2)} Wh</strong>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── CHARTS ── */}
      <section className="analytics-grid">
        <div className="card chart-card">
          <h2>Energy by Room</h2>
          <Pie data={roomChartData} />
        </div>
        <div className="card chart-card">
          <h2>Energy by Device</h2>
          <Bar data={deviceChartData} />
        </div>
        <div className="card chart-card wide">
          <h2>Energy Over Time</h2>
          <Line data={timeSeriesChartData} />
        </div>
      </section>

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

    </div>
  );
}

export default App;