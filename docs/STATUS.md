# ServerBridge — 개발 상태 (마스터 문서)

> **에이전트 규칙**: 작업 시작 전 이 문서를 반드시 읽을 것.
> 작업 완료 후 아래 체크리스트와 파일 구조를 업데이트할 것.

---

## 현재 단계
**전체 완료 — 미니PC 배포 대기 중**

## 전체 진행률
- [x] Phase 1: 기반 인프라 (Next.js + Docker 연동 + 대시보드 UI) ✅
- [x] Phase 2: 파일 탐색기 + Monaco 에디터 + 배포 SSE UI ✅
- [x] Phase 3: AI 멀티프로바이더 에디터 (Claude/GPT/Gemini/Ollama) ✅
- [x] Phase 4: 시각적 페이지 편집기 (iframe + 클릭 주입) ✅

---

## 완료된 작업 (Phase 1)
- [x] Next.js 16.2.6 프로젝트 초기화 (Turbopack 기본)
- [x] dockerode 연동 (`lib/docker.ts`) — 컨테이너 목록/재시작/중지/시작/로그
- [x] SQLite 연동 (`lib/db.ts`) — 프로젝트, 도메인, AI프로바이더, 배포로그 테이블
- [x] 대시보드 UI (서비스 카드, 상태 표시, 원클릭 재시작/중지)
- [x] 프로젝트 목록 페이지 (도메인 배지, 배포 명령 보기)
- [x] 설정 페이지 (AI 프로바이더 등록 폼, 등록된 프로젝트 목록)
- [x] API routes: `/api/docker/containers`, `/api/deploy`, `/api/files`, `/api/ai/edit`, `/api/settings/providers`
- [x] 배포 SSE 스트리밍 (`/api/deploy/[jobId]/stream`)
- [x] 빌드 성공 (npm run build ✓)

---

## 다음 에이전트가 할 작업 (Phase 2)

### 1. 프로젝트 상세 페이지 (`app/projects/[id]/page.tsx`)
- 파일 탐색기 UI (좌측 트리, 우측 Monaco Editor)
- `/api/files?path=` GET으로 디렉토리 목록
- `/api/files/content?path=` GET으로 파일 내용
- Monaco Editor로 편집 → PUT `/api/files/content` 저장
- 저장 후 [배포] 버튼 표시

### 2. 배포 실행 UI
- [배포] 버튼 → POST `/api/deploy` → jobId 반환
- SSE 연결 `GET /api/deploy/[jobId]/stream`으로 실시간 로그
- 터미널 스타일 로그 출력 (검정 배경, 흰 텍스트)

### 3. Monaco Editor 설치
```bash
npm install @monaco-editor/react
```

### 작업 완료 후 필수
- 이 STATUS.md 업데이트 (완료 항목 체크)
- `docs/work-log/2026-05-30-phase2.md` 작성

---

## 현재 파일 구조

```
D:\dev\server-bridge\
  ├── app\
  │   ├── page.tsx                        ← 대시보드
  │   ├── layout.tsx                      ← Sidebar 포함 루트 레이아웃
  │   ├── globals.css                     ← 다크 테마
  │   ├── projects\page.tsx               ← 프로젝트 목록
  │   ├── settings\page.tsx               ← AI 설정
  │   ├── logs\[containerId]\page.tsx     ← 컨테이너 로그
  │   └── api\                            ← docker, deploy, files, ai, settings
  ├── components\
  │   ├── Sidebar.tsx
  │   ├── Dashboard.tsx                   ← 클라이언트, 15초 폴링
  │   └── SettingsForm.tsx
  ├── lib\
  │   ├── db.ts                           ← SQLite 싱글톤
  │   ├── docker.ts                       ← dockerode 래퍼
  │   └── ai\index.ts                     ← Claude/GPT/Gemini/Ollama
  ├── docs\
  ├── next.config.ts                      ← serverExternalPackages 설정
  ├── Dockerfile
  └── package.json
```

---

## 중요 결정사항 (변경 시 기록)

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-05-30 | 웹앱 (Next.js) 방식 채택 | 어디서나 브라우저로 접근 가능 |
| 2026-05-30 | 미니PC 내부 실행 (SSH 불필요) | 파일시스템 직접 접근, Docker socket 직접 사용 |
| 2026-05-30 | AI 멀티프로바이더 | Claude + GPT + Gemini + Ollama 선택 가능 |
| 2026-05-30 | 시각적 편집기: iframe + 클릭 주입 방식 | 실제 페이지 UI 유지하면서 편집 |
| 2026-05-30 | serverExternalPackages 사용 | ssh2/dockerode 네이티브 모듈 Turbopack 번들링 제외 |

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
| 2026-05-30 | 개발 에이전트 | Phase 1 완료 — Next.js 16 + dockerode + SQLite + 대시보드 UI + 빌드 성공 |
