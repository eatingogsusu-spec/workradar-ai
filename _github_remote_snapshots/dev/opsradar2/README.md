# 운영 인텔리전스 AI

## 팀 구성

| 이름 | 역할 | 담당 파일 |
|---|---|---|
| 김희진 | 팀장·기획 | 요구사항 정의 |
| 이성우 | AI·챗봇 | services/*.py, endpoints/chat.py |
| 김예은 | 인프라 | 배포 환경·Azure VM |
| 김성호 | 백엔드·DB | endpoints/*, models/*, schemas/* |
| 박주원 | 프론트 | React (별도 레포) |

## 실행 방법

```bash
cp .env.example .env      # 환경변수 설정
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API 문서: http://localhost:8000/docs

## 브랜치 전략

```
main          ← 배포용 (PR 승인 필수 — 김희진)
dev           ← 통합 브랜치 (껍데기 머지 후 로직 구현)
feat/이름-기능명  ← 개인 작업 브랜치
```

예시: `feat/sungho-todo-api`, `feat/sungwoo-rag-pipeline`

## 개발 규칙

- RESTful: 복수 명사, kebab-case URI, HTTP Method로 행위 표현
- 껍데기 라우터 먼저 dev 머지 → 로직 구현 순서
- .env 절대 커밋 금지 (.env.example만 커밋)
- AI Provider 전환: .env의 AI_PROVIDER=azure 로 변경

## AI 파이프라인 흐름

```
파일 업로드
  → parser_service.py      (텍스트 추출)
  → text_normalizer.py     (전처리)
  → embedding_service.py   (벡터화 → ChromaDB)
  → ai_analysis_service.py (Todo/이슈/요약 추출)
```
