/* Мир Уюта: предварительный подбор ОКПД2 и ТН ВЭД по документально подтверждённым признакам. */
(() => {
'use strict';
const OK='https://www.consultant.ru/document/cons_doc_LAW_163703/5b7903aa3b744532da614ead2c4a9b6178266cef/';
const TN='https://www.consultant.ru/document/cons_doc_LAW_397176/bfe444864622d236c231a5693b2b2e9e557da183/';
const FAR='https://www.consultant.ru/document/cons_doc_LAW_397176/b9d5ab91ea9454d73239979cbb7067e356f7ec82/';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=x=>String(x||'').toLowerCase().replace(/ё/g,'е');
function classify(p,opt={}){
 const name=text(p.name),mat=text(p.material), t={okpd:'',tnved:'',group:'',warnings:[],source:'',reason:''};
 const drink=/стакан|рюмк|бокал|фужер|стопк|tumbler|highball|goblet|flute|wine glass|shot glass|beer glass/.test(name);
 const decorative=/ваз[а-я]*\s+для\s+цветов|flower vase|цветочн[а-я]*\s+ваз/.test(name);
 const table=/тарелк|салатник|масленк|сахарниц|пиал|чашк|блюд|конфетниц|кувшин|графин|менажниц|соусник|фруктовниц|чайник|для фруктов|для конфет|plate|bowl|dish|pitcher|decanter/.test(name);
 const porcelain=/фарфор|porcelain/.test(mat),crystal=/хруст|crystal/.test(mat),glass=crystal||/стекл|glass/.test(mat);
 if(!porcelain&&!glass){t.warnings.push('Нет подтверждённого типа материала для этих правил. Не назначаем коды по бренду или одному названию.');return t;}
 if(!drink&&!table&&!decorative){t.warnings.push('Не удалось однозначно определить вид изделия. Уточни назначение товара.');return t;}
 if(!p.verified)t.warnings.push('Материал ещё не отмечен подтверждённым по официальному источнику.');
 if(porcelain){
   if(decorative){t.warnings.push('Декоративный фарфор классифицируется отдельно от столовой посуды.');return t;}
   t.okpd='23.41.11.110';t.tnved='6911100000';t.group='6911';t.source=FAR;
   t.reason='Посуда столовая/кухонная из фарфора';return t;
 }
 t.source=TN;
 t.okpd=decorative?(crystal?'23.13.13.141':'23.13.13.142'):drink?(crystal?'23.13.12.110':'23.13.12.120'):(crystal?'23.13.13.111':'23.13.13.112');
 t.reason='Тип: '+(decorative?'декоративное изделие':drink?'сосуд для питья':'столовая/кухонная посуда')+'; материал: '+p.material;
 if(decorative){t.group='7013';t.warnings.push('Для ваз для цветов полный код ТН ВЭД требует дополнительной проверки назначения и свойств стекла.');return t;}
 const lead=opt.lead||'unknown',stem=opt.stem||'unknown',made=opt.made||'unknown',decor=opt.decor||'unknown',tempered=opt.tempered||'unknown',low=opt.low||'unknown';
 if(lead==='unknown')t.warnings.push('Неизвестна доля PbO. «Хрусталь» в названии не подтверждает ≥24% оксида свинца.');
 if(drink){
  if(stem==='unknown'){t.group='7013';t.warnings.push('Уточни, на ножке ли сосуд для питья.');}
  else if(lead==='yes'){
   t.group=stem==='yes'?'7013 22':'7013 33';
   if(stem==='yes'){t.tnved=made==='hand'?'7013221000':made==='machine'?'7013229000':'';}
   else if(made!=='unknown'&&decor!=='unknown'){const c={hand:{yes:'7013331100',no:'7013331900'},machine:{yes:'7013339100',no:'7013339900'}};t.tnved=c[made]?.[decor]||'';}
  }else if(lead==='no'){
   t.group=stem==='yes'?'7013 28':'7013 37';
   if(stem==='yes'){t.tnved=made==='hand'?'7013281000':made==='machine'?'7013289000':'';}
   else if(tempered==='yes')t.tnved='7013371000';
   else if(tempered==='no'&&made!=='unknown'&&decor!=='unknown'){const c={hand:{yes:'7013375100',no:'7013375900'},machine:{yes:'7013379100',no:'7013379900'}};t.tnved=c[made]?.[decor]||'';}
  }else t.group='7013';
 }else{
  if(lead==='yes'){t.group='7013 41';t.tnved=made==='hand'?'7013411000':made==='machine'?'7013419000':'';}
  else if(lead==='no'){
   t.group='7013 49';
   if(low==='yes'){t.group='7013 42';t.tnved='7013420000';}
   else if(low==='no'){
    if(tempered==='yes')t.tnved='7013491000';
    else if(tempered==='no')t.tnved=made==='hand'?'7013499100':made==='machine'?'7013499900':'';
   }else t.warnings.push('Не исключено стекло с низким коэффициентом термического расширения (7013 42).');
  }else t.group='7013';
 }
 if(!t.tnved)t.warnings.push('Для точного 10-значного ТН ВЭД пока не хватает подтверждённых признаков. Неполный код в карточку не переносится.');
 return t;
}
function options(el){return Object.fromEntries([...el.querySelectorAll('[data-c-opt]')].map(x=>[x.dataset.cOpt,x.value]));}
function fields(form){const get=x=>form.elements.namedItem(x)?.value?.trim()||'';return {name:get('name'),material:get('material'),verified:!!form.elements.namedItem('verified_material')?.checked,oldOk:get('okpd2'),oldTn:get('tnved')};}
function make(){
 const el=document.createElement('details');el.id='code-classifier';el.className='code-classifier span2';
 el.innerHTML='<summary>🧾 Подобрать ОКПД2 и ТН ВЭД <small>НОВОЕ</small></summary><div class="class-body">'+
 '<p>Предварительный подбор по названию и материалу карточки. Неизвестные признаки не заполняются догадками.</p>'+
 '<div class="class-options">'+[
 ['lead','PbO ≥ 24%?',['unknown','Неизвестно'],['yes','Да, подтверждено'],['no','Нет, подтверждено']],
 ['stem','Сосуд на ножке?',['unknown','Неизвестно'],['yes','Да'],['no','Нет']],
 ['made','Изготовление',['unknown','Неизвестно'],['hand','Ручное'],['machine','Механическое']],
 ['decor','Резной / другой декор?',['unknown','Неизвестно'],['yes','Есть'],['no','Нет']],
 ['tempered','Стекло упрочнённое?',['unknown','Неизвестно'],['yes','Да'],['no','Нет']],
 ['low','Низкое тепловое расширение (7013 42)?',['unknown','Неизвестно'],['yes','Да, по документам'],['no','Нет, по документам']]
 ].map(([key,title,...opts])=>'<label>'+title+'<select data-c-opt="'+key+'">'+opts.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>').join('')+'</div>'+
 '<button type="button" class="outline" data-c-action="calculate">Подобрать по карточке</button><div class="class-result" aria-live="polite"></div>'+
 '<p>Справочный подбор, а не решение таможенного органа. Проверяй действующую номенклатуру, документы производителя и назначение изделия перед публикацией.</p></div>';
 el.addEventListener('click',click);
 el.addEventListener('change',e=>{if(e.target.matches('[data-c-opt]'))render(el)});
 return el;
}
function render(el){
 const form=el.closest('form');if(!form)return;
 const p=fields(form),r=classify(p,options(el)),target=el.querySelector('.class-result');
 function line(key,title,code,old){
  if(!code)return '<p class="class-empty">'+title+': полный код пока не установлен</p>';
  return '<label class="class-row"><input type="checkbox" data-c-field="'+key+'" data-code="'+code+'"'+(old&&old!==code?'':' checked')+'><span><b>'+title+': '+esc(code)+'</b>'+(old&&old!==code?'<small>Уже указан другой код: '+esc(old)+'. Отметь галочку, чтобы заменить.</small>':'<small>Предварительный подбор — требует сверки</small>')+'</span></label>';
 }
 target.innerHTML='<h4>Результат подбора</h4>'+line('okpd2','ОКПД2',r.okpd,p.oldOk)+line('tnved','ТН ВЭД',r.tnved,p.oldTn)+
 (r.group&&!r.tnved?'<p class="class-family">Предварительная группа ТН ВЭД: <strong>'+esc(r.group)+'</strong> — в карточку не записывается.</p>':'')+
 (r.reason?'<p><b>Основание:</b> '+esc(r.reason)+'</p>':'')+
 r.warnings.map(x=>'<p class="class-warning">'+esc(x)+'</p>').join('')+
 '<p>Документы: <a href="'+OK+'" target="_blank" rel="noopener noreferrer">ОКПД2</a> · <a href="'+esc(r.source||TN)+'" target="_blank" rel="noopener noreferrer">ТН ВЭД ЕАЭС</a></p>'+
 (r.okpd||r.tnved?'<label class="class-row"><input type="checkbox" data-c-confirm><span>Проверил назначение и материал по официальным документам; согласен перенести отмеченные коды.</span></label><button type="button" class="primary" data-c-action="apply">Перенести отмеченные коды</button>':'')+
 '<p class="class-status" role="status"></p>';
}
function click(event){
 const b=event.target.closest('[data-c-action]');if(!b)return;event.preventDefault();
 const el=event.currentTarget,form=el.closest('form');if(!form)return;
 if(b.dataset.cAction==='calculate'){render(el);return;}
 const status=el.querySelector('.class-status');
 if(!el.querySelector('[data-c-confirm]')?.checked){if(status)status.textContent='Сначала подтверди ручную проверку.';return;}
 const chosen=[...el.querySelectorAll('[data-c-field]:checked')];
 if(!chosen.length){if(status)status.textContent='Отметь хотя бы один код.';return;}
 const fresh=classify(fields(form),options(el));
 for(const x of chosen){const key=x.dataset.cField,code=key==='okpd2'?fresh.okpd:fresh.tnved;
  if(!code||code!==x.dataset.code){if(status)status.textContent='Данные изменились: подбери коды ещё раз.';return;}
  const input=form.elements.namedItem(key);if(input){input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}));}
 }
 if(status)status.textContent='Коды перенесены в форму. Проверь их и нажми «Сохранить» внизу карточки.';
}
function attach(){
 const input=document.querySelector('#product-form #f-tnved');
 if(!input||document.querySelector('#code-classifier'))return;
 const host=input.closest('.field');if(host)host.insertAdjacentElement('afterend',make());
}
const css=document.createElement('style');css.textContent=
'.code-classifier{grid-column:1/-1;min-width:0;border:1px solid #d5def0;border-radius:12px;background:#f8faff;margin:6px 0}'+
'.code-classifier summary{padding:14px;cursor:pointer;font-size:12px;font-weight:800;color:#3a4eaa}'+
'.code-classifier summary small{font-size:9px;padding:3px 6px;background:#e1eaff;border-radius:5px}'+
'.code-classifier .class-body{padding:13px;border-top:1px solid #e5eafd;min-width:0}'+
'.code-classifier .class-body p{font-size:11px;line-height:1.6;color:#65748d;overflow-wrap:anywhere}'+
'.code-classifier .class-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}'+
'.code-classifier .class-options label{display:grid;gap:5px;font-size:11px;font-weight:700;min-width:0}'+
'.code-classifier .class-options select{width:100%;min-width:0;border:1px solid #d6dff1;border-radius:8px;padding:9px;background:#fff}'+
'.code-classifier .class-result{min-width:0;overflow-wrap:anywhere}'+
'.code-classifier .class-result h4{font-size:12px;margin:14px 0 7px}'+
'.code-classifier .class-row{display:grid;grid-template-columns:20px minmax(0,1fr);gap:10px;width:100%;min-width:0;align-items:start;padding:10px 4px;border-bottom:1px solid #e6e9f3;font-size:11px;color:#34445e}'+
'.code-classifier .class-row input[type=checkbox]{appearance:auto;display:block;width:18px!important;min-width:18px!important;max-width:18px!important;height:18px!important;min-height:18px;padding:0!important;margin:2px 0 0!important;border:initial;accent-color:#455bca}'+
'.code-classifier .class-row span{min-width:0;overflow-wrap:anywhere}'+
'.code-classifier .class-row small{display:block;color:#78869c;margin-top:4px}'+
'.code-classifier .class-warning{background:#fff5e8;border-radius:8px;padding:9px;color:#916a33!important}'+
'.code-classifier .class-family{background:#eaf0ff;border-radius:8px;padding:9px;color:#3b52a6!important}'+
'.code-classifier .class-result button{font-size:11px;margin-top:10px}'+
'@media(max-width:500px){.code-classifier .class-options{grid-template-columns:1fr}.code-classifier .class-body{padding:10px}}';
document.head.appendChild(css);
const root=document.querySelector('#modal-root');
if(root){new MutationObserver(attach).observe(root,{subtree:true,childList:true});attach();}
window.MirUyutaClassify={classify};
})();