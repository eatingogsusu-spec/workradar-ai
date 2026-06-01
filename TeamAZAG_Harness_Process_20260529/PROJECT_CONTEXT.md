# 프로젝트 컨텍스트

이 브랜치는 최신 `origin/dev` 애플리케이션 스냅샷에 Codex Harness
워크플로를 적용하기 위한 전달본입니다.

- 상위 기준점: `origin/dev`의 `53d8985` 커밋 (`fix all`)
- Harness 적용 브랜치: `codex/dev-harness`
- 제품 애플리케이션 디렉터리: `opsradar2/`

기존 로컬 `SeongHo` 작업 트리는 독립적인 DB, 문서, 애플리케이션 변경을
포함하고 있어 의도적으로 건드리지 않았습니다. 초기 비교 내용은
`docs/DEV_COMPARISON.md`를 참고하세요.

## Harness 명령

```powershell
python scripts/execute.py --validate dev-stabilization
python scripts/execute.py dev-stabilization
```

Harness step은 이 저장소 루트를 기준으로 동작합니다. 그래서 변경 사항은
분리된 템플릿 복사본이 아니라 실제 `opsradar2/` 애플리케이션에 적용됩니다.
