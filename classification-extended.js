/* Мир Уюта · справочный подбор дополнительных товарных групп (2026). */
(() => {
'use strict';
const nrm=v=>String(v||'').toLowerCase().replace(/ё/g,'е');
const links={
  ceramic:'https://www.consultant.ru/document/cons_doc_LAW_397176/146079106bc522ebc5e29ae62ec4edf2ebf50ef0/',
  decor:'https://www.consultant.ru/document/cons_doc_LAW_397176/f480568617f6fa58488266fef23f63a935ae8581/',
  steel:'https://classinform.ru/tn-ved/7323930000.html',
  cut:'https://www.consultant.ru/document/cons_doc_LAW_397176/d8d4a4bd38f42f8f020c548270233d80d25d853e/',
  al:'https://www.consultant.ru/document/cons_doc_LAW_397176/1adaa744d1bc2f880cc2439840a215403e3fcd1b/',
  cu:'https://www.consultant.ru/document/cons_doc_LAW_397176/0221b10e9904bb5f0eb58d108166ed616489d22d/',
  plastic:'https://www.consultant.ru/document/cons_doc_LAW_397176/abd928fc43119c9d3e7ef166027da874d8d84c8b/',
  wood:'https://www.consultant.ru/document/cons_doc_LAW_397176/a859a2254f13c32ac5df34aa0d4ef9562950c494/'
};
function classify(p,o={}){
 const n=nrm(p.name),m=nrm(p.material);
 const a={steel:/нержав|коррозионностойк|stainless/.test(m),ceramic:/керамик|фаянс|stoneware|earthenware/.test(m),porcelain:/фарфор|porcelain/.test(m),plastic:/пластик|пластмасс|акрил|полипропилен|полиэтилен|polypropylene|acrylic/.test(m),glass:/стекл|хруст|glass|crystal/.test(m),al:/алюмин|alumin/.test(m),cu:/медь|меди|медн|copper/.test(m),wood:/дерев|древес|бамбук|wood|bamboo/.test(m)};
 if(a.plastic&&/акриловое стекло|acrylic glass/.test(m))a.glass=false;
 let count=Object.values(a).filter(Boolean).length;
 if(!count||a.glass&&count===1)return null;
 if(a.porcelain&&a.ceramic&&count===2)count=1;
 const r={okpd:'',tnved:'',group:'',source:'',okSource:'',reason:'',warnings:p.verified?[]:['Материал не отмечен как проверенный по официальному источнику.']};
 if(count>1){r.warnings.push('Смешанный материал или составной набор. Требуется проверка компонентов.');return r;}
 const cut=/лож|вилк|половник|шумовк|лопаточк|щипц|spoon|fork|ladle|spatula|tong/.test(n);
 const table=/стакан|рюмк|бокал|чашк|кружк|тарел|салатник|масленк|сахарниц|пиал|блюд|кувшин|графин|менажниц|соусник|фруктовниц|чайник|сервиз|кастрюл|сковород|поднос|солонк|доск|разделочн|tumbler|plate|cup|bowl|dish|tray/.test(n);
 const house=/салфетниц|салфеток|подставк|держател|органайзер|хранени|контейнер|поднос/.test(n);
 const decor=/статуэтк|фигурк|скульптур|декоративн.*ваз|ваза.*декоративн/.test(n);
 const type=o.purpose&&o.purpose!=='auto'?o.purpose:decor?'decor':cut?'cutlery':table?'table':house?'household':'unknown';
 if(a.porcelain&&type!=='decor')return null;
 if(type==='unknown'){r.warnings.push('Укажи назначение изделия по документам.');return r;}
 if(/набор.*специй|специй.*набор|мармит|термос|электр|подогрев|chafing/.test(n)){r.warnings.push('Составной товар, источник подогрева или специальное назначение. Требуется отдельная классификация.');return r;}
 if(type==='cutlery'){
  if(/нож|knife/.test(n)&&!/нож для масла|нож для рыбы|butter knife|fish knife/.test(n)){r.group='8211';r.warnings.push('Обычные столовые ножи относятся к отдельной позиции 8211.');return r;}
  if(!a.steel&&!a.al){r.warnings.push('Для столовых приборов из этого материала нет готового правила.');return r;}
  r.okpd=a.steel?'25.71.14.110':'25.71.14.140';r.okSource='https://classinform.ru/okpd-2/kod-25.71.14.html';r.group='8215';r.source=links.cut;
  if(a.steel&&o.plating==='no'&&['yes','no'].includes(o.cutlerySet))r.tnved=o.cutlerySet==='yes'?'8215201000':'8215991000';
  if(!r.tnved)r.warnings.push('Для полного ТН ВЭД уточни покрытие драгоценным металлом, единичный прибор или набор.');return r;
 }
 if(a.ceramic||a.porcelain){
  if(type==='decor'){
   r.okpd='23.41.13.190';r.okSource='https://classinform.ru/okpd-2/kod-23.41.13.html';r.group='6913';r.source=links.decor;
   r.tnved=a.porcelain?'6913100000':({coarse:'6913901000',faience:'6913909300',stoneware:'6913909800',other:'6913909800'}[o.ceramicType]||'');
  }else{
   r.okpd=type==='household'?'23.41.12.120':'23.41.12.110';r.okSource='https://classinform.ru/okpd-2/kod-23.41.12.html';r.group='6912';r.source=links.ceramic;
   const opts=type==='household'?{coarse:'6912008100',stoneware:'6912008300',faience:'6912008500',other:'6912008900'}:{coarse:'6912002100',stoneware:'6912002300',faience:'6912002500',other:'6912002900'};
   r.tnved=opts[o.ceramicType]||'';
  }
  if(!r.tnved)r.warnings.push('Необходимо подтвердить тип керамики для 10-значного ТН ВЭД.');
  if(/ваз/.test(n))r.warnings.push('Уточни: ваза для сервировки или исключительно декор.');return r;
 }
 if(a.steel||a.al||a.cu){
  if(type==='decor'){r.warnings.push('Декор из металла относится к другим возможным товарным позициям.');return r;}
  r.okpd=a.steel?'25.99.12.112':a.al?'25.99.12.130':'25.99.12.120';r.okSource='https://classinform.ru/okpd-2/kod-25.99.12.html';
  r.group=a.steel?'7323 93':a.al?'7615 10':'7418 10';r.source=a.steel?links.steel:a.al?links.al:links.cu;
  if(a.steel)r.tnved='7323930000';if(a.al)r.tnved=({cast:'7615101000',foil:'7615103000',other:'7615108009'}[o.aluminumType]||'');
  if(a.cu&&o.heating==='no')r.tnved='7418109000';
  if(o.heating==='yes'){r.tnved='';r.warnings.push('Нагреватель или топливо требуют отдельной проверки.');}
  if(!r.tnved)r.warnings.push('Для полного ТН ВЭД уточни нагрев и способ изготовления.');
  if(/подставк|держател|салфетниц/.test(n))r.warnings.push('Проверь, что это именно бытовая кухонная принадлежность.');return r;
 }
 if(a.plastic){
  if(type==='decor'){r.warnings.push('Пластиковый декор классифицируется отдельно.');return r;}
  r.okpd=type==='household'?'22.29.23.120':'22.29.23.110';r.okSource='https://classinform.ru/okpd-2/kod-22.29.23.html';
  r.group=type==='household'?'3924 90':'3924 10';r.tnved=type==='household'?'3924900009':'3924100000';r.source=links.plastic;return r;
 }
 if(a.wood){
  if(type==='decor'){r.warnings.push('Деревянный декор может относиться к 4420.');return r;}
  r.okpd='16.29.12.000';r.group='4419';r.okSource='https://classinform.ru/okpd-2/kod-16.29.12.000.html';r.source=links.wood;
  if(/бамбук|bamboo/.test(m))r.tnved=/разделочн|доск/.test(n)?'4419110000':/палочк.*еды|chopsticks/.test(n)?'4419120000':'4419190000';
  else if(o.woodType==='tropical')r.tnved='4419200000';else if(o.woodType==='other')r.tnved='4419900000';else r.warnings.push('Уточни породу древесины.');return r;
 }
 return null;
}
window.MirUyutaExpandedClassifier=classify;
})();