const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  category: {
    type: String,
    default: "General"
  },
  question: String,
  answer: String,
  keywordScore: Number,
  semanticScore: Number,
  totalScore: Number,
  feedback: String,
  improvedAnswer: String,
  strengths: [String],
  improvements: [String]
}, { timestamps: true });

// Pre-save hook
interviewSchema.pre("save", function () {
  const semanticScore = Number(this.semanticScore || 0);
  const keywordScore = Number(this.keywordScore || 0);
  const weightSemantic = semanticScore / 100;
  const weightKeyword = 1 - weightSemantic;
  this.totalScore = Number(((weightKeyword * keywordScore) + (weightSemantic * semanticScore)).toFixed(1));
});

module.exports = mongoose.model("Interview", interviewSchema);
