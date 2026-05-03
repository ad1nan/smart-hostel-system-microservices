import { useState } from "react";
import API from "./api";

export default function Login({ onLogin }) {
  const [tab, setTab]           = useState("login");   // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("user");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const reset = () => { setError(""); setSuccess(""); };

  const handleLogin = async () => {
    reset();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    reset();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await API.post("/auth/register", { username, password, role });
      setSuccess("Account created! You can now log in.");
      setTab("login");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") tab === "login" ? handleLogin() : handleRegister();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo / title */}
        <div className="auth-header">
          <div className="auth-logo">⚡</div>
          <h1 className="auth-title">Smart Hostel</h1>
          <p className="auth-subtitle">Energy Management System</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => { setTab("login"); reset(); }}
          >
            Sign in
          </button>
          <button
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => { setTab("register"); reset(); }}
          >
            Register
          </button>
        </div>

        {/* Fields */}
        <div className="auth-fields">
          <div className="auth-field">
            <label className="auth-label">Username</label>
            <input
              className="auth-input"
              type="text"
              placeholder="Enter username"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              placeholder={tab === "register" ? "Min. 6 characters" : "Enter password"}
              value={password}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>

          {/* Role selector — register only */}
          {tab === "register" && (
            <div className="auth-field">
              <label className="auth-label">Role</label>
              <div className="auth-role-group">
                {["user", "admin"].map((r) => (
                  <button
                    key={r}
                    className={`auth-role-btn ${role === r ? "selected" : ""}`}
                    onClick={() => setRole(r)}
                    type="button"
                  >
                    {r === "admin" ? "👑 Admin" : "👤 User"}
                  </button>
                ))}
              </div>
              {role === "admin" && (
                <p className="auth-role-hint">
                  Admin accounts can toggle devices and resolve alerts.
                </p>
              )}
            </div>
          )}

          {/* Error / success */}
          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {/* Submit */}
          <button
            className="auth-submit"
            onClick={tab === "login" ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading
              ? (tab === "login" ? "Signing in…" : "Creating account…")
              : (tab === "login" ? "Sign in" : "Create account")}
          </button>
        </div>

        {/* Role legend */}
        <div className="auth-legend">
          <div className="auth-legend-row">
            <span className="auth-badge admin">Admin</span>
            <span>View dashboard · Toggle devices · Resolve alerts</span>
          </div>
          <div className="auth-legend-row">
            <span className="auth-badge user">User</span>
            <span>View dashboard · Read-only access</span>
          </div>
        </div>

      </div>
    </div>
  );
}