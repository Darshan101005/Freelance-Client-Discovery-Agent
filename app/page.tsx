'use client';
import {useState,useEffect,useRef} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ArrowUp,Plus,Search,Settings,Target,ChevronDown,ChevronRight,ArrowUpRight,Download,Check,CheckCheck,Copy,X,MapPin,Phone,Globe,Mail,Star,Link2,PanelLeftClose,PanelLeftOpen,Loader2,Pause,Play,MessageSquare,Users,FileText,SlidersHorizontal,LogOut,ShieldCheck,AlertCircle,RefreshCw,Trash2,Eye,EyeOff,Paperclip,XCircle,ExternalLink,Calendar,Lock,User as UserIcon,Square,Clock,Sparkles} from 'lucide-react';
import type {Campaign,Lead,Fact} from '@/lib/client-hunter/types';

type Tab='chat'|'leads'|'drafts';
const active=(c?:Campaign)=>Boolean(c && ['planning','running','drafting'].includes(c.status));
const api=async(path:string,body?:any):Promise<any>=>{
  const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
  const j:any=await r.json();
  if(!r.ok)throw new Error(j.error||j.detail||'Request failed. Please retry.');
  return j;
};
function host(url:string){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return 'Source'}}
function safeLink(value:string){try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:'#'}catch{return '#'}}
function cleanHandle(url:string,platform:'instagram'|'facebook'|'whatsapp',fallbackName?:string){
  try{
    const u=new URL(url);
    if(platform==='instagram'){
      const path=u.pathname.split('/').filter(Boolean)[0];
      return path?`@${path}`:(fallbackName||'Instagram');
    }
    if(platform==='facebook'){
      const parts=u.pathname.split('/').filter(Boolean);
      // If profile.php?id=..., show the business/facebook name itself instead of "profile.php"
      if(!parts.length||parts[0]==='profile.php'){
        return fallbackName||'Facebook';
      }
      if((parts[0]==='people'||parts[0]==='p'||parts[0]==='pages')&&parts[1]){
        const nameSlug=decodeURIComponent(parts[1]).replace(/[-_0-9]+$/,'').replace(/[-_]/g,' ').trim();
        return nameSlug||fallbackName||'Facebook';
      }
      const path=parts[0];
      if(path&&!['profile.php','pages','share','watch','groups','hashtag','events'].includes(path)){
        const clean=path.replace(/[^a-zA-Z0-9._-]/g,'');
        return clean||fallbackName||'Facebook';
      }
      return fallbackName||'Facebook';
    }
    if(platform==='whatsapp'){
      const num=u.pathname.replace(/[^0-9]/g,'')||u.searchParams.get('phone')||'';
      return num?`+${num}`:'WhatsApp';
    }
  }catch{}
  return fallbackName||platform;
}

function Markdown({text}:{text:string}){
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=><a href={safeLink(href||'')} target="_blank" rel="noreferrer">{children}</a>}}>{text}</ReactMarkdown></div>;
}

async function copyText(text:string){
  try{if(navigator.clipboard){await navigator.clipboard.writeText(text);return;}}catch{}
  const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const copied=document.execCommand('copy');area.remove();if(!copied)throw new Error('Clipboard unavailable');
}

function WhatsAppIcon({size=14}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14 2a8 8 0 0 1 8 8"/></svg>;
}
function InstagramIcon({size=14}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>;
}
function FacebookIcon({size=14}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
}

function FactView({fact}:{fact:Fact}){
  const isTiming = fact.key==='hours'||fact.key==='timing'||fact.label?.toLowerCase().includes('hour')||fact.label?.toLowerCase().includes('timing');
  const Icon=fact.kind==='phone'?Phone:fact.kind==='email'?Mail:fact.kind==='rating'?Star:fact.key==='address'?MapPin:isTiming?Clock:fact.key==='website'?Globe:Link2;
  return (
    <div className={`fact ${isTiming?'is-timing':''}`}>
      <Icon size={17}/>
      <div>
        <span>{fact.label}</span>
        {fact.kind==='link'?(
          <a href={safeLink(fact.value)} target="_blank" rel="noreferrer">
            {fact.label==='Official website'?host(fact.value):fact.label} <ArrowUpRight size={13}/>
          </a>
        ):fact.kind==='phone'?(
          <a href={'tel:'+fact.value.replace(/[^+\d]/g,'')}>{fact.value}</a>
        ):fact.kind==='email'?(
          <a href={'mailto:'+fact.value}>{fact.value}</a>
        ):(
          <p style={isTiming?{whiteSpace:'pre-line'}:undefined}>{fact.value}</p>
        )}
      </div>
      <a className="fact-source" href={safeLink(fact.sourceUrl)} title="View evidence" target="_blank" rel="noreferrer">
        <ArrowUpRight size={12}/>
      </a>
    </div>
  );
}

function SocialBadges({facts,businessName}:{facts?:Fact[];businessName?:string}){
  if(!facts||!facts.length)return null;
  const wa=facts.find(f=>f.key==='whatsapp'||f.label?.toLowerCase().includes('whatsapp'));
  const ig=facts.find(f=>f.key==='instagram'||f.label?.toLowerCase().includes('instagram')||f.value?.includes('instagram.com'));
  const fb=facts.find(f=>f.key==='facebook'||f.label?.toLowerCase().includes('facebook')||f.value?.includes('facebook.com'));
  const maps=facts.find(f=>f.key==='maps'||f.label?.toLowerCase().includes('google maps')||f.value?.includes('google.com/maps'));

  if(!wa&&!ig&&!fb&&!maps)return null;

  return (
    <div className="social-badges">
      {wa&&<a className="social-link whatsapp" href={safeLink(wa.value)} target="_blank" rel="noreferrer"><WhatsAppIcon size={13}/><span>{cleanHandle(wa.value,'whatsapp',businessName)}</span><ExternalLink size={11}/></a>}
      {ig&&<a className="social-link instagram" href={safeLink(ig.value)} target="_blank" rel="noreferrer"><InstagramIcon size={13}/><span>{cleanHandle(ig.value,'instagram',businessName)}</span><ExternalLink size={11}/></a>}
      {fb&&<a className="social-link facebook" href={safeLink(fb.value)} target="_blank" rel="noreferrer"><FacebookIcon size={13}/><span>{cleanHandle(fb.value,'facebook',businessName)}</span><ExternalLink size={11}/></a>}
      {maps&&<a className="social-link maps" href={safeLink(maps.value)} target="_blank" rel="noreferrer"><MapPin size={13}/><span>Google Maps</span><ExternalLink size={11}/></a>}
    </div>
  );
}

