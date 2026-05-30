# ServerBridge — 개발 상태 (마스터 문서)

> **에이전트 규칙**: 작업 시작 전 이 문서를 반드시 읽을 것.
> 작업 완료 후 아래 체크리스트와 파일 구조를 업데이트할 것.

---

## 현재 단계
**Phase 1 — 기반 인프라** (진행 전)

## 전체 진행률
- [ ] Phase 1: 기반 인프라 (Next.js + Docker 연동 + 대시보드 UI)
- [ ] Phase 2: 파일 탐색기 + 배포 파이프라인
- [ ] Phase 3: AI 멀티프로바이더 에디터
- [ ] Phase 4: 시각적 페이지 편집기

---

## 완료된 작업
없음 (초기 상태)

---

## 다음 에이전트가 할 작업 (Phase 1)

1. **Next.js 프로젝트 초기화**
   - `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir`
   - shadcn/ui 설치: `npx shadcn@latest init`
   - 추가 패키지: `dockerode better-sqlite3 @types/dockerode`

2. **파일 구조 셋업**
   - `app/` — Next.js App Router 페이지
   - `lib/docker.ts` — dockerode 연동
   - `lib/db.ts` — SQLite 연동
   - `components/` — UI 컴포넌트

3. **대시보드 구현**
   - `/api/docker/containers` — 컨테이너 목록 API
   - `app/page.tsx` — 대시보드 메인 (서비스 카드)

4. **작업 완료 후**: 이 STATUS.md의 완료 항목 업데이트 + 파일 구조 섹션 업데이트

---

## 현재 파일 구조

```
D:\dev\server-bridge\
  ├── docs\              ← 현재 위치
  │   ├── STATUS.md      ← 이 파일
  │   ├── architecture.md
  │   ├── api-spec.md
  │   ├── deploy.md
  │   └── work-log\
  └── (Next.js 아직 미설치)
```

---

## 중요 결정사항 (변경 시 기록)

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-05-30 | 웹앱 (Next.js) 방식 채택 | 어디서나 브라우저로 접근 가능 |
| 2026-05-30 | 미니PC 내부 실행 (SSH 불필요) | 파일시스템 직접 접근, Docker socket 직접 사용 |
| 2026-05-30 | AI 멀티프로바이더 | Claude + GPT + Gemini + Ollama 선택 가능 |
| 2026-05-30 | 시각적 편집기: iframe + 클릭 주입 방식 | 실제 페이지 UI 유지하면서 편집 |

---

## 환경 정보

- **미니PC**: `xsandox@112.168.76.70`
- **배포 포트**: `5500`
- **접근 URL**: `http://112.168.76.70:5500`
- **운영 중인 서비스**:
  - `open-webui` → :3000
  - `agonyang-nginx` → :4000
  - `adv-admin` → :8080 (localhost only)
  - `ollama` → :11434

---

## 작업 로그

| 날짜 | 에이전트 | 작업 내용 |
|---|---|---|
| 2026-05-30 | 기획 에이전트 | 프로젝트 구조 및 docs 파이프라인 초기화 |
