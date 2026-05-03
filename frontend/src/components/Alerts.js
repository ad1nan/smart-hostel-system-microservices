import React, { useEffect, useState } from "react";
import API from "../api";
import io from "socket.io-client";

const GATEWAY_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
const socket = io(GATEWAY_URL);

const getColor = (level) => {
  if (level === "critical") return "#ef4444";
  if (level === "warning") return "#f59e0b";
  return "#38bdf8";
};

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);

  const fetchAlerts = async () => {
    try {
      const res = await API.get("/alerts");
      setAlerts(res.data);
    } catch (err) {
      console.error("Alert fetch error:", err.message);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(fetchAlerts, 10000);

    socket.on("newAlert", (alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    return () => {
      clearInterval(interval);
      socket.off("newAlert");
    };
  }, []);

  return (
    <div className="alerts-container">
      <h2>🚨 Alerts</h2>

      {alerts.length === 0 ? (
        <p className="no-alerts">No alerts detected</p>
      ) : (
        <div className="alerts-grid">
          {alerts.slice(0, 6).map((a) => (
            <div
              key={a._id}
              className="alert-card"
              style={{ borderLeft: `5px solid ${getColor(a.level)}` }}
            >
              <div className="alert-header">
                <strong>{a.level.toUpperCase()}</strong>
                <span>
                  {new Date(a.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <p>{a.message}</p>

              <div className="alert-meta">
                Room: {a.roomId?.name || "N/A"} | Device: {a.deviceId?.type || "N/A"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
