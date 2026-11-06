/* Мир Уюта v3.0: внутренняя проверка полноты карточки; без сетевых запросов и записи данных. */
(() => {
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const present=s=>typeof s==='string'?!!s.trim():s!==null&&s!==undefined&&s!=='';
const https=s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.hostname.includes('.')}catch{return false}};
function evaluate(product={},photoRecords=[]){
 const d=product?.data||product||{},v=d.verified||{},sites=Array.isArray(d.platforms)?[...new Set(d.platforms.filter(x=>x==='ozon'||x==='wb'))]:[],checks=[];
 const check=(key,label,passed,weight,hint,group='Основные сведения',part=0)=>checks.push({key,label,done:!!passed,weight,hint,group,progress:passed?1:Math.max(0,Math.min(1,Number(part)||0))});
 check('platforms','Выбрана площадка',sites.length>0,3,'Укажи Ozon и/или Wildberries.');
 check('name','Название товара',present(d.name),6,'Укажи полное название и комплектность.');
 check('brand','Бренд',present(d.brand),3,'Укажи бренд.');
 check('article','Артикул',present(d.article),5,'Сверь артикул с документами производителя.');
 check('officialUrl','Официальная HTTPS-ссылка',https(d.officialUrl),6,'Вставь страницу производителя и проверь, что домен официальный.');
 for(const [key,label,weight,verifyWeight] of [['material','Материал',6,5],['dimensions','Размер / объём',6,5],['country','Страна',4,3],['manufacturer','Производитель',4,3]]){
   check(key,label,present(d[key]),weight,'Найди значение в официальном источнике.','Характеристики');
   check('verified_'+key,'Подтверждено: '+label,present(d[key])&&https(d.officialUrl)&&v[key]===true,verifyWeight,'Отметь подтверждение только после сверки.','Характеристики');
 }
 check('okpd2','Проверен код ОКПД2',/^\d{2}\.\d{2}\.\d{2}\.\d{3}$/.test(String(d.okpd2||'').trim()),6,'Укажи полный ОКПД2 00.00.00.000 после проверки классификатора.','Коды');
 check('tnved','Проверен 10-значный ТН ВЭД',/^\d{10}$/.test(String(d.tnved||'').trim()),6,'Укажи десять цифр после проверки материала, назначения и действующей ТН ВЭД.','Коды');
 if(sites.includes('wb')){
  check('wbCategory','Категория WB',present(d.wbCategory),5,'Нужна категория Wildberries.','Wildberries');
  check('wbCode','Код WB',present(d.wbCode),4,'Нужен код Wildberries.','Wildberries');
 }
 check('quantity','Положительный остаток',Number.isInteger(Number(d.quantity))&&Number(d.quantity)>0,5,'Укажи фактический остаток.','Продажа');
 check('packaging','Описание упаковки',present(d.packaging),4,'Укажи тип упаковки.','Продажа');
 check('packagingChecked','Комплектность/упаковка проверены',d.packagingChecked===true,5,'Проверь продажу поштучно или набором и упаковку.','Продажа');
 const photoList=Array.isArray(photoRecords)?photoRecords:[];
 const files=photoList.filter(x=>Number.isInteger(Number(x?.slot))&&Number(x.slot)>=1&&Number(x.slot)<=8&&present(x?.storage_path));
 const count=Math.min(8,files.length,new Set(files.map(x=>Number(x.slot))).size,new Set(files.map(x=>String(x.storage_path))).size);
 check('photos','8 файлов фотографий',photoList.length===8&&files.length===8&&count===8,14,
 'Загружено '+count+'/8 файлов. Проверь вручную отсутствие коллажей и правильность фото.','Фотографии',count/8);
 check('infographic','Инфографика готова',d.infographic===true,5,'Проверь и отметь готовность инфографики.','Фотографии');
 const names={photo:'Исправить фото',material:'Уточнить материал',dimension:'Уточнить размер',category:'Исправить категорию',stock:'Исправить остаток'};
 const problems=Array.isArray(d.issues)?[...new Set(d.issues.filter(k=>Object.prototype.hasOwnProperty.call(names,k)))]:[];
 check('issues','Нет открытых ошибок',problems.length===0,4,problems.length?'Отмечено: '+problems.map(k=>names[k]).join(', '):'Закрой замечания.','Контроль');
 const total=checks.reduce((s,c)=>s+c.weight,0)||1,score=Math.max(0,Math.min(100,Math.round(100*checks.reduce((s,c)=>s+c.weight*c.progress,0)/total)));
 const missing=checks.filter(c=>!c.done);
 const core=checks.filter(c=>c.group!=='Wildberries').every(c=>c.done);
 const channels={ozon:sites.includes('ozon')&&core,wb:sites.includes('wb')&&checks.every(c=>c.done)};
 return {score,complete:sites.length>0&&sites.every(k=>channels[k]),checks,missing,missingCount:missing.length,doneCount:checks.length-missing.length,count:checks.length,channels,sites,
  note:'Проверка полноты полей, а не экспертная оценка фото, подтверждение таможенного кода или проверка требований маркетплейсов по API.'};
}
function mini(r){
 const title=r.complete?'По чек-листу готово':r.missingCount+' пунктов требуют внимания';
 return '<div class="audit-mini" title="'+esc(title)+'"><div class="audit-mini-title"><b>'+r.score+'%</b><span>'+esc(title)+'</span></div><div class="audit-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+r.score+'" aria-label="Готовность товара"><span style="width:'+r.score+'%"></span></div></div>';
}
function panel(r){
 const pending=r.missing.slice(0,5).map(c=>'<li>'+esc(c.label)+'</li>').join('');
 const marketplace=r.sites.map(k=>'<span class="audit-market">'+(k==='wb'?'Wildberries':'Ozon')+': '+(r.channels[k]?'✓ по чек-листу':'не готово')+'</span>').join('');
 const groups=[...new Set(r.checks.map(c=>c.group))];
 return '<details id="readiness-audit" class="audit-panel"><summary><b>📋 Проверка товара · '+r.score+'%</b><small>Открыть список</small></summary><div class="audit-body">'+mini(r)+
 '<p class="audit-note">Выполнено '+r.doneCount+' из '+r.count+' пунктов.</p><div class="audit-markets">'+marketplace+'</div>'+
 (pending?'<div class="audit-next"><b>Нужно исправить:</b><ul>'+pending+'</ul></div>':'')+
 groups.map(g=>'<section class="audit-section"><h4>'+esc(g)+'</h4>'+r.checks.filter(c=>c.group===g).map(c=>
  '<div class="audit-check"><span class="audit-check-symbol '+(c.done?'done':'')+'">'+(c.done?'✓':'!')+'</span><span><strong>'+esc(c.label)+'</strong>'+
   (c.done?'':'<small>'+esc(c.hint)+'</small>')+'</span></div>').join('')+'</section>').join('')+
 '<p class="audit-note">'+esc(r.note)+'</p></div></details>';
}
const style=document.createElement('style');
style.textContent=[
 '.audit-mini{font-size:11px;min-width:110px;max-width:260px;line-height:1.4}',
 '.audit-mini-title{display:flex;flex-wrap:wrap;gap:7px;align-items:baseline;color:#78849b}',
 '.audit-mini-title b{font-size:13px;color:#344a9a}',
 '.audit-mini-title span{flex:1;min-width:75px}',
 '.audit-meter{height:7px;overflow:hidden;background:#e5eafb;border-radius:25px;margin-top:6px}',
 '.audit-meter>span{display:block;background:#5168cf;height:100%;border-radius:25px}',
 '.audit-panel{border:1px solid #cddaf7;background:#f7f9ff;border-radius:13px;margin:16px 0 22px;overflow:hidden}',
 '.audit-panel>summary{padding:14px;cursor:pointer;color:#354eaa;display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;font-size:12px}',
 '.audit-panel>summary small{font-size:10px;font-weight:500}',
 '.audit-body{padding:14px;border-top:1px solid #dce6fc}',
 '.audit-markets{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}',
 '.audit-market{font-size:10px;background:#eaf0ff;color:#435e9e;padding:5px 7px;border-radius:7px}',
 '.audit-next{font-size:11px;background:#fff5e8;color:#8c652a;padding:10px;border-radius:9px;margin:12px 0}',
 '.audit-next ul{margin:6px 0 0;padding-left:18px}',
 '.audit-note{font-size:11px;color:#718198;line-height:1.6}',
 '.audit-section{margin-top:13px}',
 '.audit-section h4{font-size:11px;color:#6e7d9e;margin:0 0 8px}',
 '.audit-check{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;align-items:start;border-top:1px solid #e3eafa;padding:9px 2px;font-size:11px;color:#314164;overflow-wrap:anywhere}',
 '.audit-check small{display:block;color:#7b89a0;font-size:11px;line-height:1.5;margin-top:4px}',
 '.audit-check-symbol{width:17px;height:17px;border-radius:5px;background:#fff0d7;color:#936619;display:grid;place-items:center;font-weight:800}',
 '.audit-check-symbol.done{background:#e2f3ed;color:#128267}',
 '.audit-show{padding:7px 9px;font-size:10px;border:1px solid #dce4f3;border-radius:8px;color:#455c93;background:#fff;cursor:pointer;font-weight:700}',
 '.audit-fix-items{font-size:11px;color:#697b95;padding-left:18px;margin:9px 0}',
 '@media(max-width:600px){.audit-body{padding:10px}}'
].join('');
document.head.appendChild(style);
window.MirUyutaReadiness={evaluate,mini,panel};
})();