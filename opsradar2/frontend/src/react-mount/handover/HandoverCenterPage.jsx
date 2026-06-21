import { useEffect, useMemo, useState } from "react";
import HandoffHome from "./HandoffHome";
import HandoffDetail from "./HandoffDetail";
import HandoffArchive from "./HandoffArchive";
import { DEFAULT_HANDOFF_CONDITIONS, DEFAULT_ONBOARDING_CONDITIONS, HANDOFF_CANDIDATES, ONBOARDING_CANDIDATES, PEOPLE, DEPARTMENTS, buildPreviewData, readArchives, writeArchives, deleteArchive, fetchHandoffCandidates, fetchMembers, fetchHandoverPreview, parseHandoverMarkdown } from "./handoverData";
import { normalizeMode, setHandoffController } from "./handoffStateAdapter";
import "./handover.css";

const toast = (message) => window.showToast?.(message) || console.info(message);
export default function HandoverCenterPage() {
  const [mode, setMode] = useState("home");
  const [step, setStep] = useState(1);
  const [handoff, setHandoff] = useState(() => ({ ...DEFAULT_HANDOFF_CONDITIONS }));
  const [onboarding, setOnboarding] = useState(() => ({ ...DEFAULT_ONBOARDING_CONDITIONS }));
  const [handoffIds, setHandoffIds] = useState(() => HANDOFF_CANDIDATES.map((v) => v.id));
  const [onboardingIds, setOnboardingIds] = useState(() => ONBOARDING_CANDIDATES.map((v) => v.id));
  const [archives, setArchives] = useState(readArchives);
  const [archiveFilter, setArchiveFilter] = useState("all");
  const [archiveId, setArchiveId] = useState("");
  const [previewOverrides, setPreviewOverrides] = useState({ handoff: null, onboarding: null });
  const [savedDraftId, setSavedDraftId] = useState("");
  const [handoffCandidates, setHandoffCandidates] = useState(HANDOFF_CANDIDATES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState(PEOPLE);
  const [memberTeamMap, setMemberTeamMap] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generationNote, setGenerationNote] = useState("");

  const activeConditions = mode === "onboarding" ? onboarding : handoff;
  const activeCandidates = mode === "onboarding" ? ONBOARDING_CANDIDATES : handoffCandidates;
  const activeIds = mode === "onboarding" ? onboardingIds : handoffIds;
  const generatedHandoffPreview = useMemo(() => buildPreviewData("handoff", handoff, handoffCandidates, handoffIds), [handoff, handoffCandidates, handoffIds]);
  const generatedOnboardingPreview = useMemo(() => buildPreviewData("onboarding", onboarding, ONBOARDING_CANDIDATES, onboardingIds), [onboarding, onboardingIds]);
  const previewType = mode === "onboarding" ? "onboarding" : "handoff";
  const preview = previewOverrides[previewType] || (previewType === "onboarding" ? generatedOnboardingPreview : generatedHandoffPreview);
  const openMode = (next) => { const normalized = normalizeMode(next); setMode(normalized); setArchiveId(""); setSavedDraftId(""); setStep(1); window.G && (window.G.currentKnowledgeType = normalized); };
  const getPreviewData = (type) => { const normalized = normalizeMode(type) === "onboarding" ? "onboarding" : "handoff"; return previewOverrides[normalized] || (normalized === "onboarding" ? generatedOnboardingPreview : generatedHandoffPreview); };
  const openPreview = (type) => { const normalized = normalizeMode(type) === "onboarding" ? "onboarding" : "handoff"; setMode(normalized); setStep(3); return getPreviewData(normalized); };

  useEffect(() => setHandoffController({ openMode, openPreview, getPreviewData }), [generatedHandoffPreview, generatedOnboardingPreview, previewOverrides]);
  useEffect(() => { const command = (event) => event.detail?.command === "preview" ? openPreview(event.detail.mode) : openMode(event.detail?.mode || "home"); const nav = () => openMode("home"); window.addEventListener("opsradar:handoff-command", command); window.addEventListener("opsradar:open-handover", nav); return () => { window.removeEventListener("opsradar:handoff-command", command); window.removeEventListener("opsradar:open-handover", nav); }; }, [generatedHandoffPreview, generatedOnboardingPreview, previewOverrides]);
  useEffect(() => { setLoading(true); fetchHandoffCandidates().then((candidates) => { setHandoffCandidates(candidates); setHandoffIds(candidates.map((v) => v.id)); }).catch(() => { setError("API 연결 실패 - 기본 데이터를 사용합니다."); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetchMembers().then(({ names, teamMap }) => { setMembers(names); setMemberTeamMap(teamMap); setHandoff((c) => ({ ...c, owner: c.owner || names[0] || "", receiver: c.receiver || names[1] || "" })); setOnboarding((c) => ({ ...c, target: c.target || names[0] || "" })); }); }, []);

  // Step 2→3 진입 시 인수인계 모드면 백엔드 LLM 호출. 온보딩은 기존 템플릿 흐름 유지.
  const generateHandoverPreview = async () => {
    const selected = handoffCandidates.filter((c) => handoffIds.includes(c.id));
    const todoIds = selected.filter((c) => c.group === "진행 중 Todo").map((c) => c.id.replace(/^todo_/, ""));
    const issueIds = selected.filter((c) => c.group === "미해결 이슈").map((c) => c.id.replace(/^issue_/, ""));
    setGenerating(true);
    setGenerationNote("");
    try {
      const { content, mode: genMode, documents } = await fetchHandoverPreview({
        owner: handoff.owner, receiver: handoff.receiver, type: "handoff",
        todoIds, issueIds, department: handoff.department, period: handoff.period,
      });
      if (genMode === "ai" && content) {
        const parsed = parseHandoverMarkdown(content, `업무 인수인계서 - ${handoff.owner || "전임자"} → ${handoff.receiver || "후임자"}`, documents);
        setSavedDraftId("");
        setPreviewOverrides((current) => ({ ...current, handoff: parsed }));
      } else {
        setGenerationNote("기본 템플릿으로 표시 중입니다.");
      }
    } catch {
      setGenerationNote("기본 템플릿으로 표시 중입니다.");
    } finally {
      setGenerating(false);
    }
  };
  const goToStep = (next) => {
    // A: Step 2 진입 시 owner 기준으로 기본 체크 필터링
    if (next === 2 && mode !== "onboarding") {
      const owner = handoff.owner;
      if (owner) {
        const ownerTodosIssues = handoffCandidates.filter(
          (c) => (c.group === "진행 중 Todo" || c.group === "미해결 이슈") && c.meta === owner
        );
        const statics = handoffCandidates.filter(
          (c) => c.group !== "진행 중 Todo" && c.group !== "미해결 이슈"
        );
        setHandoffIds(
          ownerTodosIssues.length > 0
            ? [...ownerTodosIssues, ...statics].map((c) => c.id)
            : handoffCandidates.map((c) => c.id)
        );
      }
    }
    setStep(next);
    if (next === 3 && mode !== "onboarding") generateHandoverPreview();
  };

  const resetEditedPreview = (type = previewType) => { setSavedDraftId(""); setPreviewOverrides((current) => ({ ...current, [type]: null })); };
  const changeCondition = (key, value) => {
    resetEditedPreview();
    (mode === "onboarding" ? setOnboarding : setHandoff)((current) => {
      const next = { ...current, [key]: value };
      // B: owner 변경 시 팀 자동채우기(team_name이 DEPARTMENTS에 있을 때만)
      if (key === "owner" && mode !== "onboarding" && memberTeamMap[value] && DEPARTMENTS.includes(memberTeamMap[value])) {
        next.department = memberTeamMap[value];
      }
      return next;
    });
  };
  const toggleInclude = (value) => changeCondition("includes", activeConditions.includes.includes(value) ? activeConditions.includes.filter((item) => item !== value) : [...activeConditions.includes, value]);
  const toggleCandidate = (id) => { resetEditedPreview(); (mode === "onboarding" ? setOnboardingIds : setHandoffIds)((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  const share = () => toast("공유 링크를 준비했습니다.");
  const save = () => {
    const record = { id: `${mode}-${Date.now()}`, type: mode, title: preview.title, status: "draft", createdAt: new Date().toISOString(), createdBy: localStorage.getItem("opsradar_user_name") || "김희진", owner: activeConditions.owner || "", receiver: activeConditions.receiver || "", target: activeConditions.target || "", department: activeConditions.department, customer: activeConditions.customer || "전체", supplier: activeConditions.supplier || "전체", scope: activeConditions.scope || "", period: activeConditions.period, conditions: activeConditions, selectedIds: activeIds, selectedCandidates: activeCandidates.filter((item) => activeIds.includes(item.id)), previewData: preview };
    const next = [record, ...archives]; setArchives(next); writeArchives(next); setSavedDraftId(record.id); toast("초안을 인수인계 문서함에 저장했습니다.");
  };
  const clone = (record) => { if (record.type === "onboarding") { setOnboarding({ ...DEFAULT_ONBOARDING_CONDITIONS, ...record.conditions }); setOnboardingIds(record.selectedIds || []); } else { setHandoff({ ...DEFAULT_HANDOFF_CONDITIONS, ...record.conditions }); setHandoffIds(record.selectedIds || []); } openMode(record.type); };
  const updateArchivePreview = (id, previewData) => { const editedRecord = archives.find((record) => record.id === id); const next = archives.map((record) => record.id === id ? { ...record, title: previewData.title, previewData } : record); setArchives(next); writeArchives(next); if (editedRecord) setPreviewOverrides((current) => ({ ...current, [editedRecord.type]: previewData })); toast("저장된 문서를 수정했습니다."); };
  const removeArchive = (id) => { const next = deleteArchive(id); setArchives(next); if (archiveId === id) setArchiveId(""); toast("문서함에서 삭제했습니다."); };
  const selectedArchive = archives.find((item) => item.id === archiveId);

  if (mode === "home") return <HandoffHome archiveCount={archives.length} onOpen={openMode} />;
  if (mode === "archive") return <HandoffArchive archives={archives} filter={archiveFilter} selected={selectedArchive} onFilter={setArchiveFilter} onOpen={setArchiveId} onBack={() => openMode("home")} onList={() => setArchiveId("")} onClone={clone} onShare={share} onPreviewChange={updateArchivePreview} onDelete={removeArchive} />;
  return <HandoffDetail type={mode} step={step} conditions={activeConditions} candidates={activeCandidates} selectedIds={activeIds} previewData={preview} savedDraftId={savedDraftId} members={members} generating={generating} generationNote={generationNote} onBack={() => openMode("home")} onStep={goToStep} onCondition={changeCondition} onInclude={toggleInclude} onToggle={toggleCandidate} onEdit={(nextPreview) => { setSavedDraftId(""); setPreviewOverrides((current) => ({ ...current, [previewType]: nextPreview })); }} onRegenerate={() => { resetEditedPreview(); if (mode !== "onboarding") { generateHandoverPreview(); } else { toast("최신 업무 자료로 미리보기를 다시 생성했습니다."); } }} onShare={share} onSave={save} onOpenArchive={() => openMode("archive")} />;
}
