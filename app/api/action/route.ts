import {db,owner,load,save,remove} from '@/lib/client-hunter/store';
import {Campaign,event,restoreCampaign} from '@/lib/client-hunter/types';
import {readSettings} from '@/lib/client-hunter/settings';
import {keyContext} from '@/lib/client-hunter/providers';
import {advance} from '@/lib/client-hunter/agent';
export async function POST(r:Request){
 try{
 const b:any=await r.json(),user=owner(r);const row=await load(String(b.id),user);if(!row)return Response.json({error:'Campaign not found.'},{status:404});
 const c:Campaign=restoreCampaign(JSON.parse(row.data));
 if(b.action==='delete'){
  await remove(c.id,user);
  return Response.json({deleted:true,id:c.id});
 }
 if(b.action==='step'){
  if(!['planning','running','drafting'].includes(c.status))return Response.json(c);
  const keys=await readSettings(user);
  const lease=await db().prepare('UPDATE campaigns SET locked_until=? WHERE id=? AND owner=? AND revision=? AND locked_until<?').bind(Date.now()+240000,c.id,user,row.revision,Date.now()).run();
  if(!lease.meta.changes)return Response.json({error:'A research step is already in progress.'},{status:409});
  if(b.stream){const encoder=new TextEncoder();let closed=false;const stream=new ReadableStream({async start(controller){const emit=(data:any)=>{if(!closed)try{controller.enqueue(encoder.encode(JSON.stringify(data)+'\n'));}catch{closed=true;}};try{emit({type:'start',id:c.id});const next=await keyContext.run(keys,()=>advance(c,emit));await save(next,user,row.revision);const fresh=await load(c.id,user);emit({type:'state',campaign:restoreCampaign(JSON.parse(fresh!.data))});}catch{emit({type:'error',message:'The step could not finish. Saved progress is safe.'});}finally{if(!closed)controller.close();}},cancel(){closed=true;}});return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
  const next=await keyContext.run(keys,()=>advance(c));await save(next,user,row.revision);const fresh=await load(c.id,user);return Response.json(restoreCampaign(JSON.parse(fresh!.data)));
 }
 if(b.action==='pause'){c.status='paused';event(c,'You','Research paused. Your progress is saved.');}
 else if(b.action==='resume'){c.error='';c.status=c.plan.length?'running':'planning';event(c,'You','Research resumed.');}
 else if(b.action==='reject_lead'){
  const l=c.leads.find(x=>x.id===b.leadId);if(!l)return Response.json({error:'Lead not found.'},{status:404});
  l.rejected=!l.rejected;
  event(c,'You',`${l.rejected?'Excluded':'Restored'} ${l.name}.`);
 }
 else if(b.action==='reply'){
  const reply=String(b.message||'').trim().slice(0,3000);if(!reply)return Response.json({error:'Enter a reply.'},{status:400});
  c.messages.push({role:'user',content:reply});c.question='';c.pendingCandidate=undefined;c.phase='research';c.status='planning';event(c,'You','Updated the research direction.');
 }
 else if(b.action==='drafts'){if(!c.leads.some(l=>l.selected))return Response.json({error:'Select at least one lead first.'},{status:400});c.phase='draft';c.status='drafting';c.error='';event(c,'You','Preparing any missing drafts.');}
 else if(b.action==='lead'){const l=c.leads.find(x=>x.id===b.leadId);if(!l)return Response.json({error:'Lead not found.'},{status:404});if(typeof b.selected==='boolean')l.selected=b.selected;if(b.draft)l.draft={subject:String(b.draft.subject||'').slice(0,200),body:String(b.draft.body||'').slice(0,5000),enhanced:true};}
 else if(b.action==='extend'){c.phase='research';c.status='running';c.steps=0;c.searches=0;c.pages=0;c.error='';c.target=Math.min(30,c.target+5);c.messages.push({role:'user',content:'Continue within the original geography. Aim for five more leads; a new bounded research pass is approved.'});}
 else return Response.json({error:'Unknown action.'},{status:400});
 const saved=await save(c,user,row.revision);if(!saved.meta.changes)return Response.json({error:'This research changed in another request. Refresh before retrying.'},{status:409});return Response.json(c);
 }catch{return Response.json({error:'The action could not be completed. Your saved results are safe.'},{status:500});}
}
