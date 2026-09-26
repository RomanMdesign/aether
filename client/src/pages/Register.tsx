import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function Register() {
  const register = useAuth((s) => s.register);
  const [form, setForm] = useState({
    email: "",
    username: "",
    displayName: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Join Aether</h1>
        <p>Create your account</p>
        {error && <div className="error">{error}</div>}
        <label>Display name</label>
        <input
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          required
        />
        <label>Username</label>
        <input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          pattern="[a-zA-Z0-9_]+"
          required
        />
        <label>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <label>Password (min 8)</label>
        <input
          type="password"
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
