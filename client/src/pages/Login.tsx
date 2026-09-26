import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function Login() {
  const login = useAuth((s) => s.login);
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(emailOrUsername, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>✦ Aether</h1>
        <p>Sign in to your community space</p>
        {error && <div className="error">{error}</div>}
        <label>Email or username</label>
        <input
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
