const LABELS = {
  admin: "\uAD00\uB9AC\uC790",
  member: "\uD300\uC6D0",
  adminDescription: "\uC804\uCCB4 \uC6B4\uC601 \uC0C1\uD0DC\uC640 AI \uC81C\uC548 \uD56D\uBAA9\uC744 \uAC80\uD1A0\uD569\uB2C8\uB2E4.",
  memberDescription: "\uB098\uC5D0\uAC8C \uBC30\uC815\uB41C Todo\uC640 \uAD00\uB828 Issue\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.",
  adminAction: "\uAD00\uB9AC\uC790\uB85C \uC2DC\uC791\uD558\uAE30",
  memberAction: "\uD300\uC6D0\uC73C\uB85C \uC2DC\uC791\uD558\uAE30",
  subtitleLine1: "\uC6B4\uC601 \uAE30\uB85D\uC744 \uADFC\uAC70 \uC788\uB294 Todo \u00B7 Issue \u00B7 Report \u00B7 Handoff \uD6C4\uBCF4\uB85C \uC815\uB9AC\uD558\uACE0,",
  subtitleLine2: "\uC2B9\uC778\uB41C \uD56D\uBAA9\uB9CC \uACF5\uC2DD \uC6B4\uC601 \uB370\uC774\uD130\uB85C \uBC18\uC601\uD569\uB2C8\uB2E4.",
  roleSelect: "\uC5ED\uD560 \uC120\uD0DD",
};

const roles = [
  {
    role: "admin",
    title: LABELS.admin,
    description: LABELS.adminDescription,
    action: LABELS.adminAction,
  },
  {
    role: "member",
    title: LABELS.member,
    description: LABELS.memberDescription,
    action: LABELS.memberAction,
  },
];

function Login({ onLogin }) {
  return (
    <main className="opsradar-login">
      <section className="opsradar-login-copy" aria-labelledby="login-title">
        <div className="opsradar-login-mark">OR</div>
        <p>AI Operational Intelligence</p>
        <h1 id="login-title">OpsRadar</h1>
        <div className="opsradar-login-subtitle">
          {LABELS.subtitleLine1}
          <br />
          {LABELS.subtitleLine2}
        </div>
      </section>

      <section className="opsradar-login-cards" aria-label={LABELS.roleSelect}>
        {roles.map((item) => (
          <article className="opsradar-login-card" key={item.role}>
            <span>{item.role === "admin" ? "ADMIN" : "MEMBER"}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <button type="button" onClick={() => onLogin(item.role)}>
              {item.action}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

export default Login;
