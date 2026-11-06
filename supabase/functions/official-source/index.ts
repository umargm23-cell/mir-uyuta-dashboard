/**
 * Мир Уюта — безопасное чтение публичной страницы производителя.
 * Доступ: только вошедший пользователь Supabase (auth: user).
 * Доступные домены: OFFICIAL_SOURCE_HOSTS, список через запятую (обязательно).
 * Не обходит CAPTCHA, авторизацию, платный доступ или ограничения сайта.
 */
import { withSupabase } from 'npm:@supabase/server@1';

const MAX_HTML_BYTES = 256 * 1024;
const MAX_BODY_BYTES = 4096;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12000;
const REQUESTS_PER_MINUTE = 10;
const attempts = new Map<string, { started: number; count: number }>();

function reject(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function allowedHosts(): string[] {
  const raw = Deno.env.get('OFFICIAL_SOURCE_HOSTS') || 'nachtmann.com,rcrcrystal.com,crystal-bohemia.com';
  return raw.split(',').map(x => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''))
    .filter(x => x.includes('.') && !x.includes('/') && !x.includes(':') && x.length > 3 && !x.startsWith('.'));
}

function safePublicUrl(value: unknown, hosts: string[]): URL {
  if (typeof value !== 'string' || !value || value.length > 2200) throw Error('Укажи полный HTTPS-адрес страницы производителя.');
  let url: URL;
  try { url = new URL(value); } catch { throw Error('Некорректная ссылка.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !host || host.includes(':')) {
    throw Error('Разрешены только обычные HTTPS-страницы без логина, пароля и порта.');
  }
  if (/^(?:\d+\.\d+\.\d+\.\d+|\d+|localhost)$/.test(host) || /\.(?:localhost|local|internal|test|invalid|example)$/.test(host)) {
    throw Error('Локальные и IP-адреса запрещены.');
  }
  if (!hosts.some(allowed => host === allowed || host === `www.${allowed}`)) {
    throw Error('Домен не включён в список официальных сайтов. Добавь его в OFFICIAL_SOURCE_HOSTS в Supabase.');
  }
  return url;
}

async function readCapped(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error('Страница слишком большая для обработки.');
      parts.push(value);
    }
  } finally { try { await reader.cancel(); } catch { /* уже закрыт */ } }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { combined.set(part, offset); offset += part.byteLength; }
  return new TextDecoder('utf-8').decode(combined);
}

async function fetchOfficial(initial: URL, hosts: string[]): Promise<{ html: string; url: string }> {
  let url = initial;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
      const res = await fetch(url, {
        method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
        headers: { 'Accept': 'text/html, application/xhtml+xml, text/plain;q=0.8' }
      });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        if (attempt === MAX_REDIRECTS) throw Error('Слишком много перенаправлений.');
        const location = res.headers.get('location');
        if (!location) throw Error('Перенаправление без адреса.');
        url = safePublicUrl(new URL(location, url).href, hosts);
        await res.body?.cancel();
        continue;
      }
      if (!res.ok) throw Error('Сайт производителя вернул HTTP ' + res.status + '.');
      const mime = (res.headers.get('content-type') || '').toLowerCase();
      if (!/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:\s*;|\s*$)/.test(mime)) {
        throw Error('По ссылке не найдена HTML-страница с характеристиками.');
      }
      if (Number(res.headers.get('content-length') || 0) > MAX_HTML_BYTES) throw Error('Страница слишком большая.');
      const html = await readCapped(res.body, MAX_HTML_BYTES);
      if (!html.trim()) throw Error('Страница оказалась пустой.');
      return { html, url: url.href };
    }
    throw Error('Не удалось открыть страницу.');
  } finally { clearTimeout(deadline); }
}

const authHandler = withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return reject('Используй POST.', 405);
    const hosts = allowedHosts();
    if (!hosts.length) return reject('Сервер ещё не настроен: в Supabase добавь OFFICIAL_SOURCE_HOSTS.', 503);
    const userId = String(ctx.userClaims?.id || ctx.jwtClaims?.sub || '');
    if (!userId) return reject('Нужен вход в личный кабинет.', 401);
    const now = Date.now();
    const quota = attempts.get(userId);
    if (quota && now - quota.started < 60_000 && quota.count >= REQUESTS_PER_MINUTE) return reject('Слишком много запросов. Повтори позже.', 429);
    if (!quota || now - quota.started >= 60_000) attempts.set(userId, { started: now, count: 1 });
    else quota.count++;
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) return reject('Слишком большой запрос.', 413);
    let url: URL;
    try {
      const raw = await readCapped(req.body, MAX_BODY_BYTES);
      const json = JSON.parse(raw);
      url = safePublicUrl(json?.url, hosts);
    } catch (error) { return reject(String(error instanceof Error ? error.message : 'Неверные данные.'), 400); }
    try {
      const result = await fetchOfficial(url, hosts);
      return Response.json({ ...result, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'Сайт слишком долго отвечает.' :
        error instanceof Error ? error.message : 'Не удалось получить страницу.';
      return reject(message, 422);
    }
  });
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://umargm23-cell.github.io',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};
export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const response = await authHandler(req);
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
  }
};