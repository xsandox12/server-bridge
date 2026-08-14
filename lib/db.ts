import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), '.data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'server-bridge.db'))
db.pragma('journal_mode = WAL')
// next build 시 다중 워커가 동시에 마이그레이션을 실행하면 SQLITE_BUSY가 발생할 수 있으므로
// 즉시 에러 대신 잠금 해제를 최대 5초 대기
db.pragma('busy_timeout = 5000')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    compose_file TEXT,
    deploy_cmd TEXT,
    git_repo TEXT,
    git_branch TEXT DEFAULT 'main',
    docker_service TEXT,
    description TEXT,
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

  CREATE TABLE IF NOT EXISTS agonyang_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cols INTEGER NOT NULL DEFAULT 2,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agonyang_banners (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES agonyang_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT NOT NULL,
    icon TEXT,
    accent_color TEXT,
    meta TEXT,
    is_live INTEGER NOT NULL DEFAULT 0,
    open_in_new_tab INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_stats_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_percent REAL,
    mem_percent REAL,
    load1 REAL,
    disk_percent REAL
  );
  CREATE INDEX IF NOT EXISTS idx_system_stats_history_ts ON system_stats_history(ts);
`)

// 기존 DB 마이그레이션 (컬럼 없으면 추가)
for (const sql of [
  `ALTER TABLE projects ADD COLUMN git_repo TEXT`,
  `ALTER TABLE projects ADD COLUMN git_branch TEXT DEFAULT 'main'`,
  `ALTER TABLE deploy_logs ADD COLUMN git_commit TEXT`,
  `ALTER TABLE domains ADD COLUMN env TEXT DEFAULT 'test'`,
  `ALTER TABLE projects ADD COLUMN docker_service TEXT`,
  `ALTER TABLE projects ADD COLUMN description TEXT`,
  `ALTER TABLE projects ADD COLUMN sort_order INTEGER`,
  `ALTER TABLE projects ADD COLUMN group_name TEXT`,
  `ALTER TABLE deploy_logs ADD COLUMN notes TEXT`,
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
  .run('chzzk-analyze-prod','chzzk-analyze','agonyang.com/chzzk-analyze','https://www.agonyang.com/chzzk-analyze/',null,1,'production')
db.prepare(`UPDATE domains SET label='agonyang.com/chzzk-analyze' WHERE id='chzzk-analyze-prod'`).run()

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
  .run('chzzk-dashboard-prod','chzzk-dashboard','agonyang.com/chzzk-dashboard','https://www.agonyang.com/chzzk-dashboard/',null,1,'production')
db.prepare(`UPDATE domains SET label='agonyang.com/chzzk-dashboard' WHERE id='chzzk-dashboard-prod'`).run()

// docker_service 설정 (컨테이너 매칭용)
db.prepare(`UPDATE projects SET docker_service='nginx'            WHERE id='agonyang'`).run()
db.prepare(`UPDATE projects SET docker_service='chzzk-analysis'  WHERE id='chzzk-analyze'`).run()
db.prepare(`UPDATE projects SET docker_service='chzzk-dashboard' WHERE id='chzzk-dashboard'`).run()
db.prepare(`UPDATE projects SET docker_service='admin'           WHERE id='adv'`).run()

db.prepare(`DELETE FROM domains WHERE id='agonyang-cf'`).run()

// ── coldstorage ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('coldstorage','coldstorage (재고/견적 관리)','/home/xsandox/coldstorage','/home/xsandox/coldstorage/docker-compose.yml',
    'docker compose build coldstorage && docker compose up -d coldstorage',
    'xsandox12/coldstorage','master','coldstorage')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('coldstorage-test','coldstorage','coldstorage',`http://${h}:9000/`,9000,0,'test')

// ── drawingtool ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('drawingtool','drawingtool (도면 설계)','/home/xsandox/drawingtool',null,null,'xsandox12/drawingtool','master',null)
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('drawingtool-test','drawingtool','drawingtool',`http://${h}:9100/`,9100,0,'test')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('drawingtool-prod','drawingtool','drawingtool.agonyang.com','https://drawingtool.agonyang.com/',null,1,'production')

// ── adv production 도메인 ──
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('adv-prod','adv','adv.agonyang.com','https://adv.agonyang.com/',null,1,'production')

// ── bubblechat (한글 음절 버블 타자 대전) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('bubblechat','bubblechat (한글 타자 대전)','/home/xsandox/bubblechat','/home/xsandox/bubblechat/docker-compose.yml',
    'docker compose build bubblechat && docker compose up -d bubblechat',
    'xsandox12/bubblechat','master','bubblechat')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('bubblechat-test','bubblechat','bubblechat',`http://${h}:9400/`,9400,0,'test')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('bubblechat-prod','bubblechat','bubblechat.agonyang.com','https://bubblechat.agonyang.com/',null,1,'production')

