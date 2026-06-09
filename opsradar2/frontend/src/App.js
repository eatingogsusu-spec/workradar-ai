function App() {
  const hasStaticShell = typeof document !== "undefined" && document.querySelector(".sidebar .sb-logo-name");

  if (hasStaticShell) {
    return null;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>OpsRadar frontend shell</h1>
      <p>정적 OpsRadar 화면은 public/index.html에서 렌더링됩니다.</p>
      <p>화면이 비어 보이면 public/index.html 또는 정적 스크립트 경로를 확인하세요.</p>
    </main>
  );
}

export default App;