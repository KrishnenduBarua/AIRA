import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const demoFeatures = {
  months_of_history: 6,
  n_transactions: 145,
  income_regularity: 0.82,
  avg_monthly_income: 18500,
  savings_ratio: 0.31,
  bill_payment_count: 12,
  bill_payment_regularity: 0.77,
  transaction_diversity: 0.68,
  spending_to_income_ratio: 0.63,
  balance_volatility: 0.41,
  max_single_txn_pct_balance: 0.9,
  circular_transfer_flag: false,
  balance_consistency_pass: true,
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function App() {
  const [mode, setMode] = useState("borrower");
  const [session, setSession] = useState(null);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          AIRA <span>credit, understood</span>
        </a>
        <div
          className="mode-switch"
          role="tablist"
          aria-label="Choose workspace"
        >
          <button
            className={mode === "borrower" ? "active" : ""}
            onClick={() => setMode("borrower")}
          >
            Borrower
          </button>
          <button
            className={mode === "lender" ? "active" : ""}
            onClick={() => setMode("lender")}
          >
            Lender
          </button>
        </div>
        {session && (
          <button className="text-button" onClick={() => setSession(null)}>
            Sign out
          </button>
        )}
      </header>
      <section className="intro">
        <p className="eyebrow">ALTERNATIVE CREDIT INTELLIGENCE</p>
        <h1>
          {mode === "borrower"
            ? "Your financial story, made visible."
            : "Make clearer lending decisions."}
        </h1>
        <p className="intro-copy">
          {mode === "borrower"
            ? "Turn everyday financial activity into a transparent, portable credit profile."
            : "Explore consented borrower signals with context, not just a number."}
        </p>
      </section>
      {mode === "borrower" ? (
        <BorrowerView session={session} setSession={setSession} />
      ) : (
        <LenderView session={session} setSession={setSession} />
      )}
    </main>
  );
}

function AuthCard({ role, onSuccess }) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await request(
        `/auth/${registering ? "register" : "login"}`,
        { method: "POST", body: JSON.stringify({ ...form, role }) },
      );
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <section className="panel auth-card">
      <div className="panel-heading">
        <p className="eyebrow">WELCOME TO AIRA</p>
        <h2>{registering ? "Create your profile" : "Sign in to continue"}</h2>
      </div>
      <form onSubmit={submit}>
        {registering && (
          <label>
            Full name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 6 characters"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary-button" type="submit">
          {registering ? "Create account" : "Sign in"}
          <span>→</span>
        </button>
      </form>
      <button
        className="link-button"
        onClick={() => setRegistering(!registering)}
      >
        {registering
          ? "Already have an account? Sign in"
          : "New to AIRA? Create an account"}
      </button>
    </section>
  );
}

function BorrowerView({ session, setSession }) {
  if (!session) return <AuthCard role="borrower" onSuccess={setSession} />;
  return <BorrowerDashboard session={session} />;
}

function BorrowerDashboard({ session }) {
  const [consented, setConsented] = useState(session.user.consentGiven);
  const [score, setScore] = useState(null);
  const [file, setFile] = useState(null);
  const [chat, setChat] = useState({ question: "", answer: "" });
  const [message, setMessage] = useState("");
  const headers = { Authorization: `Bearer ${session.token}` };
  const consent = async () => {
    try {
      await request("/auth/consent", {
        method: "POST",
        headers,
        body: JSON.stringify({ consentGiven: !consented }),
      });
      setConsented(!consented);
    } catch (err) {
      setMessage(err.message);
    }
  };
  const upload = async () => {
    if (!file) return setMessage("Choose a statement file first.");
    if (!consented) return setMessage("Please grant consent before uploading.");
    try {
      const body = new FormData();
      body.append("statement", file);
      const uploaded = await fetch(`${API_URL}/statements/upload`, {
        method: "POST",
        headers,
        body,
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        return d;
      });
      const result = await request("/score/compute", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: session.user.id,
          features: uploaded.statement.extractedFeatures,
        }),
      });
      setScore(result);
      setMessage("Your score is ready.");
    } catch (err) {
      setMessage(err.message);
    }
  };
  const ask = async () => {
    try {
      const result = await request("/chat/borrower", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...chat, ...(score || {}) }),
      });
      setChat({ ...chat, answer: result.answer });
    } catch (err) {
      setMessage(err.message);
    }
  };
  return (
    <div className="dashboard-grid">
      <section className="panel profile-panel">
        <div className="panel-heading">
          <p className="eyebrow">BORROWER PROFILE</p>
          <h2>Hi, {session.user.name || "there"}.</h2>
          <p>Your data stays yours. Consent controls every share.</p>
        </div>
        <div className="consent-row">
          <div>
            <strong>Data consent</strong>
            <span>
              {consented
                ? "Active and reversible"
                : "Required to calculate your score"}
            </span>
          </div>
          <button
            className={consented ? "quiet-button" : "primary-button"}
            onClick={consent}
          >
            {consented ? "Revoke" : "Grant consent"}
          </button>
        </div>
      </section>
      <section className="panel upload-panel">
        <div className="panel-heading">
          <p className="eyebrow">STEP 01 / STATEMENT</p>
          <h2>Bring your activity</h2>
          <p>Upload a PDF, CSV, Excel, or JSON statement to begin.</p>
        </div>
        <label className="dropzone">
          <input
            type="file"
            accept=".pdf,.csv,.xlsx,.json"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <span className="upload-mark">＋</span>
          <strong>{file ? file.name : "Choose a statement"}</strong>
          <small>{file ? "Ready to process" : "PDF, CSV, XLSX, or JSON"}</small>
        </label>
        <button className="primary-button" onClick={upload}>
          Analyze statement <span>→</span>
        </button>
        {message && <p className="status">{message}</p>}
      </section>
      <ScoreCard score={score} />
      <ChatCard
        mode="borrower"
        score={score}
        chat={chat}
        setChat={setChat}
        ask={ask}
      />
    </div>
  );
}

