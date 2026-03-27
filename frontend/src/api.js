import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://localhost:5000"
});

export async function submitInterview(payload) {
  const response = await API.post("/api/interviews", payload);
  return response.data;
}

export async function fetchPracticeCategories() {
  const response = await API.get("/api/practice/categories");
  return response.data;
}

export async function fetchPracticeQuestions(category, limit = 20) {
  const response = await API.get("/api/questions", {
    params: {
      category,
      limit
    }
  });
  return response.data;
}

export async function savePracticeSession(payload) {
  const response = await API.post("/api/practice-sessions", payload);
  return response.data;
}

export default API;
