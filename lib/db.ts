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
    git_repo TEXT,
    git_branch TEXT DEFAULT 'main',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT,
    url TEXT,
    port INTEGER,
    is_external INTEGER DEFAULT 0,
    env TEXT DEFAULT 'test'
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
    git_commit TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`)

// 기존 DB 마이그레이션 (컬럼 없으면 추가)
for (const sql of [
  `ALTER TABLE projects ADD COLUMN git_repo TEXT`,
  `ALTER TABLE projects ADD COLUMN git_branch TEXT DEFAULT 'main'`,
  `ALTER TABLE deploy_logs ADD COLUMN git_commit TEXT`,
  `ALTER TABLE domains ADD COLUMN env TEXT DEFAULT 'test'`,
]) {
  try { db.exec(sql) } catch { /* 이미 존재 */ }
}

// 도메인 env 설정 (test / production)
const minipcHost = process.env.MINIPC_HOST ?? 'localhost'
db.prepare(`UPDATE domains SET env = 'production' WHERE id IN ('agonyang-main','agonyang-com')`).run()
db.prepare(`UPDATE domains SET env = 'test', url = ? WHERE id = 'adv-local'`).run(`http://${minipcHost}:8080`)
db.prepare(`UPDATE domains SET env = 'test', url = ? WHERE id = 'agonyang-nginx'`).run(`http://${minipcHost}:4000`)

// 초기 데이터 (미니PC 프로젝트들)
const existing = db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }
if (existing.cnt === 0) {
  const insert = db.prepare(`INSERT INTO projects (id, name, path, compose_file, deploy_cmd) VALUES (?, ?, ?, ?, ?)`)
  insert.run('adv', 'adv (광고 관리)', '/home/xsandox/adv', 'docker-compose.yml', 'docker compose build admin && docker compose up -d admin')
  insert.run('agonyang', 'agonyang (치지직 분석)', '/home/xsandox/agonyang', 'docker-compose.minipc.yml', 'docker compose -f docker-compose.minipc.yml build chzzk-analysis && docker compose -f docker-compose.minipc.yml up -d chzzk-analysis')

  const insertDomain = db.prepare(`INSERT INTO domains (id, project_id, label, url, port, is_external) VALUES (?, ?, ?, ?, ?, ?)`)
  insertDomain.run('adv-local', 'adv', 'adv-admin (로컬)', 'http://localhost:8080', 8080, 0)
  insertDomain.run('agonyang-nginx', 'agonyang', 'agonyang nginx', 'http://localhost:4000', 4000, 0)
  insertDomain.run('agonyang-main', 'agonyang', 'main', 'https://www.agonyang.com', null, 1)
  insertDomain.run('agonyang-com', 'agonyang', 'chzzk-analyze', 'https://www.agonyang.com/chzzk-analyze/', null, 1)
}

// agonyang → main + chzzk-analyze 분리
db.prepare(`UPDATE projects SET
  name = 'main (agonyang.com)',
  deploy_cmd = 'docker compose -f /home/xsandox/agonyang/docker-compose.minipc.yml build nginx && docker compose -f /home/xsandox/agonyang/docker-compose.minipc.yml up -d nginx'
  WHERE id = 'agonyang'`).run()

// main 도메인만 agonyang에 남기고, chzzk-analyze 도메인은 새 프로젝트로 이동
db.prepare(`UPDATE domains SET project_id = 'agonyang', env = 'test',  url = 'http://' || COALESCE(?, 'localhost') || ':4000/'
  WHERE id = 'agonyang-nginx'`).run(process.env.MINIPC_HOST ?? 'localhost')
db.prepare(`UPDATE domains SET project_id = 'agonyang', label = 'agonyang.com', env = 'production' WHERE id = 'agonyang-main'`).run()
db.prepare(`DELETE FROM domains WHERE id IN ('agonyang-com')`).run()

// chzzk-analyze 프로젝트 추가
db.prepare(`INSERT OR IGNORE INTO projects (id, name, path, compose_file, deploy_cmd, git_repo, git_branch) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run(
    'chzzk-analyze',
    'chzzk-analyze',
    '/home/xsandox/agonyang/chzzk-analysis',
    '/home/xsandox/agonyang/docker-compose.minipc.yml',
    'docker compose -f /home/xsandox/agonyang/docker-compose.minipc.yml build chzzk-analysis && docker compose -f /home/xsandox/agonyang/docker-compose.minipc.yml up -d chzzk-analysis',
    'xsandox12/agonyang',
    'master'
  )
db.prepare(`INSERT OR IGNORE INTO domains (id, project_id, label, url, port, is_external, env) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run('chzzk-analyze-test', 'chzzk-analyze', 'chzzk-analyze', `http://${process.env.MINIPC_HOST ?? 'localhost'}:4000/chzzk-analyze/`, 4000, 0, 'test')
db.prepare(`INSERT OR IGNORE INTO domains (id, project_id, label, url, port, is_external, env) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run('chzzk-analyze-prod', 'chzzk-analyze', 'chzzk-analyze', 'https://www.agonyang.com/chzzk-analyze/', null, 1, 'production')

// chzzk-dashboard 프로젝트 추가
db.prepare(`INSERT OR IGNORE INTO projects (id, name, path, compose_file, deploy_cmd, git_repo, git_branch) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run(
    'chzzk-dashboard',
    'chzzk-dashboard',
    '/home/xsandox/agonyang/chzzk-dashboard',
    '/home/xsandox/agonyang/docker-compose.minipc.yml',
    'docker compose -f /home/xsandox/agonyang/docker-compose.minipc.yml build chzzk-dashboard && docker compose -f /home/xsandox/agonyang/docker-compose.minipc.yml up -d chzzk-dashboard',
    'xsandox12/agonyang',
    'master'
  )
db.prepare(`INSERT OR IGNORE INTO domains (id, project_id, label, url, port, is_external, env) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run('chzzk-dashboard-test', 'chzzk-dashboard', 'chzzk-dashboard', `http://${process.env.MINIPC_HOST ?? 'localhost'}:4000/chzzk-dashboard/`, 4000, 0, 'test')
db.prepare(`INSERT OR IGNORE INTO domains (id, project_id, label, url, port, is_external, env) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run('chzzk-dashboard-prod', 'chzzk-dashboard', 'chzzk-dashboard', 'https://www.agonyang.com/chzzk-dashboard/', null, 1, 'production')

// 기존 DB 마이그레이션
db.prepare(`DELETE FROM domains WHERE id = 'agonyang-cf'`).run()
db.prepare(`INSERT OR IGNORE INTO domains (id, project_id, label, url, port, is_external) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('agonyang-main', 'agonyang', 'main', 'https://www.agonyang.com', null, 1)
db.prepare(`INSERT OR IGNORE INTO domains (id, project_id, label, url, port, is_external) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('agonyang-com', 'agonyang', 'chzzk-analyze', 'https://www.agonyang.com/chzzk-analyze/', null, 1)
// 기존 agonyang-com 레이블 업데이트
db.prepare(`UPDATE domains SET label = 'chzzk-analyze' WHERE id = 'agonyang-com'`).run()

export default db
