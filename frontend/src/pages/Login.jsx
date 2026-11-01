import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Disclaimer } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const [pin, setPin]     = useState("");
  const [role, setRole]   = useState("father"); // UI hint only; backend validates the PIN
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(pin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        {/* Branding */}
        <div className="login-logo">
          <div className="login-logo-icon">🏥</div>
          <h1>Family Health Companion</h1>
          <p>Personal Healthcare Management</p>
        </div>

        {/* Role selector (visual only – PIN determines actual role) */}
        <div className="login-role-row">
          <button
            type="button"
            className={`login-role-btn ${role === "father" ? "active" : ""}`}
            onClick={() => setRole("father")}
          >
            👨 Patient
          </button>
          <button
            type="button"
            className={`login-role-btn ${role === "admin" ? "active" : ""}`}
            onClick={() => setRole("admin")}
          >
            🩺 Admin
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <span className="field-label">
              {role === "father" ? "Patient PIN" : "Admin PIN"}
            </span>
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              aria-label="PIN"
              autoFocus
            />
          </div>

          {error && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: ".8rem" }}>
              {error}
            </div>
          )}

          <button className="btn btn-block" disabled={busy || !pin} style={{ marginTop: ".4rem" }}>
            {busy ? "Verifying…" : "Sign In →"}
          </button>
        </form>

        <Disclaimer />
      </div>
    </div>
  );
}
