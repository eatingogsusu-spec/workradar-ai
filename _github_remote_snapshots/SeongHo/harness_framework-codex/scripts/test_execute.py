import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import execute as ex


@pytest.fixture
def tmp_project(tmp_path):
    phases_dir = tmp_path / "phases"
    phases_dir.mkdir()

    agents_md = tmp_path / "AGENTS.md"
    agents_md.write_text("# Rules\n- rule one\n- rule two", encoding="utf-8")

    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "arch.md").write_text("# Architecture\nSome content", encoding="utf-8")
    (docs_dir / "guide.md").write_text("# Guide\nAnother doc", encoding="utf-8")

    return tmp_path


@pytest.fixture
def phase_dir(tmp_project):
    d = tmp_project / "phases" / "0-mvp"
    d.mkdir()

    index = {
        "project": "TestProject",
        "phase": "mvp",
        "steps": [
            {"step": 0, "name": "setup", "status": "completed", "summary": "project setup complete"},
            {"step": 1, "name": "core", "status": "completed", "summary": "core logic implemented"},
            {"step": 2, "name": "ui", "status": "pending"},
        ],
    }
    (d / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    (d / "step2.md").write_text("# Step 2: UI\n\nImplement the UI.", encoding="utf-8")

    return d


@pytest.fixture
def top_index(tmp_project):
    top = {
        "phases": [
            {"dir": "0-mvp", "status": "pending"},
            {"dir": "1-polish", "status": "pending"},
        ]
    }
    p = tmp_project / "phases" / "index.json"
    p.write_text(json.dumps(top, indent=2), encoding="utf-8")
    return p


@pytest.fixture
def executor(tmp_project, phase_dir):
    with patch.object(ex, "ROOT", tmp_project):
        inst = ex.StepExecutor("0-mvp")
    inst._root = str(tmp_project)
    inst._phases_dir = tmp_project / "phases"
    inst._phase_dir = phase_dir
    inst._phase_dir_name = "0-mvp"
    inst._index_file = phase_dir / "index.json"
    inst._top_index_file = tmp_project / "phases" / "index.json"
    return inst


class TestStamp:
    def test_returns_kst_timestamp(self, executor):
        assert "+0900" in executor._stamp()

    def test_format_is_iso(self, executor):
        dt = datetime.strptime(executor._stamp(), "%Y-%m-%dT%H:%M:%S%z")
        assert dt.tzinfo is not None

    def test_is_current_time(self, executor):
        before = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0)
        parsed = datetime.strptime(executor._stamp(), "%Y-%m-%dT%H:%M:%S%z")
        after = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0) + timedelta(seconds=1)
        assert before <= parsed <= after


class TestJsonHelpers:
    def test_roundtrip(self, tmp_path):
        data = {"key": "value", "nested": [1, 2, 3]}
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, data)
        assert ex.StepExecutor._read_json(p) == data

    def test_save_indented(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"a": 1})
        assert "\n" in p.read_text(encoding="utf-8")

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ex.StepExecutor._read_json(tmp_path / "nope.json")


