import { Link } from 'react-router-dom';

const features = [
  { icon: '🎤', title: 'Voice Input', desc: 'Answer using your voice via Whisper AI transcription.', tag: 'Whisper API', color: '#5eead4' },
  { icon: '🧠', title: 'Semantic Analysis', desc: 'Sentence-BERT compares your answer against expert responses.', tag: 'Sentence-BERT', color: '#3b82f6' },
  { icon: '📊', title: 'Progress Tracking', desc: 'Visualize improvement over time with interactive charts.', tag: 'Dashboard', color: '#a78bfa' },
  { icon: '✨', title: 'AI Feedback', desc: 'Get detailed critique with improved model answers.', tag: 'AI-Powered', color: '#f472b6' },
  { icon: '🏷️', title: 'Keyword Matching', desc: 'NLP-powered detection with spaCy and FuzzyWuzzy.', tag: 'NLP · spaCy', color: '#fbbf24' },
  { icon: '🏆', title: 'Scoring System', desc: 'Multi-dimensional weighted scoring out of 100.', tag: '0–100 Score', color: '#5eead4' },
];

const stats = [
  { num: '10K+', label: 'Questions Ready' },
  { num: '98%',  label: 'AI Accuracy' },
  { num: '6',    label: 'Tech Domains' },
  { num: '∞',    label: 'Practice Sessions' },
];

export default function Home() {
  return (
    <div style={{ paddingTop: 68 }}>
      <section style={{
        minHeight: 'calc(100vh - 68px)', display: 'flex', alignItems: 'center',
        padding: '4rem 3rem', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.16) 0%, transparent 70%)',
          top: -100, right: -100, filter: 'blur(60px)', pointerEvents: 'none'
        }}/>
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96,165,250,0.14) 0%, transparent 70%)',
          bottom: -50, left: -80, filter: 'blur(60px)', pointerEvents: 'none'
        }}/>

        <div style={{ maxWidth: 680, position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(20,184,166,0.18)',
            padding: '6px 16px', borderRadius: 100, marginBottom: '2rem',
            fontSize: '0.8rem', fontWeight: 500, color: '#0f766e',
            boxShadow: '0 10px 30px rgba(15,23,42,0.05)'
          }}>
            <span style={{ width: 6, height: 6, background: '#14b8a6', borderRadius: '50%' }}/>
            AI-Powered · NLP · Speech Recognition
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.2rem)', fontWeight: 800,
            lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '1.5rem'
          }}>
            Ace Every Interview<br />With{' '}
            <span style={{
              background: 'linear-gradient(135deg, #5eead4, #3b82f6, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>AI Coaching</span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: 560 }}>
            Practice real interview questions, get instant AI feedback, and track your improvement.
            Powered by Sentence-BERT, NLP, and Speech Recognition technology.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: '3rem' }}>
            <Link to="/practice" style={{
              padding: '13px 30px', borderRadius: 12, fontSize: '1rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #5eead4, #3b82f6)',
              color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8
            }}>▶ Start Practice</Link>
            <Link to="/features" style={{
              padding: '13px 30px', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
              background: 'rgba(255,255,255,0.76)', color: '#0f766e', textDecoration: 'none',
              border: '1px solid rgba(20,184,166,0.22)', display: 'inline-flex', alignItems: 'center', gap: 8
            }}>✦ Explore Features</Link>
          </div>

          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
            {stats.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f766e' }}>{s.num}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ background: 'rgba(255,255,255,0.56)', borderTop: '1px solid rgba(148,163,184,0.12)', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '5rem 3rem' }}>
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>How It Works</div>
            <h2 style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '0.75rem' }}>From Question to Expert-Level Answer</h2>
            <p style={{ color: '#475569', fontSize: '1rem', maxWidth: 520 }}>Our AI pipeline analyzes your response across multiple dimensions in seconds.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
            {[
              { n: '01', title: 'Choose a Category', desc: 'Select from AI, ML, Data Science, Software Engineering, QA, and more.' },
              { n: '02', title: 'Answer the Question', desc: 'Type your answer or use voice input powered by Whisper AI.' },
              { n: '03', title: 'AI Analyzes Response', desc: 'NLP checks keywords, Sentence-BERT computes semantic similarity.' },
              { n: '04', title: 'Get Smart Feedback', desc: 'Receive detailed scoring, strengths, weaknesses, and improved answer.' },
            ].map(step => (
              <div key={step.n} style={{ padding: '1.5rem' }}>
                <div style={{
                  fontSize: '3rem', fontWeight: 800, lineHeight: 1, marginBottom: '1rem',
                  background: 'linear-gradient(135deg, #5eead4, #3b82f6)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', opacity: 0.5
                }}>{step.n}</div>
                <h3 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '5rem 3rem' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Key Features</div>
          <h2 style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 800 }}>Everything You Need to Prepare</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: 16, padding: 28, transition: 'all 0.3s', cursor: 'default',
              boxShadow: '0 18px 40px rgba(15,23,42,0.05)'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(20,184,166,0.24)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.18)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.65, marginBottom: 14 }}>{f.desc}</p>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace',
                background: `${f.color}18`, color: f.color
              }}>{f.tag}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 3rem 5rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(226,244,255,0.95))',
          border: '1px solid rgba(20,184,166,0.16)', borderRadius: 24,
          padding: '4rem', textAlign: 'center'
        }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 800, marginBottom: '1rem' }}>Ready to Ace Your Next Interview?</h2>
          <p style={{ color: '#475569', maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.7 }}>
            Join thousands of students who improved their interview skills with AI-powered coaching.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/practice" style={{
              padding: '13px 30px', borderRadius: 12, fontWeight: 700, fontSize: '1rem',
              background: 'linear-gradient(135deg, #5eead4, #3b82f6)', color: '#fff', textDecoration: 'none'
            }}>🚀 Get Started Free</Link>
            <Link to="/dashboard" style={{
              padding: '13px 30px', borderRadius: 12, fontWeight: 600, fontSize: '1rem',
              background: 'transparent', color: '#0f766e', border: '1px solid rgba(20,184,166,0.24)', textDecoration: 'none'
            }}>📊 View Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
