import { useEffect, useState } from "react";
import Login from "./Login";

function App() {
  const [session, setSession] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("opsradar_session");
      if (raw) return JSON.parse(raw);
      const token = window.localStorage.getItem("access_token");
      const user = JSON.parse(window.localStorage.getItem("user") || "null");
      return token && user ? { token, user } : null;
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
    window.localStorage.setItem("access_token", data.access_token);
    window.localStorage.setItem("token", data.access_token);
    window.localStorage.setItem("user", JSON.stringify(data.user));
    window.localStorage.setItem("role", data.user.role);
    window.localStorage.setItem("opsradar_user_role", data.user.role);
    window.localStorage.setItem("opsradar_user_name", data.user.name);
    setSession(sessionData);
  }

  function handleLogout() {
    window.localStorage.removeItem("opsradar_session");
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
    window.localStorage.removeItem("role");
    window.localStorage.removeItem("opsradar_user_role");
    window.localStorage.removeItem("opsradar_user_name");
    setSession(null);
  }

  if (!session) return <Login onLogin={handleLogin} />;

  if (hasStaticShell) {
    return null;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>WorkRader frontend shell</h1>
      <p>정적 WorkRader 화면은 public/index.html에서 렌더링됩니다.</p>
      <p>화면이 비어 보이면 public/index.html 또는 정적 스크립트 경로를 확인하세요.</p>
      <button type="button" onClick={handleLogout}>
        로그아웃
      </button>
    </main>
  );
}

export default App;
