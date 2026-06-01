from __future__ import annotations

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs"

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
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
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

POS = {
    "USERS": (60, 110),
    "TEAMS": (60, 420),
    "PROJECTS": (360, 235),
    "PROJECT_MEMBERS": (360, 610),
    "DOCUMENTS": (690, 90),
    "DOCUMENT_CHUNKS": (1000, 110),
    "CHUNK_EMBEDDINGS": (1310, 145),
    "TODOS": (690, 505),
    "ISSUES": (1000, 555),
    "CHAT_MESSAGES": (1310, 455),
    "WEEKLY_REPORTS": (60, 755),
    "MONTHLY_REPORTS": (60, 995),
    "HANDOFF_REPORTS": (360, 820),
    "AI_SUMMARIES": (1000, 820),
}

RELATIONS = [
    ("TEAMS", "PROJECTS", "has"),
    ("USERS", "PROJECTS", "creates"),
    ("PROJECTS", "PROJECT_MEMBERS", "has"),
    ("USERS", "PROJECT_MEMBERS", "joins"),
    ("PROJECTS", "DOCUMENTS", "contains"),
    ("USERS", "DOCUMENTS", "uploads"),
    ("DOCUMENTS", "DOCUMENT_CHUNKS", "splits"),
    ("PROJECTS", "DOCUMENT_CHUNKS", "scopes"),
    ("DOCUMENT_CHUNKS", "CHUNK_EMBEDDINGS", "indexes"),
    ("PROJECTS", "TODOS", "tracks"),
    ("USERS", "TODOS", "assigned/creates/reviews"),
    ("DOCUMENTS", "TODOS", "sources"),
    ("DOCUMENT_CHUNKS", "TODOS", "sources"),
    ("PROJECTS", "ISSUES", "logs"),
    ("USERS", "ISSUES", "reports/assigned"),
    ("DOCUMENTS", "ISSUES", "sources"),
    ("PROJECTS", "CHAT_MESSAGES", "contains"),
    ("USERS", "CHAT_MESSAGES", "sends"),
    ("PROJECTS", "WEEKLY_REPORTS", "has"),
    ("USERS", "WEEKLY_REPORTS", "creates"),
    ("PROJECTS", "MONTHLY_REPORTS", "has"),
    ("USERS", "MONTHLY_REPORTS", "creates"),
    ("PROJECTS", "HANDOFF_REPORTS", "has"),
    ("USERS", "HANDOFF_REPORTS", "creates"),
    ("PROJECTS", "AI_SUMMARIES", "has"),
    ("DOCUMENTS", "AI_SUMMARIES", "summarized_by"),
]

WIDTH = 1580
HEIGHT = 1220
CARD_W = 230
HEADER_H = 34
ROW_H = 24


def table_height(name: str) -> int:
    return HEADER_H + 12 + len(TABLES[name]) * ROW_H


def anchor(name: str, side: str) -> tuple[int, int]:
    x, y = POS[name]
    h = table_height(name)
    if side == "left":
        return x, y + h // 2
    if side == "right":
        return x + CARD_W, y + h // 2
    if side == "top":
        return x + CARD_W // 2, y
    return x + CARD_W // 2, y + h


def relation_points(src: str, dst: str) -> tuple[tuple[int, int], tuple[int, int]]:
    sx, sy = POS[src]
    dx, dy = POS[dst]
    if dx > sx + CARD_W:
        return anchor(src, "right"), anchor(dst, "left")
    if sx > dx + CARD_W:
        return anchor(src, "left"), anchor(dst, "right")
    if dy > sy:
        return anchor(src, "bottom"), anchor(dst, "top")
    return anchor(src, "top"), anchor(dst, "bottom")


def draw_relation(src: str, dst: str, label: str, index: int) -> str:
    (x1, y1), (x2, y2) = relation_points(src, dst)
    midx = (x1 + x2) // 2
    offset = ((index % 5) - 2) * 10
    if abs(x2 - x1) > abs(y2 - y1):
        d = f"M{x1},{y1} C{midx},{y1 + offset} {midx},{y2 - offset} {x2},{y2}"
        lx, ly = midx, (y1 + y2) // 2 + offset
    else:
        midy = (y1 + y2) // 2
        d = f"M{x1},{y1} C{x1 + offset},{midy} {x2 - offset},{midy} {x2},{y2}"
        lx, ly = (x1 + x2) // 2 + offset, midy
    return f"""
    <path d="{d}" class="rel"/>
    <circle cx="{x1}" cy="{y1}" r="3.5" class="rel-dot one"/>
    <path d="M{x2 - 9},{y2 - 5} L{x2},{y2} L{x2 - 9},{y2 + 5}" class="crow"/>
    <text x="{lx}" y="{ly}" class="rel-label">{escape(label)}</text>
    """


