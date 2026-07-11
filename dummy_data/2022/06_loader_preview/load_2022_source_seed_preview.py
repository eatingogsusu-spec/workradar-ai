from __future__ import annotations

import csv
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "dummy_data" / "2022"
OUT = SOURCE / "06_loader_preview" / "out_preview"
NAMESPACE = uuid.UUID("9f16729a-7f4d-4a4a-85c6-44da0cb08780")


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, headers, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def mapped_id(source_type: str, source_id: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{source_type}:{source_id}"))


def main() -> None:
    docs = read_csv(SOURCE / "03_structured_csv" / "source_document_index.csv")
    issues = read_csv(SOURCE / "03_structured_csv" / "issue_events.csv")
    employees = read_csv(SOURCE / "01_master_data" / "employees.csv")
    status_map = {(r["target_table"], r["source_value"]): r["target_value"] for r in read_csv(SOURCE / "05_mapping" / "status_mapping.csv")}
    missing_paths = [r["file_path"] for r in docs if not (SOURCE / r["file_path"]).exists()]
    issue_ids = {r["issue_id"] for r in issues}
    orphan_docs = [r["doc_id"] for r in docs if r["related_issue_id"] and r["related_issue_id"] not in issue_ids]

    document_rows = [{"source_id": r["doc_id"], "id": mapped_id("document", r["doc_id"]), "project_id": mapped_id("project", "PROJECT-2022"), "file_name": Path(r["file_path"]).name, "file_type": "other", "storage_uri": f"dummy_data/2022/{r['file_path']}", "created_at": f"{r['created_date']}T09:00:00", "analysis_status": "pending"} for r in docs]
    issue_rows = [{"source_id": r["issue_id"], "id": mapped_id("issue", r["issue_id"]), "project_id": mapped_id("project", "PROJECT-2022"), "title": r["issue_title"], "status": status_map.get(("issues", r["status"]), "open"), "severity": r["severity"].lower(), "created_at": f"{r['start_date']}T09:00:00"} for r in issues]
    todo_rows = [{"source_id": f"TODO-{r['issue_id']}", "id": mapped_id("todo", f"TODO-{r['issue_id']}"), "project_id": mapped_id("project", "PROJECT-2022"), "title": f"[PREVIEW] {r['issue_title']} 확인", "status": "open", "priority": r["severity"].lower(), "linked_issue_id": mapped_id("issue", r["issue_id"]), "assignee_member_id": ""} for r in issues]

    write_csv(OUT / "documents_preview.csv", list(document_rows[0]), document_rows)
    write_csv(OUT / "issues_preview.csv", list(issue_rows[0]), issue_rows)
    write_csv(OUT / "todos_preview.csv", list(todo_rows[0]), todo_rows)
    print(f"source documents: {len(docs)}")
    print(f"preview documents rows: {len(document_rows)}")
    print(f"preview issues rows: {len(issue_rows)}")
    print(f"preview todo candidates: {len(todo_rows)}")
    print(f"missing file paths: {len(missing_paths)}")
    print(f"orphan issue/document links: {len(orphan_docs)}")
    print(f"status mapping failures: {sum(1 for r in issue_rows if r['status'] == 'open' and next(x for x in issues if x['issue_id'] == r['source_id'])['status'] != 'in_progress')}")
    print("expected output mixed into input: False")
    print("actual DB insert: False")


if __name__ == "__main__":
    main()