function ScoreCard({ score }) {
  return (
    <section className="panel score-panel">
      <div className="panel-heading">
        <p className="eyebrow">STEP 02 / YOUR RESULT</p>
        <h2>Trust score</h2>
      </div>
      {score ? (
        <div className="score-result">
          <div className="score-number">
            {score.score}
            <small>/ 2</small>
          </div>
          <div>
            <span className="pill">{score.tier}</span>
            <p>{score.riskLevel?.replace("_", " ")}</p>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          Upload a statement to reveal your score and its contributing signals.
        </div>
      )}
      {score?.factors && <FactorList factors={score.factors} />}
    </section>
  );
}

function FactorList({ factors }) {
  return (
    <div className="factor-list">
      {Object.entries(factors)
        .slice(0, 5)
        .map(([key, value]) => (
          <div className="factor" key={key}>
            <span>{key.replaceAll("_", " ")}</span>
            <strong className={value >= 0 ? "positive" : "negative"}>
              {value >= 0 ? "+" : ""}
              {Number(value).toFixed(2)}
            </strong>
          </div>
        ))}
    </div>
  );
}

function ChatCard({ mode, score, chat, setChat, ask }) {
  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <p className="eyebrow">STEP 03 / COACH</p>
        <h2>{mode === "borrower" ? "Ask in Bangla" : "AIRA Coach"}</h2>
        <p>
          {mode === "borrower"
            ? "Get simple, high-level ways to strengthen your profile."
            : "Understand the signals behind a borrower score."}
        </p>
      </div>
      <div className="chat-answer">
        {chat.answer ||
          (mode === "borrower"
            ? "আপনার স্কোর সম্পর্কে জানতে প্রশ্ন করুন।"
            : "Ask why a score looks the way it does.")}
      </div>
      <div className="chat-input">
        <input
          value={chat.question}
          onChange={(e) => setChat({ ...chat, question: e.target.value })}
          placeholder={
            mode === "borrower"
              ? "কীভাবে আমার স্কোর উন্নত করব?"
              : "Why is this score low?"
          }
        />
        <button aria-label="Send question" onClick={ask}>
          →
        </button>
      </div>
      {!score && (
        <small className="muted">
          Generate a score first for a grounded answer.
        </small>
      )}
    </section>
  );
}

function LenderView({ session, setSession }) {
  if (!session) return <AuthCard role="lender" onSuccess={setSession} />;
  return <LenderDashboard session={session} />;
}
function LenderDashboard({ session }) {
  const [userId, setUserId] = useState("");
  const [score, setScore] = useState(null);
  const [chat, setChat] = useState({ question: "", answer: "" });
  const [error, setError] = useState("");
  const headers = { Authorization: `Bearer ${session.token}` };
  const lookup = async () => {
    try {
      setError("");
      setScore(await request(`/lender/score/${userId}`, { headers }));
    } catch (err) {
      setError(err.message);
    }
  };
  const ask = async () => {
    try {
      const result = await request("/chat/lender", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...chat, ...(score || {}) }),
      });
      setChat({ ...chat, answer: result.answer });
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="dashboard-grid lender-grid">
      <section className="panel lookup-panel">
        <div className="panel-heading">
          <p className="eyebrow">LENDER WORKSPACE</p>
          <h2>Find a consented profile.</h2>
          <p>Enter a borrower ID to view the latest available score.</p>
        </div>
        <div className="lookup-row">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="e.g. user_001"
          />
          <button className="primary-button" onClick={lookup}>
            Look up <span>→</span>
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="panel score-panel lender-score">
        <div className="panel-heading">
          <p className="eyebrow">BORROWER RESULT</p>
          <h2>{score ? `Profile ${score.userId}` : "No profile selected"}</h2>
        </div>
        {score ? (
          <>
            <div className="score-result">
              <div className="score-number">
                {score.score}
                <small>/ 2</small>
              </div>
              <div>
                <span className="pill">{score.tier}</span>
                <p>{score.riskLevel?.replace("_", " ")}</p>
              </div>
            </div>
            <FactorList factors={score.factors || {}} />
          </>
        ) : (
          <div className="empty-state">
            A consented borrower score will appear here.
          </div>
        )}
      </section>
      <ChatCard
        mode="lender"
        score={score}
        chat={chat}
        setChat={setChat}
        ask={ask}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
