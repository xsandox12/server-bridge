# ServerBridge — 아키텍처

## 전체 구조

```
[브라우저 어디서나]
         ↓ HTTP:5500
[미니PC - Next.js 서버 (Docker 컨테이너)]
  ├── /api/docker        → dockerode → /var/run/docker.sock
  ├── /api/files         → Node.js fs → 실제 파일 시스템 (볼륨 마운트)
  ├── /api/deploy        → child_process.spawn → docker compose 명령
  ├── /api/ai            → 멀티프로바이더 (Claude/GPT/Gemini/Ollama)
  ├── /api/git           → simple-git
  ├── /api/proxy         → http-proxy-middleware → 내부 서비스
  └── SQLite DB          → /data/server-bridge.db (볼륨 마운트)
```

## 페이지 구조

| 경로 | 컴포넌트 | 설명 |
|---|---|---|
| `/` | Dashboard | Docker 서비스 상태 카드 |
| `/projects` | ProjectList | 프로젝트 목록 |
| `/projects/[id]` | ProjectDetail | 파일 탐색기 + 배포 패널 |
| `/editor/[projectId]` | VisualEditor | 시각적 페이지 편집기 |
| `/logs/[containerId]` | LogViewer | 컨테이너 실시간 로그 (SSE) |
| `/settings` | Settings | AI API 키, 프로젝트 등록 |

## 데이터 흐름

### 배포 흐름
```
사용자 [배포] 클릭
  → POST /api/deploy { projectId }
  → DB에서 deploy_cmd 조회
  → child_process.spawn(cmd)
  → GET /api/deploy/[jobId]/stream (SSE)
  → 실시간 로그 → 브라우저
```

### AI 편집 흐름
```
사용자 프롬프트 입력
  → POST /api/ai/edit { provider, prompt, filePath, fileContent }
  → AI 프로바이더 API 호출
  → diff 생성 (unified-diff)
  → 브라우저에 diff 표시
  → 사용자 [적용] 클릭
  → 파일 저장 → 배포 트리거
```

### 시각적 편집기 흐름
```
프로젝트 페이지 선택
  → iframe src = /api/proxy?url=<서비스URL>
  → 페이지 로드 후 클릭 이벤트 스크립트 주입
  → 요소 클릭 → outerHTML + CSS selector 추출
  → /api/files/search?text=<textContent> 로 소스 파일 검색
  → 편집 팝업 표시
  → 수정 → 저장 → 배포
```

## Docker 컨테이너 설정

```yaml
# docker-compose.yml (서버브릿지 자체)
services:
  server-bridge:
    build: .
    ports:
      - "5500:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Docker API
      - /home/xsandox:/workspace                   # 프로젝트 파일
      - server-bridge-data:/data                   # SQLite DB
    environment:
      - WORKSPACE_ROOT=/workspace
```

## SQLite 스키마

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,        -- 미니PC 절대 경로
  compose_file TEXT,
  deploy_cmd TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  label TEXT,
  url TEXT,
  port INTEGER,
  is_external BOOLEAN DEFAULT 0
);

CREATE TABLE ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,        -- 'claude' | 'gpt' | 'gemini' | 'ollama'
  api_key TEXT,
  model TEXT,
  base_url TEXT,             -- Ollama용
  is_default BOOLEAN DEFAULT 0
);

CREATE TABLE deploy_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  command TEXT,
  status TEXT,               -- 'running' | 'success' | 'failed'
  started_at DATETIME,
  finished_at DATETIME
);
```