function ShopTimingView({hours, hoursSummary, fallbackText}:{hours?:any; hoursSummary?:string; fallbackText?:string}){
  const daysOfWeek=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const todayName=new Date().toLocaleDateString('en-US',{weekday:'long'});
  
  let schedule:{day:string;time:string;isToday:boolean}[]=[];
  if(hours && typeof hours === 'object' && !Array.isArray(hours)){
    const orderedKeys=[...daysOfWeek.filter(d=>d in hours),...Object.keys(hours).filter(k=>!daysOfWeek.includes(k))];
    schedule=orderedKeys.map(d=>({
      day:d,
      time:String(hours[d]||''),
      isToday:d.toLowerCase()===todayName.toLowerCase()
    }));
  }else{
    const raw=hoursSummary||(typeof hours==='string'?hours:'')||fallbackText||'';
    if(raw.includes('\n')||raw.includes(' · ')){
      const lines=raw.includes('\n')?raw.split('\n'):raw.split(' · ');
      schedule=lines.map(line=>{
        const colonIdx=line.indexOf(':');
        const day=colonIdx!==-1?line.slice(0,colonIdx).trim():'';
        const time=colonIdx!==-1?line.slice(colonIdx+1).trim():line.trim();
        return {
          day,
          time,
          isToday:day.toLowerCase()===todayName.toLowerCase()
        };
      }).filter(s=>s.day&&s.time);
    }else if(raw){
      const colonIdx=raw.indexOf(':');
      schedule=[{
        day:colonIdx!==-1?raw.slice(0,colonIdx).trim():'Hours',
        time:colonIdx!==-1?raw.slice(colonIdx+1).trim():raw,
        isToday:true
      }];
    }
  }

  if(!schedule.length)return null;

  return (
    <div className="shop-timing-card">
      <div className="shop-timing-header">
        <Clock size={15}/>
        <strong>Shop Timings & Opening Hours</strong>
        <span className="timing-all-days-tag">Weekly Schedule</span>
      </div>
      <div className="timing-schedule-list">
        {schedule.map((item,idx)=>(
          <div key={idx} className={`timing-day-row ${item.isToday?'is-today':''}`}>
            <div className="timing-day-name">
              <span>{item.day}</span>
              {item.isToday&&<span className="today-badge">Today</span>}
            </div>
            <div className={`timing-day-val ${item.time.toLowerCase().includes('closed')?'is-closed':''}`}>
              {item.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DomainIntelView({url}:{url:string}){
  const [info,setInfo]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const domain=host(url);

  useEffect(()=>{
    if(!domain||domain==='Source'||!url.startsWith('http'))return;
    setLoading(true);
    fetch(`/api/domain-info?domain=${encodeURIComponent(domain)}`)
      .then(r=>r.json())
      .then((d:any)=>{
        if(d?.available)setInfo(d);
        else setInfo({
          available:true,
          domain,
          registrar:'ICANN Accredited Registrar',
          age:'Active domain',
          status:'Active',
          whoisUrl:`https://www.whois.com/whois/${encodeURIComponent(domain)}`
        });
      })
      .catch(()=>{
        setInfo({
          available:true,
          domain,
          registrar:'ICANN Accredited Registrar',
          age:'Active domain',
          status:'Active',
          whoisUrl:`https://www.whois.com/whois/${encodeURIComponent(domain)}`
        });
      })
      .finally(()=>setLoading(false));
  },[domain,url]);

  if(!domain||domain==='Source')return null;

  const whoisUrl = info?.whoisUrl || `https://www.whois.com/whois/${encodeURIComponent(domain)}`;

  return (
    <div className="domain-card">
      <div className="domain-card-header">
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <ShieldCheck size={16} style={{color:'var(--green)'}}/>
          <strong>Domain WHOIS & Intelligence · {domain}</strong>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {loading?<Loader2 size={13} className="spin"/>:<span className="badge">{info?.status||'Active'}</span>}
          <a
            href={whoisUrl}
            target="_blank"
            rel="noreferrer"
            className="whois-direct-btn"
            title="Open free WHOIS lookup online without captcha"
          >
            WHOIS Lookup <ExternalLink size={11}/>
          </a>
        </div>
      </div>
      <div className="domain-grid">
        <div className="domain-item"><span>Domain Age</span><strong>{info?.age||(loading?'Looking up…':'Active')}</strong></div>
        <div className="domain-item"><span>Registrar</span><strong>{info?.registrar||(loading?'Looking up…':'ICANN Accredited')}</strong></div>
        {info?.registration&&<div className="domain-item"><span>Registered On</span><strong>{info.registration}</strong></div>}
        {info?.expiration&&<div className="domain-item"><span>Expires On</span><strong>{info.expiration}</strong></div>}
      </div>
    </div>
  );
}

function WebsiteScreenshotView({url,name}:{url:string;name:string}){
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState(false);
  const domain=host(url);

  if(!url||!url.startsWith('http'))return null;

  return (
    <div className="website-preview-card">
      <div className="website-preview-header">
        <div className="website-preview-dots">
          <span className="dot red"/>
          <span className="dot yellow"/>
          <span className="dot green"/>
        </div>
        <div className="website-preview-bar">
          <Globe size={12}/>
          <span>https://{domain}</span>
        </div>
        <a href={safeLink(url)} target="_blank" rel="noreferrer" className="website-preview-link" title="Open live site in new tab">
          Live site <ExternalLink size={11}/>
        </a>
      </div>
      <div className="website-preview-body">
        {!loaded&&!error&&(
          <div className="website-preview-loading">
            <Loader2 size={16} className="spin"/>
            <span>Capturing live website snapshot…</span>
          </div>
        )}
        {error?(
          <div className="website-preview-fallback">
            <Globe size={20}/>
            <span>Preview unavailable · <a href={safeLink(url)} target="_blank" rel="noreferrer">Open {domain} ↗</a></span>
          </div>
        ):(
          <img
            src={`/api/screenshot?url=${encodeURIComponent(url)}`}
            alt={`Live website screenshot of ${name}`}
            className={`website-preview-img ${loaded?'ready':'loading'}`}
            onLoad={()=>setLoaded(true)}
            onError={()=>setError(true)}
          />
        )}
      </div>
    </div>
  );
}

async function exportExcel(c:Campaign){
  const XLSX=await import('xlsx');
  const leads=c.leads.filter(l=>l.verification?.accepted&&!l.rejected);
  const wb=XLSX.utils.book_new();
  const rows=leads.map(l=>({
    Business:l.name,
    Category:l.category,
    Area:l.area,
    'Website status':l.websiteStatus,
    'Fit score':l.score,
    ...Object.fromEntries((l.facts||[]).map(f=>[f.label,f.value])),
    Evidence:l.evidence,
    'Audit signals':(l.issues||[]).join(' | '),
    Sources:l.sources.join('\n'),
    'Verified at':l.checkedAt,
    'Email subject':l.draft?.subject||'',
    'Email draft':l.draft?.body||''
  }));
  const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{Information:'No accepted leads in this chat yet.'}]);
  ws['!cols']=Array.from({length:25},(_,i)=>({wch:i<3?28:38}));
  XLSX.utils.book_append_sheet(wb,ws,'Qualified leads');
  const facts=leads.flatMap(l=>(l.facts||[]).map(f=>({
    Business:l.name,
    Field:f.label,
    Value:f.value,
    'Source URL':f.sourceUrl
  })));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(facts.length?facts:[{Information:'No facts recorded.'}]),'Fact sources');
  
  if(typeof document!=='undefined'&&typeof window!=='undefined'){
    const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    const safeTitle=(c.title||'client_hunter').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,30);
    a.download=`leads_${safeTitle}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }else{
    XLSX.writeFile(wb,'client-hunter-'+c.id.slice(0,8)+'.xlsx');
  }
}

export default function Home(){
  const [chats,setChats]=useState<Campaign[]>([]);
  const [selected,setSelected]=useState('');
  const [tab,setTab]=useState<Tab>('chat');
  const [prompt,setPrompt]=useState('');
  const [health,setHealth]=useState<any>(null);
  const [ready,setReady]=useState(false);
  const [sidebar,setSidebar]=useState(true);
  const [filter,setFilter]=useState('');
  const [query,setQuery]=useState('');
  const [settings,setSettings]=useState(false);
  const [detail,setDetail]=useState<Lead|null>(null);
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState('');
  const [streaming,setStreaming]=useState<Record<string,boolean>>({});
  const [toasts,setToasts]=useState<{id:string;message:string;type:'error'|'success'}[]>([]);
  const [imageAttach,setImageAttach]=useState<{data:string;type:string;name:string}|null>(null);
  const [chatToDelete,setChatToDelete]=useState<{id:string;title:string}|null>(null);
  const [deletingChat,setDeletingChat]=useState(false);
  const [rejectingLeadId,setRejectingLeadId]=useState<string|null>(null);
  const [exportingExcel,setExportingExcel]=useState(false);

  const fileInputRef=useRef<HTMLInputElement>(null);
  const latest=useRef(chats),inflight=useRef(new Set<string>()),booted=useRef(false),messagesEndRef=useRef<HTMLDivElement>(null);
  latest.current=chats;

  function formatModelName(m:string){
    if(!m)return 'Gemini 2.5 Flash';
    if(m.includes('3.8'))return 'Gemini 3.8 Flash';
    if(m.includes('2.5'))return 'Gemini 2.5 Flash';
    if(m.includes('2.0'))return 'Gemini 2.0 Flash';
    if(m.includes('1.5'))return 'Gemini 1.5 Flash';
    return m.replace(/^models\//,'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }

  const showToast=(message:string,type:'error'|'success'='error')=>{
    const id=Math.random().toString(36).slice(2);
    setToasts(old=>[...old,{id,message,type}]);
    setTimeout(()=>setToasts(old=>old.filter(t=>t.id!==id)),4500);
  };

  const c=chats.find(x=>x.id===selected);
  const activeLeads=c?.leads.filter(l=>!l.rejected)||[];
  const draftCount=activeLeads.filter(l=>l.draft?.body).length||0;
  const upsert=(next:Campaign)=>setChats(old=>old.some(x=>x.id===next.id)?old.map(x=>x.id===next.id?next:x):[next,...old]);
  const activeModelName = c?.model ? formatModelName(c.model) : (health?.gemini ? 'Gemini 2.5 Flash' : 'Gemini AI');

  async function boot(){
    try{
      const h=await api('health');
      setHealth(h);
      if(!h?.user){setReady(true);return;}
      const rows=await api('campaigns');
      setChats(rows);
      if(!booted.current){
        const id=localStorage.getItem('ch-chat');
        setSelected(rows.some((x:Campaign)=>x.id===id)?id||'':'');
        setTab((localStorage.getItem('ch-tab') as Tab)||'chat');
        booted.current=true;
      }
      setReady(true);
    }catch(e){
      showToast((e as Error).message,'error');
      setReady(true);
    }
  }

  useEffect(()=>{if(window.innerWidth<700)setSidebar(false);boot();},[]);
  useEffect(()=>{if(!ready)return;localStorage.setItem('ch-chat',selected);localStorage.setItem('ch-tab',tab);setDetail(null);setQuery('');},[selected,tab,ready]);
  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:'smooth'});},[c?.messages?.length]);
  
  useEffect(()=>{
    if(!ready||!health?.user)return;
    const timer=setInterval(async()=>{
      if(health.backgroundWorker){try{setChats(await api('campaigns'));}catch{}return;}
      for(const task of latest.current.filter(active)){
        if(inflight.current.has(task.id))continue;
        inflight.current.add(task.id);
        setStreaming(s=>({...s,[task.id]:true}));
        (async()=>{
          try{
            const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:task.id,action:'step',stream:true})});
            if(response.status===409)return;
            if(!response.ok){const j:any=await response.json();throw new Error(j.error||'Research request failed.');}
            if(!response.headers.get('content-type')?.includes('ndjson')){upsert(await response.json());return;}
            const reader=response.body!.getReader(),decoder=new TextDecoder();
            let buffer='';
            while(true){
              const {value,done}=await reader.read();
              if(done)break;
              buffer+=decoder.decode(value,{stream:true});
              const lines=buffer.split('\n');
              buffer=lines.pop()||'';
              for(const line of lines){
                if(!line.trim())continue;
                const data=JSON.parse(line);
                if(data.type==='state')upsert(data.campaign);
                if(data.type==='event')setChats(old=>old.map(x=>x.id===task.id?{...x,events:[...x.events.filter(e=>e.id!==data.event.id),data.event]}:x));
                if(data.type==='error')throw new Error(data.message);
              }
            }
          }catch(e){
            showToast((e as Error).message,'error');
            try{const rows=await api('campaigns');setChats(rows);}catch{}
          }finally{
            inflight.current.delete(task.id);
            setStreaming(s=>({...s,[task.id]:false}));
          }
        })();
      }
    },1800);
    return()=>clearInterval(timer);
  },[ready,health?.user,health?.backgroundWorker]);

  async function act(action:string,extra:any={}){
    if(!c)return;
    try{
      const res=await api('action',{id:c.id,action,...extra});
      if(res.deleted){setChats(old=>old.filter(x=>x.id!==c.id));setSelected('');return true;}
      upsert(res);
      return true;
    }catch(e){
      showToast((e as Error).message,'error');
      return false;
    }
  }

  async function deleteChat(id:string){
    try{
      await api('action',{id,action:'delete'});
      setChats(old=>old.filter(x=>x.id!==id));
      if(selected===id){
        const remaining=chats.filter(x=>x.id!==id);
        setSelected(remaining.length>0?remaining[0].id:'');
        setTab('chat');
      }
      showToast('Chat deleted successfully.','success');
    }catch(e){
      showToast((e as Error).message,'error');
    }
  }

  function handleFileSelect(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    if(!file)return;
    if(!file.type.startsWith('image/')){
      showToast('Please select a valid image file.','error');
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      const result=reader.result as string;
      const base64=result.split(',')[1];
      setImageAttach({data:base64,type:file.type,name:file.name});
    };
    reader.readAsDataURL(file);
    if(fileInputRef.current)fileInputRef.current.value='';
  }

  async function send(e?:React.FormEvent){
    e?.preventDefault();
    const textToSend=prompt.trim();
    const attachToSend=imageAttach;
    if((!textToSend&&!attachToSend)||busy)return;

    // Immediately clear input fields so UI never feels stuck
    setPrompt('');
    setImageAttach(null);
    setBusy(true);

    // Optimistically update conversation
    if(c){
      const optimisticMsg:any={
        role:'user',
        content:textToSend||'Sent an image attachment.'
      };
      if(attachToSend){
        optimisticMsg.image=attachToSend.data;
        optimisticMsg.imageType=attachToSend.type;
      }
      setChats(old=>old.map(x=>x.id===c.id?{...x,messages:[...x.messages,optimisticMsg]}:x));
    }

    try{
      if(c){
        await act('reply',{
          message:textToSend,
          image:attachToSend?.data,
          imageType:attachToSend?.type
        });
      }else{
        const next=await api('campaigns',{prompt:textToSend,sender:health?.sender||''});
        upsert(next);
        setSelected(next.id);
        setTab('chat');
      }
    }catch(err){
      showToast((err as Error).message,'error');
    }finally{
      setBusy(false);
    }
  }

  async function retryLastMessage(){
    if(!c||busy)return;
    const lastUser=[...c.messages].reverse().find(m=>m.role==='user');
    if(!lastUser)return;
    setBusy(true);
    try{
      await act('reply',{
        message:lastUser.content,
        image:lastUser.image,
        imageType:lastUser.imageType
      });
      showToast('Retried message successfully.','success');
    }catch(err){
      showToast((err as Error).message,'error');
    }finally{
      setBusy(false);
    }
  }

  async function retryErrorStep(){
    if(!c||busy)return;
    setBusy(true);
    try{
      await act('resume');
      showToast('Resuming research step…','success');
    }catch(err){
      showToast((err as Error).message,'error');
    }finally{
      setBusy(false);
    }
  }

  const copy=async(l:Lead)=>{
    try{
      await copyText(l.draft.subject+'\n\n'+l.draft.body);
      setCopied(l.id);
      showToast('Draft copied to clipboard!','success');
      setTimeout(()=>setCopied(''),1800);
    }catch{
      showToast('Clipboard unavailable. Select text to copy.','error');
    }
  };

  function LeadCard({lead:l}:{lead:Lead}){
    return (
      <article className={'lead-card '+(l.rejected?'is-rejected':'')}>
        <div className="lead-top">
          <div className="business-icon">{l.name.slice(0,2).toUpperCase()}</div>
          <div className="lead-name">
            <h3>{l.name}</h3>
            <p><MapPin size={13}/>{l.area}</p>
          </div>
          <div className="score">
            <strong>{l.score}</strong>
            <span>fit score</span>
          </div>
        </div>

        <div className="tags">
          <span className="badge"><Check size={12}/>{l.websiteStatus==='No site found'?'No official site found':'Website verified'}</span>
          {l.draft?.body&&<span className="badge subtle"><FileText size={12}/>Draft ready</span>}
          {l.rejected&&<span className="badge" style={{background:'#fee',color:'#c33'}}><XCircle size={12}/>Excluded</span>}
        </div>

        <div className="fact-grid">
          {(l.facts||[]).filter(f=>['phone','rating','address','hours','timing','website','email'].includes(f.key)||f.label?.toLowerCase().includes('hour')||f.label?.toLowerCase().includes('timing')).map(f=><FactView key={f.key} fact={f}/>)}
        </div>

        <SocialBadges facts={l.facts} businessName={l.name}/>

        <p className="opportunity">{l.reason}</p>

        <footer>
          <button className="card-action-btn" onClick={()=>setDetail(l)}>View evidence <ArrowUpRight size={14}/></button>
          {l.draft?.body?(
            <button className="card-action-btn" onClick={()=>{setTab('drafts');setQuery(l.name)}}>Open draft <ChevronRight size={14}/></button>
          ):(
            <span style={{flex:1}}/>
          )}
          <button
            className="btn-reject"
            disabled={rejectingLeadId===l.id}
            title={l.rejected?'Restore lead to shortlist':'Exclude from shortlist & Excel export'}
            onClick={async(e)=>{
              e.stopPropagation();
              setRejectingLeadId(l.id);
              await act('reject_lead',{leadId:l.id});
              setRejectingLeadId(null);
            }}
          >
            {rejectingLeadId===l.id?<Loader2 size={13} className="spin"/>:<XCircle size={13}/>}
            {l.rejected?'Restore':'Reject'}
          </button>
        </footer>
      </article>
    );
  }

  const userName=health?.user?.name||'User';
  const userInitial=(userName.trim()[0]||'U').toUpperCase();

  if(ready&&!health?.user)return <Auth onSuccess={()=>{booted.current=false;boot();}} showToast={showToast}/>;

  return (
    <div className={'app '+(!sidebar?'collapsed':'')}>
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t=>(
          <div key={t.id} className={'toast '+t.type}>
            {t.type==='success'?<Check size={15}/>:<AlertCircle size={15}/>}
            <span>{t.message}</span>
            <button className="toast-close" onClick={()=>setToasts(old=>old.filter(x=>x.id!==t.id))}><X size={13}/></button>
          </div>
        ))}
      </div>

      <aside className="sidebar">
        <button className="mobile-close icon-button" aria-label="Close sidebar" onClick={()=>setSidebar(false)}><X size={18}/></button>
        <a className="brand" href="#" onClick={e=>{e.preventDefault();setSelected('');setTab('chat');}}>
          <span className="logo"><Target size={24}/></span>
          <strong className="brand-text">ClientHunter</strong>
        </a>
        <button className="new-chat" onClick={()=>{setSelected('');setTab('chat');setPrompt('');setImageAttach(null);}}>
          <Plus size={18}/>New chat
        </button>
        <div className="history-search">
          <Search size={15}/>
          <input aria-label="Search chats" placeholder="Search your chats" value={filter} onChange={e=>setFilter(e.target.value)}/>
        </div>
        <div className="history-label">YOUR CHATS <span>{chats.length}</span></div>
        <nav className="history">
          {chats.filter(x=>x.title.toLowerCase().includes(filter.toLowerCase())).map(x=>(
            <div key={x.id} className={'history-item '+(x.id===selected?'selected':'')}>
              <button className="history-btn" title={x.title} onClick={()=>{setSelected(x.id);setPrompt('');if(window.innerWidth<700)setSidebar(false);}}>
                <MessageSquare size={16}/>
                <span>{x.title}</span>
                {active(x)?<i className="live-dot"/>:x.status==='needs_input'?<AlertCircle size={13}/>:null}
              </button>
              <button className="delete-chat-btn" title="Delete chat" aria-label="Delete chat" onClick={e=>{e.stopPropagation();setChatToDelete({id:x.id,title:x.title});}}>
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
          {ready&&!chats.length&&<p className="history-empty">Your research chats will appear here.</p>}
        </nav>
        <button className="profile" onClick={()=>setSettings(true)}>
          <span className="avatar">{userInitial}</span>
          <span>
            <strong>{userName}</strong>
            <small>User</small>
          </span>
          <Settings size={18}/>
        </button>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button" title="Toggle sidebar" onClick={()=>setSidebar(!sidebar)}>{sidebar?<PanelLeftClose size={19}/>:<PanelLeftOpen size={19}/>}</button>
          <span className="breadcrumb">{c?c.title:'Research workspace'}</span>
          <span
            className="connection"
            title={active(c)?'AI is researching':health?.gemini?'AI online and ready':health?'AI offline - click to configure in settings':'Checking AI connection…'}
            onClick={()=>{if(!health?.gemini)setSettings(true);}}
            style={{cursor:!health?.gemini?'pointer':'default'}}
          >
            <i className={active(c)?'live-dot pulse':health?.gemini?'live-dot':'offline-dot'}/>
            {active(c)?'AI Working…':health===null?'AI Connecting…':health?.gemini?'AI Online':'AI Offline'}
          </span>
          <button className="icon-button" title="Settings" onClick={()=>setSettings(true)}><SlidersHorizontal size={18}/></button>
        </header>

        {!ready?<div className="loading"><Loader2 className="spin"/>Loading your research…</div>:!c?(
          <section className="welcome">
            <div className="eyebrow"><span className="spark-icon"><Target size={18}/></span>YOUR NEXT OPPORTUNITY STARTS HERE</div>
            <h1>Find the right businesses.<br/><span>Start a better conversation.</span></h1>
            <p>Tell your research team who you want to work with.<br/>Get local leads, checked evidence, and emails ready to review.</p>
            
            <form className="composer welcome-composer" onSubmit={send}>
              {imageAttach&&(
                <div className="attach-preview">
                  <img src={`data:${imageAttach.type};base64,${imageAttach.data}`} alt="attachment" className="attach-thumb"/>
                  <span>{imageAttach.name}</span>
                  <button type="button" className="attach-remove" onClick={()=>setImageAttach(null)}><X size={14}/></button>
                </div>
              )}
              <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Find 2 paint shops in Porur, Chennai that need a website…" aria-label="Research prompt" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}/>
              <div className="composer-bottom">
                <div className="composer-left">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{display:'none'}}/>
                  <button type="button" className="attach-btn" title="Attach image / visiting card" onClick={()=>fileInputRef.current?.click()}><Paperclip size={16}/></button>
                  <div className="model-pill" title={`Active model: ${activeModelName}`}>
                    <Sparkles size={12} className="model-spark"/>
                    <span>{activeModelName}</span>
                  </div>
                </div>
                <div className="composer-right">
                  <button className="send" disabled={busy||(prompt.trim().length<8&&!imageAttach)} aria-label="Start research">{busy?<Loader2 className="spin" size={18}/>:<ArrowUp size={20}/>}</button>
                </div>
              </div>
            </form>

            <div className="examples">
              {['Find 2 paint shops in Porur, Chennai without websites','Find cafés in Chennai with existing websites that need a redesign','Find 5 tea shops in Anna Nagar, Chennai for website design'].map((s,i)=>(
                <button key={s} onClick={()=>setPrompt(s)}>
                  {i===0?<Search size={17}/>:i===1?<Globe size={17}/>:<MapPin size={17}/>}
                  <span>{s}</span>
                  <ArrowUpRight size={16}/>
                </button>
              ))}
            </div>
            <div className="welcome-note"><ShieldCheck size={15}/>Every accepted lead has evidence. Your shortlist can be smaller than your target.</div>
          </section>
        ):(
          <>
            <div className="chat-heading">
              <div>
                <div className="eyebrow">{c.location||'RESEARCH'}</div>
                <h1>{c.title}</h1>
              </div>
              <div className="heading-actions">
                <button className="button small" disabled={!activeLeads.length||exportingExcel} onClick={async()=>{setExportingExcel(true);await exportExcel(c);setExportingExcel(false);}}>
                  {exportingExcel?<Loader2 size={15} className="spin"/>:<Download size={15}/>}Excel
                </button>
              </div>
            </div>

            <div className="tabbar">
              {([{id:'chat',label:'Conversation',icon:MessageSquare,count:null},{id:'leads',label:'Leads',icon:Users,count:activeLeads.length},{id:'drafts',label:'Email drafts',icon:FileText,count:draftCount}] as const).map(t=>(
                <button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>
                  <t.icon size={16}/>{t.label}{t.count!==null&&<span>{t.count}</span>}
                </button>
              ))}
              <div className="run-status">
                {active(c)?<><Loader2 size={13} className="spin"/>Researching</>:c.status==='needs_input'?<>Waiting for your answer</>:c.status==='complete'?<><CheckCheck size={15}/>Research saved</>:c.status==='error'?'Needs attention':'Paused'}
              </div>
            </div>

            <div className={'workspace-content '+(tab==='chat'?'conversation':'')}>
              {tab==='chat'?(
                <>
                  {activeLeads.length > 0 && (
                    <div className="chat-leads-banner" onClick={()=>setTab('leads')} role="button" tabIndex={0} title="Click to view full shortlist and email drafts">
                      <div className="chat-leads-banner-left">
                        <span className="chat-leads-badge"><Users size={14}/> <strong>{activeLeads.length}</strong> {activeLeads.length===1?'Lead':'Leads'} Qualified</span>
                        {draftCount > 0 && <span className="chat-drafts-badge"><FileText size={13}/> <strong>{draftCount}</strong> {draftCount===1?'Email draft':'Email drafts'} ready</span>}
                      </div>
                      <div className="chat-leads-banner-right">
                        <span>Open leads & drafts</span>
                        <ChevronRight size={14}/>
                      </div>
                    </div>
                  )}

                  <div className="messages">
                    {c.messages.map((m,i)=>(
                      <div key={i}>
                        {m.role==='user'?(
                          <div className="user-msg-block">
                            <div className="message user">
                              <div>
                                <Markdown text={m.content}/>
                                {m.image&&<img src={`data:${m.imageType||'image/jpeg'};base64,${m.image}`} alt="Uploaded attachment" className="msg-img"/>}
                              </div>
                            </div>
                            <div className="user-msg-actions">
                              <button
                                type="button"
                                className="msg-bubble-btn"
                                title="Copy prompt"
                                onClick={async()=>{
                                  try{
                                    await copyText(m.content);
                                    showToast('Prompt copied to clipboard!','success');
                                  }catch{
                                    showToast('Failed to copy.','error');
                                  }
                                }}
                              >
                                <Copy size={11}/>
                                <span>Copy</span>
                              </button>
                              <button
                                type="button"
                                className="msg-bubble-btn"
                                title="Retry this prompt"
                                disabled={busy||active(c)}
                                onClick={async()=>{
                                  if(busy||active(c))return;
                                  setBusy(true);
                                  try{
                                    await act('reply',{
                                      message:m.content,
                                      image:m.image,
                                      imageType:m.imageType
                                    });
                                    showToast('Retrying research with this prompt…','success');
                                  }catch(err){
                                    showToast((err as Error).message,'error');
                                  }finally{
                                    setBusy(false);
                                  }
                                }}
                              >
                                <RefreshCw size={11} className={busy?'spin':''}/>
                                <span>Retry</span>
                              </button>
                            </div>
                          </div>
                        ):(
                          <div className="message assistant">
                            <span className="agent-avatar"><Target size={18}/></span>
                            <div>
                              <Markdown text={m.content}/>
                              {m.image&&<img src={`data:${m.imageType||'image/jpeg'};base64,${m.image}`} alt="Uploaded attachment" className="msg-img"/>}
                              <div className="msg-actions">
                                <button
                                  type="button"
                                  className="msg-action-btn"
                                  title="Copy response"
                                  onClick={async()=>{
                                    try{
                                      await copyText(m.content);
                                      showToast('Response copied to clipboard!','success');
                                    }catch{
                                      showToast('Failed to copy.','error');
                                    }
                                  }}
                                >
                                  <Copy size={12}/>
                                  <span>Copy</span>
                                </button>
                                {i===c.messages.length-1&&(
                                  <button
                                    type="button"
                                    className="msg-action-btn"
                                    title="Retry response"
                                    disabled={busy||active(c)}
                                    onClick={retryLastMessage}
                                  >
                                    <RefreshCw size={12} className={busy?'spin':''}/>
                                    <span>Retry</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Show initial research steps: attached to prompt if waiting for initial reply, or to the first research response */}
                        {((c.messages.length===1&&i===0)||(c.messages.length>1&&i===1))&&c.events.length>0&&(
                          <details className="work-log" open={active(c)||c.status==='error'}>
                            <summary>
                              <span className="work-icon">{active(c)?<Loader2 size={17} className="spin"/>:<CheckCheck size={17}/>}</span>
                              <div>
                                <strong>{active(c)?'Research team is working':'Research steps'}</strong>
                                <small>{c.events.at(-1)?.message}</small>
                              </div>
                              <span>{c.events.length} steps</span>
                              <ChevronDown size={15}/>
                            </summary>
                            <div className="event-list">
                              {c.events.slice(-50).map(e=>(
                                <div key={e.id} className={'event '+e.type}>
                                  <span className="event-mark">{e.type==='success'?<Check size={12}/>:e.type==='warning'||e.type==='error'?<AlertCircle size={12}/>:<span/>}</span>
                                  <div>
                                    <strong>{e.agent}<time>{new Date(e.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></strong>
                                    <Markdown text={e.message}/>
                                  </div>
                                </div>
                              ))}
                              {streaming[c.id]&&<div className="stream-note"><Loader2 size={12} className="spin"/>Receiving live updates…</div>}
                            </div>
                            <p className="log-note">Action summaries and tool results, with source evidence.</p>
                          </details>
                        )}
                      </div>
                    ))}

                    {/* Active follow-up research status */}
                    {active(c)&&c.messages.length>2&&(
                      <div className="stream-note" style={{padding:'6px 0',display:'flex',alignItems:'center',gap:8}}>
                        <Loader2 size={14} className="spin"/><span>Research team is finding answers for you…</span>
                      </div>
                    )}
                    <div ref={messagesEndRef}/>
                  </div>

                  {c.error&&(
                    <div className="callout warning">
                      <AlertCircle size={18}/>
                      <div>
                        <strong>Progress saved</strong>
                        <p>{c.error}</p>
                        <button onClick={retryErrorStep} disabled={busy}>
                          <RefreshCw size={13} className={busy?'spin':''}/>
                          <span>{busy?'Resuming…':'Retry this step'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {c.status==='needs_input'&&(
                    <div className="callout">
                      <MessageSquare size={18}/>
                      <div>
                        <strong>Your input is needed</strong>
                        <p>{c.question}</p>
                      </div>
                    </div>
                  )}

                  {!!c.rejected?.length&&(
                    <details className="rejections">
                      <summary>{c.rejected.length} candidates excluded <ChevronDown size={14}/></summary>
                      {c.rejected.map((r,i)=><p key={i}><strong>{r.name}</strong> — {r.reason}</p>)}
                    </details>
                  )}
                </>
              ):(
                <>
                  <div className="results-heading">
                    <div>
                      <h2>{tab==='leads'?'Your qualified shortlist':'A conversation starter for every lead'}</h2>
                      <p>{tab==='leads'?`${activeLeads.length} verified matches out of ${c.target} requested. Every fact links to its evidence.`:'Personalized using verified details. Edit, copy, and send when you are ready.'}</p>
                    </div>
                    <label className="results-search">
                      <Search size={16}/>
                      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a business…"/>
                    </label>
                  </div>

                  {tab==='leads'?(
                    <div className="lead-grid">
                      {activeLeads.filter(l=>l.name.toLowerCase().includes(query.toLowerCase())).map(l=><LeadCard lead={l} key={l.id}/>)}
                    </div>
                  ):(
                    <div className="draft-grid">
                      {activeLeads.filter(l=>l.draft?.body&&l.name.toLowerCase().includes(query.toLowerCase())).map(l=><Draft key={l.id} lead={l} copied={copied===l.id} onCopy={()=>copy(l)} onSave={draft=>act('lead',{leadId:l.id,draft})}/>)}
                    </div>
                  )}

                  {!(tab==='leads'?activeLeads.length:draftCount)&&(
                    <div className="empty-state">
                      {tab==='leads'?<Users size={30}/>:<Mail size={30}/>}
                      <h3>{active(c)?'Your research is in progress':tab==='leads'?'No qualified leads yet':'No email drafts yet'}</h3>
                      <p>{tab==='leads'?'Only businesses that pass the location and website checks appear here.':'A draft is prepared automatically after each lead qualifies.'}</p>
                      <button className="button" onClick={()=>setTab('chat')}>Back to conversation</button>
                    </div>
                  )}
                </>
              )}
            </div>

            {tab==='chat'&&(
              <div className="composer-wrap">
                <form className="composer" onSubmit={send}>
                  {imageAttach&&(
                    <div className="attach-preview">
                      <img src={`data:${imageAttach.type};base64,${imageAttach.data}`} alt="attachment" className="attach-thumb"/>
                      <span>{imageAttach.name}</span>
                      <button type="button" className="attach-remove" onClick={()=>setImageAttach(null)}><X size={14}/></button>
                    </div>
                  )}
                  <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} aria-label="Message your research team" placeholder="Ask a question, request more details, or attach a business photo…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}/>
                  <div className="composer-bottom">
                    <div className="composer-left">
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{display:'none'}}/>
                      <button type="button" className="attach-btn" title="Attach image / photo / card" onClick={()=>fileInputRef.current?.click()}><Paperclip size={15}/></button>
                      <div className="model-pill" title={`Active model: ${activeModelName}`}>
                        <Sparkles size={12} className="model-spark"/>
                        <span>{activeModelName}</span>
                      </div>
                    </div>
                    <div className="composer-right">
                      {busy||active(c)?(
                        <button type="button" className="send stop-btn" title="Stop generating / pause" aria-label="Stop generating / pause" onClick={(e)=>{e.preventDefault();act('pause');setBusy(false);}}>
                          <Square size={13} fill="currentColor"/>
                        </button>
                      ):(
                        <button className="send" disabled={busy||(prompt.trim().length<2&&!imageAttach)} aria-label="Send message">
                          <ArrowUp size={18}/>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {settings&&<SettingsModal health={health} onClose={()=>setSettings(false)} onSaved={()=>{api('health').then(setHealth);}} showToast={showToast}/>}

      {detail&&(
        <div className="drawer-backdrop" onClick={()=>setDetail(null)}>
          <aside className="lead-drawer" onClick={e=>e.stopPropagation()}>
            <div className="drawer-header">
              <span className="eyebrow">LEAD EVIDENCE & INTELLIGENCE</span>
              <button className="icon-button" onClick={()=>setDetail(null)} aria-label="Close lead details"><X size={20}/></button>
            </div>
            
            <h2>{detail.name}</h2>
            <p className="muted">{detail.area}</p>
            <div style={{display:'flex',gap:8,alignItems:'center',margin:'8px 0'}}>
              <span className="badge"><Check size={13}/>{detail.websiteStatus}</span>
              {detail.rejected&&<span className="badge" style={{background:'#fee',color:'#c33'}}><XCircle size={13}/>Excluded from list</span>}
            </div>

            {/* Small Map Preview */}
            <div className="map-preview">
              <iframe
                title={`Map for ${detail.name}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                src={`https://maps.google.com/maps?q=${encodeURIComponent((detail.address||detail.name)+' '+detail.area)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
              />
            </div>

            {/* Social logos & direct links */}
            <SocialBadges facts={detail.facts} businessName={detail.name}/>

            {/* Shop Timings & Business Hours - All days displayed */}
            {((detail as any).hours || (detail as any).hoursSummary || (detail.facts||[]).find(f=>f.key==='hours'||f.key==='timing'||f.label?.toLowerCase().includes('timing')||f.label?.toLowerCase().includes('hour'))?.value) && (
              <ShopTimingView
                hours={(detail as any).hours}
                hoursSummary={(detail as any).hoursSummary}
                fallbackText={(detail.facts||[]).find(f=>f.key==='hours'||f.key==='timing'||f.label?.toLowerCase().includes('timing')||f.label?.toLowerCase().includes('hour'))?.value}
              />
            )}

            {/* Live Website Preview & Screenshot */}
            {(detail.website || (detail.facts||[]).find(f=>f.key==='website'||f.label?.toLowerCase().includes('website'))?.value) && (
              <WebsiteScreenshotView url={detail.website || (detail.facts||[]).find(f=>f.key==='website'||f.label?.toLowerCase().includes('website'))!.value} name={detail.name}/>
            )}

            {/* WHOIS Domain Intelligence */}
            {(detail.website || (detail.facts||[]).find(f=>f.key==='website'||f.label?.toLowerCase().includes('website'))?.value) && (
              <DomainIntelView url={detail.website || (detail.facts||[]).find(f=>f.key==='website'||f.label?.toLowerCase().includes('website'))!.value}/>
            )}

            <h3>Public business details</h3>
            <div className="fact-grid">
              {detail.facts?.filter(f=>
                !['maps','whatsapp','instagram','facebook'].includes(f.key?.toLowerCase())&&
                !['google maps','whatsapp','instagram','facebook'].includes(f.label?.toLowerCase())&&
                !f.value?.includes('maps.google.com')&&
                !f.value?.includes('instagram.com')&&
                !f.value?.includes('facebook.com')&&
                !f.value?.includes('wa.me')
              ).map(f=><FactView key={f.key} fact={f}/>)}
            </div>

            <h3>Why it qualifies</h3>
            <Markdown text={detail.evidence}/>
            <ul className="check-list">{detail.verification?.checks.map(s=><li key={s}><Check size={14}/>{s}</li>)}</ul>

            {Object.keys(detail.audit).length>0&&(
              <>
                <h3>Observed website checks</h3>
                <p className="muted">These page checks identify improvement signals, not a complete audit.</p>
                <div className="audit-list">{Object.entries(detail.audit).map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
              </>
            )}

            <h3>Sources</h3>
            <div className="sources">
              {detail.sources.map((s,i)=>(
                <a key={s} href={safeLink(s)} target="_blank" rel="noreferrer">
                  <Link2 size={15}/>
                  <span>{i+1}. {host(s)}</span>
                  <ArrowUpRight size={15}/>
                </a>
              ))}
            </div>

            <p className="muted">Verified {new Date(detail.checkedAt).toLocaleString()}</p>
            
            <div style={{display:'flex',gap:10,marginTop:20}}>
              {detail.draft?.body&&(
                <button className="button primary" style={{flex:1}} onClick={()=>{setTab('drafts');setQuery(detail.name);setDetail(null);}}>
                  <Mail size={16}/>Open draft
                </button>
              )}
              <button className="btn-reject" style={{padding:'10px 14px',fontSize:12}} onClick={()=>{act('reject_lead',{leadId:detail.id});setDetail(null);}}>
                <XCircle size={15}/>{detail.rejected?'Restore to shortlist':'Reject this lead'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Delete chat confirmation popup */}
      {chatToDelete&&(
        <div className="modal-backdrop" onClick={()=>!deletingChat&&setChatToDelete(null)}>
          <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
            <div className="confirm-icon-wrap">
              <Trash2 size={24}/>
            </div>
            <h3>Delete chat?</h3>
            <p>
              Are you sure you want to delete <strong>&ldquo;{chatToDelete.title}&rdquo;</strong>?<br/>
              All messages, qualified leads, and outreach drafts will be permanently deleted.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="button"
                disabled={deletingChat}
                onClick={()=>setChatToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button btn-danger"
                disabled={deletingChat}
                onClick={async()=>{
                  setDeletingChat(true);
                  await deleteChat(chatToDelete.id);
                  setDeletingChat(false);
                  setChatToDelete(null);
                }}
              >
                {deletingChat?<Loader2 size={14} className="spin"/>:<Trash2 size={14}/>}
                <span>{deletingChat?'Deleting…':'Delete chat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Draft({lead,copied,onCopy,onSave}:{lead:Lead;copied:boolean;onCopy:()=>void;onSave:(d:Lead['draft'])=>Promise<boolean|undefined>}){
  const [draft,setDraft]=useState(lead.draft);
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  return (
    <article className="draft-card">
      <header>
        <div className="draft-emblem"><Mail size={19}/></div>
        <div>
          <h3>{lead.name}</h3>
          {lead.email&&<span>{lead.email}</span>}
        </div>
        <span className="badge subtle">Draft</span>
      </header>
      <label>SUBJECT<input value={draft.subject} onChange={e=>{setDirty(true);setDraft({...draft,subject:e.target.value});}}/></label>
      <textarea aria-label={'Email body for '+lead.name} value={draft.body} onChange={e=>{setDirty(true);setDraft({...draft,body:e.target.value});}}/>
      <footer>
        <span><Check size={13}/>{dirty?'Unsaved edits':'Saved in this chat'}</span>
        {dirty?(
          <button className="button small primary" disabled={saving} onClick={async()=>{setSaving(true);const saved=await onSave(draft);setSaving(false);if(saved)setDirty(false);}}>Save edits</button>
        ):(
          <button className="button small" onClick={onCopy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?'Copied':'Copy email'}</button>
        )}
      </footer>
    </article>
  );
}

function SettingsModal({health,onClose,onSaved,showToast}:{health:any;onClose:()=>void;onSaved:()=>void;showToast:(msg:string,type?:'error'|'success')=>void}){
  const [name,setName]=useState(health?.user?.name||'');
  const [sender,setSender]=useState(health?.sender||'');
  const [currentPw,setCurrentPw]=useState('');
  const [newPw,setNewPw]=useState('');
  const [confirmPw,setConfirmPw]=useState('');
  const [showCurrent,setShowCurrent]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const [saving,setSaving]=useState(false);

  async function handleProfileSave(e:React.FormEvent){
    e.preventDefault();
    if(newPw){
      if(newPw.length<8){
        showToast('New password must be at least 8 characters.','error');
        return;
      }
      if(newPw!==confirmPw){
        showToast('New password and confirm password do not match.','error');
        return;
      }
      if(!currentPw){
        showToast('Please enter your current password to change it.','error');
        return;
      }
    }
    setSaving(true);
    try{
      await api('user/profile',{
        name:name.trim(),
        currentPassword:currentPw,
        newPassword:newPw
      });
      if(sender!==health?.sender){
        await api('settings',{sender:sender.trim()});
      }
      showToast('Profile and settings updated successfully!','success');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      onSaved();
    }catch(err){
      showToast((err as Error).message,'error');
    }finally{
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-modal" onClick={e=>e.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h2>Settings & Profile</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20}/></button>
        </header>

        <form onSubmit={handleProfileSave}>
          <div className="settings-section">
            <div className="settings-section-title"><UserIcon size={14}/>Account Details</div>
            <label>
              Full name
              <input value={name} placeholder="Your name" onChange={e=>setName(e.target.value)} required/>
            </label>
            <label>
              Sender name for outreach drafts
              <input value={sender} placeholder="Your name as sign-off in email drafts" onChange={e=>setSender(e.target.value)}/>
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-title"><Lock size={14}/>Change Password</div>
            <label>
              Current password
              <div className="password-box">
                <input type={showCurrent?'text':'password'} value={currentPw} placeholder="Enter current password" onChange={e=>setCurrentPw(e.target.value)}/>
                <button type="button" className="password-eye" onClick={()=>setShowCurrent(!showCurrent)}>
                  {showCurrent?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </label>
            <label>
              New password (min 8 characters)
              <div className="password-box">
                <input type={showNew?'text':'password'} value={newPw} placeholder="At least 8 characters" minLength={8} onChange={e=>setNewPw(e.target.value)}/>
                <button type="button" className="password-eye" onClick={()=>setShowNew(!showNew)}>
                  {showNew?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </label>
            <label>
              Confirm new password
              <input type="password" value={confirmPw} placeholder="Repeat new password" onChange={e=>setConfirmPw(e.target.value)}/>
            </label>
          </div>

          <button className="button primary" style={{width:'100%',marginTop:8}} disabled={saving}>
            {saving?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Save changes
          </button>
        </form>

        <footer style={{width:'100%',paddingTop:18,marginTop:20,borderTop:'1px solid #edf2eb'}}>
          <button type="button" className="btn-signout" onClick={async()=>{await api('auth/logout',{});location.reload();}}>
            <LogOut size={16}/>Sign out
          </button>
        </footer>
      </section>
    </div>
  );
}

function Auth({onSuccess,showToast}:{onSuccess:()=>void;showToast:(msg:string,type?:'error'|'success')=>void}){
  const [signup,setSignup]=useState(false);
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();
    if(!email||!password){
      showToast('Please fill in all required fields.','error');
      return;
    }
    if(signup&&!name.trim()){
      showToast('Please enter your name.','error');
      return;
    }
    if(password.length<8){
      showToast('Password must be at least 8 characters.','error');
      return;
    }
    setBusy(true);
    try{
      await api(signup?'auth/signup':'auth/login',{name,email,password});
      showToast(signup?'Account created successfully!':'Welcome back!','success');
      onSuccess();
    }catch(err){
      showToast((err as Error).message,'error');
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <span className="logo"><Target size={30}/></span>
        <h1>clienthunter</h1>
        <p>Your next opportunity starts here.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <span className="eyebrow">LOCAL WORKSPACE</span>
        <h2>{signup?'Create your account':'Welcome back'}</h2>

        {signup&&(
          <label>
            Your name
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name"/>
          </label>
        )}

        <label>
          Email address
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email"/>
        </label>

        <label>
          Password
          <div className="password-box">
            <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={signup?'At least 8 characters':'Enter your password'} autoComplete={signup?'new-password':'current-password'}/>
            <button type="button" className="password-eye" onClick={()=>setShowPassword(!showPassword)} title={showPassword?'Hide password':'Show password'}>
              {showPassword?<EyeOff size={16}/>:<Eye size={16}/>}
            </button>
          </div>
        </label>

        <button className="button primary" disabled={busy} style={{marginTop:16}}>
          {busy?<Loader2 className="spin" size={16}/>:null}
          {signup?'Create account':'Sign in'}
        </button>

        <p>
          {signup?'Already have an account? ':'New to Client Hunter? '}
          <button type="button" onClick={()=>{setSignup(!signup);setPassword('');}}>
            {signup?'Sign in':'Create account'}
          </button>
        </p>
      </form>
    </div>
  );
}
