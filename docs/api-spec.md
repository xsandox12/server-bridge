# ServerBridge — API 명세

## Docker API

### GET /api/docker/containers
컨테이너 목록 + 상태 조회
```json
// Response
[
  {
    "id": "abc123",
    "name": "agonyang-nginx",
    "status": "running",
    "ports": [{ "host": 4000, "container": 80 }],
    "image": "nginx:latest",
    "created": "2026-05-01T00:00:00Z"
  }
]
```

### POST /api/docker/containers/[id]/restart
컨테이너 재시작

### POST /api/docker/containers/[id]/stop
컨테이너 중지

### GET /api/docker/containers/[id]/logs?stream=true
SSE 로그 스트리밍

---

## Files API

### GET /api/files?path=/workspace/agonyang
디렉토리 목록
```json
[
  { "name": "docker-compose.yml", "type": "file", "size": 1234 },
  { "name": "src", "type": "directory" }
]
```

### GET /api/files/content?path=/workspace/agonyang/src/app.js
파일 내용 조회

### PUT /api/files/content
파일 저장
```json
// Body
{ "path": "/workspace/agonyang/src/app.js", "content": "..." }
```

### GET /api/files/search?path=/workspace/agonyang&text=네비게이션
텍스트로 소스 파일 검색 (grep)

---

## Deploy API

### POST /api/deploy
배포 시작
```json
// Body
{ "projectId": "agonyang" }
// Response
{ "jobId": "job_abc123" }
```

### GET /api/deploy/[jobId]/stream
SSE 배포 로그 스트리밍
```
data: {"type":"log","line":"Building image..."}
data: {"type":"log","line":"Successfully built"}
data: {"type":"done","status":"success"}
```

### GET /api/deploy/history?projectId=agonyang
배포 이력

---

## AI API

### POST /api/ai/edit
AI 코드 수정 요청
```json
// Body
{
  "provider": "claude",    // "claude" | "gpt" | "gemini" | "ollama"
  "prompt": "네비게이션 색상을 파란색으로 바꿔줘",
  "filePath": "/workspace/agonyang/src/nav.css",
  "fileContent": "..."
}
// Response
{
  "diff": "--- a/nav.css\n+++ b/nav.css\n...",
  "newContent": "...",
  "explanation": "nav 요소의 background-color를 #2563EB로 변경했습니다."
}
```

---

## Git API

### POST /api/git/commit
```json
// Body
{ "projectId": "agonyang", "message": "feat: AI로 네비 색상 수정" }
```

### GET /api/git/status?projectId=agonyang
git status 조회

---

## Proxy API

### GET /api/proxy?url=http://localhost:4000
내부 서비스를 프록시로 전달 (시각적 편집기용)
- 응답 HTML에 클릭 이벤트 스크립트 자동 주입
