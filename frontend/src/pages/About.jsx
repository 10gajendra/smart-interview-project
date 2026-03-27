export default function About() {
  return (
    <div style={{ padding: "108px 1.5rem 4rem", maxWidth: 960, margin: "0 auto" }}>
      <div style={{
        padding: "2rem",
        borderRadius: 24,
        background: "rgba(255,255,255,0.84)",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.05)"
      }}>
        <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          About The Project
        </div>
        <h1 style={{ marginTop: "0.8rem", fontSize: "2.4rem" }}>AI Interview Coach</h1>
        <p style={{ marginTop: "1rem", color: "#334155", lineHeight: 1.8 }}>
          This application helps users practice interview questions, submit answers, receive instant feedback,
          and track performance across sessions.
        </p>
        <p style={{ marginTop: "1rem", color: "#475569", lineHeight: 1.8 }}>
          The current stack uses a React frontend, an Express and MongoDB backend, and a scoring flow that returns
          structured feedback for each interview attempt.
        </p>
      </div>
    </div>
  );
}