// ── bubblechat-en (영어 알파벳 버블 타자 대전) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('bubblechat-en','bubblechat-en (영어 타자 대전)','/home/xsandox/bubblechat-en','/home/xsandox/bubblechat-en/docker-compose.yml',
    'docker compose build bubblechat-en && docker compose up -d bubblechat-en',
    null,'master','bubblechat-en')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('bubblechat-en-test','bubblechat-en','bubblechat-en',`http://${h}:9500/`,9500,0,'test')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('bubblechat-en-prod','bubblechat-en','bubblechat-en.agonyang.com','https://bubblechat-en.agonyang.com/',null,1,'production')

// ── hex21 (육각 블랙잭 퍼즐) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('hex21','hex21 (육각 블랙잭 퍼즐)','/home/xsandox/hex21','/home/xsandox/hex21/docker-compose.yml',
    'docker compose build hex21 && docker compose up -d hex21',
    null,'master','hex21')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('hex21-test','hex21','hex21',`http://${h}:9600/`,9600,0,'test')

// ── fishgame (시청자 참여형 낚시 미니게임) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('fishgame','fishgame (낚시 미니게임)','/home/xsandox/fishgame','/home/xsandox/fishgame/docker-compose.yml',
    'git pull origin master && docker compose build fishgame && docker compose up -d fishgame',
    'xsandox12/fishgame','master','fishgame')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('fishgame-test','fishgame','fishgame',`http://${h}:9700/`,9700,0,'test')

// ── smartorder (테이블오더 POS) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('smartorder','smartorder (테이블오더 POS)','/home/xsandox/smartorder','/home/xsandox/smartorder/docker-compose.yml',
    'git pull origin main && docker compose build smartorder-server smartorder-web-admin smartorder-web-table && docker compose up -d smartorder-server smartorder-web-admin smartorder-web-table',
    'xsandox12/smartorder','main',null)
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('smartorder-admin-test','smartorder','smartorder-admin',`http://${h}:9301/`,9301,0,'test')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('smartorder-table-test','smartorder','smartorder-table',`http://${h}:9302/`,9302,0,'test')

// ── openmarket (판매자입점 중개몰) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('openmarket','openmarket (판매자입점 중개몰)','/home/xsandox/openmarket','/home/xsandox/openmarket/docker-compose.yml',
    'git pull origin master && docker compose build openmarket && docker compose up -d openmarket',
    'xsandox12/openmarket','master','openmarket')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('openmarket-test','openmarket','openmarket',`http://${h}:9800/`,9800,0,'test')

// ── stock-dashboard (국내 주식 관심종목 스크리닝 대시보드) ──
db.prepare(`INSERT OR IGNORE INTO projects (id,name,path,compose_file,deploy_cmd,git_repo,git_branch,docker_service) VALUES (?,?,?,?,?,?,?,?)`)
  .run('stock-dashboard','stock-dashboard (주식 관심종목 대시보드)','/home/xsandox/stock-dashboard','/home/xsandox/stock-dashboard/docker-compose.yml',
    'git pull origin master && docker compose build stock-dashboard && docker compose up -d stock-dashboard',
    'xsandox12/stock-dashboard','master','stock-dashboard')
db.prepare(`INSERT OR IGNORE INTO domains (id,project_id,label,url,port,is_external,env) VALUES (?,?,?,?,?,?,?)`)
  .run('stock-dashboard-test','stock-dashboard','stock-dashboard',`http://${h}:9900/`,9900,0,'test')

// ── agonyang 메인 페이지 카테고리/배너 (프로젝트 네비게이터 목업 기반) ──
const agonyangCatCount = db.prepare('SELECT COUNT(*) as cnt FROM agonyang_categories').get() as { cnt: number }
if (agonyangCatCount.cnt === 0) {
  db.prepare(`INSERT INTO agonyang_categories (id, name, cols, sort_order) VALUES (?, ?, ?, ?)`)
    .run('live', '방송', 1, 0)
  db.prepare(`INSERT INTO agonyang_categories (id, name, cols, sort_order) VALUES (?, ?, ?, ?)`)
    .run('services', '서비스', 2, 1)

  const insertBanner = db.prepare(`INSERT INTO agonyang_banners
    (id, category_id, title, description, image_url, link_url, icon, accent_color, meta, is_live, open_in_new_tab, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  insertBanner.run('agonyang-live', 'live', '아고냥 라이브', '치지직에서 아고냥의 실시간 방송을 시청합니다.',
    '/icon/agonyang_icon_46.png', 'https://chzzk.naver.com/live/6f4072c1cdb6e6188a6982ddd64ee556',
    '방', '#fb7360', null, 0, 1, 1, 0)

  insertBanner.run('chzzk-analyze-banner', 'services', 'Chzzk Trend Analysis', '실시간 시청자 현황, 카테고리 트렌드, 스트리머 히스토리를 분석합니다.',
    '/chzzk-analyze/chzzk_analyze_icon_32.png', '/chzzk-analyze/',
    '분', '#4da6ff', null, 0, 0, 1, 0)

  insertBanner.run('chzzk-dashboard-banner', 'services', 'Chzzk Dashboard', '팔로잉 스트리머의 방송 현황을 대시보드로 한눈에 확인합니다.',
    '/chzzk-dashboard/dashboard_icon_32.png', '/chzzk-dashboard/',
    '대', '#4ddb8f', null, 0, 0, 1, 1)
}

export default db
