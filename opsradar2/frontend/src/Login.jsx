import { useState } from "react";

const API_BASE =
  ["8002", "3001"].includes(window.location.port)
    ? "/api/v1"
    : (["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://127.0.0.1:8002/api/v1"
      : `${window.location.protocol}//${window.location.hostname}:8002/api/v1`);

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      onLogin(data);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="opsradar-login">
      <section className="opsradar-login-copy" aria-labelledby="login-title">
        <div className="opsradar-login-mark">OR</div>
        <p className="opsradar-login-tagline">AI Operational Intelligence</p>
        <h1 id="login-title">WorkRader</h1>
        <div className="opsradar-login-subtitle">
          운영 기록을 근거 있는 Todo · Issue · Report · Handoff 후보로 정리하고,
          <br />
          승인된 항목만 공식 운영 데이터로 반영합니다.
        </div>
      </section>

      <section className="opsradar-login-cards" aria-label="로그인">
        <form className="opsradar-login-form" onSubmit={handleSubmit} noValidate>
          <h2>로그인</h2>
          <p className="opsradar-login-form-desc">
            관리자로부터 발급받은 계정으로 로그인하세요.
          </p>

          <label htmlFor="opsradar-username">아이디</label>
          <input
            id="opsradar-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label htmlFor="opsradar-password">비밀번호</label>
          <input
            id="opsradar-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p className="opsradar-login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
