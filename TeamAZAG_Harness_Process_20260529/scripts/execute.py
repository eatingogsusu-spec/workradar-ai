#!/usr/bin/env python3
"""Codex로 Harness phase step을 검증하거나 실행합니다."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PHASES = ROOT / "phases"
VALID_STATUSES = {"pending", "completed", "blocked", "error"}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def stamp() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)


def validate_phase(phase_name: str) -> dict:
    phase_dir = PHASES / phase_name
    index_file = phase_dir / "index.json"
    errors: list[str] = []
    if not index_file.exists():
        raise ValueError(f"phase index 파일이 없습니다: {index_file.relative_to(ROOT)}")

    index = read_json(index_file)
    steps = index.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("phase index에는 step이 하나 이상 있어야 합니다.")
        steps = []
    for position, step in enumerate(steps):
        if step.get("step") != position:
            errors.append(f"{position}단계의 번호는 순서대로 {position}이어야 합니다.")
        if step.get("status") not in VALID_STATUSES:
            errors.append(f"{position}단계의 status 값이 올바르지 않습니다: {step.get('status')!r}")
        if not step.get("name"):
            errors.append(f"{position}단계에 name 값이 없습니다.")
        if not (phase_dir / f"step{position}.md").exists():
            errors.append(f"{position}단계 지시 파일이 없습니다.")

    top_index = read_json(PHASES / "index.json")
    if phase_name not in {entry.get("dir") for entry in top_index.get("phases", [])}:
        errors.append("phases/index.json에 해당 phase가 등록되어 있지 않습니다.")
    if errors:
        raise ValueError("\n".join(errors))
    return index


def load_guardrails() -> str:
    inputs = [ROOT / "AGENTS.md", ROOT / "docs" / "ARCHITECTURE.md", ROOT / "docs" / "ADR.md"]
    sections = []
    for path in inputs:
        if path.exists():
            sections.append(path.read_text(encoding="utf-8"))
    return "\n\n---\n\n".join(sections)


def ensure_execution_branch(phase_name: str) -> None:
    branch = f"codex/{phase_name}"
    current = git("branch", "--show-current").stdout.strip()
    if current == branch:
        return
    dirty = git("status", "--porcelain").stdout.strip()
    if dirty:
        raise RuntimeError("phase 실행 전에 로컬 변경 사항을 commit하거나 stash하세요.")
    exists = git("show-ref", "--verify", "--quiet", f"refs/heads/{branch}").returncode == 0
    result = git("checkout", branch) if exists else git("checkout", "-b", branch)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"{branch} 브랜치로 checkout할 수 없습니다.")


def execute_step(phase_name: str, step: dict, guardrails: str) -> None:
    step_file = PHASES / phase_name / f"step{step['step']}.md"
    prompt = (
        "TeamAZAG Harness 워크플로를 적용합니다. 규칙을 따르고 이 step만 "
        "수행하세요. 검증이 끝나면 해당 phase index의 step status와 summary를 "
        "갱신하세요.\n\n"
        f"{guardrails}\n\n---\n\n{step_file.read_text(encoding='utf-8')}"
    )
    result = subprocess.run(
        ["codex", "exec", "--cd", str(ROOT), "--sandbox", "workspace-write", "-"],
        cwd=ROOT,
        input=prompt,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(f"{step['step']}단계 실행 중 Codex가 실패했습니다.")

    index_file = PHASES / phase_name / "index.json"
    index = read_json(index_file)
    updated = next(item for item in index["steps"] if item["step"] == step["step"])
    if updated["status"] == "pending":
        raise RuntimeError(f"{step['step']}단계가 Harness status를 갱신하지 않았습니다.")
    updated[f"{updated['status']}_at"] = stamp()
    write_json(index_file, index)
    git("add", "-A")
    commit = git("commit", "-m", f"chore({phase_name}): complete step {step['step']} {step['name']}")
    if commit.returncode:
        raise RuntimeError(commit.stderr.strip() or "Harness step 산출물을 commit할 수 없습니다.")


def execute_phase(phase_name: str) -> None:
    validate_phase(phase_name)
    ensure_execution_branch(phase_name)
    guardrails = load_guardrails()
    while True:
        index = read_json(PHASES / phase_name / "index.json")
        pending = next((step for step in index["steps"] if step["status"] == "pending"), None)
        if pending is None:
            break
        execute_step(phase_name, pending, guardrails)
    top_file = PHASES / "index.json"
    top = read_json(top_file)
    for entry in top["phases"]:
        if entry["dir"] == phase_name:
            entry["status"] = "completed"
            entry["completed_at"] = stamp()
    write_json(top_file, top)
    git("add", str(top_file.relative_to(ROOT)))
    git("commit", "-m", f"chore({phase_name}): mark phase complete")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", help="phases/ 아래의 phase 디렉터리")
    parser.add_argument("--validate", action="store_true", help="코드를 수정하지 않고 phase 파일만 검증합니다.")
    args = parser.parse_args()
    try:
        validate_phase(args.phase)
        if args.validate:
            print(f"'{args.phase}' 단계 묶음은 유효합니다.")
            return 0
        execute_phase(args.phase)
        print(f"'{args.phase}' 단계 묶음이 완료되었습니다.")
        return 0
    except (ValueError, RuntimeError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
