import { useEffect, useMemo, useState } from "react";
import HandoffHome from "./HandoffHome";
import HandoffDetail from "./HandoffDetail";
import HandoffArchive from "./HandoffArchive";
import { DEFAULT_HANDOFF_CONDITIONS, DEFAULT_ONBOARDING_CONDITIONS, HANDOFF_CANDIDATES, ONBOARDING_CANDIDATES, PEOPLE, DEPARTMENTS, buildPreviewData, buildOnboardingCandidates, readArchives, writeArchives, deleteArchive, fetchHandoffCandidates, fetchMembers, fetchHandoverPreview, parseHandoverMarkdown } from "./handoverData";
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
  const [onboardingCandidates, setOnboardingCandidates] = useState(ONBOARDING_CANDIDATES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState(PEOPLE);
  const [memberTeamMap, setMemberTeamMap] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generationNote, setGenerationNote] = useState("");

  const activeConditions = mode === "onboarding" ? onboarding : handoff;
  const activeCandidates = mode === "onboarding" ? onboardingCandidates : handoffCandidates;
  const activeIds = mode === "onboarding" ? onboardingIds : handoffIds;
  const generatedHandoffPreview = useMemo(() => buildPreviewData("handoff", handoff, handoffCandidates, handoffIds), [handoff, handoffCandidates, handoffIds]);
  const generatedOnboardingPreview = useMemo(() => buildPreviewData("onboarding", onboarding, onboardingCandidates, onboardingIds), [onboarding, onboardingCandidates, onboardingIds]);
  const previewType = mode === "onboarding" ? "onboarding" : "handoff";
  const preview = previewOverrides[previewType] || (previewType === "onboarding" ? generatedOnboardingPreview : generatedHandoffPreview);
  const openMode = (next) => {
    const normalized = normalizeMode(next);
    if (normalized === "onboarding") {
      setOnboarding((current) => ({ ...current, target: "신입" }));
      setPreviewOverrides((current) => ({ ...current, onboarding: null }));
    }
    setMode(normalized); setArchiveId(""); setSavedDraftId(""); setStep(1); window.G && (window.G.currentKnowledgeType = normalized);
  };
  const getPreviewData = (type) => { const normalized = normalizeMode(type) === "onboarding" ? "onboarding" : "handoff"; return previewOverrides[normalized] || (normalized === "onboarding" ? generatedOnboardingPreview : generatedHandoffPreview); };
  const openPreview = (type) => { const normalized = normalizeMode(type) === "onboarding" ? "onboarding" : "handoff"; setMode(normalized); setStep(3); return getPreviewData(normalized); };

  useEffect(() => setHandoffController({ openMode, openPreview, getPreviewData }), [generatedHandoffPreview, generatedOnboardingPreview, previewOverrides]);
  useEffect(() => { const command = (event) => event.detail?.command === "preview" ? openPreview(event.detail.mode) : openMode(event.detail?.mode || "home"); const nav = () => openMode("home"); window.addEventListener("opsradar:handoff-command", command); window.addEventListener("opsradar:open-handover", nav); return () => { window.removeEventListener("opsradar:handoff-command", command); window.removeEventListener("opsradar:open-handover", nav); }; }, [generatedHandoffPreview, generatedOnboardingPreview, previewOverrides]);
  useEffect(() => {
    setLoading(true);
    fetchHandoffCandidates().then((candidates) => {
      const onboardingMaterials = buildOnboardingCandidates(candidates);
      setHandoffCandidates(candidates);
      setOnboardingCandidates(onboardingMaterials);
      setHandoffIds(candidates.map((v) => v.id));
      setOnboardingIds(onboardingMaterials.map((v) => v.id));
    }).catch(() => { setError("API 연결 실패 - 기본 데이터를 사용합니다."); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetchMembers().then(({ names, teamMap }) => {
      setMembers(names); setMemberTeamMap(teamMap);
      setHandoff((c) => ({ ...c, owner: c.owner || names[0] || "", receiver: c.receiver || names[1] || "" }));
      setOnboarding((c) => ({ ...c, target: "신입", mentor: c.mentor || names[1] || names[0] || "" }));
    });
  }, []);

  // Step 2→3 진입 시 선택된 실제 Todo/이슈만 백엔드 LLM에 전달한다.
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
  const generateOnboardingPreview = async () => {
    const selected = onboardingCandidates.filter((candidate) => onboardingIds.includes(candidate.id));
    const todoIds = selected.filter((candidate) => candidate.id.startsWith("todo_")).map((candidate) => candidate.id.slice(5));
    const issueIds = selected.filter((candidate) => candidate.id.startsWith("issue_")).map((candidate) => candidate.id.slice(6));
    if (!todoIds.length && !issueIds.length) {
      setGenerationNote("실제 Todo 또는 이슈를 선택하면 AI 적응 플랜을 생성할 수 있습니다.");
      return;
    }
    setGenerating(true);
    setGenerationNote("");
    try {
      const { content, mode: genMode, documents } = await fetchHandoverPreview({
        target: onboarding.target, mentor: onboarding.mentor, type: "onboarding",
        todoIds, issueIds, department: onboarding.department, period: onboarding.period,
      });
      if (genMode === "ai" && content) {
        const parsed = parseHandoverMarkdown(
          content,
          "3 Step으로 배우는 업무 적응 플랜 - 신입",
          documents,
          "onboarding",
        );
        setSavedDraftId("");
        setPreviewOverrides((current) => ({ ...current, onboarding: parsed }));
      } else {
        setGenerationNote("AI 연결이 없어 선택한 실제 자료를 기준으로 기본 플랜을 표시합니다.");
      }
    } catch {
      setGenerationNote("AI 연결이 없어 선택한 실제 자료를 기준으로 기본 플랜을 표시합니다.");
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
    if (next === 3) {
      if (mode === "onboarding") generateOnboardingPreview();
      else generateHandoverPreview();
    }
  };

  const resetEditedPreview = (type = previewType) => { setSavedDraftId(""); setPreviewOverrides((current) => ({ ...current, [type]: null })); };
  const changeCondition = (key, value) => {
    resetEditedPreview();
    (mode === "onboarding" ? setOnboarding : setHandoff)((current) => {
      const next = { ...current, [key]: value };
      // 담당자/신입 변경 시 실제 소속 팀을 우선 반영한다.
      if (((key === "owner" && mode !== "onboarding") || (key === "target" && mode === "onboarding")) && memberTeamMap[value] && DEPARTMENTS.includes(memberTeamMap[value])) {
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
  const clone = (record) => { if (record.type === "onboarding") { setOnboarding({ ...DEFAULT_ONBOARDING_CONDITIONS, ...record.conditions, target: "신입" }); setOnboardingIds(record.selectedIds || []); } else { setHandoff({ ...DEFAULT_HANDOFF_CONDITIONS, ...record.conditions }); setHandoffIds(record.selectedIds || []); } openMode(record.type); };
  const updateArchivePreview = (id, previewData) => { const editedRecord = archives.find((record) => record.id === id); const next = archives.map((record) => record.id === id ? { ...record, title: previewData.title, previewData } : record); setArchives(next); writeArchives(next); if (editedRecord) setPreviewOverrides((current) => ({ ...current, [editedRecord.type]: previewData })); toast("저장된 문서를 수정했습니다."); };
  const removeArchive = (id) => { const next = deleteArchive(id); setArchives(next); if (archiveId === id) setArchiveId(""); toast("문서함에서 삭제했습니다."); };
  const selectedArchive = archives.find((item) => item.id === archiveId);

  if (mode === "home") return <HandoffHome archiveCount={archives.length} onOpen={openMode} />;
  if (mode === "archive") return <HandoffArchive archives={archives} filter={archiveFilter} selected={selectedArchive} onFilter={setArchiveFilter} onOpen={setArchiveId} onBack={() => openMode("home")} onList={() => setArchiveId("")} onClone={clone} onShare={share} onPreviewChange={updateArchivePreview} onDelete={removeArchive} />;
  return <HandoffDetail type={mode} step={step} conditions={activeConditions} candidates={activeCandidates} selectedIds={activeIds} previewData={preview} savedDraftId={savedDraftId} members={members} generating={generating} generationNote={generationNote} onBack={() => openMode("home")} onStep={goToStep} onCondition={changeCondition} onInclude={toggleInclude} onToggle={toggleCandidate} onEdit={(nextPreview) => { setSavedDraftId(""); setPreviewOverrides((current) => ({ ...current, [previewType]: nextPreview })); }} onRegenerate={() => { resetEditedPreview(); if (mode === "onboarding") generateOnboardingPreview(); else generateHandoverPreview(); }} onShare={share} onSave={save} onOpenArchive={() => openMode("archive")} />;
}
