const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");

const User = require("./models/User");
const Interview = require("./models/Interview");
const PracticeSession = require("./models/PracticeSession");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/interviewDB-backup";
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
const SESSION_FEEDBACK_MODEL = process.env.OPENAI_SESSION_FEEDBACK_MODEL || "gpt-4.1-mini";
const TRANSCRIPTION_PROVIDER = (process.env.TRANSCRIPTION_PROVIDER || "auto").toLowerCase();
const LOCAL_TRANSCRIPTION_MODEL = process.env.LOCAL_TRANSCRIPTION_MODEL || "anish-shilpakar/wav2vec2-nepali";
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SCORER_PYTHON = path.join(
  REPO_ROOT,
  "training model",
  "trained model",
  "model",
  "venv",
  "bin",
  "python"
);
const SCORER_PYTHON = process.env.INTERVIEW_SCORER_PYTHON || DEFAULT_SCORER_PYTHON;
const SCORER_SCRIPT = path.join(REPO_ROOT, "ml_models", "evaluate", "score_answer.py");
const SEMANTIC_SCORER_SCRIPT = path.join(REPO_ROOT, "ml_models", "evaluate", "semantic_score_answer.py");
const PRACTICE_CATALOG_SCRIPT = path.join(REPO_ROOT, "ml_models", "evaluate", "practice_catalog.py");
const LOCAL_TRANSCRIBE_SCRIPT = path.join(REPO_ROOT, "ml_models", "evaluate", "transcribe_speech.py");
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

let mongoConnectionError = "";

mongoose.connect(MONGODB_URI)
  .then(() => {
    mongoConnectionError = "";
    console.log("MongoDB connected");
  })
  .catch((err) => {
    mongoConnectionError = err.message;
    console.error("MongoDB connection failed:", err.message);
  });

mongoose.connection.on("connected", () => {
  mongoConnectionError = "";
});

mongoose.connection.on("error", (err) => {
  mongoConnectionError = err.message;
});

mongoose.connection.on("disconnected", () => {
  if (!mongoConnectionError) {
    mongoConnectionError = "MongoDB is disconnected.";
  }
});

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function getMongoStatus() {
  const readyStateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  return {
    ready: isMongoReady(),
    state: readyStateMap[mongoose.connection.readyState] || "unknown",
    error: mongoConnectionError || ""
  };
}

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeywords(question, answer) {
  const combined = normalizeText(`${question} ${answer}`);
  const defaultKeywords = combined
    .split(" ")
    .filter((word) => word.length > 4);

  if (combined.includes("react")) {
    return ["state", "props", "component", "data", "ui"];
  }
  if (combined.includes("rest")) {
    return ["resource", "endpoint", "http", "crud", "client", "server"];
  }
  if (combined.includes("index")) {
    return ["query", "speed", "read", "write", "storage", "performance"];
  }

  return Array.from(new Set(defaultKeywords)).slice(0, 6);
}

function formatStructuredFeedback(strengths, weaknesses, suggestions) {
  const strengthText = strengths[0] || "The answer addresses the question and shows some relevant understanding.";
  const weaknessText = weaknesses[0] || "The response could be clearer and more complete in covering the core concepts.";
  const suggestionText = suggestions[0] || "Open with a direct answer, then support it with one clear example or key detail.";

  return [
    `Strengths: ${strengthText}`,
    `Weaknesses: ${weaknessText}`,
    `Suggestions: ${suggestionText}`
  ].join(" ");
}

