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

const h = process.env.MINIPC_HOST ?? 'localhost'

// ── agonyang → main ──
db.prepare(`UPDATE projects SET
  name = 'main',
  path = '/home/xsandox/main',
  compose_file = '/home/xsandox/main/docker-compose.yml',
  deploy_cmd = 'docker compose -f /home/xsandox/main/docker-compose.yml build nginx && docker compose -f /home/xsandox/main/docker-compose.yml up -d nginx',
  git_repo = 'xsandox12/main',
  git_branch = 'master'
  WHERE id = 'agonyang'`).run()

db.prepare(`DELETE FROM domains WHERE id IN ('agonyang-cf','agonyang-com')`).run()
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('agonyang-nginx', 'agonyang', 'main', `http://${h}:4000/`, 4000, 0, 'test')
db.prepare(`UPDATE domains SET env='test', label='main', url=? WHERE id='agonyang-nginx'`).run(`http://${h}:4000/`)
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('agonyang-main', 'agonyang', 'agonyang.com', 'https://www.agonyang.com', null, 1, 'production')
db.prepare(`UPDATE domains SET env='production', label='agonyang.com', project_id='agonyang' WHERE id='agonyang-main'`).run()

// ── chzzk-analyze ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch) VALUES (?,?,?,?,?,?,?)`)
  .run('chzzk-analyze','chzzk-analyze','/home/xsandox/chzzk-analyze','/home/xsandox/main/docker-compose.yml',
    'docker compose -f /home/xsandox/main/docker-compose.yml build chzzk-analysis && docker compose -f /home/xsandox/main/docker-compose.yml up -d chzzk-analysis',
    'xsandox12/chzzk-analyze','master')
db.prepare(`UPDATE projects SET path=?,git_repo=?,deploy_cmd=? WHERE id='chzzk-analyze'`)
  .run('/home/xsandox/chzzk-analyze','xsandox12/chzzk-analyze',
    'docker compose -f /home/xsandox/main/docker-compose.yml build chzzk-analysis && docker compose -f /home/xsandox/main/docker-compose.yml up -d chzzk-analysis')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('chzzk-analyze-test','chzzk-analyze','chzzk-analyze',`http://${h}:4000/chzzk-analyze/`,4000,0,'test')
db.prepare(`UPDATE domains SET url=? WHERE id='chzzk-analyze-test'`).run(`http://${h}:4000/chzzk-analyze/`)
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('chzzk-analyze-prod','chzzk-analyze','chzzk-analyze','https://www.agonyang.com/chzzk-analyze/',null,1,'production')

// ── chzzk-dashboard ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch) VALUES (?,?,?,?,?,?,?)`)
  .run('chzzk-dashboard','chzzk-dashboard','/home/xsandox/chzzk-dashboard','/home/xsandox/main/docker-compose.yml',
    'docker compose -f /home/xsandox/main/docker-compose.yml build chzzk-dashboard && docker compose -f /home/xsandox/main/docker-compose.yml up -d chzzk-dashboard',
    'xsandox12/chzzk-dashboard','master')
db.prepare(`UPDATE projects SET path=?,git_repo=?,deploy_cmd=? WHERE id='chzzk-dashboard'`)
  .run('/home/xsandox/chzzk-dashboard','xsandox12/chzzk-dashboard',
    'docker compose -f /home/xsandox/main/docker-compose.yml build chzzk-dashboard && docker compose -f /home/xsandox/main/docker-compose.yml up -d chzzk-dashboard')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('chzzk-dashboard-test','chzzk-dashboard','chzzk-dashboard',`http://${h}:4000/chzzk-dashboard/`,4000,0,'test')
db.prepare(`UPDATE domains SET url=? WHERE id='chzzk-dashboard-test'`).run(`http://${h}:4000/chzzk-dashboard/`)
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('chzzk-dashboard-prod','chzzk-dashboard','chzzk-dashboard','https://www.agonyang.com/chzzk-dashboard/',null,1,'production')

db.prepare(`DELETE FROM domains WHERE id='agonyang-cf'`).run()

export default db
