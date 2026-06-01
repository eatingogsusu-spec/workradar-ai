from __future__ import annotations

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "erd-split"

TABLES = {
    "USERS": [
        ("id", "uuid", "PK"),
        ("name", "string", ""),
        ("email", "string", "UK"),
        ("password_hash", "text", ""),
        ("role", "string", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ],
    "TEAMS": [
        ("id", "uuid", "PK"),
        ("name", "string", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ],
    "PROJECTS": [
        ("id", "uuid", "PK"),
        ("team_id", "uuid", "FK"),
        ("created_by", "uuid", "FK"),
        ("name", "string", ""),
        ("description", "text", ""),
        ("status", "string", ""),
        ("start_date", "date", ""),
        ("end_date", "date", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ],
    "PROJECT_MEMBERS": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("user_id", "uuid", "FK"),
        ("role", "string", ""),
        ("joined_at", "timestamp", ""),
    ],
    "DOCUMENTS": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("uploaded_by", "uuid", "FK"),
        ("file_name", "string", ""),
        ("file_type", "string", ""),
        ("source_type", "string", ""),
        ("storage_path", "text", ""),
        ("status", "string", ""),
        ("uploaded_at", "timestamp", ""),
    ],
    "DOCUMENT_CHUNKS": [
        ("id", "uuid", "PK"),
        ("document_id", "uuid", "FK"),
        ("project_id", "uuid", "FK"),
        ("content", "text", ""),
        ("chunk_index", "int", ""),
        ("page_number", "int", ""),
        ("created_at", "timestamp", ""),
    ],
    "CHUNK_EMBEDDINGS": [
        ("id", "uuid", "PK"),
        ("chunk_id", "uuid", "FK"),
        ("faiss_index_path", "string", ""),
        ("faiss_index_id", "int", ""),
        ("embedding_model", "string", ""),
        ("created_at", "timestamp", ""),
    ],
    "TODOS": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("assignee_id", "uuid", "FK"),
        ("created_by", "uuid", "FK"),
        ("source_document_id", "uuid", "FK"),
        ("source_chunk_id", "uuid", "FK"),
        ("linked_issue_id", "uuid", "FK"),
        ("reviewed_by", "uuid", "FK"),
        ("title", "string", ""),
        ("description", "text", ""),
        ("status", "string", ""),
        ("priority", "string", ""),
        ("source_type", "string", ""),
        ("approval_status", "string", ""),
        ("confidence_score", "int", ""),
        ("reviewed_at", "timestamp", ""),
        ("due_date", "timestamp", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ],
    "ISSUES": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("reporter_id", "uuid", "FK"),
        ("assignee_id", "uuid", "FK"),
        ("source_document_id", "uuid", "FK"),
        ("title", "string", ""),
        ("description", "text", ""),
        ("severity", "string", ""),
        ("status", "string", ""),
        ("source_type", "string", ""),
        ("confidence_score", "int", ""),
        ("is_candidate", "boolean", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ],
    "CHAT_MESSAGES": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("user_id", "uuid", "FK"),
        ("role", "string", ""),
        ("content", "text", ""),
        ("sources_json", "jsonb", ""),
        ("created_at", "timestamp", ""),
    ],
    "WEEKLY_REPORTS": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("created_by", "uuid", "FK"),
        ("week_start", "timestamp", ""),
        ("week_end", "timestamp", ""),
        ("content", "text", ""),
        ("progress_rate", "int", ""),
    ],
    "MONTHLY_REPORTS": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("created_by", "uuid", "FK"),
        ("month_start", "timestamp", ""),
        ("month_end", "timestamp", ""),
        ("content", "text", ""),
        ("progress_rate", "int", ""),
    ],
    "HANDOFF_REPORTS": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("created_by", "uuid", "FK"),
        ("title", "string", ""),
        ("content", "text", ""),
        ("handoff_score", "int", ""),
        ("missing_items_json", "jsonb", ""),
    ],
    "AI_SUMMARIES": [
        ("id", "uuid", "PK"),
        ("project_id", "uuid", "FK"),
        ("document_id", "uuid", "FK"),
        ("summary_type", "string", ""),
        ("summary", "text", ""),
        ("extracted_json", "jsonb", ""),
        ("created_at", "timestamp", ""),
    ],
}

