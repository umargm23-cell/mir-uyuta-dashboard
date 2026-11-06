/* Мир Уюта — помощник заполнения v2.4. Серверная функция доступна после развертывания в Supabase. */
(() => {
  'use strict';
  const FIELDS = [
    ['name', 'Название товара'],
    ['brand', 'Бренд'],
    ['article', 'Артикул'],
    ['material', 'Материал'],
    ['dimensions', 'Размеры / объём'],
    ['country', 'Страна производства'],
    ['manufacturer', 'Производитель'],
    ['decorColor', 'Цвет / декор']
  ];
  const verifiedFields = { material: 'verified_material', dimensions: 'verified_dimensions', country: 'verified_country', manufacturer: 'verified_manufacturer' };
  const labelPattern = {
    article: /^(?:артикул|арт\.?|sku|item\s*(?:no\.?|number)|код\s*(?:товара|изделия)|модель|model|mpn)\s*[:：\-—–]\s*(.+)$/i,
    brand: /^(?:бренд|торговая\s+марка|brand|marke)\s*[:：\-—–]\s*(.+)$/i,
    material: /^(?:материал(?:\s+изделия)?|material|матеріал)\s*[:：\-—–]\s*(.+)$/i,
    dimensions: /^(?:размеры?|габариты?|размер\s*изделия|size|dimensions?)\s*[:：\-—–]\s*(.+)$/i,
    volume: /^(?:объ[её]м|вместимость|volume|capacity)\s*[:：\-—–]\s*(.+)$/i,
    height: /^(?:высота|height)\s*[:：\-—–]\s*(.+)$/i,
    diameter: /^(?:диаметр|diameter)\s*[:：\-—–]\s*(.+)$/i,
    country: /^(?:страна\s*(?:производства|изготовления|изготовитель)?|country\s*of\s*origin|made\s+in)\s*[:：\-—–]\s*(.+)$/i,
    manufacturer: /^(?:производитель|изготовитель|manufacturer|hersteller)\s*[:：\-—–]\s*(.+)$/i,
    decorColor: /^(?:цвет\s*декора|цвет|color|colour|декор)\s*[:：\-—–]\s*(.+)$/i
  };
  const trimmable = value => String(value ?? '').replace(/\s+/g, ' ').replace(/^[\s:—-]+|[\s|;]+$/g, '').trim().slice(0, 200);
  function validSource(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !/(^|\.)(localhost|local|test|invalid)$/.test(u.hostname) &&
        !(/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname));
    } catch { return false; }
  }
  function findProduct(items) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) { const found = findProduct(item); if (found) return found; continue; }
      const types = [].concat(item['@type'] || []).map(String).map(x => x.toLowerCase());
      if (types.some(x => x === 'product' || x.endsWith('/product'))) return item;
      const children = [];
      for (const k of ['@graph', 'mainEntity', 'itemListElement']) if (item[k]) children.push(item[k]);
      if (children.length) { const found = findProduct(children); if (found) return found; }
    }
    return null;
  }
  function nameOf(x) {
    if (Array.isArray(x)) return nameOf(x[0]);
    if (x && typeof x === 'object') return x.name || x['@id'] || '';
    return x || '';
  }
  function textFields(source) {
    const out = {};
    const lines = String(source).replace(/\r/g, '\n').split('\n').map(trimmable).filter(Boolean).slice(0, 5000);
    const extras = {};
    for (const line of lines) {
      // Не принимать весь рекламный текст в значение одного поля.
      if (line.length > 230) continue;
      for (const [key, regex] of Object.entries(labelPattern)) {
        const m = line.match(regex);
        if (!m) continue;
        const value = trimmable(m[1]);
        if (!value || value.length > 140 || (key !== 'article' && /^[-—–\d\s]*$/.test(value))) continue;
        if (key === 'volume' || key === 'height' || key === 'diameter') {
          if (!extras[key] && /\d/.test(value)) extras[key] = value;
        } else if (!out[key]) out[key] = value;
      }
    }
    if (!out.dimensions) {
      const parts = [];
      if (extras.volume) parts.push(`Объём: ${extras.volume}`);
      if (extras.height) parts.push(`Высота: ${extras.height}`);
      if (extras.diameter) parts.push(`Диаметр: ${extras.diameter}`);
      if (parts.length) out.dimensions = parts.join('; ');
    }
    return out;
  }
  function extractEvidence(raw) {
    const excerpt = String(raw || '').slice(0, 300000);
    if (!excerpt.trim()) return {};
    let source = excerpt;
    let structured = null;
    if (/<(?:!doctype|html|head|body|script|main|div|table|meta)\b/i.test(excerpt)) {
      const doc = new DOMParser().parseFromString(excerpt, 'text/html');
      const candidates = [];
      doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try { candidates.push(JSON.parse(script.textContent || 'null')); } catch { /* бывает некорректный JSON-LD */ }
      });
      structured = findProduct(candidates);
      const readable = excerpt.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
        .replace(/<\/?(?:div|p|tr|td|th|li|dd|dt|br|h[1-6]|section|article)\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');
      const tmp = doc.createElement('textarea');
      tmp.innerHTML = readable;
      source = tmp.value;
    }
    const data = textFields(source);
    if (structured) {
      const fromJson = {
        name: structured.name,
        brand: nameOf(structured.brand),
        article: structured.sku || structured.mpn || structured.productID,
        material: nameOf(structured.material),
        dimensions: nameOf(structured.size) || nameOf(structured.depth),
        country: nameOf(structured.countryOfOrigin),
        manufacturer: nameOf(structured.manufacturer),
        decorColor: nameOf(structured.color)
      };
      for (const [key, val] of Object.entries(fromJson)) {
        const cleaned = trimmable(val);
        if (cleaned) data[key] = cleaned;
      }
      const properties = Array.isArray(structured.additionalProperty) ? structured.additionalProperty : [];
      const propLines = properties.filter(p => p && p.name && p.value).map(p => `${p.name}: ${p.value}`).join('\n');
      const fromProps = textFields(propLines);
      for (const [k, val] of Object.entries(fromProps)) if (!data[k]) data[k] = val;
    }
    return Object.fromEntries(FIELDS.filter(([key]) => data[key]).map(([key]) => [key, data[key]]));
  }

  // Некоторые официальные страницы показывают сразу несколько товаров серии
  // в alt-текстах изображений или заголовках вместо таблицы «Материал: ...».
  // В таком случае нельзя автоматически выбирать первый объём.
  function extractProductVariants(raw) {
    const html = String(raw || '').slice(0, 300000);
    if (!/<(?:html|body|img|figure|a)\b/i.test(html)) return [];
    let doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch { return []; }
    const nodes = [...doc.querySelectorAll('img[alt], a[title], a, figcaption, h3, h4, [data-title]')].slice(0, 1800);
    const seen = new Set(), variants = [];
    const productWord = /(?:\b(?:tumbler|shot|pitcher|glass|goblet|cup|vase|decanter|flute|whisky|highball|mixing)\b|стакан|рюмка|бокал|фужер|ваза|графин|кувшин|чашка)/i;
    const volumePattern = /(\d{1,4}(?:[.,]\d+)?)\s*(ml|мл|l|л)(?![a-zа-яё])/i;
    for (const node of nodes) {
      for (const value of [node.getAttribute('alt'), node.getAttribute('title'), node.getAttribute('data-title'), node.textContent]) {
        const label = trimmable(value);
        if (label.length < 8 || label.length > 130 || !productWord.test(label)) continue;
        const match = label.match(volumePattern);
        if (!match) continue;
        const unit = /^(?:l|л)$/i.test(match[2]) ? 'л' : 'мл';
        const key = label.toLocaleLowerCase('ru').replace(/\s+/g, ' ');
        if (seen.has(key)) continue;
        seen.add(key);
        variants.push({ label, dimensions: 'Объём: ' + match[1].replace(',', '.') + ' ' + unit });
        if (variants.length >= 24) return variants;
      }
    }
    return variants;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function ui() {
    const shell = document.createElement('details');
    shell.id = 'official-source-assistant';
    shell.className = 'source-helper field span2';
    shell.innerHTML = `<summary>🔎 Помощник заполнения по сайту производителя <span class="helper-new">НОВОЕ</span></summary>
      <div class="helper-body">
        <p>Введи выше ссылку на <strong>официальную страницу производителя</strong>. Попробуем прочитать её; если сайт блокирует доступ из браузера, открой страницу и вставь текст характеристик ниже.</p>
        <div class="helper-buttons"><button type="button" class="outline" data-source="fetch">Получить по ссылке</button><button type="button" class="outline" data-source="server">Через сервер</button><button type="button" class="outline" data-source="open">Открыть источник ↗</button></div>
        <label class="helper-label" for="helper-source-text">Текст с официальной страницы (или HTML, если копируешь код)</label>
        <textarea id="helper-source-text" rows="5" placeholder="Артикул: ...\nМатериал: ...\nОбъём: ...\nСтрана производства: ..."></textarea>
        <div class="helper-buttons"><button type="button" class="outline" data-source="analyze">Найти характеристики</button></div>
        <p class="helper-status" id="helper-status" role="status" aria-live="polite">Мы не придумываем характеристики и не считаем торговые площадки официальными источниками.</p>
        <div id="helper-results" class="helper-results"></div>
        <p class="helper-note">Коды ОКПД2 и ТН ВЭД не подставляются автоматически — для них нужна отдельная классификация товара. Перенос полей не означает их подтверждение.</p>
      </div>`;
    shell.addEventListener('click', handleClick);
    return shell;
  }
  function attach() {
    const input = document.querySelector('#product-form #f-officialUrl');
    if (!input) return;
    const form = input.form;
    if (!form || form.querySelector('#official-source-assistant')) return;
    const host = input.closest('.field');
    if (!host) return;
    host.insertAdjacentElement('afterend', ui());
  }
  function setStatus(root, message, error = false) {
    const target = root.querySelector('#helper-status');
    if (target) { target.textContent = message; target.classList.toggle('helper-error', error); }
  }
  function buildProposals(root, data, raw = '') {
    const panel = root.querySelector('#helper-results');
    const variants = raw ? extractProductVariants(raw) : [];
    if (variants.length) {
      root._sourceVariants = { variants, base: data };
      panel.innerHTML = '<h4>На странице найдены разные изделия. Выбери точную модель:</h4>' +
        '<div class="helper-variant-list">' + variants.map((v, i) =>
          '<button class="outline" type="button" data-source="variant" data-index="' + i + '">' + esc(v.label) + '</button>'
        ).join('') + '</div>' +
        '<p class="helper-note">Объём и название берутся из выбранной подписи на сайте. Набор из 6 шт., материал и заводской артикул нужно проверять отдельно.</p>';
      setStatus(root, 'Найдено вариантов: ' + variants.length + '. Укажи именно свой стакан, прежде чем переносить характеристики.');
      return;
    }
    const entries = FIELDS.filter(([key]) => data[key]);
    if (!entries.length) {
      panel.innerHTML = '';
      setStatus(root, 'В тексте не нашлись однозначные характеристики. Попробуй скопировать таблицу характеристик с официальной страницы.', true);
      return;
    }
    const form = root.closest('form');
    panel.innerHTML = `<h4>Найдено: ${entries.length}. Проверь значения перед переносом</h4>` + entries.map(([key, label]) => {
      const old = form.elements.namedItem(key)?.value?.trim();
      const selected = !old;
      return `<label class="helper-candidate"><input type="checkbox" data-field="${key}" data-value="${esc(data[key])}" ${selected ? 'checked' : ''}><span><strong>${label}</strong><small>${esc(data[key])}${old && old !== data[key] ? `<em>Сейчас в карточке: ${esc(old)}</em>` : ''}</small></span></label>`;
    }).join('') + `<label class="helper-confirm"><input type="checkbox" id="helper-source-confirm"> Подтверждаю, что ссылка ведёт на официальный сайт производителя и данные относятся к этому товару.</label>
      <button class="primary" type="button" data-source="apply">Перенести выбранное в карточку</button>`;
    setStatus(root, `Найдено ${entries.length} полей. Изменения появятся в форме, но сохранятся в облаке только после нажатия «Сохранить».`);
  }
  async function fetchThroughServer(root, requestedUrl = '') {
    const url = requestedUrl || root.closest('form')?.elements.namedItem('officialUrl')?.value?.trim() || '';
    if (!validSource(url)) throw Error('Укажи корректный HTTPS-адрес производителя.');
    const invoke = window.MirUyutaOfficialSourceInvoke;
    if (typeof invoke !== 'function') throw Error('Приложение ещё не подключилось к Supabase. Обнови страницу.');
    setStatus(root, 'Запрашиваю страницу через защищённую серверную функцию…');
    const response = await invoke(url);
    if (!response || typeof response.html !== 'string' || response.html.length > 350000 || !response.html.trim()) {
      throw Error('Сервер не вернул читаемые характеристики.');
    }
    const input = root.querySelector('#helper-source-text');
    if (input) input.value = response.html;
    buildProposals(root, extractEvidence(response.html), response.html);
    if (root.querySelectorAll('#helper-results input[data-field]').length) {
      setStatus(root, 'Сайт прочитан через Supabase. Проверь найденные значения и официальный источник перед переносом.');
    }
  }
  async function fetchPage(root) {
    const link = root.closest('form').elements.namedItem('officialUrl')?.value?.trim() || '';
    if (!validSource(link)) { setStatus(root, 'Вставь корректную HTTPS-ссылку на официальный сайт производителя.', true); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setStatus(root, 'Читаю страницу производителя…');
    try {
      const res = await fetch(link, {credentials:'omit', mode:'cors', redirect:'follow', signal:controller.signal});
      if (!res.ok) throw Error('Сайт ответил HTTP ' + res.status);
      if (new URL(res.url).origin !== new URL(link).origin) throw Error('Страница перенаправила на другой сайт. Проверь источник вручную.');
      const mime = res.headers.get('content-type') || '';
      if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(mime)) throw Error('По ссылке не HTML-страница.');
      const size = Number(res.headers.get('content-length')) || 0;
      if (size > 800000) throw Error('Страница слишком большая для этого помощника.');
      const html = (await res.text()).slice(0, 120000);
      const input = root.querySelector('#helper-source-text');
      input.value = html;
      buildProposals(root, extractEvidence(html), html);
    } catch (e) {
      try {
        await fetchThroughServer(root, link);
      } catch (serverError) {
        setStatus(root, 'Браузер не смог прочитать сайт. Сервер: ' +
          String(serverError?.message || 'недоступен') +
          '. Можно открыть официальный сайт и вставить характеристики вручную.', true);
      }
    } finally { clearTimeout(timeout); }
  }
  function applySelected(root) {
    const form = root.closest('form');
    const link = form.elements.namedItem('officialUrl')?.value?.trim() || '';
    if (!validSource(link)) { setStatus(root, 'Для переноса нужен корректный HTTPS-адрес производителя.', true); return; }
    if (!root.querySelector('#helper-source-confirm')?.checked) {
      setStatus(root, 'Подтверди, что это действительно официальный источник и именно твой товар.', true); return;
    }
    const selected = [...root.querySelectorAll('input[data-field]:checked')];
    if (!selected.length) { setStatus(root, 'Отметь хотя бы одно найденное поле.', true); return; }
    let moved = 0;
    for (const item of selected) {
      const field = item.dataset.field;
      const value = item.dataset.value;
      const input = form.elements.namedItem(field);
      if (!input || !value) continue;
      if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event('input', {bubbles:true}));
        // При изменении сведений требуется новая ручная сверка по официальному источнику.
        const verified = verifiedFields[field] && form.elements.namedItem(verifiedFields[field]);
        if (verified) verified.checked = false;
      }
      moved++;
    }
    setStatus(root, `Перенесено ${moved} полей. Проверь и при необходимости отметь подтверждение характеристик, затем нажми «Сохранить» внизу карточки.`);
  }
  function chooseVariant(root, index) {
    const variants = root._sourceVariants;
    if (!variants || !Number.isInteger(index) || index < 0 || index >= variants.variants.length) return;
    const chosen = variants.variants[index];
    const proposal = { ...variants.base, name: chosen.label, dimensions: chosen.dimensions };
    buildProposals(root, proposal);
    setStatus(root, 'Выбран вариант «' + chosen.label + '». Проверь совпадение формы и артикула, отметь нужные поля и перенеси их в карточку.');
  }
  async function handleClick(event) {
    const button = event.target.closest('[data-source]');
    if (!button) return;
    event.preventDefault();
    const root = event.currentTarget, command = button.dataset.source;
    if (command === 'fetch') { button.disabled = true; try { await fetchPage(root); } finally { button.disabled = false; } }
    if (command === 'server') {
      button.disabled = true;
      try { await fetchThroughServer(root); }
      catch (error) { setStatus(root, 'Серверное чтение не выполнено: ' + String(error?.message || error) + '. Используй ручную вставку текста.', true); }
      finally { button.disabled = false; }
      return;
    }
    if (command === 'open') {
      const url = root.closest('form').elements.namedItem('officialUrl')?.value?.trim();
      if (!validSource(url)) { setStatus(root, 'Сначала укажи HTTPS-адрес производителя.', true); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    if (command === 'variant') { chooseVariant(root, Number(button.dataset.index)); return; }
    if (command === 'analyze') {
      const html = root.querySelector('#helper-source-text').value;
      buildProposals(root, extractEvidence(html), html);
    }
    if (command === 'apply') applySelected(root);
  }
  const style = document.createElement('style');
  style.textContent = `
    .source-helper{margin:8px 0 10px;border:1px solid #cbd7f5;background:#f7f9ff;border-radius:13px;padding:0;min-width:0}
    .source-helper summary{cursor:pointer;list-style:none;color:#3449a8;font-weight:750;font-size:12px;padding:14px 16px}
    .source-helper summary::-webkit-details-marker{display:none}.source-helper summary::before{content:'▸';margin-right:9px}
    .source-helper[open] summary::before{content:'▾'}
    .helper-new{background:#e4ebff;font-size:9px;padding:4px 6px;border-radius:6px;margin-left:5px}
    .helper-body{border-top:1px solid #dfe5f6;padding:14px 16px 17px}
    .helper-body p{font-size:11px;color:#61718e;line-height:1.6;margin:0 0 12px}
    .helper-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 13px}
    .helper-buttons button{font-size:11px;padding:9px 10px}
    .helper-label{display:block;font-size:11px;color:#526583;font-weight:700;margin:9px 0 6px}
    .helper-body textarea{width:100%;box-sizing:border-box;border:1px solid #d5dfee;border-radius:9px;padding:10px;font:12px/1.5 inherit;resize:vertical;background:#fff;color:#24314d}
    .helper-status{background:#eef3ff;border-radius:8px;padding:10px 12px!important;color:#394d93!important}
    .helper-status.helper-error{background:#fff5e9;color:#996529!important}
    .helper-variant-list{display:flex;flex-direction:column;gap:7px;margin:12px 0}
    .helper-variant-list button{text-align:left;overflow-wrap:anywhere;padding:10px 12px}
    .helper-results h4{font-size:12px;color:#263b63;margin:15px 0 9px}
    /* Область помощника находится внутри .field: общие стили .field input
       иначе задают чекбоксам width:100% и отталкивают подписи за край экрана. */
    .source-helper .helper-results{width:100%;min-width:0;max-width:100%;overflow-wrap:anywhere}
    .source-helper .helper-candidate{display:grid;grid-template-columns:20px minmax(0,1fr);align-items:start;column-gap:10px;padding:12px 5px;border-bottom:1px solid #e4eaf5;color:#30405b;font-size:12px;width:100%;min-width:0;max-width:100%}
    .source-helper .helper-candidate>span{display:block;min-width:0;overflow-wrap:anywhere}
    .source-helper .helper-candidate input[type="checkbox"],.source-helper .helper-confirm input[type="checkbox"]{display:block;box-sizing:border-box;appearance:auto;width:18px!important;min-width:18px!important;max-width:18px!important;height:18px!important;min-height:18px;padding:0!important;margin:2px 0 0!important;flex:0 0 18px;accent-color:#465bca;border:initial;border-radius:0}
    .source-helper .helper-candidate small{display:block;font-size:11px;line-height:1.5;margin-top:3px;overflow-wrap:anywhere}
    .source-helper .helper-candidate em{display:block;color:#b46f31;font-size:10px;font-style:normal;overflow-wrap:anywhere}
    .source-helper .helper-confirm{display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:10px;align-items:start;font-size:11px;line-height:1.5;margin:14px 0;min-width:0;overflow-wrap:anywhere}
    .helper-results>.primary{font-size:11px;padding:11px 13px}
    .helper-note{margin-top:14px!important;font-size:10px!important}
    @media(max-width:500px){.source-helper summary{font-size:11px;padding:13px 11px}.helper-body{padding:13px 10px}.helper-buttons button{flex:1}}
  `;
  document.head.appendChild(style);
  const container = document.querySelector('#modal-root');
  if (container) {
    new MutationObserver(attach).observe(container, {subtree:true,childList:true});
    attach();
  }
  // Отладочный парсер для автоматических тестов, без доступа к личным данным.
  window.MirUyutaSourceParser = { textFields, extractEvidence };
})();