const features = [
  {
    title: "Account-based practice",
    description: "Users can register, log in, and keep their own interview session history."
  },
  {
    title: "Live backend integration",
    description: "The frontend now loads questions, submits answers, and reads dashboard summaries from the API."
  },
  {
    title: "Instant scoring feedback",
    description: "Each answer gets a keyword score, semantic score, total score, and targeted coaching notes."
  },
  {
    title: "Progress dashboard",
    description: "Recent sessions, best score, average score, and latest feedback are all shown in one place."
  }
];

export default function Features() {
  return (
    <div style={{ padding: "108px 1.5rem 4rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Platform Features
        </div>
        <h1 style={{ marginTop: "0.8rem", fontSize: "2.5rem" }}>What the app can do right now</h1>
        <p style={{ marginTop: "0.9rem", color: "#475569", lineHeight: 1.7 }}>
          This page reflects the working product flow that is currently wired between your frontend and backend.
        </p>
      </div>

      <div style={{ marginTop: "1.75rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {features.map((item) => (
          <div
            key={item.title}
            style={{
              padding: "1.5rem",
              borderRadius: 20,
              background: "rgba(255,255,255,0.84)",
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 18px 40px rgba(15,23,42,0.05)"
            }}
          >
            <h2 style={{ fontSize: "1.1rem" }}>{item.title}</h2>
            <p style={{ marginTop: "0.75rem", color: "#475569", lineHeight: 1.7 }}>{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
