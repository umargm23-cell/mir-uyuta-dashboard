/* Мир Уюта 3.1: проверка бренда, подтверждения артикула, комплектности. */
(() => {
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=x=>String(x??'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
function evaluate(d={}){
 const findings=[],name=normalize(d.name),brand=normalize(d.brand),count=Math.max(0,Math.floor(Number(d.piecesInSet)||0));
 const add=(key,title,detail)=>findings.push({key,title,detail});
 if(/^(набор|комплект|стакан|бокал|рюмка|тарелка|салатник|сахарница|масленка|чашка|ваза|фужер|кувшин|графин)(\s|$)/.test(brand)){
  const maker=String(d.manufacturer||'').trim();
  add('brand','Вместо бренда похоже указано название товара.', 'Указано: «'+String(d.brand)+'». '+(maker?'В производителе указан «'+maker+'» — проверь, является ли это торговой маркой. ':'')+'Не заменяй бренд без официального подтверждения.');
 }
 if(!String(d.article||'').trim())add('article','Не указан артикул.','Укажи артикул производителя.');
 else if(d.verified?.article!==true)add('articleUnverified','Артикул не подтверждён.','Сверь артикул «'+String(d.article)+'» с официальной страницей или упаковкой и отметь подтверждение.');
 const setMentioned=/(^|[\s(])(?:набор|комплект|сервиз|set)(?=\s|$)/.test(name);
 const titleNumbers=[...name.matchAll(/(\d{1,3})\s*(шт\.?|штук|предм\.?|предметов|pcs(?:\s|$))/g)].map(m=>Number(m[1]));
 if(d.saleType==='set'){
   if(count<2)add('setQuantity','Не указано количество предметов набора.','Заполни поле «Предметов в наборе». Это не остаток товара.');
   else{
    if(!setMentioned)add('setLabel','В названии не указано, что товар продаётся набором.','Укажи комплектность в названии после сверки с упаковкой.');
    if(titleNumbers.length&&!titleNumbers.includes(count))add('countMismatch','Количество в названии и карточке различается.','В названии: '+titleNumbers.join(', ')+' шт., в карточке: '+count+' шт.');
    if(!titleNumbers.length)add('countTitle','В названии не указано количество предметов.','Для набора из '+count+' предметов проверь название и добавь количество, если оно соответствует фактической продаже.');
   }
 }else if(setMentioned||titleNumbers.some(x=>x>1)){
  add('singleMismatch','Название похоже на набор, но продажа указана поштучно.','Проверь формат продажи и название; поштучная продажа не равна комплекту поставки.');
 }
 if(d.verified?.article===true&&!/^https:\/\//i.test(String(d.officialUrl||''))){
  add('articleSource','Артикул подтверждён без официальной HTTPS-ссылки.','Добавь ссылку и сверь артикул.');
 }
 return findings;
}
function panel(list){
 return '<details class="quality-panel" id="quality-panel"><summary><b>🧠 Проверка бренда, артикула и комплектности</b><span>'+
 (list.length?list.length+' предупреждений':'✓ явных ошибок не найдено')+'</span></summary><div class="quality-body">'+
 (list.length?list.map(x=>'<div class="quality-issue"><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small></div>').join(''):
 '<p>Типичные логические ошибки не обнаружены. Подлинность бренда и артикула проверяется по документам.</p>')+
 '</div></details>';
}
const style=document.createElement('style');
style.textContent=[
'.quality-panel{margin:12px 0 16px;border:1px solid #e9d6aa;background:#fffaf0;border-radius:12px;overflow:hidden}',
'.quality-panel summary{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;padding:13px;cursor:pointer;color:#795c2a;font-size:12px}',
'.quality-panel summary span{font-size:10px}',
'.quality-body{padding:12px;border-top:1px solid #f1e7cf}',
'.quality-body p{font-size:11px;line-height:1.6;color:#816e50}',
'.quality-issue{font-size:11px;border-top:1px solid #f0e4cf;padding:10px 2px;color:#74572a;overflow-wrap:anywhere}',
'.quality-issue small{display:block;color:#8d795c;margin-top:4px;line-height:1.55}'
].join('');
document.head.appendChild(style);
window.MirUyutaQuality={evaluate,panel};
})();