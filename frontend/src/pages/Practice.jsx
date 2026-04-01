import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API, { fetchPracticeCategories, fetchPracticeQuestions, savePracticeSession, submitInterview } from "../api";

const FALLBACK_DOMAINS = [
  { id: "general software engineering", label: "Software Engineering" },
  { id: "sql", label: "SQL" },
  { id: "devops", label: "DevOps" },
  { id: "containers and cloud", label: "Containers & Cloud" },
  { id: "data science", label: "Data Science" },
  { id: "ai (data science)", label: "AI (Data Science)" },
  { id: "machine learning", label: "Machine Learning" }
];

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

function sessionAverageScore(items, key, divisor) {
  if (!divisor) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  return Number((total / divisor).toFixed(1));
}

function parseRequestedQuestionCount(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) {
    return null;
  }

  return Math.max(0, parsedValue);
}

function normalizeQuestionCountInput(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return "";
  }

  return String(value).replace(/[^\d]/g, "");
}

export default function Practice() {
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const activeQuestionIdRef = useRef("");
  const questionRequestIdRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [categories, setCategories] = useState(FALLBACK_DOMAINS);
  const [selectedCategory, setSelectedCategory] = useState(FALLBACK_DOMAINS[0].id);
  const [questionCount, setQuestionCount] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answersByQuestion, setAnswersByQuestion] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [sessionResults, setSessionResults] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [speechMode, setSpeechMode] = useState("unsupported");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [questionNotice, setQuestionNotice] = useState("");
  const [status, setStatus] = useState({ loading: true, submitting: false, error: "" });
  const user = getStoredUser();
  const isLoggedIn = Boolean(user?.id);
  const requestedQuestionCount = parseRequestedQuestionCount(questionCount);

  const microphoneButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid rgba(94,234,212,0.35)",
    background: "rgba(94,234,212,0.08)",
    color: "#5eead4",
    cursor: "pointer"
  };

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetchPracticeCategories();
        if (Array.isArray(response) && response.length > 0) {
          setCategories(response);
          setSelectedCategory((current) => current || response[0].id);
        } else {
          setCategories(FALLBACK_DOMAINS);
        }
        setStatus({ loading: false, submitting: false, error: "" });
      } catch (error) {
        setCategories(FALLBACK_DOMAINS);
        setStatus({ loading: false, submitting: false, error: "" });
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadQuestions() {
      if (!isLoggedIn) {
        resetPracticeSession();
        setQuestionNotice("");
        setStatus((current) => ({ ...current, loading: false, error: "" }));
        return;
      }

      if (!selectedCategory) {
        resetPracticeSession();
        setQuestionNotice("");
        return;
      }

      const requestId = questionRequestIdRef.current + 1;
      questionRequestIdRef.current = requestId;
      const requestedCount = parseRequestedQuestionCount(questionCount);

      resetPracticeSession();
      setStatus((current) => ({ ...current, loading: true, error: "" }));

      if (requestedCount === null) {
        setQuestionNotice("");
        setStatus((current) => ({ ...current, loading: false, error: "" }));
        return;
      }

      if (requestedCount === 0) {
        setQuestionNotice("No questions will be shown because the selected question count is 0.");
        setStatus((current) => ({ ...current, loading: false, error: "" }));
        return;
      }

      try {
        const response = await fetchPracticeQuestions(selectedCategory, requestedCount);

        if (questionRequestIdRef.current !== requestId) {
          return;
        }

        setQuestions(response);
        setAnswersByQuestion(Object.fromEntries(response.map((item) => [item.id, ""])));
        setCurrentQuestionIndex(0);
        setActiveQuestionId(response[0]?.id || "");

        if (response.length < requestedCount) {
          const selectedDomainLabel =
            categories.find((item) => item.id === selectedCategory)?.label || "this domain";
          setQuestionNotice(
            `Only ${response.length} question${response.length === 1 ? "" : "s"} are available in ${selectedDomainLabel}, so ${response.length} ${response.length === 1 ? "was" : "were"} loaded.`
          );
        } else {
          setQuestionNotice("");
        }

        setStatus((current) => ({ ...current, loading: false, error: "" }));
      } catch (error) {
        if (questionRequestIdRef.current !== requestId) {
          return;
        }

        resetPracticeSession();
        setQuestionNotice("");
        setStatus((current) => ({
          ...current,
          loading: false,
          error: "Unable to load practice questions for this category right now."
        }));
      }
    }

    loadQuestions();
  }, [selectedCategory, questionCount, categories, isLoggedIn]);

  useEffect(() => {
    activeQuestionIdRef.current = activeQuestionId;
  }, [activeQuestionId]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supportsRecording =
      Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError("");
      };

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index][0].transcript;

          if (event.results[index].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript && activeQuestionIdRef.current) {
          setAnswersByQuestion((current) => {
            const currentAnswer = current[activeQuestionIdRef.current] || "";
            const baseText = currentAnswer.trim();
            const nextText = finalTranscript.trim();
            return {
              ...current,
              [activeQuestionIdRef.current]: baseText ? `${baseText} ${nextText}`.trim() : nextText
            };
          });
        }

        if (interimTranscript) {
          setSpeechError(`Listening... ${interimTranscript.trim()}`);
        } else {
          setSpeechError("");
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          setSpeechError("Microphone access was blocked. Allow microphone permission and try again.");
        } else if (event.error === "no-speech") {
          setSpeechError("No speech detected. Try speaking a little closer to the microphone.");
        } else {
          setSpeechError("Speech recognition stopped unexpectedly. Please try again.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setSpeechMode("recognition");
      setSpeechSupported(true);

      return () => {
        recognition.stop();
      };
    }

    if (supportsRecording) {
      setSpeechMode("recording");
      setSpeechSupported(true);
      return undefined;
    }

    setSpeechMode("unsupported");
    setSpeechSupported(false);
    return undefined;
  }, []);

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const currentQuestion = questions[currentQuestionIndex] || null;
  const selectedDomainLabel =
    categories.find((item) => item.id === selectedCategory)?.label || "Selected Domain";
  const answeredResults = sessionResults.filter((item) => item.status === "answered");
  const sessionProgress = questions.length
    ? Math.min(currentQuestionIndex + 1, questions.length)
    : 0;

  const setAnswerForQuestion = (questionId, value) => {
    setAnswersByQuestion((current) => ({
      ...current,
      [questionId]: value
    }));
  };

  const stopVoiceTools = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const resetPracticeSession = () => {
    setQuestions([]);
    setAnswersByQuestion({});
    setCurrentQuestionIndex(0);
    setActiveQuestionId("");
    setSessionResults([]);
    setSpeechError("");
    setTranscriptionStatus("");
  };

  const finishSession = async (results) => {
    stopVoiceTools();

    const answered = results.filter((item) => item.status === "answered");
    const summary = {
      type: "session_summary",
      domain: selectedDomainLabel,
      requestedQuestionCount,
      totalQuestions: questions.length,
      answeredCount: answered.length,
      skippedCount: results.filter((item) => item.status === "skipped").length,
      totalScore: sessionAverageScore(answered, "totalScore", requestedQuestionCount),
      keywordScore: sessionAverageScore(answered, "keywordScore", requestedQuestionCount),
      semanticScore: sessionAverageScore(answered, "semanticScore", requestedQuestionCount),
      feedback: answered.length
        ? "Practice session complete. Your final score is based on the total requested questions in the session."
        : "Practice session complete. No questions were answered, so the final score is 0.",
      strengths: answered.length
        ? [
          `You completed ${answered.length} out of ${questions.length} question${questions.length === 1 ? "" : "s"}.`,
          "Your final score reflects the average of all answered questions in this session."
        ]
        : ["You moved through the full session, but every question was skipped."],
      improvements: answered.length
        ? ["Review the skipped questions and retry the session to improve your overall average."]
        : ["Answer at least one question next time so the system can compute a meaningful final score."],
      results
    };

    let persistedSummary = summary;

    if (user?.id) {
      try {
        const savedSession = await savePracticeSession({
          userId: user.id,
          domain: summary.domain,
          requestedQuestionCount: summary.requestedQuestionCount,
          totalQuestions: summary.totalQuestions,
          results: summary.results
        });

        persistedSummary = {
          ...summary,
          sessionId: savedSession._id,
          answeredCount: savedSession.answeredCount,
          skippedCount: savedSession.skippedCount,
          keywordScore: savedSession.keywordScore,
          semanticScore: savedSession.semanticScore,
          totalScore: savedSession.totalScore,
          feedback: savedSession.feedback || summary.feedback,
          strengths: savedSession.strengths || summary.strengths,
          improvements: savedSession.improvements || summary.improvements,
          results: Array.isArray(savedSession.results) && savedSession.results.length
            ? savedSession.results.map((item) => ({
              id: item.questionId || item.id || "",
              status: item.status,
              question: item.question,
              answer: item.answer,
              category: item.category,
              subcategory: item.subcategory,
              keywordScore: Number(item.keywordScore || 0),
              semanticScore: Number(item.semanticScore || 0),
              totalScore: Number(item.totalScore || 0),
              feedback: item.feedback || "",
              improvedAnswer: item.improvedAnswer || "",
              strengths: item.strengths || [],
              improvements: item.improvements || []
            }))
            : summary.results
        };
      } catch (error) {
        persistedSummary = {
          ...summary,
          saveError: error.response?.data?.details
            || error.response?.data?.message
            || "The session summary could not be saved to the database."
        };
      }
    }

    localStorage.setItem(
      "latestFeedback",
      JSON.stringify({
        ...persistedSummary,
        viewerUserId: user?.id || null
      })
    );
    navigate("/feedback");
  };

  const moveToNextQuestion = async (nextResults) => {
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      await finishSession(nextResults);
      return;
    }

    const nextQuestion = questions[nextIndex];
    setCurrentQuestionIndex(nextIndex);
    setActiveQuestionId(nextQuestion?.id || "");
    setSpeechError("");
    setTranscriptionStatus("");
    setStatus((current) => ({ ...current, submitting: false, error: "" }));
  };

  const handleRecognitionToggle = (questionId = activeQuestionIdRef.current) => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setSpeechError("Speech recognition is not available in this browser.");
      return;
    }

    if (!questionId) {
      setSpeechError("Focus the current question answer box first.");
      return;
    }

    if (isListening && activeQuestionIdRef.current === questionId) {
      recognition.stop();
      return;
    }

    setActiveQuestionId(questionId);
    activeQuestionIdRef.current = questionId;

    if (isListening) {
      recognition.stop();
    }

    try {
      recognition.start();
    } catch (error) {
      setSpeechError("Speech recognition is already starting. Please wait a moment.");
    }
  };

  const handleRecordedAudio = async (blob, mimeType) => {
    const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
    const formData = new FormData();
    formData.append("audio", blob, `answer-recording.${extension}`);

    setTranscriptionStatus("Uploading audio for transcription...");
    setSpeechError("");

    try {
      const response = await API.post("/api/transcribe", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      const transcript = (response.data?.text || "").trim();

      if (!transcript) {
        setTranscriptionStatus("");
        setSpeechError("The recording was received, but no transcript text came back.");
        return;
      }

      if (!activeQuestionIdRef.current) {
        setTranscriptionStatus("");
        setSpeechError("Focus the current question answer box before adding recorded audio.");
        return;
      }

      setAnswersByQuestion((current) => {
        const currentAnswer = current[activeQuestionIdRef.current] || "";
        const baseText = currentAnswer.trim();
        return {
          ...current,
          [activeQuestionIdRef.current]: baseText ? `${baseText} ${transcript}`.trim() : transcript
        };
      });
      setTranscriptionStatus("Transcription added to your answer.");
    } catch (error) {
      setTranscriptionStatus("");
      setSpeechError(
        error.response?.data?.details ||
        error.response?.data?.message ||
        "Audio upload failed. Make sure the backend is running and OPENAI_API_KEY is configured."
      );
    }
  };

  const startRecording = async (questionId = activeQuestionIdRef.current) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSpeechError("Speech-to-text is not available in this browser.");
      return;
    }

    if (!questionId) {
      setSpeechError("Focus the current question answer box first.");
      return;
    }

    setActiveQuestionId(questionId);
    activeQuestionIdRef.current = questionId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "";

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
        setTranscriptionStatus("Recording in progress...");
        setSpeechError("");
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        const recordedMimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        audioChunksRef.current = [];
        await handleRecordedAudio(audioBlob, recordedMimeType);
      };

      mediaRecorder.start();
    } catch (error) {
      setIsListening(false);
      setTranscriptionStatus("");
      setSpeechError("Microphone access failed. Allow microphone permission and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSpeechToggle = (questionId = activeQuestionIdRef.current) => {
    if (speechMode === "recognition") {
      handleRecognitionToggle(questionId);
      return;
    }

    if (speechMode === "recording") {
      if (isListening) {
        stopRecording();
      } else {
        startRecording(questionId);
      }
      return;
    }

    setSpeechError("Speech-to-text is not available in this browser.");
  };

  const handleSubmitQuestion = async () => {
    if (!user?.id) {
      navigate("/login");
      return;
    }

    if (!currentQuestion) {
      return;
    }

    const answer = (answersByQuestion[currentQuestion.id] || "").trim();
    if (!answer) {
      setStatus((current) => ({
        ...current,
        error: "Write an answer before submitting this question."
      }));
      return;
    }

    setStatus((current) => ({ ...current, submitting: true, error: "" }));

    try {
      const payload = await submitInterview({
        userId: user.id,
        category: currentQuestion.category,
        question: currentQuestion.prompt,
        answer
      });

      const nextResults = [
        ...sessionResults,
        {
          id: currentQuestion.id,
          status: "answered",
          question: currentQuestion.prompt,
          answer,
          category: currentQuestion.category,
          subcategory: currentQuestion.subcategory,
          keywordScore: Number(payload.keywordScore || 0),
          semanticScore: Number(payload.semanticScore || 0),
          totalScore: Number(payload.totalScore || 0),
          feedback: payload.feedback,
          improvedAnswer: payload.improvedAnswer || "",
          strengths: payload.strengths || [],
          improvements: payload.improvements || []
        }
      ];

      setSessionResults(nextResults);
      await moveToNextQuestion(nextResults);
    } catch (error) {
      setStatus((current) => ({
        ...current,
        submitting: false,
        error: error.response?.data?.details
          || error.response?.data?.message
          || "Failed to submit your answer."
      }));
    }
  };

  const handleSkipQuestion = async () => {
    if (!currentQuestion) {
      return;
    }

    const nextResults = [
      ...sessionResults,
      {
        id: currentQuestion.id,
        status: "skipped",
        question: currentQuestion.prompt,
        category: currentQuestion.category,
        subcategory: currentQuestion.subcategory
      }
    ];

    setSessionResults(nextResults);
    await moveToNextQuestion(nextResults);
  };

  return (
    <div style={{ padding: "108px 1.5rem 4rem", maxWidth: 1100, margin: "0 auto" }}>
      <div className="grid-two">
        <section style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "1.5rem"
        }}>
          <div style={{ color: "#5eead4", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Practice Session
          </div>
          <h1 style={{ marginTop: "0.8rem", fontSize: "2rem" }}>Answer one question at a time</h1>
          <p style={{ marginTop: "0.75rem", color: "#94a3b8", lineHeight: 1.6 }}>
            The next question appears only after you submit or skip the current one. Your final session score is the average of answered questions.
          </p>

          <div style={{ marginTop: "1.5rem" }}>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.95rem" }}>
              Select Domain
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                disabled={status.submitting}
                style={{
                  width: "100%",
                  marginTop: "0.85rem",
                  padding: "0.95rem 1rem",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "#0f172a",
                  color: "#f8fafc",
                  fontSize: "0.95rem"
                }}
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.95rem" }}>
              Number of Questions
              <input
                type="text"
                value={questionCount}
                onChange={(event) => setQuestionCount(normalizeQuestionCountInput(event.target.value))}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={status.submitting}
                placeholder="Enter number of questions"
                style={{
                  width: "100%",
                  marginTop: "0.85rem",
                  padding: "0.95rem 1rem",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "#0f172a",
                  color: "#f8fafc",
                  fontSize: "0.95rem"
                }}
              />
            </label>
          </div>

          {!isLoggedIn ? (
            <div style={{ marginTop: "1.25rem", color: "#fbbf24", lineHeight: 1.6 }}>
              You need an account before questions and answers are shown.{" "}
              <Link to="/login" style={{ color: "#5eead4" }}>Log in here</Link>.
            </div>
          ) : (
            <div style={{ marginTop: "1.25rem", color: "#cbd5e1" }}>
              Practicing as <strong>{user.email}</strong>
            </div>
          )}

          <div style={{
            marginTop: "1.25rem",
            padding: "0.9rem 1rem",
            borderRadius: 14,
            background: "rgba(94,234,212,0.08)",
            border: "1px solid rgba(94,234,212,0.16)",
            color: "#cbd5e1",
            lineHeight: 1.6
          }}>
            <strong style={{ color: "#5eead4" }}>Session Progress:</strong>{" "}
            {questions.length ? `${Math.min(currentQuestionIndex, questions.length)}/${questions.length} completed` : "No questions loaded yet"}
          </div>

          <div style={{
            marginTop: "0.75rem",
            padding: "0.9rem 1rem",
            borderRadius: 14,
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.16)",
            color: "#cbd5e1",
            lineHeight: 1.6
          }}>
            <strong style={{ color: "#93c5fd" }}>Answered:</strong> {answeredResults.length}
            <span style={{ marginLeft: "1rem" }}>
              <strong style={{ color: "#93c5fd" }}>Skipped:</strong> {sessionResults.length - answeredResults.length}
            </span>
          </div>

          {questionNotice ? (
            <div style={{ marginTop: "0.75rem", color: "#fbbf24", fontSize: "0.9rem" }}>
              {questionNotice}
            </div>
          ) : null}

          {status.error ? (
            <div style={{ marginTop: "0.75rem", color: "#fca5a5" }}>{status.error}</div>
          ) : null}
        </section>

        <section style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "1.5rem"
        }}>
          <div style={{ color: "#cbd5e1", fontSize: "0.95rem" }}>Voice And Recording Helper</div>
          <h2 style={{ marginTop: "0.75rem", lineHeight: 1.4 }}>
            {!isLoggedIn
              ? "Log in to unlock practice questions"
              : currentQuestion?.prompt || (
              requestedQuestionCount === null
                ? "Questions will appear after you enter a number of questions"
                : requestedQuestionCount === 0
                ? "No questions are shown while the selected question count is 0"
                : "Questions will appear here once the practice session is ready"
            )}
          </h2>

          <div style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.95rem" }}>
            {!isLoggedIn
              ? "Sign in to load questions and start answering."
              : currentQuestion
              ? `Question ${sessionProgress} of ${questions.length} in ${selectedDomainLabel}`
              : requestedQuestionCount === null
                ? `Enter the number of questions for ${selectedDomainLabel}`
                : requestedQuestionCount === 0
                ? `Question selection is set to 0 for ${selectedDomainLabel}`
                : `Waiting for questions from ${selectedDomainLabel}`}
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => handleSpeechToggle()}
              disabled={!isLoggedIn || !speechSupported || !currentQuestion}
              style={{
                padding: "0.8rem 1rem",
                borderRadius: 12,
                border: isListening ? "1px solid rgba(248,113,113,0.55)" : "1px solid rgba(94,234,212,0.35)",
                background: isListening ? "rgba(248,113,113,0.12)" : "rgba(94,234,212,0.08)",
                color: isListening ? "#fca5a5" : "#5eead4",
                fontWeight: 700,
                cursor: isLoggedIn && speechSupported && currentQuestion ? "pointer" : "not-allowed"
              }}
            >
              {isListening ? "Stop Voice Input" : "Start Voice Input"}
            </button>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              {!isLoggedIn
                ? "Log in to answer questions with typing or speech-to-text."
                : speechSupported
                ? speechMode === "recognition"
                  ? "Use your microphone to dictate into the current answer box."
                  : "Record your answer, then it will be transcribed into the current answer box."
                : "Speech-to-text is available in supported browsers like Chrome, Edge, and browsers with microphone recording support."}
            </div>
          </div>

          {speechError ? (
            <div style={{ marginTop: "0.75rem", color: speechError.startsWith("Listening...") ? "#93c5fd" : "#fbbf24", fontSize: "0.9rem" }}>
              {speechError}
            </div>
          ) : null}

          {transcriptionStatus ? (
            <div style={{ marginTop: "0.75rem", color: "#93c5fd", fontSize: "0.9rem" }}>
              {transcriptionStatus}
            </div>
          ) : null}
        </section>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        {status.loading ? (
          <div style={{ color: "#94a3b8" }}>Loading questions...</div>
        ) : currentQuestion ? (
          <section
            style={{
              padding: "1.5rem",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)"
            }}
          >
            <div style={{ color: "#5eead4", fontSize: "0.82rem", marginBottom: "0.55rem" }}>
              {currentQuestion.category}{currentQuestion.subcategory ? ` • ${currentQuestion.subcategory}` : ""}
            </div>
            <h3 style={{ lineHeight: 1.6, fontSize: "1.15rem" }}>{currentQuestion.prompt}</h3>
            <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
              <label
                htmlFor={`answer-${currentQuestion.id}`}
                style={{
                  color: "#cbd5e1",
                  fontSize: "0.92rem",
                  fontWeight: 600
                }}
              >
                Your Answer
              </label>
              <button
                type="button"
                onClick={() => handleSpeechToggle(currentQuestion.id)}
                disabled={!speechSupported}
                aria-label={isListening ? "Stop voice input for this answer" : "Start voice input for this answer"}
                title={speechSupported ? "Use microphone for this answer" : "Speech-to-text is not available in this browser"}
                style={{
                  ...microphoneButtonStyle,
                  border: isListening
                    ? "1px solid rgba(248,113,113,0.55)"
                    : microphoneButtonStyle.border,
                  background: isListening
                    ? "rgba(248,113,113,0.12)"
                    : microphoneButtonStyle.background,
                  color: isListening ? "#fca5a5" : microphoneButtonStyle.color,
                  cursor: speechSupported ? "pointer" : "not-allowed"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 11.5a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 18.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8.5 21.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <textarea
              id={`answer-${currentQuestion.id}`}
              value={answersByQuestion[currentQuestion.id] || ""}
              onFocus={() => setActiveQuestionId(currentQuestion.id)}
              onChange={(event) => {
                setActiveQuestionId(currentQuestion.id);
                setAnswerForQuestion(currentQuestion.id, event.target.value);
              }}
              placeholder="Write your answer for this question..."
              rows={8}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "#0f172a",
                color: "#f8fafc",
                resize: "vertical"
              }}
            />
            <div style={{ marginTop: "0.9rem", color: "#94a3b8", fontSize: "0.92rem" }}>
              Submit to evaluate this answer and move on, or skip to see the next question.
            </div>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={status.submitting}
                onClick={handleSubmitQuestion}
                style={{
                  padding: "0.9rem 1.1rem",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #5eead4, #3b82f6)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {status.submitting ? "Evaluating..." : "Submit Answer"}
              </button>
              <button
                type="button"
                disabled={status.submitting}
                onClick={handleSkipQuestion}
                style={{
                  padding: "0.9rem 1.1rem",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#f87171",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Skip Question
              </button>
            </div>
          </section>
        ) : (
          <div style={{
            padding: "1.5rem",
            borderRadius: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#cbd5e1"
          }}>
            {!isLoggedIn
              ? "Log in to view practice questions and write answers."
              : requestedQuestionCount === null
              ? "No question is shown until you enter the number of questions."
              : requestedQuestionCount === 0
              ? "No question is shown because the selected number of questions is 0."
              : "No current question is available for this practice session."}
          </div>
        )}
      </div>
    </div>
  );
}