DIAGRAMS = [
    {
        "slug": "01-core-project",
        "title": "01 Core Project",
        "subtitle": "Users, teams, projects, memberships",
        "tables": ["USERS", "TEAMS", "PROJECTS", "PROJECT_MEMBERS"],
        "relations": [
            ("TEAMS", "PROJECTS", "has"),
            ("USERS", "PROJECTS", "creates"),
            ("PROJECTS", "PROJECT_MEMBERS", "has"),
            ("USERS", "PROJECT_MEMBERS", "joins"),
        ],
        "pos": {
            "USERS": (70, 130),
            "TEAMS": (70, 430),
            "PROJECTS": (410, 250),
            "PROJECT_MEMBERS": (750, 250),
        },
    },
    {
        "slug": "02-ai-analysis-documents",
        "title": "02 AI Analysis / Documents",
        "subtitle": "Upload source, chunks, vectors, summaries",
        "tables": ["PROJECTS", "USERS", "DOCUMENTS", "DOCUMENT_CHUNKS", "CHUNK_EMBEDDINGS", "AI_SUMMARIES"],
        "relations": [
            ("PROJECTS", "DOCUMENTS", "contains"),
            ("USERS", "DOCUMENTS", "uploads"),
            ("DOCUMENTS", "DOCUMENT_CHUNKS", "splits"),
            ("PROJECTS", "DOCUMENT_CHUNKS", "scopes"),
            ("DOCUMENT_CHUNKS", "CHUNK_EMBEDDINGS", "indexes"),
            ("PROJECTS", "AI_SUMMARIES", "has"),
            ("DOCUMENTS", "AI_SUMMARIES", "summarized_by"),
        ],
        "pos": {
            "PROJECTS": (70, 230),
            "USERS": (70, 560),
            "DOCUMENTS": (410, 180),
            "DOCUMENT_CHUNKS": (750, 170),
            "CHUNK_EMBEDDINGS": (1090, 200),
            "AI_SUMMARIES": (750, 560),
        },
    },
    {
        "slug": "03-todo-issues",
        "title": "03 TODO / Issues",
        "subtitle": "Work tracking, evidence documents, issue candidate review",
        "tables": ["PROJECTS", "USERS", "DOCUMENTS", "DOCUMENT_CHUNKS", "TODOS", "ISSUES"],
        "relations": [
            ("PROJECTS", "TODOS", "tracks"),
            ("USERS", "TODOS", "assigned/creates/reviews"),
            ("DOCUMENTS", "TODOS", "evidence"),
            ("DOCUMENT_CHUNKS", "TODOS", "evidence"),
            ("PROJECTS", "ISSUES", "logs"),
            ("USERS", "ISSUES", "reports/assigned"),
            ("DOCUMENTS", "ISSUES", "evidence"),
        ],
        "pos": {
            "PROJECTS": (70, 230),
            "USERS": (70, 560),
            "DOCUMENTS": (410, 120),
            "DOCUMENT_CHUNKS": (410, 480),
            "TODOS": (780, 90),
            "ISSUES": (780, 540),
        },
    },
    {
        "slug": "04-reports-handoff",
        "title": "04 Reports / Handoff",
        "subtitle": "Weekly and monthly reports, handoff, AI summary source",
        "tables": ["PROJECTS", "USERS", "WEEKLY_REPORTS", "MONTHLY_REPORTS", "HANDOFF_REPORTS", "AI_SUMMARIES"],
        "relations": [
            ("PROJECTS", "WEEKLY_REPORTS", "has"),
            ("USERS", "WEEKLY_REPORTS", "creates"),
            ("PROJECTS", "MONTHLY_REPORTS", "has"),
            ("USERS", "MONTHLY_REPORTS", "creates"),
            ("PROJECTS", "HANDOFF_REPORTS", "has"),
            ("USERS", "HANDOFF_REPORTS", "creates"),
            ("PROJECTS", "AI_SUMMARIES", "has"),
        ],
        "pos": {
            "PROJECTS": (70, 160),
            "USERS": (70, 520),
            "WEEKLY_REPORTS": (410, 70),
            "MONTHLY_REPORTS": (410, 360),
            "HANDOFF_REPORTS": (750, 70),
            "AI_SUMMARIES": (750, 410),
        },
    },
    {
        "slug": "05-assistant-rag",
        "title": "05 AI Assistant / RAG",
        "subtitle": "Chat messages connected to project knowledge sources",
        "tables": ["PROJECTS", "USERS", "CHAT_MESSAGES", "DOCUMENTS", "DOCUMENT_CHUNKS", "CHUNK_EMBEDDINGS"],
        "relations": [
            ("PROJECTS", "CHAT_MESSAGES", "contains"),
            ("USERS", "CHAT_MESSAGES", "sends"),
            ("PROJECTS", "DOCUMENTS", "contains"),
            ("DOCUMENTS", "DOCUMENT_CHUNKS", "splits"),
            ("DOCUMENT_CHUNKS", "CHUNK_EMBEDDINGS", "indexes"),
        ],
        "pos": {
            "PROJECTS": (70, 170),
            "USERS": (70, 500),
            "CHAT_MESSAGES": (430, 390),
            "DOCUMENTS": (430, 90),
            "DOCUMENT_CHUNKS": (770, 100),
            "CHUNK_EMBEDDINGS": (1110, 130),
        },
    },
]

