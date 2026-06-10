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
  staticShell: "\uC815\uC801 WorkRader \uD654\uBA74\uC740 public/index.html\uC5D0\uC11C \uB80C\uB354\uB9C1\uB429\uB2C8\uB2E4.",
  staticHelp: "\uD654\uBA74\uC774 \uBE44\uC5B4 \uBCF4\uC774\uBA74 public/index.html \uB610\uB294 \uC815\uC801 \uC2A4\uD06C\uB9BD\uD2B8 \uACBD\uB85C\uB97C \uD655\uC778\uD558\uC138\uC694.",
};

function clearOpsRadarSession() {
  window.localStorage.removeItem("opsradar_user_role");
  window.localStorage.removeItem("opsradar_user_name");
  window.localStorage.removeItem("opsradar_user_id");
  window.localStorage.removeItem("role");
  window.localStorage.removeItem("user");
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("auth");
  window.sessionStorage.clear();
}

function syncDashboardRoleUi(role, name) {
  const isMember = role === "member";
  const allowedRole = isMember ? "member" : "pm";
  const roleLabel = isMember ? LABELS.member : LABELS.admin;
  const roleDescription = isMember ? "Team Member" : "PM \u00B7 \uD300\uC7A5";
  const displayName = name || LABELS.user;
  const switcher = document.querySelector(".ops-role-switch");

  if (typeof window.__opsradarOriginalSwitchDbRole !== "function" && typeof window.switchDbRole === "function") {
    window.__opsradarOriginalSwitchDbRole = window.switchDbRole;
  }

  const originalSwitch = window.__opsradarOriginalSwitchDbRole;
  if (typeof originalSwitch === "function") {
    window.switchDbRole = () => originalSwitch(allowedRole);
    window.switchDbRole.opsradarRoleLocked = true;
    originalSwitch(allowedRole);
  }

  if (!switcher) return;

  switcher.style.display = "none";

  let badge = document.getElementById("opsLoginRoleBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "opsLoginRoleBadge";
    badge.className = "ops-login-role-badge";
    switcher.insertAdjacentElement("afterend", badge);
  }
  badge.textContent = `${displayName} / ${roleLabel}`;

  const sidebarName = document.getElementById("sidebarUserName");
  const sidebarRole = document.getElementById("sidebarUserRole");
  const sidebarDescription = document.getElementById("sidebarUserDescription");
  const sidebarAvatar = document.getElementById("sidebarUserAvatar");
  if (sidebarName) sidebarName.textContent = displayName;
  if (sidebarRole) sidebarRole.textContent = roleLabel;
  if (sidebarDescription) sidebarDescription.textContent = roleDescription;
  if (sidebarAvatar) sidebarAvatar.textContent = displayName.trim().slice(0, 1) || "U";
}

function App() {
  const [userRole, setUserRole] = useState(() => {
    if (typeof window === "undefined") return null;
    const storedRole = window.localStorage.getItem("opsradar_user_role");
    return storedRole === "admin" || storedRole === "member" ? storedRole : null;
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

  useEffect(() => {
    if (!userRole || typeof window === "undefined") return undefined;
    window.__workraderLogout = handleLogout;
    window.logout = handleLogout;
    const interceptLogoutClick = (event) => {
      const target = event.target;
      if (target?.closest?.(".settings-logout-btn, [data-workrader-logout='true']")) {
        event.preventDefault();
        event.stopPropagation();
        handleLogout();
      }
    };
    document.addEventListener("click", interceptLogoutClick, true);
    const timer = window.setTimeout(() => {
      syncDashboardRoleUi(userRole, userName);
      if (typeof window.updateSettingsPage === "function") window.updateSettingsPage();
      window.__workraderLogout = handleLogout;
      window.logout = handleLogout;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", interceptLogoutClick, true);
    };
  }, [userRole, userName]);

  function handleLogin(user) {
    window.localStorage.setItem("opsradar_user_role", user.role);
    window.localStorage.setItem("opsradar_user_name", user.name);
    window.localStorage.setItem("opsradar_user_id", user.id);
    window.localStorage.setItem("role", user.role);
    window.localStorage.setItem("user", JSON.stringify({ id: user.id, name: user.name, role: user.role }));
    setUserRole(user.role);
    setUserName(user.name);
  }

  function handleLogout() {
    clearOpsRadarSession();
    setUserRole(null);
    setUserName("");
    document.body.classList.add("opsradar-login-required");
    window.location.reload();
  }

  if (!userRole) return <Login onLogin={handleLogin} />;

  if (hasStaticShell) {
    return null;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>WorkRader frontend shell</h1>
      <p>{LABELS.staticShell}</p>
      <p>{LABELS.staticHelp}</p>
      <button type="button" onClick={handleLogout}>{LABELS.logout}</button>
    </main>
  );
}

export default App;
