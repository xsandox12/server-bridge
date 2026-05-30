# 에이전트 작업 가이드 (필독)

이 문서는 이 프로젝트를 이어받는 모든 에이전트/개발자가 작업 시작 전 반드시 읽어야 합니다.

---

## 작업 시작 시 (필수 순서)

1. `docs/STATUS.md` 읽기 → 현재 단계 + 다음 작업 확인
2. `docs/architecture.md` 읽기 → 전체 구조 파악
3. `docs/api-spec.md` 읽기 → 구현할 API 명세 확인
4. 현재 파일 구조 확인 (`D:\dev\server-bridge` 디렉토리)
5. 작업 시작

---

## 작업 완료 시 (필수 순서)

1. `docs/STATUS.md` 업데이트:
   - 완료된 작업 체크 표시
   - 현재 파일 구조 섹션 업데이트
   - 다음 에이전트가 할 작업 내용 업데이트
   - 작업 로그 테이블에 행 추가

2. `docs/work-log/YYYY-MM-DD-[phase].md` 작성:
   - 이번 세션에서 한 작업 상세
   - 만난 문제와 해결 방법
   - 다음 에이전트를 위한 힌트

---

## 작업 로그 파일 형식

파일명: `docs/work-log/2026-05-30-phase1.md`

```markdown
# 작업 로그 - 2026-05-30 Phase 1

## 완료한 작업
- Next.js 프로젝트 초기화
- dockerode 연동 완료

## 구현 결정사항
- Docker API는 /api/docker/containers 엔드포인트로 통합
- 컨테이너 상태는 30초마다 폴링 (WebSocket 대신 SSE)

## 문제 및 해결
- dockerode 타입 정의 오류 → @types/dockerode 별도 설치 필요

## 다음 에이전트를 위한 힌트
- lib/docker.ts의 getContainers() 함수 이미 구현됨, 재사용할 것
- shadcn Card 컴포넌트를 서비스 카드에 사용 중
```

---

## 코딩 컨벤션

- **파일 경로 기준**: 미니PC 내부 경로는 `/workspace/...` (환경변수 `WORKSPACE_ROOT`)
- **에러 처리**: API route에서 try/catch, 500 에러 반환
- **실시간 로그**: SSE (Server-Sent Events) 사용, WebSocket 사용 안 함
- **AI 프로바이더**: `lib/ai/` 폴더에 프로바이더별 파일 분리

## 금지 사항

- `STATUS.md` 없이 작업 시작 금지
- 작업 완료 후 `STATUS.md` 업데이트 없이 종료 금지
- 이미 구현된 함수 중복 구현 금지 (반드시 기존 코드 확인)
