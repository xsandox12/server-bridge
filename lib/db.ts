import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), '.data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'server-bridge.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    compose_file TEXT,
    deploy_cmd TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT,
    url TEXT,
    port INTEGER,
    is_external INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT,
    model TEXT,
    base_url TEXT,
    is_default INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS deploy_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    command TEXT,
    status TEXT DEFAULT 'running',
    output TEXT DEFAULT '',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME
  );
`)

// 초기 데이터 (미니PC 프로젝트들)
const existing = db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }
if (existing.cnt === 0) {
  const insert = db.prepare(`INSERT INTO projects (id, name, path, compose_file, deploy_cmd) VALUES (?, ?, ?, ?, ?)`)
  insert.run('adv', 'adv (광고 관리)', '/home/xsandox/adv', 'docker-compose.yml', 'docker compose build admin && docker compose up -d admin')
  insert.run('agonyang', 'agonyang (치지직 분석)', '/home/xsandox/agonyang', 'docker-compose.minipc.yml', 'docker compose -f docker-compose.minipc.yml build chzzk-analysis && docker compose -f docker-compose.minipc.yml up -d chzzk-analysis')

  const insertDomain = db.prepare(`INSERT INTO domains (id, project_id, label, url, port, is_external) VALUES (?, ?, ?, ?, ?, ?)`)
  insertDomain.run('adv-local', 'adv', 'adv-admin (로컬)', 'http://localhost:8080', 8080, 0)
  insertDomain.run('agonyang-nginx', 'agonyang', 'agonyang nginx', 'http://localhost:4000', 4000, 0)
  insertDomain.run('agonyang-cf', 'agonyang', 'agonyang (외부)', 'https://agonyang.kr', null, 1)
}

export default db
