/* Мир Уюта 3.1 — выбор действительных категорий из Ozon / Wildberries через защищённый Supabase API. */
(() => {
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const simplify=name=>{
 const s=String(name||'').toLocaleLowerCase('ru');
 const synonyms=[[/стакан|tumbler|highball|хайбол|old fashioned/,'стакан'],[/бокал|фужер|wine glass|flute/,'бокал'],[/масленк/,'масленка'],[/салфетниц|салфеток/,'салфетница'],[/тарелк/,'тарелка'],[/сахарниц/,'сахарница'],[/конфетниц/,'конфетница'],[/чайник/,'чайник'],[/кружк|mug/,'кружка'],[/кувшин/,'кувшин'],[/поднос/,'поднос'],[/ложк/,'ложка'],[/вилк/,'вилка'],[/ваз/,'ваза']];
 return (synonyms.find(([r])=>r.test(s))?.[1]||String(name||'').slice(0,45)).trim();
};
function make(form){
 const node=document.createElement('div');node.className='category-helper span2';node.id='category-helper';
 node.innerHTML='<details><summary>🏷️ Категории из Ozon и Wildberries <small>НОВОЕ</small></summary>'+
 '<div class="category-inner"><p>Поиск выполняется в реальных справочниках Seller API. Категория не назначается автоматически — выбери подходящий вариант и проверь тип товара.</p>'+
 '<label class="cat-label">Что ищем в категориях?<input type="search" data-cat-query maxlength="120" placeholder="Например, стакан или масленка" value="'+esc(simplify(form.elements.namedItem('name')?.value||''))+'"></label>'+
 '<button type="button" class="outline" data-cat-action="search">Найти категории Ozon и WB</button>'+
 '<p class="cat-status" role="status" aria-live="polite">Для поиска потребуется настроить API-доступы продавца в Supabase Secrets.</p>'+
 '<div class="cat-results"></div><p class="cat-hint">Применение категории меняет поля только в этой форме. Чтобы сохранить, нажми основную кнопку «Сохранить».</p></div></details>';
 node.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-cat-action]');if(!btn)return;
  e.preventDefault();const action=btn.dataset.catAction;
  if(action==='search'){
   const query=node.querySelector('[data-cat-query]').value.trim();
   if(query.length<3){node.querySelector('.cat-status').textContent='Введи не менее трёх символов.';return}
   if(typeof window.MirUyutaCategorySearch!=='function'){node.querySelector('.cat-status').textContent='Сервер поиска пока не подключён. Обнови страницу.';return}
   btn.disabled=true;node.querySelector('.cat-status').textContent='Загружаю справочники Ozon и Wildberries…';
   try{
    const answer=await window.MirUyutaCategorySearch(query);
    node._data=answer.result||{};
    node.querySelector('.cat-results').innerHTML=['ozon','wb'].map(provider=>{
      const r=node._data[provider],title=provider==='ozon'?'Ozon':'Wildberries';
      if(!r)return '<section class="cat-provider"><h4>'+title+'</h4><p>Ответ от площадки не получен.</p></section>';
      if(!r.ok)return '<section class="cat-provider"><h4>'+title+'</h4><p class="cat-problem">'+esc(r.message||'Справочник недоступен.')+'</p></section>';
      if(!Array.isArray(r.items)||!r.items.length)return '<section class="cat-provider"><h4>'+title+'</h4><p>Совпадения не найдены. Попробуй другое название предмета.</p></section>';
      return '<section class="cat-provider"><h4>'+title+' · '+r.items.length+' вариантов</h4>'+r.items.map((x,i)=>
       '<button type="button" class="cat-choice" data-cat-action="choose" data-cat-provider="'+provider+'" data-cat-index="'+i+'">'+
       '<b>'+esc(x.name)+'</b><small>'+esc(x.category||'')+'</small>'+
       '<small>'+(provider==='ozon'?'Категория '+esc(x.id)+' · тип '+esc(x.typeId):'ID предмета '+esc(x.id))+'</small></button>').join('')+'</section>';
    }).join('');
    node.querySelector('.cat-status').textContent='Результаты получены из API. Выбери правильный предмет и проверь комплектность.';
   }catch(err){node.querySelector('.cat-status').textContent='Ошибка поиска: '+String(err?.message||err).slice(0,230)}
   finally{btn.disabled=false}
  }else if(action==='choose'){
   const provider=btn.dataset.catProvider,idx=Number(btn.dataset.catIndex);
   if(!['ozon','wb'].includes(provider)||!Number.isInteger(idx)||idx<0)return;
   const item=node._data?.[provider]?.items?.[idx];if(!item||!String(item.id).match(/^\d+$/))return;
   const changes=provider==='ozon'?
      {ozonCategory:String(item.category||''),ozonCategoryId:String(item.id),ozonTypeId:String(item.typeId||'')}:
      {wbCategory:[item.category,item.name].filter(Boolean).join(' / '),wbCode:String(item.id)};
   if(provider==='ozon'&&!/^\d+$/.test(changes.ozonTypeId)){node.querySelector('.cat-status').textContent='Ozon не вернул корректный ID типа товара; выбери другой результат.';return}
   const conflicting=Object.entries(changes).filter(([key,value])=>{const el=form.elements.namedItem(key);return el&&el.value&&el.value!==value;});
   if(conflicting.length&&!window.confirm('В карточке уже указана другая категория. Заменить её данными '+(provider==='ozon'?'Ozon':'Wildberries')+'?'))return;
   for(const [key,value] of Object.entries(changes)){const field=form.elements.namedItem(key);if(field){field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}))}}
   node.querySelector('.cat-status').textContent='Категория '+(provider==='ozon'?'Ozon':'WB')+' перенесена в поля карточки. Проверь выбор и нажми «Сохранить».';
  }
 });
 return node;
}
function attach(){
 const form=document.querySelector('#product-form');
 if(!form||form.querySelector('#category-helper'))return;
 const anchor=form.querySelector('#f-wbCode')?.closest('.field');if(!anchor)return;
 anchor.insertAdjacentElement('afterend',make(form));
}
const css=document.createElement('style');
css.textContent=[
'.category-helper{grid-column:1/-1;min-width:0;max-width:100%;margin:10px 0}',
'.category-helper details{border:1px solid #ccdbee;background:#f8fbff;border-radius:12px;overflow:hidden}',
'.category-helper summary{padding:13px;color:#305789;cursor:pointer;font-size:12px;font-weight:800}',
'.category-helper summary small{background:#e3eeff;padding:3px 5px;border-radius:5px;font-size:9px}',
'.category-inner{padding:13px;border-top:1px solid #d9e4f6}',
'.category-inner p{font-size:11px;line-height:1.6;color:#687c96}',
'.cat-label{display:grid;gap:5px;font-size:11px;font-weight:700}',
'.cat-label input{width:100%;min-width:0;padding:10px;border:1px solid #ccd9ea;border-radius:9px}',
'.cat-status{padding:9px;background:#ebf1ff;border-radius:8px;overflow-wrap:anywhere}',
'.cat-provider{margin:12px 0 20px}',
'.cat-provider h4{font-size:12px;color:#334c8b;margin:10px 0}',
'.cat-provider .cat-problem{background:#fff3e2;color:#89642b;padding:8px;border-radius:8px}',
'.cat-choice{display:block;text-align:left;width:100%;max-width:100%;box-sizing:border-box;white-space:normal;border:1px solid #dbe3f0;border-radius:9px;background:#fff;padding:10px;margin:7px 0;color:#304565;cursor:pointer}',
'.cat-choice b,.cat-choice small{display:block;overflow-wrap:anywhere}',
'.cat-choice b{font-size:12px}',
'.cat-choice small{font-size:10px;color:#72839a;margin-top:4px}',
'.cat-hint{font-style:italic}'
].join('');
document.head.appendChild(css);
const root=document.querySelector('#modal-root');
if(root){new MutationObserver(attach).observe(root,{subtree:true,childList:true});attach()}
window.MirUyutaCategoryFinder={simplify,attach};
})();