WIDTH = 1380
HEIGHT = 820
CARD_W = 240
HEADER_H = 34
ROW_H = 23


def table_height(name: str) -> int:
    return HEADER_H + 12 + len(TABLES[name]) * ROW_H


def mermaid(diagram: dict) -> str:
    lines = ["erDiagram"]
    for src, dst, label in diagram["relations"]:
        lines.append(f"  {src} ||--o{{ {dst} : {label}")
    lines.append("")
    for table in diagram["tables"]:
        lines.append(f"  {table} {{")
        for col, col_type, key in TABLES[table]:
            suffix = f" {key}" if key else ""
            lines.append(f"    {col_type} {col}{suffix}")
        lines.append("  }")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def anchor(pos: dict, name: str, side: str) -> tuple[int, int]:
    x, y = pos[name]
    h = table_height(name)
    if side == "left":
        return x, y + h // 2
    if side == "right":
        return x + CARD_W, y + h // 2
    if side == "top":
        return x + CARD_W // 2, y
    return x + CARD_W // 2, y + h


def relation_points(pos: dict, src: str, dst: str) -> tuple[tuple[int, int], tuple[int, int]]:
    sx, sy = pos[src]
    dx, dy = pos[dst]
    if dx > sx + CARD_W:
        return anchor(pos, src, "right"), anchor(pos, dst, "left")
    if sx > dx + CARD_W:
        return anchor(pos, src, "left"), anchor(pos, dst, "right")
    if dy > sy:
        return anchor(pos, src, "bottom"), anchor(pos, dst, "top")
    return anchor(pos, src, "top"), anchor(pos, dst, "bottom")


def draw_relation(pos: dict, src: str, dst: str, label: str, index: int) -> str:
    (x1, y1), (x2, y2) = relation_points(pos, src, dst)
    midx = (x1 + x2) // 2
    midy = (y1 + y2) // 2
    offset = ((index % 3) - 1) * 14
    if abs(x2 - x1) >= abs(y2 - y1):
        d = f"M{x1},{y1} C{midx},{y1 + offset} {midx},{y2 - offset} {x2},{y2}"
        lx, ly = midx, midy + offset
    else:
        d = f"M{x1},{y1} C{x1 + offset},{midy} {x2 - offset},{midy} {x2},{y2}"
        lx, ly = midx + offset, midy
    return f"""
      <path d="{d}" class="rel"/>
      <circle cx="{x1}" cy="{y1}" r="3.5" class="rel-dot"/>
      <path d="M{x2 - 9},{y2 - 5} L{x2},{y2} L{x2 - 9},{y2 + 5}" class="crow"/>
      <text x="{lx}" y="{ly}" class="rel-label">{escape(label)}</text>
    """


def draw_table(pos: dict, name: str) -> str:
    x, y = pos[name]
    h = table_height(name)
    rows = []
    row_y = y + HEADER_H + 21
    for col, col_type, key in TABLES[name]:
        if key:
            cls = key.lower()
            chip = f'<rect x="{x + 14}" y="{row_y - 14}" width="25" height="15" rx="4" class="chip {cls}"/><text x="{x + 26.5}" y="{row_y - 3}" class="chip-text">{key}</text>'
            name_x = x + 48
        else:
            chip = ""
            name_x = x + 18
        rows.append(
            f'{chip}<text x="{name_x}" y="{row_y}" class="col-name">{escape(col)}</text><text x="{x + CARD_W - 16}" y="{row_y}" class="col-type">{escape(col_type)}</text>'
        )
        row_y += ROW_H
    return f"""
    <g class="table">
      <rect x="{x}" y="{y}" width="{CARD_W}" height="{h}" rx="10" class="table-bg"/>
      <rect x="{x}" y="{y}" width="{CARD_W}" height="{HEADER_H}" rx="10" class="table-head"/>
      <rect x="{x}" y="{y + HEADER_H - 8}" width="{CARD_W}" height="8" class="table-head-square"/>
      <text x="{x + 16}" y="{y + 23}" class="table-title">{escape(name)}</text>
      <text x="{x + CARD_W - 16}" y="{y + 23}" class="table-count">{len(TABLES[name])} cols</text>
      {''.join(rows)}
    </g>
    """


