import fs from 'fs'
import { NextResponse } from 'next/server'

// game-factory 레벨 서버(game-factory-server, main_default 네트워크)의 관리 API를 내부망으로 부른다.
// 비밀번호는 미니PC의 ~/game-factory/.env(ADMIN_PASSWORD)에 있고, server-bridge는 /home/xsandox를 마운트한다.
const BASE = process.env.GAME_FACTORY_URL || 'http://game-factory-server:8080'
const ENV_FILE = process.env.GAME_FACTORY_ENV || '/home/xsandox/game-factory/.env'

function adminPassword(): string {
  const m = /^ADMIN_PASSWORD=(.*)$/m.exec(fs.readFileSync(ENV_FILE, 'utf8'))
  if (!m) throw new Error(`ADMIN_PASSWORD 없음: ${ENV_FILE}`)
  return m[1].trim()
}

export async function gameFactoryAdmin(pathAndQuery: string) {
  try {
    const auth = 'Basic ' + Buffer.from('admin:' + adminPassword()).toString('base64')
    const res = await fetch(BASE + pathAndQuery, { headers: { Authorization: auth }, cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `game-factory-server ${res.status}` }, { status: 502 })
    return NextResponse.json(await res.json())
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