def draw_table(name: str) -> str:
    x, y = POS[name]
    h = table_height(name)
    rows = []
    current_y = y + HEADER_H + 22
    for column, col_type, key in TABLES[name]:
        chip = ""
        if key:
            cls = "pk" if key == "PK" else "fk" if key == "FK" else "uk"
            chip = f'<rect x="{x + 14}" y="{current_y - 14}" width="25" height="15" rx="4" class="chip {cls}"/><text x="{x + 26.5}" y="{current_y - 3}" class="chip-text">{key}</text>'
            name_x = x + 47
        else:
            name_x = x + 18
        rows.append(
            f"""
            {chip}
            <text x="{name_x}" y="{current_y}" class="col-name">{escape(column)}</text>
            <text x="{x + CARD_W - 16}" y="{current_y}" class="col-type">{escape(col_type)}</text>
            """
        )
        current_y += ROW_H
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


def build_svg() -> str:
    relations = "\n".join(draw_relation(src, dst, label, i) for i, (src, dst, label) in enumerate(RELATIONS))
    tables = "\n".join(draw_table(name) for name in TABLES)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#dce3f0"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#1c2b4a" flood-opacity="0.10"/>
    </filter>
  </defs>
  <style>
    .canvas {{ fill: #ffffff; }}
    .grid {{ fill: url(#grid); opacity: .9; }}
    .title {{ font: 700 28px Arial, sans-serif; fill: #182033; }}
    .subtitle {{ font: 400 13px Arial, sans-serif; fill: #69738d; }}
    .legend {{ font: 700 11px Arial, sans-serif; fill: #69738d; }}
    .table-bg {{ fill: #ffffff; stroke: #cfd8ea; stroke-width: 1.2; filter: url(#shadow); }}
    .table-head {{ fill: #f4f7fc; stroke: #cfd8ea; stroke-width: 1.2; }}
    .table-head-square {{ fill: #f4f7fc; }}
    .table-title {{ font: 700 13px Arial, sans-serif; fill: #17213a; letter-spacing: .2px; }}
    .table-count {{ font: 400 10px Arial, sans-serif; fill: #8a94aa; text-anchor: end; }}
    .col-name {{ font: 600 11px Arial, sans-serif; fill: #2c3650; }}
    .col-type {{ font: 400 10px Arial, sans-serif; fill: #8a94aa; text-anchor: end; }}
    .chip.pk {{ fill: #e8f1ff; stroke: #4f7cff; }}
    .chip.fk {{ fill: #fff3df; stroke: #d08000; }}
    .chip.uk {{ fill: #edf8f2; stroke: #1a9e6a; }}
    .chip-text {{ font: 700 8px Arial, sans-serif; fill: #31405f; text-anchor: middle; }}
    .rel {{ fill: none; stroke: #7d8fb3; stroke-width: 1.4; opacity: .78; }}
    .rel-dot.one {{ fill: #4f7cff; }}
    .crow {{ fill: none; stroke: #7d8fb3; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }}
    .rel-label {{ font: 500 9px Arial, sans-serif; fill: #72809d; paint-order: stroke; stroke: #ffffff; stroke-width: 4px; stroke-linejoin: round; }}
  </style>
  <rect width="{WIDTH}" height="{HEIGHT}" class="canvas"/>
  <rect width="{WIDTH}" height="{HEIGHT}" class="grid"/>
  <text x="48" y="48" class="title">Project AZAG ERD</text>
  <text x="48" y="72" class="subtitle">ERDCloud-style white diagram · project-centered AI operations schema</text>
  <text x="{WIDTH - 48}" y="50" class="legend" text-anchor="end">PK blue · FK amber · UK green</text>
  <g>{relations}</g>
  <g>{tables}</g>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    svg = build_svg()
    (OUT / "project-azag-erdcloud-white.svg").write_text(svg, encoding="utf-8")
    html = f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Project AZAG ERDCloud White</title>
  <style>
    body {{ margin: 0; background: #eef2f8; font-family: Arial, sans-serif; }}
    .wrap {{ width: {WIDTH}px; margin: 24px auto; background: white; border: 1px solid #cfd8ea; box-shadow: 0 20px 60px rgba(28,43,74,.12); }}
    @page {{ size: A3 landscape; margin: 8mm; }}
    @media print {{
      body {{ background: white; }}
      .wrap {{ margin: 0; border: 0; box-shadow: none; width: 100%; }}
      svg {{ width: 100%; height: auto; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    {svg}
  </div>
</body>
</html>
"""
    (OUT / "project-azag-erdcloud-white.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
