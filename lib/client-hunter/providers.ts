import {env} from 'cloudflare:workers';
import {AsyncLocalStorage} from 'node:async_hooks';
export const keyContext=new AsyncLocalStorage<Record<string,string>>();
const secrets=()=>({...env,...keyContext.getStore()}) as unknown as Record<string,string>;
export function configuration(){return {gemini:!!secrets().GEMINI_API_KEY,serper:!!secrets().SERPER_API_KEY,runtime:'Hosted LangGraph · API tools',selenium:false,authMode:'native',browserReason:'This hosted runtime cannot launch Chrome. The agent uses DuckDuckGo and Serper APIs.'};}
export async function gemini(prompt:string,model='') {
 const key=secrets().GEMINI_API_KEY;if(!key)throw new Error('Gemini is not configured on the server.');
 async function discover(){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`Gemini connection failed (${r.status}). Check the server API key and project access.`);
  const j:any=await r.json();const names=(j.models||[]).filter((m:any)=>m.supportedGenerationMethods?.includes('generateContent')&&/flash/.test(m.name)&&!/image|audio|tts|live|robot|omni/.test(m.name)).map((m:any)=>m.name.replace('models/','')) as string[];
  return names.sort((a,b)=>{const rank=(n:string)=>n==='gemini-flash-latest'?5:(Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1])||0)*10-(n.includes('preview')?200:0)+(n.includes('lite')?100:0);return rank(b)-rank(a)});
 }
 let choices=model?[model]:await discover();let refreshed=!model;
 for(let attempt=0;attempt<3&&choices.length;attempt++){
  model=choices.shift()!;
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(55000),
   body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json',maxOutputTokens:6000}})});
  if(r.status===404||r.status===503){if(!refreshed){choices=(await discover()).filter(x=>x!==model);refreshed=true;}continue;}
  if(!r.ok)throw new Error(r.status===429?'Gemini quota reached. Your progress is saved. Retry when your allowance resets.':`Gemini request failed (${r.status}). Progress has been saved.`);
  const j:any=await r.json();let text=j.candidates?.[0]?.content?.parts?.filter((p:any)=>!p.thought).map((p:any)=>p.text||'').join('')||'';
  text=text.replace(/^```(?:json)?\s*|\s*```$/g,'');
  try{let val=JSON.parse(text);if(Array.isArray(val)&&val.length>0&&typeof val[0]==='object')val=val[0];return {value:val,model};}catch{throw new Error('The model returned an incomplete structured response. Retry this step.');}
 }
 throw new Error('Gemini models are currently unavailable or at capacity. Your progress is saved; retry later.');
}

