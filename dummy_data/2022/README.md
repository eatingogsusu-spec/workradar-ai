# AutoParts One Korea 2022 Business Source Seed

## Purpose
This isolated 2022 dataset tests report and handoff generation from fragmented operational source material. It is not a DB-ready seed and must not be inserted directly into PostgreSQL.

## Why it is separate
All outputs live under `dummy_data/2022/`. Existing dummy data, `05_db_seed_v2`, and `06_current_db_seed` are not modified by this generator.

## Core scenarios
1. `ISSUE-2022-001` 설 연휴 전 긴급 출고 일정 혼선
2. `ISSUE-2022-002` 구매처 재고 부족과 대체품 검토
3. `ISSUE-2022-003` 수출 서류 누락으로 통관 지연
4. `ISSUE-2022-004` 반복 불량과 고객 조립 문제 사이 클레임
5. `ISSUE-2022-005` 리드타임 변경 공지와 고객 발주 일정 충돌
6. `ISSUE-2022-006` 항공 이송 전환 비용 승인 지연
7. `ISSUE-2022-007` 단가 인상 공지와 기존 견적 적용 기준 충돌
8. `ISSUE-2022-008` 담당자 부재로 고객 회신 누락

## Generated row counts
- `orders.csv`: 80 rows
- `purchase_orders.csv`: 72 rows
- `shipments.csv`: 72 rows
- `claims.csv`: 24 rows
- `issue_events.csv`: 16 rows
- `source_document_index.csv`: 128 rows

## Monthly document density
- 2022-01: 12 documents
- 2022-02: 8 documents
- 2022-03: 12 documents
- 2022-04: 12 documents
- 2022-05: 12 documents
- 2022-06: 8 documents
- 2022-07: 12 documents
- 2022-08: 12 documents
- 2022-09: 8 documents
- 2022-10: 12 documents
- 2022-11: 8 documents
- 2022-12: 12 documents

## Usage
```bash
python scripts/generate_2022_source_seed.py
python dummy_data/2022/06_loader_preview/load_2022_source_seed_preview.py
```

The loader is preview-only. Review `05_mapping/`, current DB constraints, and preview validation results before implementing any real import. Expected outputs are test references and must never be mixed into service upload input.
