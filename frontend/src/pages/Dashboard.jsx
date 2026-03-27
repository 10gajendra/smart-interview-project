import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import API from "../api";

function SessionDot({ cx, cy, stroke, fill, active = false }) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }

  const radius = active ? 7 : 5.5;
  const ringWidth = active ? 3 : 2;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill}
      stroke={stroke}
      strokeWidth={ringWidth}
    />
  );
}

function getStoredUser() {
  const rawUser = localStorage.getItem("user");
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser);
  } catch (error) {
    return null;
  }
}

function MetricCard({ label, value }) {
  return (
    <div style={{
      padding: "1.25rem",
      borderRadius: 18,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)"
    }}>
      <div style={{ color: "#7f8ea3", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ marginTop: "0.55rem", fontSize: "2rem", fontWeight: 800, color: "#5eead4" }}>{value}</div>
    </div>
  );
}

function formatSessionDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatSessionDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function ProgressChart({ sessions }) {
  if (!sessions?.length) {
    return (
      <div style={{
        minHeight: 330,
        display: "grid",
        placeItems: "center",
        color: "#64748b",
        textAlign: "center",
        lineHeight: 1.7
      }}>
        Complete a few practice sessions and your progress graph will appear here.
      </div>
    );
  }

  const chartData = sessions.map((item) => ({
    ...item,
    label: `S${item.sessionNumber}`,
    shortDate: formatSessionDate(item.createdAt),
    scoreLabel: `${item.score}/100`
  }));

  const latestScore = chartData[chartData.length - 1]?.score ?? 0;

  return (
    <div style={{
      width: "100%",
      borderRadius: 22,
      background: "linear-gradient(180deg, #ffffff 0%, #fbfefb 100%)",
      overflow: "hidden",
      border: "1px solid rgba(148,163,184,0.06)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "1rem",
        padding: "0.15rem 0 0.8rem"
      }}>
        <div>
          <div style={{
            color: "#166534",
            fontSize: "0.78rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em"
          }}>
            Score Progression
          </div>
          <div style={{ marginTop: "0.45rem", color: "#475569", lineHeight: 1.6, fontSize: "0.95rem", maxWidth: 360 }}>
            Each session is marked with a dot and connected by a dotted line to show steady improvement over time.
          </div>
        </div>

        <div style={{
          flexShrink: 0,
          minWidth: 82,
          padding: "0.72rem 1rem",
          borderRadius: 10,
          background: "linear-gradient(180deg, rgba(240,253,244,0.98) 0%, rgba(220,252,231,0.95) 100%)",
          border: "1px solid rgba(34,197,94,0.65)",
          textAlign: "center"
        }}>
          <div style={{ color: "#166534", fontSize: "0.9rem", fontWeight: 500 }}>Latest</div>
          <div style={{ marginTop: "0.18rem", color: "#14532d", fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
            {latestScore}
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: 300, padding: "0 0 0.25rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -24, bottom: 8 }}>
            <defs>
              <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ade80" stopOpacity={0.55} />
                <stop offset="65%" stopColor="#86efac" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#dcfce7" stopOpacity={0.18} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="rgba(148,163,184,0.22)"
              strokeDasharray="2 6"
              vertical={false}
            />

            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 14 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "#64748b", fontSize: 14 }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={{ stroke: "rgba(34,197,94,0.3)", strokeWidth: 1.5, strokeDasharray: "4 4" }}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid rgba(34,197,94,0.15)",
                borderRadius: 14,
                color: "#0f172a",
                boxShadow: "0 8px 24px rgba(15,23,42,0.1)",
                padding: "10px 14px"
              }}
              itemStyle={{ color: "#166534", fontWeight: 600 }}
              labelStyle={{ color: "#0f172a", fontWeight: 700, marginBottom: 4 }}
              formatter={(value, _name, entry) => [entry?.payload?.scoreLabel || `${value}/100`, "Final Score"]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                if (!item) return "";
                return `Session ${item.sessionNumber} • ${item.shortDate} • ${item.domain || "Practice Session"}`;
              }}
            />

            <Area
              type="monotone"
              dataKey="score"
              connectNulls
              baseValue={0}
              isAnimationActive={false}
              stroke="#16a34a"
              strokeWidth={3}
              strokeDasharray="6 6"
              fill="url(#scoreFill)"
              fillOpacity={1}
              dot={<SessionDot stroke="#ffffff" fill="#22c55e" />}
              activeDot={<SessionDot active stroke="#ffffff" fill="#16a34a" />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = getStoredUser();
  const userId = user?.id || "";
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: !!user, error: "" });
  const [expandedSessionId, setExpandedSessionId] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      if (!userId) return;
      try {
        const response = await API.get(`/api/dashboard/${userId}`);
        setData(response.data);
        setExpandedSessionId((current) => current || response.data?.recentInterviews?.[0]?._id || "");
        setStatus({ loading: false, error: "" });
      } catch (error) {
        setStatus({ loading: false, error: "Unable to load dashboard right now." });
      }
    }
    loadDashboard();
  }, [userId]);

  if (!user) {
    return (
      <div style={{ padding: "120px 1.5rem 4rem", maxWidth: 760, margin: "0 auto" }}>
        <div style={{
          padding: "2rem",
          borderRadius: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <h1>Your dashboard is waiting</h1>
          <p style={{ marginTop: "0.75rem", color: "#7f8ea3", lineHeight: 1.6 }}>
            Log in to see session history, average scores, and recent feedback trends.
          </p>
          <Link to="/login" style={{ color: "#5eead4" }}>Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "108px 1.5rem 4rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{
        padding: "1.75rem",
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Progress Dashboard
        </div>
        <h1 style={{ marginTop: "0.8rem", fontSize: "2rem" }}>{user.email}</h1>
        <p style={{ marginTop: "0.75rem", color: "#7f8ea3", lineHeight: 1.6 }}>
          Review your recent practice sessions and keep pushing your average score upward.
        </p>
      </div>

      {status.loading ? (
        <div style={{ marginTop: "1.5rem", color: "#7f8ea3" }}>Loading dashboard...</div>
      ) : status.error ? (
        <div style={{ marginTop: "1.5rem", color: "#fca5a5" }}>{status.error}</div>
      ) : (
        <>
          <div className="grid-three" style={{ marginTop: "1.5rem" }}>
            <MetricCard label="Total Sessions" value={data?.totalSessions || 0} />
            <MetricCard label="Average Score" value={data?.averageScore || 0} />
            <MetricCard label="Best Score" value={data?.bestScore || 0} />
          </div>

          <section style={{
            marginTop: "1.5rem",
            padding: "1.5rem",
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(252,253,252,0.98) 100%)",
            border: "1px solid rgba(148,163,184,0.24)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.04)"
          }}>
            <div style={{ color: "#0f766e", marginBottom: "0.35rem", fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Performance Trend
            </div>
            <div style={{ color: "#334155", lineHeight: 1.6, marginBottom: "1.2rem", fontSize: "1.02rem" }}>
              Track how your final practice-session scores move over time. Each point represents one saved session.
            </div>
            <ProgressChart sessions={data?.sessionHistory || []} />
          </section>

          <div className="grid-two" style={{ marginTop: "1.5rem" }}>
            <section style={{
              padding: "1.5rem",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)"
            }}>
              <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>Latest Coach Summary</div>
              <p style={{ color: "#b7c4d4", lineHeight: 1.8 }}>
                {data?.latestFeedback || "No feedback yet. Submit a practice answer to start building history."}
              </p>
              <Link to="/practice" style={{ display: "inline-block", marginTop: "1rem", color: "#5eead4" }}>
                Start another session
              </Link>
            </section>

            <section style={{
              padding: "1.5rem",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)"
            }}>
              <div style={{ color: "#5eead4", marginBottom: "0.75rem" }}>All Sessions</div>
              {!data?.recentInterviews?.length ? (
                <p style={{ color: "#7f8ea3" }}>No sessions yet.</p>
              ) : data.recentInterviews.map((item) => (
                <div
                  key={item._id}
                  style={{
                    width: "100%",
                    padding: "0.95rem 0",
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                    <div>
                      <strong>{item.domain || item.category || "Practice Session"}</strong>
                      <div style={{ marginTop: "0.35rem", color: "#b7c4d4", lineHeight: 1.6 }}>
                        {`${item.answeredCount || 0} answered • ${item.skippedCount || 0} skipped • ${formatSessionDate(item.createdAt)}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.45rem" }}>
                      <span style={{ color: "#5eead4" }}>{item.totalScore}/100</span>
                      <button
                        type="button"
                        onClick={() => setExpandedSessionId((current) => current === item._id ? "" : item._id)}
                        style={{
                          padding: "0.42rem 0.8rem",
                          borderRadius: 999,
                          border: "1px solid rgba(94,234,212,0.28)",
                          background: "rgba(94,234,212,0.08)",
                          color: "#93c5fd",
                          cursor: "pointer",
                          fontSize: "0.86rem"
                        }}
                      >
                        {expandedSessionId === item._id ? "Hide session details" : "View session details"}
                      </button>
                    </div>
                  </div>
                  {expandedSessionId === item._id ? (
                    <div style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      borderRadius: 16,
                      background: "rgba(15,23,42,0.35)",
                      border: "1px solid rgba(148,163,184,0.2)"
                    }}>
                      <div style={{ color: "#e2e8f0", fontWeight: 700 }}>
                        {item.domain || item.category || "Practice Session"}
                      </div>
                      <div style={{ marginTop: "0.35rem", color: "#7f8ea3", fontSize: "0.92rem", lineHeight: 1.6 }}>
                        {formatSessionDateTime(item.createdAt)} • Final Score {item.totalScore}/100
                      </div>

                      {!item.results?.length ? (
                        <div style={{ marginTop: "0.9rem", color: "#7f8ea3" }}>
                          No question details were saved for this session.
                        </div>
                      ) : item.results.map((result, index) => (
                        <div
                          key={`${item._id}-${result.questionId || index}`}
                          style={{
                            marginTop: "0.95rem",
                            padding: "0.95rem 1rem",
                            borderRadius: 14,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                            <div style={{ color: "#f8fafc", fontWeight: 600, lineHeight: 1.6 }}>
                              {`Question ${index + 1}: ${result.question || "Question unavailable"}`}
                            </div>
                            <div style={{
                              flexShrink: 0,
                              padding: "0.24rem 0.6rem",
                              borderRadius: 999,
                              fontSize: "0.78rem",
                              background: result.status === "answered" ? "rgba(34,197,94,0.16)" : "rgba(251,191,36,0.16)",
                              color: result.status === "answered" ? "#86efac" : "#fde68a",
                              border: result.status === "answered" ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(251,191,36,0.24)"
                            }}>
                              {result.status === "answered" ? "Answered" : "Skipped"}
                            </div>
                          </div>

                          <div style={{ marginTop: "0.7rem", color: "#b7c4d4", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                            <strong style={{ color: "#5eead4" }}>Answer:</strong>{" "}
                            {result.answer?.trim() || "No answer was submitted for this question."}
                          </div>

                          <div style={{
                            marginTop: "0.85rem",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: "0.65rem"
                          }}>
                            <div style={{ padding: "0.75rem", borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                              <div style={{ color: "#7f8ea3", fontSize: "0.82rem" }}>Final Score</div>
                              <div style={{ marginTop: "0.28rem", color: "#5eead4", fontSize: "1.2rem", fontWeight: 700 }}>
                                {Number(result.totalScore || 0)}/100
                              </div>
                            </div>
                            <div style={{ padding: "0.75rem", borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                              <div style={{ color: "#7f8ea3", fontSize: "0.82rem" }}>Keyword Score</div>
                              <div style={{ marginTop: "0.28rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
                                {Number(result.keywordScore || 0)}/100
                              </div>
                            </div>
                            <div style={{ padding: "0.75rem", borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                              <div style={{ color: "#7f8ea3", fontSize: "0.82rem" }}>Semantic Score</div>
                              <div style={{ marginTop: "0.28rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
                                {Number(result.semanticScore || 0)}/100
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
