import { useEffect, useState } from "react";
import Login from "./Login";

const LABELS = {
  adminName: "\uAE40\uD76C\uC9C4",
  memberName: "\uC624\uC138\uBBFC",
  sessionLabel: "\uD604\uC7AC \uB85C\uADF8\uC778 \uC138\uC158",
  user: "\uC0AC\uC6A9\uC790",
  admin: "\uAD00\uB9AC\uC790",
  member: "\uD300\uC6D0",
  logout: "\uB85C\uADF8\uC544\uC6C3",
  staticShell: "\uC815\uC801 OpsRadar \uD654\uBA74\uC740 public/index.html\uC5D0\uC11C \uB80C\uB354\uB9C1\uB429\uB2C8\uB2E4.",
  staticHelp: "\uD654\uBA74\uC774 \uBE44\uC5B4 \uBCF4\uC774\uBA74 public/index.html \uB610\uB294 \uC815\uC801 \uC2A4\uD06C\uB9BD\uD2B8 \uACBD\uB85C\uB97C \uD655\uC778\uD558\uC138\uC694.",
};

function App() {
  const [userRole, setUserRole] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("opsradar_user_role");
  });
  const [userName, setUserName] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("opsradar_user_name") || "";
  });
  const hasStaticShell = typeof document !== "undefined" && document.querySelector(".sidebar .sb-logo-name");

  useEffect(() => {
    document.body.classList.toggle("opsradar-login-required", !userRole);
    return () => document.body.classList.remove("opsradar-login-required");
  }, [userRole]);

  function handleLogin(role) {
    const name = role === "admin" ? LABELS.adminName : LABELS.memberName;
    window.localStorage.setItem("opsradar_user_role", role);
    window.localStorage.setItem("opsradar_user_name", name);
    setUserRole(role);
    setUserName(name);
  }

  function handleLogout() {
    window.localStorage.removeItem("opsradar_user_role");
    window.localStorage.removeItem("opsradar_user_name");
    setUserRole(null);
    setUserName("");
  }

  if (!userRole) return <Login onLogin={handleLogin} />;

  if (hasStaticShell) {
    return (
      <div className="app-session-control" aria-label={LABELS.sessionLabel}>
        <span>{userName || LABELS.user}</span>
        <span>{userRole === "admin" ? LABELS.admin : LABELS.member}</span>
        <button type="button" onClick={handleLogout}>{LABELS.logout}</button>
      </div>
    );
  }

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>OpsRadar frontend shell</h1>
      <p>{LABELS.staticShell}</p>
      <p>{LABELS.staticHelp}</p>
      <button type="button" onClick={handleLogout}>{LABELS.logout}</button>
    </main>
  );
}

export default App;
