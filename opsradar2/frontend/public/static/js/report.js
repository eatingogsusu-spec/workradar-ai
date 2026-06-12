// Period-aware report generation and report lifecycle actions.
(function () {
  const labels = {
    completed:"완료된 업무", inProgress:"진행 중인 업무", technical:"AI 및 기술적 상세 내용",
    risk:"리스크 관리 및 해결 방안", retrospective:"팀 회고", nextPlan:"차주 계획"
  };
  const keys = Object.fromEntries(Object.entries(labels).map(([key, value]) => [value, key]));

  window.parseReportMarkdown = function (content) {
    const sections = Object.fromEntries(Object.keys(labels).map((key) => [key, []]));
    if (String(content || "").includes("<")) {
      const container = document.createElement("div");
      container.innerHTML = String(content || "");
      container.querySelectorAll("h3").forEach((heading) => {
        const key = keys[heading.textContent.trim()];
        const list = heading.nextElementSibling;
        if (key && list) sections[key] = Array.from(list.querySelectorAll("li")).map((item) => item.textContent.trim()).filter(Boolean);
      });
    }
    let current = null;
    String(content || "").split(/\r?\n/).forEach((line) => {
      const heading = line.match(/^##\s+(.+)$/)?.[1]?.trim();
      if (heading) { current = keys[heading] || null; return; }
      const item = line.match(/^\s*-\s+(.+)$/)?.[1]?.trim();
      if (current && item) sections[current].push(item);
    });
    Object.keys(sections).forEach((key) => {
      if (!sections[key].length) sections[key] = ["해당 기간의 데이터가 없습니다."];
    });
    return sections;
  };

  function ensurePeriodModal() {
    if (document.getElementById("reportPeriodModal")) return;
    const modal = document.createElement("div");
    modal.id = "reportPeriodModal";
    modal.className = "modal-overlay";
    modal.onclick = (event) => { if (event.target === modal) closeModal("reportPeriodModal"); };
    modal.innerHTML = `<div class="modal slide-up" style="width:min(460px,92vw)" onclick="event.stopPropagation()">
      <div class="modal-title" id="reportPeriodTitle">보고서 기간 선택</div>
      <div class="modal-sub">선택한 기간 당시의 완료 업무, 진행 업무, AI 분석 및 리스크를 기준으로 초안을 생성합니다.</div>
      <div><div class="form-label" id="reportPeriodLabel">주 선택</div><input class="form-input" id="reportPeriodInput" type="week"></div>
      <div class="modal-actions"><button class="tbtn" onclick="closeModal('reportPeriodModal')">취소</button><button class="tbtn primary" onclick="confirmReportDraftPeriod()"><i class="ti ti-wand"></i> AI 초안 생성</button></div>
    </div>`;
    document.body.appendChild(modal);
  }

  function weekValue(date) {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return `${target.getUTCFullYear()}-W${String(Math.ceil((((target - yearStart) / 86400000) + 1) / 7)).padStart(2, "0")}`;
  }

  function weekStart(value) {
    const [yearText, weekText] = String(value).split("-W");
    const januaryFourth = new Date(Date.UTC(Number(yearText), 0, 4));
    const monday = new Date(januaryFourth);
    monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + ((Number(weekText) - 1) * 7));
    return monday.toISOString().slice(0, 10);
  }

  window.generateReportDraft = function () {
    ensurePeriodModal();
    const type = getActiveReportPeriod();
    const input = document.getElementById("reportPeriodInput");
    input.type = type === "monthly" ? "month" : "week";
    input.value = type === "monthly" ? new Date().toISOString().slice(0, 7) : weekValue(new Date());
    document.getElementById("reportPeriodTitle").textContent = `${getReportTypeLabel(type)} 기간 선택`;
    document.getElementById("reportPeriodLabel").textContent = type === "monthly" ? "월 선택" : "주 선택";
    openModal("reportPeriodModal");
  };

  window.confirmReportDraftPeriod = async function () {
    const type = getActiveReportPeriod();
    const value = document.getElementById("reportPeriodInput")?.value;
    if (!value) return showToast("보고서 기간을 선택해주세요.", "warn");
    const startDate = type === "monthly" ? `${value}-01` : weekStart(value);
    try {
      const generated = await window.opsRadarApi.request("/reports/generate", {
        method: "POST",
        body: JSON.stringify({ period: type, start_date: startDate }),
      });
      const sections = window.parseReportMarkdown(generated.content);
      const draft = {
        id: generated.report_id, apiId: generated.report_id, type,
        title: type === "monthly" ? `${startDate.slice(0, 7)} 월간 운영 보고서` : `${startDate} 주간 운영 보고서`,
        period: `${generated.start_date} ~ ${generated.end_date}`,
        sections, html: generated.content, createdAt: new Date().toISOString(),
      };
      closeModal("reportPeriodModal");
      await window.opsRadarApi.loadReports();
      renderReportDraft({ ...draft, sections: Object.entries(sections).map(([key, items]) => [labels[key], items]) });
      G.currentReportDraft = draft;
      showToast(`${getReportTypeLabel(type)} AI 초안을 생성했습니다.`, "success");
    } catch (error) {
      console.warn("Report draft generation failed", error);
      showToast(`보고서 초안 생성에 실패했습니다. ${error.message || ""}`, "warn");
    }
  };

  window.deleteReport = async function (reportId) {
    if (!confirm("이 보고서를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return;
    try {
      if (reportId && !String(reportId).startsWith("sample-")) {
        await window.opsRadarApi.request(`/reports/${reportId}`, { method: "DELETE" });
      }
      persistReports(fetchReports().filter((report) => report.id !== reportId));
      G.selectedReportId = null;
      await window.opsRadarApi.loadReports();
      renderReportList();
      showToast("보고서를 삭제했습니다.", "success");
    } catch (error) {
      console.warn("Report delete failed", error);
      showToast("보고서 삭제에 실패했습니다.", "warn");
    }
  };
})();
