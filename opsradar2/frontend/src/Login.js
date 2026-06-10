import { useState } from "react";

const LABELS = {
  admin: "\uAD00\uB9AC\uC790",
  member: "\uD300\uC6D0",
  loginTitle: "\uB85C\uADF8\uC778",
  idLabel: "\uC544\uC774\uB514",
  passwordLabel: "\uBE44\uBC00\uBC88\uD638",
  idPlaceholder: "admin \uB610\uB294 member",
  passwordPlaceholder: "\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694",
  loginAction: "\uB85C\uADF8\uC778",
  testAccounts: "\uD14C\uC2A4\uD2B8 \uACC4\uC815",
  invalid: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  subtitleLine1: "\uC6B4\uC601 \uAE30\uB85D\uC744 \uADFC\uAC70 \uC788\uB294 Todo \u00B7 Issue \u00B7 Report \u00B7 Handoff \uD6C4\uBCF4\uB85C \uC815\uB9AC\uD558\uACE0,",
  subtitleLine2: "\uC2B9\uC778\uB41C \uD56D\uBAA9\uB9CC \uACF5\uC2DD \uC6B4\uC601 \uB370\uC774\uD130\uB85C \uBC18\uC601\uD569\uB2C8\uB2E4.",
};

const MOCK_USERS = [
  {
    id: "admin",
    password: "admin123",
    name: "\uAE40\uD76C\uC9C4",
    role: "admin",
    roleLabel: LABELS.admin,
  },
  {
    id: "member",
    password: "member123",
    name: "\uC624\uC138\uBBFC",
    role: "member",
    roleLabel: LABELS.member,
  },
];

function Login({ onLogin }) {
  const [form, setForm] = useState({ id: "", password: "" });
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  }

  function submitLogin(event) {
    event.preventDefault();
    const id = form.id.trim();
    const user = MOCK_USERS.find((item) => item.id === id && item.password === form.password);
    if (!user) {
      setError(LABELS.invalid);
      return;
    }
    onLogin(user);
  }

  return (
    <main className="opsradar-login">
      <section className="opsradar-login-copy" aria-labelledby="login-title">
        <div className="opsradar-login-mark">OR</div>
        <p>AI Operational Intelligence</p>
        <h1 id="login-title">WorkRader</h1>
        <div className="opsradar-login-subtitle">
          {LABELS.subtitleLine1}
          <br />
          {LABELS.subtitleLine2}
        </div>
      </section>

      <section className="opsradar-login-panel" aria-label={LABELS.loginTitle}>
        <form className="opsradar-login-form" onSubmit={submitLogin}>
          <div>
            <span className="opsradar-login-eyebrow">WORKRADAR ACCESS</span>
            <h2>{LABELS.loginTitle}</h2>
          </div>

          <label className="opsradar-login-field">
            <span>{LABELS.idLabel}</span>
            <input
              type="text"
              value={form.id}
              placeholder={LABELS.idPlaceholder}
              autoComplete="username"
              onChange={(event) => updateField("id", event.target.value)}
            />
          </label>

          <label className="opsradar-login-field">
            <span>{LABELS.passwordLabel}</span>
            <input
              type="password"
              value={form.password}
              placeholder={LABELS.passwordPlaceholder}
              autoComplete="current-password"
              onChange={(event) => updateField("password", event.target.value)}
            />
          </label>

          {error ? <div className="opsradar-login-error" role="alert">{error}</div> : null}

          <button className="opsradar-login-submit" type="submit">
            {LABELS.loginAction}
          </button>

          <div className="opsradar-login-accounts">
            <span>{LABELS.testAccounts}</span>
            <code>{LABELS.admin}: admin / admin123</code>
            <code>{LABELS.member}: member / member123</code>
          </div>
        </form>
      </section>
    </main>
  );
}

export default Login;
