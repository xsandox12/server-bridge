# ServerBridge — 미니PC 배포 가이드

## 사전 요구사항
- 미니PC에 Docker + Docker Compose 설치됨
- SSH 접근: `xsandox@112.168.76.70`

## 개발 환경에서 빌드

```bash
# Windows D:\dev\server-bridge에서
docker build -t server-bridge .
docker save server-bridge | gzip > server-bridge.tar.gz

# 미니PC로 전송
scp server-bridge.tar.gz xsandox@112.168.76.70:~/
```

## 미니PC에서 실행

```bash
# 이미지 로드
gunzip -c server-bridge.tar.gz | docker load

# 실행
docker compose up -d
```

## docker-compose.yml (미니PC용)

```yaml
services:
  server-bridge:
    image: server-bridge:latest
    container_name: server-bridge
    ports:
      - "5500:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/xsandox:/workspace:ro
      - server-bridge-data:/data
    restart: unless-stopped
    environment:
      - WORKSPACE_ROOT=/workspace
      - NODE_ENV=production

volumes:
  server-bridge-data:
```

## 접근

브라우저에서: `http://112.168.76.70:5500`

## 업데이트 배포

```bash
# 새 버전 빌드 후
docker compose pull
docker compose up -d --build
```

## 주의사항

- `/workspace`는 read-only 마운트 → 파일 수정 시 별도 write 마운트 필요
- Docker socket 마운트로 미니PC의 모든 컨테이너 제어 가능
- AI API 키는 환경변수 또는 앱 설정에서 관리 (DB 암호화 저장)
