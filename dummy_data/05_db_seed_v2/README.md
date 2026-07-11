# OpsRadar2 v2 MVP Seed Data

> **Compatibility warning:** This folder targets an expanded candidate schema with tables such as `business_entities`, `entity_links`, and `approval_requests`. Those tables are not present in the current `SeongWoo-new2` `opsradar2/schema.sql`. Do not load these CSV files directly into the current database. Use `dummy_data/06_current_db_seed` for the current application schema.

## 1. 목적
이 seed 데이터는 기존 `dummy_data`의 원천 문서와 flat CSV를 OpsRadar2 v2 MVP DB 구조에 맞게 적재하기 위한 CSV 묶음입니다.

## 2. 원본 dummy_data와 v2 seed의 차이
원본은 문서와 업무 CSV를 분리해 AI 분석 입력을 검증하는 구조입니다. v2 seed는 `business_entities`를 중심으로 주문, 구매, 출하, 클레임, 공급처 공지, 승인 요청, AI 결과물을 연결합니다.

## 3. 생성된 테이블 목록
- `teams.csv`: 1 rows
- `users.csv`: 14 rows
- `projects.csv`: 1 rows
- `project_members.csv`: 14 rows
- `departments.csv`: 6 rows
- `department_members.csv`: 14 rows
- `customers.csv`: 5 rows
- `suppliers.csv`: 5 rows
- `products.csv`: 6 rows
- `business_entities.csv`: 392 rows
- `customer_orders.csv`: 131 rows
- `purchase_orders.csv`: 110 rows
- `shipments.csv`: 111 rows
- `quality_claims.csv`: 31 rows
- `supplier_notices.csv`: 5 rows
- `approval_requests.csv`: 4 rows
- `documents.csv`: 151 rows
- `issues.csv`: 19 rows
- `todos.csv`: 38 rows
- `calendar_events.csv`: 38 rows
- `entity_links.csv`: 1054 rows
- `weekly_reports.csv`: 3 rows
- `monthly_reports.csv`: 3 rows
- `report_sources.csv`: 30 rows
- `handoff_reports.csv`: 1 rows
- `handoff_sources.csv`: 24 rows
- `ai_summaries.csv`: 49 rows

## 4. business_entities 역할
`business_entities`는 실제 업무 객체의 허브입니다. customer_order, purchase_order, shipment, quality_claim, supplier_notice, approval_request가 모두 하나의 업무 객체 ID를 가집니다.

## 5. entity_links 역할
`entity_links`는 문서, 이슈, Todo, 보고서, 인수인계서가 어떤 업무 객체와 연결되는지 저장합니다. AI 결과가 실제 업무 데이터로 추적될 수 있게 하는 핵심 연결 테이블입니다.

## 6. report_sources / handoff_sources 역할
`report_sources`는 주간/월간 보고서가 참조한 업무 객체, 문서, 이슈를 저장합니다. `handoff_sources`는 인수인계서가 포함한 업무 객체와 Todo를 저장합니다.

## 7. expected_outputs_for_test 제외 이유
`04_expected_outputs_for_test`는 검증용 정답 샘플입니다. 실제 seed 입력으로 사용하면 AI 결과와 입력 데이터가 섞여 평가가 오염될 수 있어 제외했습니다.

## 8. DB insert 권장 순서
1. teams
2. users
3. projects
4. project_members
5. departments
6. department_members
7. customers
8. suppliers
9. products
10. business_entities
11. customer_orders
12. purchase_orders
13. shipments
14. quality_claims
15. supplier_notices
16. approval_requests
17. documents
18. issues
19. todos
20. calendar_events
21. entity_links
22. weekly_reports
23. monthly_reports
24. report_sources
25. handoff_reports
26. handoff_sources
27. ai_summaries

## 9. 검증 결과 요약
- 날짜 범위 초과 건수: 0
- business_entity_id 누락 건수: 0
- orphan link 건수: 0
- expected_outputs_for_test 사용 여부: False

## 재생성 명령어
```bash
python scripts/convert_dummy_to_seed_v2.py
```
