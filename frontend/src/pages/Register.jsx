import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";

const cardStyle = {
  width: "min(460px, 100%)",
  margin: "120px auto 0",
  padding: "2rem",
  borderRadius: 20,
  background: "rgba(255,255,255,0.84)",
  border: "1px solid rgba(148,163,184,0.2)",
  boxShadow: "0 24px 50px rgba(15,23,42,0.08)"
};

const inputStyle = {
  width: "100%",
  padding: "0.95rem 1rem",
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "#ffffff",
  color: "#0f172a",
  marginTop: "0.5rem"
};

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ loading: false, error: "" });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "" });

    try {
      const response = await API.post("/api/auth/register", form);
      localStorage.removeItem("latestFeedback");
      localStorage.setItem("user", JSON.stringify(response.data));
      window.dispatchEvent(new Event("user-auth-changed"));
      navigate("/practice");
    } catch (error) {
      const message = !error.response
        ? "Cannot reach backend at http://localhost:5000. Start the backend server and try again."
        : error.response?.data?.details
          || error.response?.data?.message
          || "Registration failed. Please try again.";

      setStatus({
        loading: false,
        error: message
      });
      return;
    }

    setStatus({ loading: false, error: "" });
  };

  return (
    <div style={{ padding: "0 1.5rem 4rem" }}>
      <form style={cardStyle} onSubmit={handleRegister}>
        <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Get Started
        </div>
        <h1 style={{ marginTop: "0.8rem", fontSize: "2rem" }}>Create your practice account</h1>
        <p style={{ marginTop: "0.75rem", color: "#475569", lineHeight: 1.6 }}>
          Save your interview attempts, review feedback, and track improvement over time.
        </p>

        <label style={{ display: "block", marginTop: "1.5rem", color: "#334155" }}>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            style={inputStyle}
            required
          />
        </label>

        <label style={{ display: "block", marginTop: "1rem", color: "#334155" }}>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Choose a password"
            style={inputStyle}
            required
          />
        </label>

        {status.error ? (
          <div style={{ marginTop: "1rem", color: "#fca5a5", fontSize: "0.95rem" }}>{status.error}</div>
        ) : null}

        <button
          type="submit"
          disabled={status.loading}
          style={{
            marginTop: "1.5rem",
            width: "100%",
            padding: "0.95rem 1rem",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #5eead4, #3b82f6)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          {status.loading ? "Creating account..." : "Create Account"}
        </button>

        <p style={{ marginTop: "1rem", color: "#475569" }}>
          Already registered?{" "}
          <Link to="/login" style={{ color: "#5eead4" }}>
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
