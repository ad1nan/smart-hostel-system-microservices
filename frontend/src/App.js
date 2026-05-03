import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);


function App() {
  // ✅ AUTH STATE
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );


  const token = localStorage.getItem("token");

  let user = null;

  try {
    user = token ? jwtDecode(token) : null;
  } catch (err) {
    console.error("Invalid token");
  }


  // DATA STATES
  const [rooms, setRooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [roomAnalytics, setRoomAnalytics] = useState([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState([]);
  const [timeSeriesAnalytics, setTimeSeriesAnalytics] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [kpi, setKpi] = useState({
    totalEnergy: 0,
    activeDevices: 0,
    activeAlerts: 0,
    topRoom: ""
  });

  // ✅ FETCH DATA (USES API WITH TOKEN INTERCEPTOR)
  const fetchData = useCallback(async () => {
    try {
      const [
        roomsRes,
        devicesRes,
        alertsRes,
        heatmapRes,
        deviceAnalyticsRes,
        timeSeriesRes
      ] = await Promise.all([
        API.get("/rooms"),
        API.get("/devices"),
        API.get("/alerts"),
        API.get("/analytics/heatmap"),
        API.get("/analytics/devices"),
        API.get("/analytics/timeseries")
      ]);

      setRooms(roomsRes.data || []);
      setDevices(devicesRes.data || []);
      setAlerts(alertsRes.data || []);
      setRoomAnalytics(heatmapRes.data || []);
      setDeviceAnalytics(deviceAnalyticsRes.data || []);
      setTimeSeriesAnalytics(timeSeriesRes.data || []);
    } catch (err) {
  console.error("Fetch error:", err.response?.data || err.message);

  // ✅ AUTO LOGOUT IF TOKEN INVALID
  if (err.response?.status === 401) {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  }
}
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchData, isAuthenticated]);

  // ✅ LOGOUT
  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  // ✅ ENERGY
  const getRoomEnergy = (roomId) => {
    const roomData = roomAnalytics.find(
      (item) =>
        item.roomId === roomId ||
        item.roomId?._id === roomId ||
        item._id === roomId
    );

    return Number(roomData?.totalUsage ?? roomData?.totalEnergy ?? 0);
  };

  const energies = rooms.map((room) => getRoomEnergy(room._id));
  const maxEnergy = Math.max(...energies, 1);

  const getColor = (value) => {
    const ratio = value / maxEnergy;
    if (ratio < 0.3) return "#22c55e";
    if (ratio < 0.6) return "#f97316";
    return "#ef4444";
  };

  // ✅ KPI
  useEffect(() => {
    const totalEnergy = roomAnalytics.reduce(
      (sum, r) => sum + Number(r.totalUsage ?? r.totalEnergy ?? 0),
      0
    );

    const activeDevices = devices.filter((d) => d.status).length;

    let maxRoom = "";
    let maxEnergy = 0;

    roomAnalytics.forEach((r) => {
      const usage = Number(r.totalUsage ?? r.totalEnergy ?? 0);
      if (usage > maxEnergy) {
        maxEnergy = usage;
        const room = rooms.find(
          (rm) => rm._id === r.roomId || rm._id === r._id
        );
        maxRoom = room?.name || "";
      }
    });

    setKpi({
      totalEnergy: totalEnergy.toFixed(2),
      activeDevices,
      activeAlerts: alerts.length,
      topRoom: maxRoom
    });
  }, [roomAnalytics, devices, alerts, rooms]);

  // ACTIONS
  const dismissAlert = async (id) => {
  try {
    await API.patch(`/alerts/${id}/resolve`);
    fetchData();
  } catch (err) {
    if (err.response?.status === 403) {
      alert("Access denied: Only admin can resolve alerts");
    } else {
      console.error("Resolve failed:", err.message);
    }
  }
};

const toggleDevice = async (id) => {
  try {
    await API.post(`/devices/toggle/${id}`);
    fetchData();
  } catch (err) {
    if (err.response?.status === 403) {
      alert("Access denied: Only admin can toggle devices");
    } else {
      console.error("Toggle failed:", err.message);
    }
  }
};
  // CHART DATA
  const roomChartData = {
    labels: rooms.map((room) => room.name),
    datasets: [
      {
        label: "Energy",
        data: energies,
        backgroundColor: "#22c55e"
      }
    ]
  };

  const deviceChartData = {
    labels: deviceAnalytics.map((d) => d.deviceType),
    datasets: [
      {
        label: "Energy",
        data: deviceAnalytics.map((d) =>
          Number(d.totalUsage ?? d.totalEnergy ?? 0)
        ),
        backgroundColor: "#3b82f6"
      }
    ]
  };

  const timeSeriesChartData = {
    labels: timeSeriesAnalytics.map((t) => t.period),
    datasets: [
      {
        label: "Energy",
        data: timeSeriesAnalytics.map((t) =>
          Number(t.totalUsage ?? t.totalEnergy ?? 0)
        ),
        borderColor: "#22c55e",
        tension: 0.3
      }
    ]
  };

  const alertRoomIds = useMemo(
    () =>
      new Set(
        alerts
          .map((a) => a.roomId?._id || a.roomId)
          .filter(Boolean)
      ),
    [alerts]
  );

  // ========================= UI =========================

  return (
    <div className="app">

      {/* ✅ LOGIN VIEW */}
      {!isAuthenticated ? (
        <Login onLogin={() => setIsAuthenticated(true)} />
      ) : (
        <>
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h1>Smart Hostel Dashboard</h1>
            <button onClick={logout}>Logout</button>
          </div>

          {/* KPI */}
          <section>
            <h2>Overview</h2>
            <div className="kpi-container">
              <div className="kpi-card"><h3>Total Energy</h3><p>{kpi.totalEnergy} Wh</p></div>
              <div className="kpi-card"><h3>Active Devices</h3><p>{kpi.activeDevices}</p></div>
              <div className="kpi-card"><h3>Active Alerts</h3><p>{kpi.activeAlerts}</p></div>
              <div className="kpi-card"><h3>Top Room</h3><p>{kpi.topRoom || "N/A"}</p></div>
            </div>
          </section>

          {/* ALERTS */}
          <section>
            <h2>Alerts</h2>
            {alerts.length === 0 ? (
              <p>No alerts</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert._id} className={`alert ${alert.level}`}>
                  <span>{alert.message}</span>
                  {user?.role === "admin" && (
  <button onClick={() => dismissAlert(alert._id)}>X</button>
)}
                </div>
              ))
            )}
          </section>

          {/* HEATMAP */}
          <section>
            <h2>Room Heatmap</h2>
            <div className="heatmap">
              {rooms.map((room) => {
                const energy = getRoomEnergy(room._id);

                return (
                  <button
                    key={room._id}
                    className={`heat-card ${
                      alertRoomIds.has(room._id) ? "has-alert" : ""
                    }`}
                    style={{ background: getColor(energy) }}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <span>{room.name}</span>
                    <strong>{energy.toFixed(2)} Wh</strong>
                  </button>
                );
              })}
            </div>
          </section>

          {/* CHARTS */}
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

          {/* MODAL */}
          {selectedRoom && (
            <div className="modal">
              <div className="modal-content">
                <h2>{selectedRoom.name}</h2>

                {devices
                  .filter((device) => {
                    const roomId =
                      typeof device.roomId === "object"
                        ? device.roomId._id
                        : device.roomId;
                    return roomId === selectedRoom._id;
                  })
                  .map((device) => (
                    <div key={device._id} className="device-row">
                      {device.type} - {device.status ? "ON" : "OFF"}
                      {user?.role === "admin" && (
  <button onClick={() => toggleDevice(device._id)}>
    Toggle
  </button>
)}
                    </div>
                  ))}

                <button onClick={() => setSelectedRoom(null)}>Close</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;