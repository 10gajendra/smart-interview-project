import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Features from './pages/Features';
import Practice from './pages/Practice';
import Feedback from './pages/Feedback';
import Dashboard from './pages/Dashboard';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', color: '#0f172a' }}>
        <Navbar />
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/features"  element={<Features />} />
          <Route path="/practice"  element={<Practice />} />
          <Route path="/feedback"  element={<Feedback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about"     element={<About />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/register"  element={<Register />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
