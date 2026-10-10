import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Disclaimer } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="login">
      <div className="logo" aria-hidden="true">💚</div>
      <h1 className="center">Family Health Companion</h1>
      <p className="center muted">Enter your PIN to continue</p>
      <form onSubmit={submit}>
        <input className="pin" type="password" inputMode="numeric" autoComplete="current-password"
               value={pin} onChange={(e) => setPin(e.target.value)} aria-label="PIN" autoFocus />
        {error && <div className="alert alert-danger" role="alert" style={{ marginTop: ".8rem" }}>{error}</div>}
        <button className="btn btn-block" style={{ marginTop: "1rem" }} disabled={busy || !pin}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
      <Disclaimer />
    </div>
  );
}
