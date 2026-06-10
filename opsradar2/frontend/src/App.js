import { useEffect, useState } from "react";
import Login from "./Login";

function App() {
  const [session, setSession] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("opsradar_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const hasStaticShell =
    typeof document !== "undefined" &&
    document.querySelector(".sidebar .sb-logo-name");

  useEffect(() => {
    document.body.classList.toggle("opsradar-login-required", !session);
    return () => document.body.classList.remove("opsradar-login-required");
  }, [session]);

  function handleLogin(data) {
    const sessionData = {
      token: data.access_token,
      user: data.user,
    };
    window.localStorage.setItem("opsradar_session", JSON.stringify(sessionData));
    window.localStorage.setItem("opsradar_user_role", data.user.role);
    window.localStorage.setItem("opsradar_user_name", data.user.name);
    setSession(sessionData);
  }

  function handleLogout() {
    window.localStorage.removeItem("opsradar_session");
    window.localStorage.removeItem("opsradar_user_role");
    window.localStorage.removeItem("opsradar_user_name");
    setSession(null);
  }

  if (!session) return <Login onLogin={handleLogin} />;

  const { user } = session;
  const roleLabel = user.role === "admin" ? "관리자" : "팀원";

  if (hasStaticShell) {
    return (
      <div className="app-session-control" aria-label="현재 로그인 세션">
        <span>{user.name}</span>
        <span>{roleLabel}</span>
        <button type="button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>OpsRadar frontend shell</h1>
      <p>정적 OpsRadar 화면은 public/index.html에서 렌더링됩니다.</p>
      <p>화면이 비어 보이면 public/index.html 또는 정적 스크립트 경로를 확인하세요.</p>
      <button type="button" onClick={handleLogout}>
        로그아웃
      </button>
    </main>
  );
}

export default App;