function buildFeedback(question, answer) {
  const trimmedAnswer = (answer || "").trim();
  const wordCount = trimmedAnswer ? trimmedAnswer.split(/\s+/).length : 0;
  const keywords = getKeywords(question, answer);
  const matchedKeywords = keywords.filter((keyword) =>
    normalizeText(answer).includes(keyword)
  );

  const keywordScore = Math.min(
    100,
    Math.round((matchedKeywords.length / Math.max(keywords.length, 1)) * 100)
  );

  const lengthScore = Math.min(100, Math.round((wordCount / 80) * 100));
  const semanticScore = Math.round((keywordScore * 0.65) + (lengthScore * 0.35));
  const weightSemantic = semanticScore / 100;
  const weightKeyword = 1 - weightSemantic;
  const totalScore = Math.round((weightKeyword * keywordScore) + (weightSemantic * semanticScore));

  const strengths = [];
  const improvements = [];
  const weaknesses = [];

  if (matchedKeywords.length >= Math.ceil(keywords.length / 2)) {
    strengths.push("You covered several role-relevant keywords from the prompt.");
  } else {
    improvements.push("Bring in more topic-specific terms that directly answer the question.");
    weaknesses.push("The answer misses some of the key concepts needed to fully address the question.");
  }

  if (wordCount >= 45) {
    strengths.push("Your answer has enough detail to show reasoning, not just a short definition.");
  } else {
    improvements.push("Add more concrete detail, structure, and one short example.");
    weaknesses.push("The response is a bit brief and could use more explanation and supporting detail.");
  }

  if (!strengths.length) {
    strengths.push("Your answer addresses the topic and gives the evaluator something to score.");
  }

  if (!improvements.length) {
    improvements.push("Tighten the structure so your strongest point appears in the first two sentences.");
  }
  if (!weaknesses.length) {
    weaknesses.push("The answer is relevant overall, but a few ideas could be explained more precisely.");
  }

  const improvedAnswer = [
    "Start with a direct answer to the question.",
    `Mention key ideas such as ${keywords.slice(0, 3).join(", ")}.`,
    "Close with a brief example or tradeoff to show practical understanding."
  ].join(" ");

  const feedback = formatStructuredFeedback(strengths, weaknesses, improvements);

  return {
    keywordScore,
    semanticScore,
    totalScore,
    feedback,
    improvedAnswer,
    strengths,
    improvements
  };
}

function averageScore(items, key, divisor) {
  if (!divisor) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  return Number((total / divisor).toFixed(1));
}

function buildSessionFeedbackFallback({ domain, requestedQuestionCount, totalQuestions, results }) {
  const answered = results.filter((item) => item.status === "answered");
  const skipped = results.filter((item) => item.status === "skipped");
  const answeredCount = answered.length;
  const skippedCount = skipped.length;
  const totalScore = averageScore(answered, "totalScore", requestedQuestionCount);
  const keywordScore = averageScore(answered, "keywordScore", requestedQuestionCount);
  const semanticScore = averageScore(answered, "semanticScore", requestedQuestionCount);
  const strongestAnswer = answered.length
    ? answered.reduce((best, item) => (Number(item.totalScore || 0) > Number(best.totalScore || 0) ? item : best), answered[0])
    : null;
  const weakestAnswer = answered.length
    ? answered.reduce((worst, item) => (Number(item.totalScore || 0) < Number(worst.totalScore || 0) ? item : worst), answered[0])
    : null;

  const strengths = [];
  const improvements = [];

  if (answeredCount > 0) {
    strengths.push(
      `You answered ${answeredCount} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} in the ${domain} session.`
    );
    if (semanticScore >= 70) {
      strengths.push("Your answers were generally relevant to the prompts and stayed on-topic.");
    } else {
      improvements.push("Make each answer more directly aligned to the exact wording of the question.");
    }

    if (keywordScore >= 65) {
      strengths.push("You used a solid amount of domain-specific vocabulary across the session.");
    } else {
      improvements.push("Include more role-specific terms, concepts, and examples to strengthen your answers.");
    }

    if (skippedCount > 0) {
      improvements.push(
        `You skipped ${skippedCount} question${skippedCount === 1 ? "" : "s"}; answering those would raise your session average.`
      );
    }

    if (weakestAnswer) {
      improvements.push(
        `Rework your lowest-scoring answer${weakestAnswer.category ? ` in ${weakestAnswer.category}` : ""} by adding structure, accuracy, and one practical example.`
      );
    }
  } else {
    strengths.push("You completed the full flow for this practice session.");
    improvements.push("Answer at least one question so the app can generate meaningful coaching.");
  }

  if (!strengths.length) {
    strengths.push("You completed a practice session and created a baseline to improve from.");
  }

  if (!improvements.length) {
    improvements.push("Keep practicing and add one clearer example in each answer to push your score higher.");
  }

  const summaryParts = [];
  if (answeredCount > 0) {
    summaryParts.push(
      `You finished a ${domain} session with a total score of ${totalScore}/100 across ${answeredCount} answered question${answeredCount === 1 ? "" : "s"}.`
    );
    if (strongestAnswer) {
      summaryParts.push(
        `Your strongest response scored ${Number(strongestAnswer.totalScore || 0)}/100${strongestAnswer.category ? ` in ${strongestAnswer.category}` : ""}.`
      );
    }
    if (skippedCount > 0) {
      summaryParts.push(
        `${skippedCount} question${skippedCount === 1 ? "" : "s"} were skipped, which lowered the overall average for the session.`
      );
    }
  } else {
    summaryParts.push("This session ended without any answered questions, so the final score is 0/100.");
  }

  return {
    feedback: summaryParts.join(" "),
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    keywordScore,
    semanticScore,
    totalScore,
    answeredCount,
    skippedCount,
    totalQuestions: Number(totalQuestions || requestedQuestionCount || results.length || 0)
  };
}

