import { NextRequest, NextResponse } from 'next/server'

const CLICK_SCRIPT = `
<script>
(function() {
  var overlay = null;
  var ctrlHeld = false;

  document.addEventListener('keydown', function(e) { if (e.key === 'Control') ctrlHeld = true; });
  document.addEventListener('keyup',   function(e) { if (e.key === 'Control') { ctrlHeld = false; if (overlay) { overlay.remove(); overlay = null; } } });

  document.addEventListener('mouseover', function(e) {
    if (!ctrlHeld) return;
    if (overlay) overlay.remove();
    var el = e.target;
    if (el === document.body || el === document.documentElement) return;
    overlay = document.createElement('div');
    var rect = el.getBoundingClientRect();
    Object.assign(overlay.style, {
      position: 'fixed', top: rect.top + 'px', left: rect.left + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
      outline: '2px solid #3b82f6', pointerEvents: 'none',
      zIndex: '99999', background: 'rgba(59,130,246,0.12)',
      cursor: 'crosshair',
    });
    var badge = document.createElement('div');
    Object.assign(badge.style, {
      position: 'absolute', top: '0', left: '0',
      background: '#3b82f6', color: '#fff', fontSize: '10px',
      padding: '1px 4px', borderRadius: '0 0 4px 0', pointerEvents: 'none',
    });
    badge.textContent = '✏️ 편집';
    overlay.appendChild(badge);
    document.body.appendChild(overlay);
  });

  document.addEventListener('click', function(e) {
    if (!ctrlHeld) return;  // Ctrl 없으면 평소처럼 동작
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    var selector = '';
    if (el.id) selector = '#' + el.id;
    else if (el.className && typeof el.className === 'string') selector = '.' + el.className.trim().split(/\\s+/).join('.');
    else selector = el.tagName.toLowerCase();
    window.parent.postMessage({
      type: 'element-click',
      selector: selector,
      tagName: el.tagName,
      textContent: el.textContent ? el.textContent.trim().slice(0, 200) : '',
      outerHTML: el.outerHTML ? el.outerHTML.slice(0, 500) : '',
      src: el.src || el.href || '',
    }, '*');
  }, true);
})();
</script>
`

function toServerUrl(url: string): string {
  const hostGateway = process.env.HOST_GATEWAY ?? 'host.docker.internal'
  return url.replace(/\blocalhost\b/g, hostGateway)
}

// 상대/절대 URL을 프록시 경유 URL로 변환
function proxify(url: string, base: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#') || url.startsWith('javascript:')) return url
  try {
    const abs = new URL(url, base).href
    return `/api/proxy?url=${encodeURIComponent(abs)}`
  } catch {
    return url
  }
}

function rewriteHtml(html: string, base: string): string {
  // src, href, action 속성 재작성
  html = html.replace(
    /(src|href|action)=(["'])([^"']*)\2/g,
    (_, attr, quote, val) => `${attr}=${quote}${proxify(val, base)}${quote}`
  )
  // srcset 재작성
  html = html.replace(
    /srcset=(["'])([^"']*)\1/g,
    (_, quote, val) => {
      const rewritten = val.replace(/([^\s,]+)(\s+\d+[wx])?/g, (m: string, url: string, descriptor: string) =>
        proxify(url, base) + (descriptor ?? '')
      )
      return `srcset=${quote}${rewritten}${quote}`
    }
  )
  // CSS url() 재작성
  html = html.replace(
    /url\((["']?)([^"')]+)\1\)/g,
    (_, quote, val) => `url(${quote}${proxify(val, base)}${quote})`
  )
  // <base> 태그 제거 (상대경로 기준점 충돌 방지)
  html = html.replace(/<base[^>]*>/gi, '')
  // 클릭 스크립트 삽입
  html = html.replace('</body>', CLICK_SCRIPT + '</body>')
  return html
}

export async function GET(req: NextRequest) {
  const target = new URL(req.url).searchParams.get('url')
  if (!target) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const serverTarget = toServerUrl(target)

  try {
    const upstream = await fetch(serverTarget, {
      headers: { 'User-Agent': 'Mozilla/5.0 ServerBridge/1.0' },
      redirect: 'follow',
    })

    const contentType = upstream.headers.get('content-type') ?? ''

    if (contentType.includes('text/html')) {
      const html = await upstream.text()
      const rewritten = rewriteHtml(html, target)
      return new Response(rewritten, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (contentType.includes('text/css')) {
      let css = await upstream.text()
      css = css.replace(
        /url\((["']?)([^"')]+)\1\)/g,
        (_, quote, val) => `url(${quote}${proxify(val, target)}${quote})`
      )
      return new Response(css, { headers: { 'Content-Type': contentType } })
    }

    // 나머지 (JS, 이미지, 폰트 등) — 그대로 전달
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
