import { Link } from "react-router-dom";

function getStoredUser() {
  const rawUser = localStorage.getItem("user");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    return null;
  }
}

function getLatestFeedback() {
  const user = getStoredUser();
  const rawFeedback = localStorage.getItem("latestFeedback");

  if (!rawFeedback) {
    return null;
  }

  try {
    const parsedFeedback = JSON.parse(rawFeedback);

    if (parsedFeedback?.viewerUserId && parsedFeedback.viewerUserId !== user?.id) {
      return null;
    }

    return parsedFeedback;
  } catch (error) {
    return null;
  }
}

function ScoreCard({ label, value, accent }) {
  return (
    <div style={{
      padding: "1rem",
      borderRadius: 16,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)"
    }}>
      <div style={{ color: "#7f8ea3", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ marginTop: "0.4rem", fontSize: "2rem", fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}

function SessionSummary({ feedback }) {
  return (
    <div style={{ padding: "108px 1.5rem 4rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{
        padding: "1.75rem",
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(94,234,212,0.1), rgba(59,130,246,0.08))",
        border: "1px solid rgba(94,234,212,0.22)"
      }}>
        <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Practice Session Complete
        </div>
        <h1 style={{ marginTop: "0.8rem", fontSize: "2rem" }}>Your final session score</h1>
        <p style={{ marginTop: "0.75rem", color: "#b7c4d4", lineHeight: 1.6 }}>{feedback.feedback}</p>
      <div style={{ marginTop: "0.9rem", color: "#7f8ea3", fontSize: "0.92rem" }}>
        Domain: <span style={{ color: "#d5dee9", fontWeight: 700 }}>{feedback.domain}</span>
      </div>
      {feedback.saveError ? (
        <div style={{ marginTop: "0.85rem", color: "#fbbf24", fontSize: "0.92rem" }}>
          Session summary shown here, but it was not saved to the database: {feedback.saveError}
        </div>
      ) : null}
      </div>

      <div className="grid-three" style={{ marginTop: "1.5rem" }}>
        <ScoreCard label="Final Score" value={feedback.totalScore} accent="#5eead4" />
        <ScoreCard label="Average Keyword Score" value={feedback.keywordScore} accent="#60a5fa" />
        <ScoreCard label="Average Semantic Score" value={feedback.semanticScore} accent="#fbbf24" />
      </div>

      <div className="grid-three" style={{ marginTop: "1rem" }}>
        <ScoreCard label="Total Questions" value={feedback.totalQuestions} accent="#cbd5e1" />
        <ScoreCard label="Answered" value={feedback.answeredCount} accent="#5eead4" />
        <ScoreCard label="Skipped" value={feedback.skippedCount} accent="#fca5a5" />
      </div>

      <div className="grid-two" style={{ marginTop: "1.5rem" }}>
        <section style={{
          padding: "1.5rem",
          borderRadius: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Session Notes</div>
          {feedback.strengths?.map((item) => (
            <div key={item} style={{ color: "#b7c4d4", lineHeight: 1.7, marginBottom: "0.5rem" }}>
              • {item}
            </div>
          ))}

          <div style={{ color: "#5eead4", marginTop: "1.5rem", marginBottom: "0.75rem" }}>Next Improvement</div>
          {feedback.improvements?.map((item) => (
            <div key={item} style={{ color: "#b7c4d4", lineHeight: 1.7, marginBottom: "0.5rem" }}>
              • {item}
            </div>
          ))}
        </section>

        <section style={{
          padding: "1.5rem",
          borderRadius: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Per-Question Results</div>
          <div style={{ display: "grid", gap: "0.85rem" }}>
            {feedback.results?.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                style={{
                  padding: "1rem",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.45)",
                  border: "1px solid rgba(148,163,184,0.16)"
                }}
              >
                <div style={{ color: "#ffffff", fontSize: "0.82rem" }}>
                  Question {index + 1} • {item.category}{item.subcategory ? ` • ${item.subcategory}` : ""}
                </div>
                <div style={{ marginTop: "0.4rem", color: "#ffffff", lineHeight: 1.6 }}>
                  {item.question}
                </div>
                <div style={{ marginTop: "0.6rem", color: item.status === "answered" ? "#5eead4" : "#fbbf24", fontWeight: 700 }}>
                  {item.status === "answered" ? `Answered • Score ${item.totalScore}` : "Skipped"}
                </div>
                {item.feedback ? (
                  <div style={{ marginTop: "0.65rem", color: "#ffffff", lineHeight: 1.6 }}>
                    {item.feedback}
                  </div>
                ) : null}
                {item.improvedAnswer ? (
                  <div style={{ marginTop: "0.65rem", color: "#ffffff", lineHeight: 1.6 }}>
                    Suggested improvement: {item.improvedAnswer}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{
        marginTop: "1.5rem",
        padding: "1.5rem",
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Next Step</div>
        <Link to="/practice" style={{ color: "#5eead4" }}>Start another practice session</Link>
        <div style={{ marginTop: "0.6rem" }}>
          <Link to="/dashboard" style={{ color: "#5eead4" }}>View your dashboard</Link>
        </div>
      </div>
    </div>
  );
}

function SingleFeedback({ feedback }) {
  const scoringLabel = feedback?.source === "semantic_matching"
    ? "Automatic Semantic + Keyword Evaluation"
    : "Automatic Evaluation";

  return (
    <div style={{ padding: "108px 1.5rem 4rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{
        padding: "1.75rem",
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(94,234,212,0.1), rgba(59,130,246,0.08))",
        border: "1px solid rgba(94,234,212,0.22)"
      }}>
        <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Latest Evaluation
        </div>
        <h1 style={{ marginTop: "0.8rem", fontSize: "2rem" }}>Your AI interview feedback</h1>
        <p style={{ marginTop: "0.75rem", color: "#b7c4d4", lineHeight: 1.6 }}>{feedback.feedback}</p>
        <div style={{ marginTop: "0.9rem", color: "#7f8ea3", fontSize: "0.92rem" }}>
          Scored with: <span style={{ color: "#d5dee9", fontWeight: 700 }}>{scoringLabel}</span>
        </div>
      </div>

      <div className="grid-three" style={{ marginTop: "1.5rem" }}>
        <ScoreCard label="Total Score" value={feedback.totalScore} accent="#5eead4" />
        <ScoreCard label="Keyword Score" value={feedback.keywordScore} accent="#60a5fa" />
        <ScoreCard label="Semantic Score" value={feedback.semanticScore} accent="#fbbf24" />
      </div>

      <div className="grid-two" style={{ marginTop: "1.5rem" }}>
        <section style={{
          padding: "1.5rem",
          borderRadius: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Question</div>
          <p style={{ lineHeight: 1.7 }}>{feedback.question}</p>

          {feedback.category ? (
            <>
              <div style={{ color: "#5eead4", marginTop: "1.25rem", marginBottom: "0.75rem" }}>Category</div>
              <p style={{ color: "#b7c4d4", lineHeight: 1.7 }}>{feedback.category}</p>
            </>
          ) : null}

          <div style={{ color: "#5eead4", marginTop: "1.5rem", marginBottom: "0.75rem" }}>Your Answer</div>
          <p style={{ color: "#b7c4d4", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{feedback.answer}</p>

          <div style={{ color: "#5eead4", marginTop: "1.5rem", marginBottom: "0.75rem" }}>Suggested Improvement</div>
          <p style={{ color: "#b7c4d4", lineHeight: 1.8 }}>{feedback.improvedAnswer}</p>
        </section>

        <section style={{ display: "grid", gap: "1rem" }}>
          <div style={{
            padding: "1.5rem",
            borderRadius: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Strengths</div>
            {feedback.strengths?.map((item) => (
              <div key={item} style={{ color: "#b7c4d4", lineHeight: 1.7, marginBottom: "0.5rem" }}>
                • {item}
              </div>
            ))}
          </div>

          <div style={{
            padding: "1.5rem",
            borderRadius: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Areas to Improve</div>
            {feedback.improvements?.map((item) => (
              <div key={item} style={{ color: "#b7c4d4", lineHeight: 1.7, marginBottom: "0.5rem" }}>
                • {item}
              </div>
            ))}
          </div>

          <div style={{
            padding: "1.5rem",
            borderRadius: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}>
            <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Next Step</div>
            <Link to="/practice" style={{ color: "#5eead4" }}>Try another question</Link>
            <div style={{ marginTop: "0.6rem" }}>
              <Link to="/dashboard" style={{ color: "#5eead4" }}>View your dashboard</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Feedback() {
  const feedback = getLatestFeedback();

  if (!feedback) {
    return (
      <div style={{ padding: "120px 1.5rem 4rem", maxWidth: 760, margin: "0 auto" }}>
        <div style={{
          padding: "2rem",
          borderRadius: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <h1>No feedback yet</h1>
          <p style={{ marginTop: "0.75rem", color: "#7f8ea3", lineHeight: 1.6 }}>
            Submit a practice answer first, then this page will show your score breakdown and coaching notes.
          </p>
          <Link to="/practice" style={{ color: "#5eead4" }}>Go to Practice</Link>
        </div>
      </div>
    );
  }

  if (feedback.type === "session_summary") {
    return <SessionSummary feedback={feedback} />;
  }

  return <SingleFeedback feedback={feedback} />;
}
