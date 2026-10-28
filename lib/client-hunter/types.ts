export type Fact = {key:string;label:string;value:string;kind:'text'|'phone'|'email'|'link'|'rating';sourceUrl:string;quote?:string};
export type Criteria = {websiteMode:'missing'|'outdated'|'any';city:string;locality:string;countryCode:string;category:string;locationTerms:string[]};
export type EvidenceDoc = {url:string;title:string;text:string;kind:'search'|'place'|'page';address?:string;phone?:string;email?:string;website?:string;rating?:number;reviewCount?:number;provider?:string;status?:number;links?:{url:string;text:string}[];audit?:Record<string,string>;issues?:string[]};
export type Lead = {
 id:string; name:string; category:string; area:string; address:string; phone:string; email:string;
 website:string; websiteStatus:'No site found'|'Website found'|'Uncertain'; score:number;
 reason:string; sources:string[]; evidence:string; rating:number|null; reviewCount:number|null;
 ratingSource:string; checkedAt:string; audit:Record<string,string>;
 draft:{subject:string;body:string;enhanced?:boolean;source?:'gemini'|'template'}; selected:boolean;
 facts?:Fact[]; verification?:{accepted:boolean;mode:string;checks:string[];checkedAt:string}; issues?:string[];
 rejected?:boolean;
};
export type Activity = {id:string;agent:string;message:string;time:string;type:'info'|'success'|'warning'|'error'};
export type Campaign = {
 id:string; title:string; prompt:string; status:'planning'|'running'|'needs_input'|'review'|'drafting'|'complete'|'paused'|'error';
 createdAt:string; target:number; location:string; category:string; service:string; sender:string;
 plan:string[]; messages:{role:'user'|'assistant';content:string;image?:string;imageType?:string}[]; events:Activity[];
 leads:Lead[]; observations:{kind:string;query?:string;url?:string;data:any}[];
 searches:number; pages:number; steps:number; question:string; summary:string; error:string;
 phase:'research'|'draft'; model:string; browser:boolean;
 schemaVersion?:number; criteria?:Criteria; rejected?:{name:string;reason:string;time:string}[];
 pendingCandidate?:any; candidateEvidence?:EvidenceDoc[]; candidateSearches?:string[]; verificationStage?:number;
 stalledTurns?:number; autoDraft?:boolean; archivedLeads?:Lead[];
};
export const uid=()=>crypto.randomUUID();
export function event(c:Campaign,agent:string,message:string,type:Activity['type']='info'){
 c.events.push({id:uid(),agent,message,type,time:new Date().toISOString()});c.events=c.events.slice(-180);
}
export function newCampaign(prompt:string,service:string,sender:string):Campaign {
 return {schemaVersion:2,autoDraft:true,rejected:[],id:uid(),title:prompt.slice(0,70),prompt,status:'planning',createdAt:new Date().toISOString(),target:20,
 location:'',category:'',service:service||'Website design',sender:sender||'',plan:[],messages:[{role:'user',content:prompt}],
 events:[],leads:[],observations:[],searches:0,pages:0,steps:0,question:'',summary:'',error:'',phase:'research',model:'',browser:false};
}

export function restoreCampaign(c:Campaign):Campaign{if(c.schemaVersion!==2){c.archivedLeads=c.leads;c.leads=[];c.schemaVersion=2;c.autoDraft=true;c.rejected=[];c.pendingCandidate=undefined;c.status='paused';c.messages.push({role:'assistant',content:'This earlier research is preserved. Its previous leads need the stronger location and website checks before joining the verified shortlist. Resume to recheck the request.'});c.plan=[];}return c;}
