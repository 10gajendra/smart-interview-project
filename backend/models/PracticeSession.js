const mongoose = require("mongoose");

const practiceResultSchema = new mongoose.Schema({
  questionId: String,
  status: {
    type: String,
    enum: ["answered", "skipped"],
    required: true
  },
  question: String,
  answer: String,
  category: String,
  subcategory: String,
  keywordScore: Number,
  semanticScore: Number,
  totalScore: Number,
  feedback: String,
  improvedAnswer: String,
  strengths: [String],
  improvements: [String]
}, { _id: false });

const practiceSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  requestedQuestionCount: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  answeredCount: {
    type: Number,
    default: 0
  },
  skippedCount: {
    type: Number,
    default: 0
  },
  keywordScore: {
    type: Number,
    default: 0
  },
  semanticScore: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  feedback: String,
  strengths: [String],
  improvements: [String],
  results: [practiceResultSchema]
}, { timestamps: true });

function sessionAverage(results, key, divisor) {
  if (!divisor) {
    return 0;
  }

  const total = results.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  return Number((total / divisor).toFixed(1));
}

practiceSessionSchema.pre("save", function () {
  const requestedQuestionCount = Math.max(1, Number(this.requestedQuestionCount || 1));
  const results = Array.isArray(this.results) ? this.results : [];
  const answered = results.filter((item) => item.status === "answered");

  this.totalQuestions = Number(this.totalQuestions || requestedQuestionCount);
  this.answeredCount = answered.length;
  this.skippedCount = results.filter((item) => item.status === "skipped").length;
  this.keywordScore = sessionAverage(answered, "keywordScore", requestedQuestionCount);
  this.semanticScore = sessionAverage(answered, "semanticScore", requestedQuestionCount);
  this.totalScore = sessionAverage(answered, "totalScore", requestedQuestionCount);
});

module.exports = mongoose.model("PracticeSession", practiceSessionSchema);