function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
export function plain(s:string){return decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).trim();}
export function safeUrl(value:string){
 const u=new URL(value);const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.localhost')||!h.includes('.')||/^[\d.]+$/.test(h)||h.includes(':')||/\.(nip|sslip)\.io$/.test(h))throw new Error('Only public HTTPS website URLs are allowed.');
 return u.href;
}
let ddgBlockedUntil=0;
export async function search(query:string){
 const attempts=['Selenium unavailable: this hosted runtime cannot launch Chrome.'];
 try{
  if(ddgBlockedUntil>Date.now())throw new Error('DuckDuckGo recently challenged this runtime.');
  const r=await fetch('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query),{signal:AbortSignal.timeout(12000)});
  const h=await r.text();if(/anomaly-modal|challenge-form|captcha/i.test(h)){ddgBlockedUntil=Date.now()+15*60000;throw new Error('DuckDuckGo challenge');}if(!r.ok)throw new Error('DuckDuckGo unavailable');
  const blocks=h.split(/<div[^>]*class="[^"']*result results_links/).slice(1);
  const results=blocks.flatMap(block=>{const m=block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);if(!m)return [];let url=decode(m[1]);if(url.startsWith('//'))url='https:'+url;try{url=new URL(url).searchParams.get('uddg')||url}catch{};return [{title:plain(m[2]),url,snippet:plain(block).slice(0,1800)}]}).slice(0,10);
  if(results.length)return {provider:'DuckDuckGo',results,attempts};
 }catch{}
 attempts.push('DuckDuckGo blocked or returned no readable results; using Serper.');
 const key=secrets().SERPER_API_KEY;if(!key)throw new Error('DuckDuckGo is unavailable and Serper is not configured.');
 const r=await fetch('https://google.serper.dev/search',{method:'POST',headers:{'X-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify({q:query,num:10,gl:'in'}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`Search fallback failed (${r.status}). Check Serper access or credits.`);
 const j:any=await r.json();return {provider:'Serper · Google results',fallback:attempts.at(-1),attempts,results:(j.organic||[]).map((x:any)=>({title:x.title,url:x.link,snippet:x.snippet||''}))};
}
export async function places(query:string){
 const key=secrets().SERPER_API_KEY;if(!key)throw new Error('Structured Maps lookup needs a Serper key. Web search remains available.');
 const r=await fetch('https://google.serper.dev/maps',{method:'POST',headers:{'X-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify({q:query,gl:'in'}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`Maps lookup failed (${r.status}). The supervisor can switch to web search.`);
 const j:any=await r.json();const documents=(j.places||[]).map((p:any)=>({kind:'place',title:p.title||'',address:p.address||'',phone:p.phoneNumber||'',website:p.website||'',rating:typeof p.rating==='number'?p.rating:undefined,reviewCount:typeof p.ratingCount==='number'?p.ratingCount:undefined,provider:'Google Maps',url:p.cid?'https://www.google.com/maps?cid='+encodeURIComponent(p.cid):p.placeId?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.title+' '+p.address)+'&query_place_id='+encodeURIComponent(p.placeId):'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.title+' '+p.address),text:[p.title,p.address,p.phoneNumber,p.category,p.website].filter(Boolean).join(' · ')}));
 return {provider:'Serper Maps',documents,results:documents.map((d:any)=>({title:d.title,url:d.url,snippet:d.text}))};
}
export async function inspect(value:string):Promise<any>{
 const url=safeUrl(value);
 // Redirects are not followed: every destination must be explicitly inspected.
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html'}});
 if(r.status>=300&&r.status<400)return {url,status:r.status,redirect:r.headers.get('location'),links:r.headers.get('location')?[{url:new URL(r.headers.get('location')!,url).href,text:'Redirect destination'}]:[],text:'Redirect: inspect the destination separately.',audit:{}};
 if(!r.ok)return {url,status:r.status,text:'Page unavailable; this does not prove the website is absent.',audit:{}};
 if(!r.headers.get('content-type')?.includes('text/html'))return {url,status:r.status,text:'Non-HTML resource, not inspected.',audit:{}};
 const reader=r.body?.getReader();let length=0,html='';const decoder=new TextDecoder();
 if(reader){while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>500000){await reader.cancel();break;}html+=decoder.decode(value,{stream:true});}}
 const text=plain(html).slice(0,12000);
 const links=[...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(m=>{try{const u=new URL(decode(m[1]),url);return ['https:','http:'].includes(u.protocol)?[{url:u.href,text:plain(m[2]).slice(0,100)}]:[]}catch{return []}}).slice(0,100);
 const issues=[];if(!/name\s*=\s*["']viewport/i.test(html))issues.push('No mobile viewport declaration was found on the inspected page.');if(!/<title[^>]*>\s*[^<]+/i.test(html))issues.push('The inspected page has no readable page title.');if(/<frameset|<marquee|<font\b/i.test(html))issues.push('Legacy presentation markup was found. A visual review is recommended.');
 return {url,status:r.status,title:plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),text,links,issues,emails:[...new Set(text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)||[])].slice(0,8),audit:{
 'HTTPS':'Present','Mobile viewport':/name\s*=\s*["']viewport/i.test(html)?'Present':'Not detected',
 'Page title':/<title[^>]*>\s*[^<]+/i.test(html)?'Present':'Not detected',
 'Meta description':/name\s*=\s*["']description/i.test(html)?'Present':'Not detected',
 'Contact information':/contact|mailto:|tel:/i.test(html)?'Detected':'Not detected'
 }};
}