function normalizeSessionAiResponse(data, fallback) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const strengths = Array.isArray(data.strengths)
    ? data.strengths.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 3)
    : fallback.strengths;
  const improvements = Array.isArray(data.improvements)
    ? data.improvements.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 3)
    : fallback.improvements;

  return {
    ...fallback,
    feedback: typeof data.feedback === "string" && data.feedback.trim()
      ? data.feedback.trim()
      : fallback.feedback,
    strengths: strengths.length ? strengths : fallback.strengths,
    improvements: improvements.length ? improvements : fallback.improvements
  };
}

async function generateSessionFeedback(sessionInput) {
  const fallback = buildSessionFeedbackFallback(sessionInput);

  if (!openai) {
    return fallback;
  }

  const compactResults = sessionInput.results.map((item, index) => ({
    questionNumber: index + 1,
    status: item.status,
    category: item.category || "",
    subcategory: item.subcategory || "",
    question: item.question || "",
    answer: item.answer || "",
    keywordScore: Number(item.keywordScore || 0),
    semanticScore: Number(item.semanticScore || 0),
    totalScore: Number(item.totalScore || 0),
    feedback: item.feedback || ""
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: SESSION_FEEDBACK_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "session_feedback",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              feedback: { type: "string" },
              strengths: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 3
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 3
              }
            },
            required: ["feedback", "strengths", "improvements"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content: [
            "You are an interview coach generating concise session feedback.",
            "Return only JSON matching the schema.",
            "Base the coaching on the provided session results.",
            "Keep the feedback supportive, specific, and grounded in the actual scores and answers.",
            "Do not invent technologies, questions, or achievements that are not present."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            domain: sessionInput.domain,
            requestedQuestionCount: sessionInput.requestedQuestionCount,
            totalQuestions: sessionInput.totalQuestions,
            aggregate: {
              answeredCount: fallback.answeredCount,
              skippedCount: fallback.skippedCount,
              keywordScore: fallback.keywordScore,
              semanticScore: fallback.semanticScore,
              totalScore: fallback.totalScore
            },
            results: compactResults
          })
        }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "";
    return normalizeSessionAiResponse(JSON.parse(content), fallback);
  } catch (error) {
    console.warn("OpenAI session feedback unavailable, using fallback:", error.message);
    return fallback;
  }
}

function runPythonScript(scriptPath, args, options = {}) {
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 15000;
  const maxBuffer = Number.isFinite(options.maxBuffer) ? options.maxBuffer : 1024 * 1024;

  return new Promise((resolve, reject) => {
    execFile(
      SCORER_PYTHON,
      [scriptPath, ...args],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PYTHONPATH: [REPO_ROOT, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)
        },
        timeout,
        maxBuffer
      },
      (error, stdout, stderr) => {
        if (error) {
          const details = stderr || error.message;
          reject(new Error(details.trim()));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(new Error(`Failed to parse scorer response: ${parseError.message}`));
        }
      }
    );
  });
}

function getAudioFileExtension(mimeType = "") {
  const map = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a"
  };

  return map[mimeType] || ".webm";
}

async function transcribeWithLocalModel(file) {
  const extension = getAudioFileExtension(file.mimetype);
  const tempFilePath = path.join(
    os.tmpdir(),
    `interview-audio-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`
  );

  await fs.writeFile(tempFilePath, file.buffer);

  try {
    const result = await runPythonScript(
      LOCAL_TRANSCRIBE_SCRIPT,
      ["--audio-path", tempFilePath, "--model-name", LOCAL_TRANSCRIPTION_MODEL],
      { timeout: 180000, maxBuffer: 5 * 1024 * 1024 }
    );
    return result.text || "";
  } finally {
    await fs.unlink(tempFilePath).catch(() => {});
  }
}

function runKeywordScorer(question, answer) {
  return runPythonScript(SCORER_SCRIPT, ["--question", question, "--answer", answer]);
}

function runSemanticScorer(question, answer) {
  return runPythonScript(SEMANTIC_SCORER_SCRIPT, ["--question", question, "--answer", answer]);
}

function runPracticeCatalog(args) {
  return runPythonScript(PRACTICE_CATALOG_SCRIPT, args);
}

