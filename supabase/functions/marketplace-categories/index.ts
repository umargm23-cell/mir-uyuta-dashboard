/**
 * Мир Уюта 3.1 — read-only категории Ozon / Wildberries.
 * Ключи берутся исключительно из Supabase Edge Function Secrets.
 * Авторизация — пользователь Supabase. Никакие токены не возвращаются клиенту.
 */
import { withSupabase } from 'npm:@supabase/server@1';

type Provider = 'ozon' | 'wb';
type Item = { provider: Provider; name:string; category:string; id:string; parentId?:string; typeId?:string; path?:string };
const OWNER_LIMIT=12, LIMIT=18, TIMEOUT=16000, MAX_RESPONSE=20*1024*1024, TTL=20*60*1000;
const quotas=new Map<string,{start:number;count:number}>();
let ozonCache: {until:number; items:Item[]} | null=null;
const headers={ 'Access-Control-Allow-Origin':'https://umargm23-cell.github.io', 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS', Vary:'Origin' };
function json(obj:unknown,code=200){return Response.json(obj,{status:code,headers:{'Cache-Control':'no-store'}})}
const norm=(s:unknown)=>String(s??'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^a-zа-я0-9 ]/gi,' ').replace(/\s+/g,' ').trim();
function words(q:string){
 const skips=new Set(['набор','комплект','шт','штук','предмет','предметов','мл','ml','л','оф','of','rcr','bohemia','crystal','alba','grazia']);
 return norm(q).split(' ').filter(t=>t.length>=3&&!skips.has(t)&&!/^\d+$/.test(t)).slice(0,8);
}
function strength(item:Item,q:string){
 const hay=norm(item.name+' '+item.category+' '+(item.path||'')),tokens=words(q);
 if(!tokens.length)return 0;
 let score=0;
 for(const t of tokens){
   if(hay.includes(t))score+=5;
   else if(t.length>4 && hay.includes(t.slice(0,-2)))score+=3;
 }
 return score;
}
function rank(items:Item[],q:string){
 const filtered=items.map(x=>({x,score:strength(x,q)})).filter(o=>o.score>0);
 filtered.sort((a,b)=>b.score-a.score||a.x.name.localeCompare(b.x.name,'ru'));
 return filtered.slice(0,LIMIT).map(({x})=>x);
}
async function upstream(url:string,init:RequestInit,limit=MAX_RESPONSE){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT);
 try{
  const r=await fetch(url,{...init,signal:controller.signal,redirect:'error',cache:'no-store'});
  if(!r.ok)throw new Error('API вернул HTTP '+r.status);
  const size=Number(r.headers.get('content-length')||0);
  if(size>limit)throw new Error('Справочник слишком большой');
  if(!(r.headers.get('content-type')||'').toLowerCase().includes('json'))throw new Error('Ответ API не является JSON');
  const reader=r.body?.getReader();if(!reader)throw new Error('API не вернул данные');
  const data:Uint8Array[]=[];let bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit)throw new Error('Превышен размер ответа API');data.push(value)}}
  finally{try{await reader.cancel()}catch{/* reader closed */}}
  const all=new Uint8Array(bytes);let offset=0;for(const chunk of data){all.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder().decode(all));
 }finally{clearTimeout(timer)}
}
function flattenOzon(tree:unknown){
 const out:Item[]=[],seen=new Set<string>();
 function walk(raw:unknown,path:string[]=[],catId=''){
  if(!raw||typeof raw!=='object')return;
  const n=raw as Record<string,unknown>;
  if(n.disabled===true)return;
  const thisName=String(n.category_name||'').trim();
  const newPath=thisName?[...path,thisName]:path;
  const id=String(n.description_category_id||catId||'');
  const typeId=String(n.type_id||''),typeName=String(n.type_name||'').trim();
  if(typeId&&id&&typeName){
    const key=id+'_'+typeId;
    if(!seen.has(key)){seen.add(key);out.push({provider:'ozon',id,name:typeName,typeId,category:newPath.join(' / ')||'Категория Ozon',path:newPath.join(' / ')})}
  }
  if(Array.isArray(n.children)){
   for(const child of n.children)walk(child,newPath,id);
  }
 }
 if(Array.isArray(tree))for(const item of tree)walk(item);
 return out;
}
async function ozon(q:string):Promise<Item[]>{
 const client=Deno.env.get('OZON_CLIENT_ID')?.trim(),key=Deno.env.get('OZON_API_KEY')?.trim();
 if(!client||!key)throw new Error('Не настроен Ozon: задай OZON_CLIENT_ID и OZON_API_KEY в Supabase Secrets.');
 if(!ozonCache||Date.now()>ozonCache.until){
  const response=await upstream('https://api-seller.ozon.ru/v1/description-category/tree',{
    method:'POST',headers:{'Client-Id':client,'Api-Key':key,'Content-Type':'application/json'},
    body:JSON.stringify({language:'RU'})
  });
  const flattened=flattenOzon(response?.result);
  if(!flattened.length)throw new Error('Ozon вернул пустой справочник. Проверь права API ключа.');
  ozonCache={until:Date.now()+TTL,items:flattened};
 }
 return rank(ozonCache.items,q);
}
async function wildberries(q:string):Promise<Item[]>{
 const key=Deno.env.get('WB_CONTENT_API_TOKEN')?.trim();
 if(!key)throw new Error('Не настроен Wildberries: задай WB_CONTENT_API_TOKEN в Supabase Secrets.');
 const name=q.replace(/\s+/g,' ').trim().slice(0,80),url=new URL('https://content-api.wildberries.ru/content/v2/object/all');
 url.searchParams.set('locale','ru');url.searchParams.set('name',name);url.searchParams.set('limit','100');url.searchParams.set('offset','0');
 const data=await upstream(url.href,{method:'GET',headers:{Authorization:key,Accept:'application/json'}},1024*1024);
 if(data?.error===true)throw new Error('Wildberries не вернул список предметов. Проверь токен «Контент».');
 const items=(Array.isArray(data?.data)?data.data:[]).filter((x:Record<string,unknown>)=>x?.subjectID&&x?.subjectName)
 .map((x:Record<string,unknown>)=>({provider:'wb' as Provider,id:String(x.subjectID),name:String(x.subjectName),category:String(x.parentName||''),parentId:String(x.parentID||'')}));
 return rank(items,q);
}
const authHandler=withSupabase({auth:'user'},async(req,ctx)=>{
 if(req.method!=='POST')return json({error:'Используй POST.'},405);
 const userId=String(ctx.userClaims?.id||ctx.jwtClaims?.sub||'');
 if(!userId)return json({error:'Нужен вход в личный кабинет.'},401);
 const allowed=Deno.env.get('MARKETPLACE_ALLOWED_USER_IDS')?.split(',').map(s=>s.trim()).filter(Boolean)||[];
 if(!allowed.length)return json({error:'Для безопасности укажи MARKETPLACE_ALLOWED_USER_IDS в Supabase Secrets.',configured:false},503);
 if(!allowed.includes(userId))return json({error:'Нет доступа к интеграциям продавца.'},403);
 const now=Date.now(),old=quotas.get(userId);
 if(old&&now-old.start<60000&&old.count>=OWNER_LIMIT)return json({error:'Превышен лимит запросов. Повтори позже.'},429);
 if(!old||now-old.start>=60000)quotas.set(userId,{start:now,count:1});else old.count++;
 if(Number(req.headers.get('content-length')||0)>4096)return json({error:'Слишком большой запрос.'},413);
 let reqData:unknown;
 try{reqData=await req.json()}catch{return json({error:'Ожидается JSON.'},400)}
 const d=reqData as Record<string,unknown>;
 const provider=d?.provider,query=String(d?.query||'').trim().slice(0,120);
 if(provider!=='ozon'&&provider!=='wb'&&provider!=='both')return json({error:'Укажи площадку ozon, wb или both.'},400);
 if(query.length<3)return json({error:'Укажи поисковый запрос от 3 символов.'},400);
 const platforms:Provider[]=provider==='both'?['ozon','wb']:[provider as Provider];
 const pairs=await Promise.all(platforms.map(async p=>{
  try{return [p,{ok:true,items:p==='ozon'?await ozon(query):await wildberries(query)}] as const}
  catch(e){return [p,{ok:false,items:[],message:e instanceof Error?e.message:'Ошибка справочника'}] as const}
 }));
 return json({query,result:Object.fromEntries(pairs),timestamp:new Date().toISOString()});
});
export default {
 async fetch(req:Request){
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  const response=await authHandler(req);
  const h=new Headers(response.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);
  return new Response(response.body,{status:response.status,headers:h});
 }
};