def svg(diagram: dict) -> str:
    relations = "\n".join(draw_relation(diagram["pos"], src, dst, label, i) for i, (src, dst, label) in enumerate(diagram["relations"]))
    tables = "\n".join(draw_table(diagram["pos"], table) for table in diagram["tables"])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dce3f0"/></pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#1c2b4a" flood-opacity="0.10"/></filter>
  </defs>
  <style>
    .canvas {{ fill: #fff; }}
    .grid {{ fill: url(#grid); }}
    .title {{ font: 700 27px Arial, sans-serif; fill: #182033; }}
    .subtitle {{ font: 400 13px Arial, sans-serif; fill: #69738d; }}
    .table-bg {{ fill: #fff; stroke: #cfd8ea; stroke-width: 1.2; filter: url(#shadow); }}
    .table-head, .table-head-square {{ fill: #f4f7fc; }}
    .table-head {{ stroke: #cfd8ea; stroke-width: 1.2; }}
    .table-title {{ font: 700 13px Arial, sans-serif; fill: #17213a; }}
    .table-count {{ font: 400 10px Arial, sans-serif; fill: #8a94aa; text-anchor: end; }}
    .col-name {{ font: 600 11px Arial, sans-serif; fill: #2c3650; }}
    .col-type {{ font: 400 10px Arial, sans-serif; fill: #8a94aa; text-anchor: end; }}
    .chip.pk {{ fill: #e8f1ff; stroke: #4f7cff; }}
    .chip.fk {{ fill: #fff3df; stroke: #d08000; }}
    .chip.uk {{ fill: #edf8f2; stroke: #1a9e6a; }}
    .chip-text {{ font: 700 8px Arial, sans-serif; fill: #31405f; text-anchor: middle; }}
    .rel {{ fill: none; stroke: #7588ad; stroke-width: 1.45; opacity: .72; }}
    .rel-dot {{ fill: #4f7cff; }}
    .crow {{ fill: none; stroke: #7588ad; stroke-width: 1.45; stroke-linecap: round; stroke-linejoin: round; }}
    .rel-label {{ font: 500 9px Arial, sans-serif; fill: #65728d; paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }}
  </style>
  <rect width="{WIDTH}" height="{HEIGHT}" class="canvas"/>
  <rect width="{WIDTH}" height="{HEIGHT}" class="grid"/>
  <text x="42" y="46" class="title">Project AZAG ERD · {escape(diagram["title"])}</text>
  <text x="42" y="70" class="subtitle">{escape(diagram["subtitle"])}</text>
  <g>{relations}</g>
  <g>{tables}</g>
</svg>
"""


def html(diagram: dict, svg_text: str) -> str:
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Project AZAG ERD - {escape(diagram["title"])}</title>
  <style>
    body {{ margin: 0; background: #eef2f8; font-family: Arial, sans-serif; }}
    .wrap {{ width: {WIDTH}px; margin: 24px auto; background: white; border: 1px solid #cfd8ea; box-shadow: 0 20px 60px rgba(28,43,74,.12); }}
    @page {{ size: A3 landscape; margin: 8mm; }}
    @media print {{ body {{ background: white; }} .wrap {{ width: 100%; margin: 0; border: 0; box-shadow: none; }} svg {{ width: 100%; height: auto; }} }}
  </style>
</head>
<body><div class="wrap">{svg_text}</div></body>
</html>
"""


def index_html() -> str:
    links = "\n".join(
        f'<li><a href="{d["slug"]}.html">{escape(d["title"])}</a> · <a href="{d["slug"]}.pdf">PDF</a> · <a href="{d["slug"]}.mmd">Mermaid</a></li>'
        for d in DIAGRAMS
    )
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Project AZAG Split ERD Index</title>
  <style>
    body {{ font-family: Arial, sans-serif; background: #f6f8fc; color: #182033; padding: 40px; }}
    h1 {{ margin-bottom: 8px; }}
    p {{ color: #69738d; }}
    li {{ margin: 12px 0; }}
    a {{ color: #315ed9; text-decoration: none; font-weight: 700; }}
  </style>
</head>
<body>
  <h1>Project AZAG Split ERDs</h1>
  <p>Full ERD is split into smaller domain diagrams for easier review.</p>
  <ol>{links}</ol>
</body>
</html>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for diagram in DIAGRAMS:
        slug = diagram["slug"]
        mmd_text = mermaid(diagram)
        svg_text = svg(diagram)
        (OUT / f"{slug}.mmd").write_text(mmd_text, encoding="utf-8")
        (OUT / f"{slug}.svg").write_text(svg_text, encoding="utf-8")
        (OUT / f"{slug}.html").write_text(html(diagram, svg_text), encoding="utf-8")
    (OUT / "index.html").write_text(index_html(), encoding="utf-8")


if __name__ == "__main__":
    main()
