#!/usr/bin/env python3
"""Validate or execute Harness phase steps through Codex."""

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
        raise ValueError(f"Missing phase index: {index_file.relative_to(ROOT)}")

    index = read_json(index_file)
    steps = index.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("Phase index must contain at least one step.")
        steps = []
    for position, step in enumerate(steps):
        if step.get("step") != position:
            errors.append(f"Step {position} must use sequential number {position}.")
        if step.get("status") not in VALID_STATUSES:
            errors.append(f"Step {position} has invalid status {step.get('status')!r}.")
        if not step.get("name"):
            errors.append(f"Step {position} is missing a name.")
        if not (phase_dir / f"step{position}.md").exists():
            errors.append(f"Missing instructions for step {position}.")

    top_index = read_json(PHASES / "index.json")
    if phase_name not in {entry.get("dir") for entry in top_index.get("phases", [])}:
        errors.append("Phase is missing from phases/index.json.")
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
        raise RuntimeError("Commit or stash local changes before executing a phase.")
    exists = git("show-ref", "--verify", "--quiet", f"refs/heads/{branch}").returncode == 0
    result = git("checkout", branch) if exists else git("checkout", "-b", branch)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"Unable to checkout {branch}.")


def execute_step(phase_name: str, step: dict, guardrails: str) -> None:
    step_file = PHASES / phase_name / f"step{step['step']}.md"
    prompt = (
        "You are applying the TeamAZAG Harness workflow. Follow the rules and "
        "perform only this step. Update the step status and summary in its phase "
        "index when verification is complete.\n\n"
        f"{guardrails}\n\n---\n\n{step_file.read_text(encoding='utf-8')}"
    )
    result = subprocess.run(
        ["codex", "exec", "--cd", str(ROOT), "--sandbox", "workspace-write", "-"],
        cwd=ROOT,
        input=prompt,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(f"Codex failed while executing step {step['step']}.")

    index_file = PHASES / phase_name / "index.json"
    index = read_json(index_file)
    updated = next(item for item in index["steps"] if item["step"] == step["step"])
    if updated["status"] == "pending":
        raise RuntimeError(f"Step {step['step']} did not update its Harness status.")
    updated[f"{updated['status']}_at"] = stamp()
    write_json(index_file, index)
    git("add", "-A")
    commit = git("commit", "-m", f"chore({phase_name}): complete step {step['step']} {step['name']}")
    if commit.returncode:
        raise RuntimeError(commit.stderr.strip() or "Unable to commit Harness step output.")


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
    parser.add_argument("phase", help="Phase directory under phases/")
    parser.add_argument("--validate", action="store_true", help="Validate phase files without editing code.")
    args = parser.parse_args()
    try:
        validate_phase(args.phase)
        if args.validate:
            print(f"Phase '{args.phase}' is valid.")
            return 0
        execute_phase(args.phase)
        print(f"Phase '{args.phase}' completed.")
        return 0
    except (ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
