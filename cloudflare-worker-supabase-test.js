const INDEX_URL = 'https://raw.githubusercontent.com/xuonginanhnhaminh1234/app-dang-ky-nghi/supabase-hr-test/index.html';
const ADAPTER_URL = 'https://raw.githubusercontent.com/xuonginanhnhaminh1234/app-dang-ky-nghi/supabase-hr-test/supabase-adapter.js';
const INIT_MARKER = '/* ================== KHỞI ĐỘNG ================== */';

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'NhaMinh-HR-Supabase-Test' },
    cf: { cacheTtl: 30, cacheEverything: true }
  });
  if (!r.ok) throw new Error(`Không tải được source: ${r.status}`);
  return await r.text();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, app: 'nhaminh-hr-supabase-test' });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const [indexHtml, adapterJs] = await Promise.all([
        fetchText(INDEX_URL),
        fetchText(ADAPTER_URL)
      ]);

      if (!indexHtml.includes(INIT_MARKER)) {
        return new Response('Không tìm thấy điểm chèn Supabase adapter trong index.html.', { status: 500 });
      }

      // Adapter được chèn trong chính thẻ <script> hiện tại, ngay trước init().
      // Vì vậy API Supabase đã thay thế xong trước khi app đọc localStorage / refreshFull.
      const html = indexHtml.replace(
        INIT_MARKER,
        `\n/* ===== SUPABASE TEST ADAPTER - AUTO INJECTED BY CLOUDFLARE ===== */\n${adapterJs}\n/* ===== END SUPABASE TEST ADAPTER ===== */\n\n${INIT_MARKER}`
      );

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer'
        }
      });
    } catch (e) {
      return new Response('HR TEST load error: ' + (e?.message || String(e)), {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });
    }
  }
};