class TestLoadGuardrails:
    def test_loads_agents_md_and_docs(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "# Rules" in result
        assert "AGENTS.md" in result
        assert "# Architecture" in result
        assert "# Guide" in result

    def test_sections_separated_by_divider(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "---" in result

    def test_docs_sorted_alphabetically(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert result.index("arch") < result.index("guide")

    def test_no_agents_md(self, executor, tmp_project):
        (tmp_project / "AGENTS.md").unlink()
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "AGENTS.md" not in result
        assert "Architecture" in result

    def test_no_docs_dir(self, executor, tmp_project):
        import shutil

        shutil.rmtree(tmp_project / "docs")
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "Rules" in result
        assert "Architecture" not in result


class TestBuildStepContext:
    def test_includes_completed_with_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert "Step 0 (setup): project setup complete" in result
        assert "Step 1 (core): core logic implemented" in result

    def test_excludes_pending(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        assert "ui" not in ex.StepExecutor._build_step_context(index)

    def test_empty_when_no_completed(self):
        index = {"steps": [{"step": 0, "name": "a", "status": "pending"}]}
        assert ex.StepExecutor._build_step_context(index) == ""

    def test_has_header(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        assert ex.StepExecutor._build_step_context(index).startswith("## Previous Step Outputs")


class TestBuildPreamble:
    def test_includes_project_name(self, executor):
        assert "TestProject" in executor._build_preamble("", "")

    def test_includes_guardrails(self, executor):
        assert "GUARD_CONTENT" in executor._build_preamble("GUARD_CONTENT", "")

    def test_includes_step_context(self, executor):
        assert "Previous Step Outputs" in executor._build_preamble("", "## Previous Step Outputs\n\n- Step 0: done")

    def test_includes_commit_example(self, executor):
        assert "feat(mvp):" in executor._build_preamble("", "")

    def test_retry_section_with_prev_error(self, executor):
        result = executor._build_preamble("", "", prev_error="boom")
        assert "Previous Attempt Failed" in result
        assert "boom" in result

    def test_includes_index_path(self, executor):
        assert "/phases/0-mvp/index.json" in executor._build_preamble("", "")


class TestUpdateTopIndex:
    def test_completed(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        mvp = next(p for p in json.loads(top_index.read_text(encoding="utf-8"))["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"
        assert "completed_at" in mvp

    def test_error(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("error")
        mvp = next(p for p in json.loads(top_index.read_text(encoding="utf-8"))["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "error"
        assert "failed_at" in mvp

    def test_blocked(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("blocked")
        mvp = next(p for p in json.loads(top_index.read_text(encoding="utf-8"))["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "blocked"
        assert "blocked_at" in mvp


class TestCheckoutBranch:
    def _mock_git(self, executor, responses):
        call_idx = {"i": 0}

        def fake_git(*args):
            idx = call_idx["i"]
            call_idx["i"] += 1
            if idx < len(responses):
                return responses[idx]
            return MagicMock(returncode=0, stdout="", stderr="")

        executor._run_git = fake_git

    def test_branch_name_uses_codex_prefix(self, executor):
        assert executor._branch_name() == "codex/mvp"

    def test_already_on_branch(self, executor):
        self._mock_git(executor, [MagicMock(returncode=0, stdout="codex/mvp\n", stderr="")])
        executor._checkout_branch()

    def test_branch_exists_checkout(self, executor):
        self._mock_git(
            executor,
            [
                MagicMock(returncode=0, stdout="main\n", stderr=""),
                MagicMock(returncode=0, stdout="", stderr=""),
                MagicMock(returncode=0, stdout="", stderr=""),
            ],
        )
        executor._checkout_branch()

    def test_branch_not_exists_create(self, executor):
        self._mock_git(
            executor,
            [
                MagicMock(returncode=0, stdout="main\n", stderr=""),
                MagicMock(returncode=1, stdout="", stderr="not found"),
                MagicMock(returncode=0, stdout="", stderr=""),
            ],
        )
        executor._checkout_branch()

    def test_checkout_fails_exits(self, executor):
        self._mock_git(
            executor,
            [
                MagicMock(returncode=0, stdout="main\n", stderr=""),
                MagicMock(returncode=1, stdout="", stderr=""),
                MagicMock(returncode=1, stdout="", stderr="dirty tree"),
            ],
        )
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1


class TestCommitStep:
    def test_two_phase_commit(self, executor):
        calls = []

        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")

        executor._run_git = fake_git
        executor._commit_step(2, "ui")

        commit_calls = [c for c in calls if c[0] == "commit"]
        assert len(commit_calls) == 2
        assert "feat(mvp):" in commit_calls[0][2]
        assert "chore(mvp):" in commit_calls[1][2]


class TestInvokeCodex:
    def test_invokes_codex_with_correct_args(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"result": "ok"}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            output = executor._invoke_codex(step, "PREAMBLE\n")

        cmd = mock_run.call_args[0][0]
        assert cmd[:2] == ["codex", "exec"]
        assert "--cd" in cmd
        assert "--sandbox" in cmd
        assert "workspace-write" in cmd
        assert "--ask-for-approval" in cmd
        assert "never" in cmd
        assert cmd[-1] == "-"
        assert "PREAMBLE" in mock_run.call_args.kwargs["input"]
        assert "Implement the UI." in mock_run.call_args.kwargs["input"]
        assert output["exitCode"] == 0

    def test_saves_output_json(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"ok": true}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result):
            executor._invoke_codex(step, "preamble")

        output_file = executor._phase_dir / "step2-output.json"
        assert output_file.exists()
        data = json.loads(output_file.read_text(encoding="utf-8"))
        assert data["step"] == 2
        assert data["name"] == "ui"
        assert data["exitCode"] == 0

    def test_nonexistent_step_file_exits(self, executor):
        with pytest.raises(SystemExit) as exc_info:
            executor._invoke_codex({"step": 99, "name": "missing"}, "preamble")
        assert exc_info.value.code == 1

    def test_timeout_is_1800(self, executor):
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_codex({"step": 2, "name": "ui"}, "preamble")
        assert mock_run.call_args.kwargs["timeout"] == 1800


class TestProgressIndicator:
    def test_context_manager(self):
        with ex.progress_indicator("test") as pi:
            time_start = datetime.now()
            while (datetime.now() - time_start).total_seconds() < 0.15:
                pass
        assert pi.elapsed >= 0.1


class TestMainCli:
    def test_no_args_exits(self):
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2

    def test_invalid_phase_dir_exits(self):
        with patch("sys.argv", ["execute.py", "nonexistent"]):
            with patch.object(ex, "ROOT", Path("/tmp/fake_nonexistent")):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_missing_index_exits(self, tmp_project):
        (tmp_project / "phases" / "empty").mkdir()
        with patch("sys.argv", ["execute.py", "empty"]):
            with patch.object(ex, "ROOT", tmp_project):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1


class TestCheckBlockers:
    def _make_executor_with_steps(self, tmp_project, steps):
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        (d / "index.json").write_text(json.dumps({"project": "T", "phase": "test", "steps": steps}), encoding="utf-8")

        inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        return inst

    def test_error_step_exits_1(self, tmp_project):
        inst = self._make_executor_with_steps(
            tmp_project,
            [
                {"step": 0, "name": "ok", "status": "completed"},
                {"step": 1, "name": "bad", "status": "error", "error_message": "fail"},
            ],
        )
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 1

    def test_blocked_step_exits_2(self, tmp_project):
        inst = self._make_executor_with_steps(
            tmp_project,
            [
                {"step": 0, "name": "ok", "status": "completed"},
                {"step": 1, "name": "stuck", "status": "blocked", "blocked_reason": "API key"},
            ],
        )
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 2
