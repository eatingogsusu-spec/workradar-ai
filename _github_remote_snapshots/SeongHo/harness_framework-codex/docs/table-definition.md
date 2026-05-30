# TeamMemory Table Definition

## users

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 사용자 ID |
| name | varchar(100) |  | NO |  | 사용자 이름 |
| email | varchar(255) | UK | NO |  | 로그인 이메일 |
| password_hash | text |  | NO |  | 해시된 비밀번호 |
| role | varchar(30) |  | NO | member | 전역 역할: admin, member |
| created_at | timestamptz |  | NO | now() | 생성일 |
| updated_at | timestamptz |  | NO | now() | 수정일 |

## teams

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 팀 ID |
| name | varchar(120) |  | NO |  | 팀 이름 |
| created_at | timestamptz |  | NO | now() | 생성일 |

## projects

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 프로젝트 ID |
| team_id | uuid | FK | NO |  | 소속 팀 |
| name | varchar(150) |  | NO |  | 프로젝트명 |
| description | text |  | YES |  | 프로젝트 설명 |
| status | varchar(30) |  | NO | active | active, archived, completed |
| start_date | date |  | YES |  | 시작일 |
| end_date | date |  | YES |  | 종료 예정일 |
| created_by | uuid | FK | NO |  | 생성자 |
| created_at | timestamptz |  | NO | now() | 생성일 |
| updated_at | timestamptz |  | NO | now() | 수정일 |

## project_members

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 프로젝트 멤버 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| user_id | uuid | FK | NO |  | 사용자 |
| role | varchar(30) |  | NO | member | owner, manager, member, viewer |
| joined_at | timestamptz |  | NO | now() | 참여일 |

## documents

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 문서 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| uploaded_by | uuid | FK | NO |  | 업로드한 사용자 |
| file_name | varchar(255) |  | NO |  | 파일명 |
| file_type | varchar(30) |  | NO |  | pdf, docx, pptx, txt 등 |
| source_type | varchar(30) |  | NO | upload | upload, notion, email, slack, meeting |
| storage_path | text |  | NO |  | 파일 저장 위치 |
| status | varchar(30) |  | NO | uploaded | uploaded, processing, completed, failed |
| uploaded_at | timestamptz |  | NO | now() | 업로드일 |

## document_chunks

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | chunk ID |
| document_id | uuid | FK | NO |  | 원본 문서 |
| project_id | uuid | FK | NO |  | 프로젝트별 검색 필터용 |
| content | text |  | NO |  | chunk 본문 |
| chunk_index | int |  | NO |  | 문서 내 chunk 순서 |
| page_number | int |  | YES |  | 원본 페이지 번호 |
| created_at | timestamptz |  | NO | now() | 생성일 |

## chunk_embeddings

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | embedding 참조 ID |
| chunk_id | uuid | FK | NO |  | 대상 chunk |
| vector_store | varchar(80) |  | NO |  | azure_ai_search, chroma, faiss 등 |
| vector_id | varchar(255) |  | NO |  | 외부 vector store의 ID |
| embedding_model | varchar(120) |  | NO |  | embedding 모델명 |
| created_at | timestamptz |  | NO | now() | 생성일 |

## todos

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | Todo ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| assignee_id | uuid | FK | YES |  | 담당자 |
| created_by | uuid | FK | NO |  | 생성자 |
| title | varchar(200) |  | NO |  | Todo 제목 |
| description | text |  | YES |  | 상세 설명 |
| status | varchar(30) |  | NO | todo | todo, in_progress, done, delayed, cancelled |
| priority | varchar(30) |  | NO | medium | low, medium, high, urgent |
| due_date | date |  | YES |  | 마감일 |
| source_document_id | uuid | FK | YES |  | AI 추출 근거 문서 |
| created_at | timestamptz |  | NO | now() | 생성일 |
| updated_at | timestamptz |  | NO | now() | 수정일 |

## issues

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 이슈 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| reporter_id | uuid | FK | NO |  | 보고자 |
| assignee_id | uuid | FK | YES |  | 담당자 |
| title | varchar(200) |  | NO |  | 이슈 제목 |
| description | text |  | YES |  | 상세 설명 |
| severity | varchar(30) |  | NO | medium | low, medium, high, critical |
| status | varchar(30) |  | NO | open | open, in_progress, resolved, closed |
| source_document_id | uuid | FK | YES |  | AI 추출 근거 문서 |
| created_at | timestamptz |  | NO | now() | 생성일 |
| updated_at | timestamptz |  | NO | now() | 수정일 |

## chat_messages

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 메시지 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| user_id | uuid | FK | YES |  | 사용자. assistant/system 메시지는 null 가능 |
| role | varchar(30) |  | NO |  | user, assistant, system |
| content | text |  | NO |  | 메시지 본문 |
| sources_json | jsonb |  | NO | '[]' | 답변 출처 문서/chunk 목록 |
| created_at | timestamptz |  | NO | now() | 생성일 |

## weekly_reports

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 주간 보고 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| week_start | date |  | NO |  | 주 시작일 |
| week_end | date |  | NO |  | 주 종료일 |
| content | text |  | NO |  | 보고서 내용 |
| progress_rate | int |  | NO | 0 | 진행률 0-100 |
| created_by | uuid | FK | NO |  | 작성자 |
| created_at | timestamptz |  | NO | now() | 생성일 |

## handoff_reports

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | 인수인계 보고서 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| title | varchar(200) |  | NO |  | 제목 |
| content | text |  | NO |  | 보고서 내용 |
| handoff_score | int |  | NO | 0 | 인수인계 점수 0-100 |
| missing_items_json | jsonb |  | NO | '[]' | 누락 항목 목록 |
| created_by | uuid | FK | NO |  | 작성자 |
| created_at | timestamptz |  | NO | now() | 생성일 |

## ai_summaries

| Column | Type | Key | Null | Default | Description |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | NO | gen_random_uuid() | AI 요약 ID |
| project_id | uuid | FK | NO |  | 프로젝트 |
| document_id | uuid | FK | YES |  | 문서 요약이면 대상 문서 |
| summary_type | varchar(40) |  | NO |  | document_summary, meeting_summary, project_summary, handoff_summary, weekly_summary |
| summary | text |  | NO |  | 요약 본문 |
| extracted_json | jsonb |  | NO | '{}' | AI가 추출한 Todo, 이슈, 결정사항 등 |
| created_at | timestamptz |  | NO | now() | 생성일 |
