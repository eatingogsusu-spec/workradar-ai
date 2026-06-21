function readAccessToken() {
  const direct = localStorage.getItem("access_token") || localStorage.getItem("token");
  if (direct) return direct;
  try {
    const session = JSON.parse(localStorage.getItem("opsradar_session") || "null");
    if (session?.access_token || session?.token) return session.access_token || session.token;
  } catch (_) {}
  try {
    return JSON.parse(localStorage.getItem("auth") || "null")?.token || "";
  } catch (_) {
    return "";
  }
}

function fileNameFrom(response, fallbackName) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
  return match?.[1] || fallbackName;
}

export async function downloadSourceDocument(documentId, fallbackName = "source-document") {
  if (!documentId) throw new Error("다운로드할 문서 정보가 없습니다.");

  // Legacy pages centralize authentication here. Reuse it so React screens
  // support every established session-storage format as well.
  if (typeof window.opsRadarApi?.downloadDocument === "function") {
    await window.opsRadarApi.downloadDocument(documentId, fallbackName);
    return;
  }

  const token = readAccessToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`/api/v1/documents/${encodeURIComponent(documentId)}/download`, { headers });
  if (!response.ok) throw new Error("문서를 불러올 수 없습니다.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameFrom(response, fallbackName);
  link.click();
  URL.revokeObjectURL(url);
}