async function scoreInterviewAnswer(question, answer) {
  try {
    const result = await runSemanticScorer(question, answer);
    return {
      keywordScore: result.keywordScore,
      semanticScore: result.semanticScore,
      totalScore: result.totalScore,
      feedback: result.feedback,
      improvedAnswer: result.improvedAnswer,
      strengths: result.strengths || [],
      improvements: result.improvements || []
    };
  } catch (err) {
    console.warn("Semantic scorer unavailable, trying keyword scorer:", err.message);
    try {
      const result = await runKeywordScorer(question, answer);
      return {
        keywordScore: result.keywordScore,
        semanticScore: result.semanticScore,
        totalScore: result.totalScore,
        feedback: result.feedback,
        improvedAnswer: result.improvedAnswer,
        strengths: result.strengths || [],
        improvements: result.improvements || []
      };
    } catch (keywordErr) {
      console.warn("Keyword scorer unavailable, falling back to JS heuristic:", keywordErr.message);
    }
    return buildFeedback(question, answer);
  }
}

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "API is healthy",
    mongo: getMongoStatus()
  });
});

app.get("/api/scoring/health", async (_req, res) => {
  const pythonBinaryExists = require("fs").existsSync(SCORER_PYTHON);

  const [keywordResult, semanticResult] = await Promise.allSettled([
    runPythonScript(SCORER_SCRIPT, ["--health"]),
    runPythonScript(SEMANTIC_SCORER_SCRIPT, ["--health"])
  ]);

  res.json({
    ok: true,
    pythonBinary: SCORER_PYTHON,
    pythonBinaryExists,
    keywordScorer: keywordResult.status === "fulfilled"
      ? keywordResult.value
      : { ok: false, error: keywordResult.reason.message },
    semanticScorer: semanticResult.status === "fulfilled"
      ? semanticResult.value
      : { ok: false, error: semanticResult.reason.message }
  });
});

app.get("/api/practice/categories", async (_req, res) => {
  try {
    const result = await runPracticeCatalog(["--categories"]);
    return res.json(result.categories || []);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load practice categories." });
  }
});

app.get("/api/questions", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const args = ["--questions"];
    if (category) {
      args.push("--category", String(category));
    }
    if (limit) {
      args.push("--limit", String(limit));
    }

    const result = await runPracticeCatalog(args);
    return res.json(result.questions || []);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load practice questions." });
  }
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Audio file is required." });
    }

    const provider = TRANSCRIPTION_PROVIDER;
    const isLocalEnabled = provider === "local" || provider === "auto";
    const isOpenAIEnabled = provider === "openai" || provider === "auto";

    if (isLocalEnabled) {
      try {
        const text = await transcribeWithLocalModel(req.file);
        return res.json({ text, provider: "local" });
      } catch (localErr) {
        if (provider === "local") {
          return res.status(500).json({
            message: "Failed to transcribe audio with local model.",
            details: localErr.message
          });
        }
        console.warn("Local transcription failed, trying OpenAI fallback:", localErr.message);
      }
    }

    if (!isOpenAIEnabled) {
      return res.status(500).json({
        message: "Invalid transcription provider. Use one of: local, openai, auto."
      });
    }

    if (!openai) {
      return res.status(503).json({
        message: "OpenAI transcription is not configured. Set OPENAI_API_KEY or use TRANSCRIPTION_PROVIDER=local."
      });
    }

    const file = await toFile(req.file.buffer, req.file.originalname || "recording.webm", {
      type: req.file.mimetype || "audio/webm"
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: TRANSCRIPTION_MODEL,
      response_format: "text"
    });

    return res.json({
      text: typeof transcription === "string" ? transcription : transcription.text || "",
      provider: "openai"
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to transcribe audio.",
      details: err.message
    });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isMongoReady()) {
      const mongo = getMongoStatus();
      return res.status(503).json({
        message: "Registration is unavailable because MongoDB is not connected.",
        details: mongo.error || `MongoDB state: ${mongo.state}`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    const user = await User.create({ email, password });
    return res.status(201).json({
      id: user._id,
      email: user.email,
      createdAt: user.createdAt
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to register user.",
      details: err.message
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isMongoReady()) {
      const mongo = getMongoStatus();
      return res.status(503).json({
        message: "Login is unavailable because MongoDB is not connected.",
        details: mongo.error || `MongoDB state: ${mongo.state}`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    return res.json({
      id: user._id,
      email: user.email,
      createdAt: user.createdAt
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to log in.",
      details: err.message
    });
  }
});

app.post("/api/interviews", async (req, res) => {
  try {
    const { userId, category, question, answer } = req.body;

    if (!isMongoReady()) {
      const mongo = getMongoStatus();
      return res.status(503).json({
        message: "Interview saving is unavailable because MongoDB is not connected.",
        details: mongo.error || `MongoDB state: ${mongo.state}`
      });
    }

    if (!userId || !question || !answer) {
      return res.status(400).json({ message: "userId, question, and answer are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ message: "Invalid user id.", details: "The saved login session is stale. Please log in again." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const scores = await scoreInterviewAnswer(question, answer);
    const interview = await Interview.create({
      userId,
      category: category || "General",
      question,
      answer,
      ...scores
    });

    return res.status(201).json(interview);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to save interview.",
      details: err.message
    });
  }
});

app.post("/api/interviews/score-semantic", async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: "question and answer are required." });
    }

    const scores = await scoreInterviewAnswer(question, answer);
    return res.json(scores);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to score answer with the semantic model.",
      details: err.message
    });
  }
});

app.get("/api/interviews", async (req, res) => {
  try {
    const { userId } = req.query;
    const query = userId ? { userId } : {};
    const interviews = await Interview.find(query).sort({ createdAt: -1 }).lean();
    return res.json(interviews);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch interviews." });
  }
});

app.post("/api/practice-sessions", async (req, res) => {
  try {
    const {
      userId,
      domain,
      requestedQuestionCount,
      totalQuestions,
      results
    } = req.body;

    if (!isMongoReady()) {
      const mongo = getMongoStatus();
      return res.status(503).json({
        message: "Practice session saving is unavailable because MongoDB is not connected.",
        details: mongo.error || `MongoDB state: ${mongo.state}`
      });
    }

    if (!userId || !domain || !requestedQuestionCount || !Array.isArray(results)) {
      return res.status(400).json({
        message: "userId, domain, requestedQuestionCount, and results are required."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({
        message: "Invalid user id.",
        details: "The saved login session is stale. Please log in again."
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const normalizedResults = results.map((item) => ({
      questionId: item.id || item.questionId || "",
      status: item.status,
      question: item.question || "",
      answer: item.answer || "",
      category: item.category || "",
      subcategory: item.subcategory || "",
      keywordScore: Number(item.keywordScore || 0),
      semanticScore: Number(item.semanticScore || 0),
      totalScore: Number(item.totalScore || 0),
      feedback: item.feedback || "",
      improvedAnswer: item.improvedAnswer || "",
      strengths: Array.isArray(item.strengths) ? item.strengths.filter(Boolean) : [],
      improvements: Array.isArray(item.improvements) ? item.improvements.filter(Boolean) : []
    }));

    const sessionFeedback = await generateSessionFeedback({
      domain,
      requestedQuestionCount: Number(requestedQuestionCount),
      totalQuestions: Number(totalQuestions || requestedQuestionCount || normalizedResults.length),
      results: normalizedResults
    });

    const session = await PracticeSession.create({
      userId,
      domain,
      requestedQuestionCount,
      totalQuestions: totalQuestions || requestedQuestionCount,
      feedback: sessionFeedback.feedback,
      strengths: sessionFeedback.strengths,
      improvements: sessionFeedback.improvements,
      results: normalizedResults
    });

    return res.status(201).json(session);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to save practice session.",
      details: err.message
    });
  }
});

app.get("/api/dashboard/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await PracticeSession.find({ userId }).sort({ createdAt: -1 }).lean();

    const totalSessions = sessions.length;
    const averageScore = totalSessions
      ? Math.round(sessions.reduce((sum, item) => sum + (item.totalScore || 0), 0) / totalSessions)
      : 0;

    const bestScore = totalSessions
      ? Math.max(...sessions.map((item) => item.totalScore || 0))
      : 0;

    const latestFeedback = totalSessions ? sessions[0].feedback : "";
    const sessionHistory = sessions
      .slice()
      .reverse()
      .map((item, index) => ({
        id: item._id,
        sessionNumber: index + 1,
        score: Number(item.totalScore || 0),
        keywordScore: Number(item.keywordScore || 0),
        semanticScore: Number(item.semanticScore || 0),
        domain: item.domain || "Practice Session",
        answeredCount: Number(item.answeredCount || 0),
        skippedCount: Number(item.skippedCount || 0),
        createdAt: item.createdAt
      }));

    return res.json({
      totalSessions,
      averageScore,
      bestScore,
      latestFeedback,
      recentInterviews: sessions,
      sessionHistory
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load dashboard." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
