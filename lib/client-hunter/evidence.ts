import type {Campaign,Criteria,EvidenceDoc,Fact,Lead} from './types';
export const normalize=(v:any)=>String(v||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
export function canonical(value:string){try{const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|srsltid$|gclid$|fbclid$)/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return '';}}
export function sameSite(a:string,b:string){try{return new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'')}catch{return false}}
export function requestedMode(prompt:string,fallback:Criteria['websiteMode']='missing'):Criteria['websiteMode']{
 if(/(?:no|without|doesn.?t have|don.?t have|do not have|not have|lack\w*)\s+(?:an?\s+)?(?:official\s+)?web\s?sites?|website(?:s)?\s+(?:not found|missing)/i.test(prompt))return 'missing';
 if(/outdated|not modern|old website|poor website|redesign|already (?:have|has).*website|existing website/i.test(prompt))return 'outdated';
 return fallback;
}
export function isListing(url:string){try{const u=new URL(url);return /(^|\.)(justdial\.com|indiamart\.com|instagram\.com|facebook\.com|linkedin\.com|youtube\.com|zomato\.com|swiggy\.com|magicpin\.in|sulekha\.com|yelp\.com|tripadvisor\.[a-z.]+|yellowpages\.[a-z.]+|maps\.google\.[a-z.]+)$/.test(u.hostname)||/google\.[a-z.]+$/.test(u.hostname)&&/^\/(maps|search)/.test(u.pathname)||/dealer|store-locator|storelocator|\/locator\//i.test(u.pathname)}catch{return true}}
export function nameMatches(name:string,text:string){const key=normalize(name);return key.length>=3&&normalize(text).includes(key);}
export function geographyMatches(criteria:Criteria,text:string){return criteria.locationTerms.length>0&&criteria.locationTerms.every(t=>normalize(text).includes(normalize(t)));}
export function phoneKey(value:string,country='in'){let d=String(value||'').replace(/\D/g,'');if(country==='in'){if(d.length===12&&d.startsWith('91'))d=d.slice(2);if(d.length===11&&d.startsWith('0'))d=d.slice(1);return /^[6-9]\d{9}$/.test(d)||/^[1-5]\d{9}$/.test(d)?d:'';}return d.length>=7&&d.length<=15?d:'';}
export function phones(text:string,country='in'){const values=String(text||'').match(/(?:\+?\d[\d ().-]{7,}\d)/g)||[];return [...new Set(values.map(v=>phoneKey(v,country)).filter(Boolean))];}
export function sourceDocs(c:Campaign):EvidenceDoc[]{return c.observations.flatMap(o=>o.kind==='search'||o.kind==='places'?(o.data.documents||o.data.results?.map((r:any)=>({url:r.url,title:r.title,text:r.snippet||'',kind:'search'}))||[]):o.kind==='page'?[{...o.data,url:o.url,kind:'page',title:o.data.title||''}]:[]);}
export function qualify(c:Campaign,p:any,docs:EvidenceDoc[],successfulQueries:string[]):{lead?:Lead;reason?:string}{
 const cr=c.criteria!;const name=String(p.name||c.pendingCandidate?.name||'').trim();
 if(!name||!cr?.locationTerms?.length)return {reason:'Business identity or requested location is missing.'};
 const identity=docs.filter(d=>nameMatches(name,d.title||'')&&geographyMatches(cr,d.address||d.text));
 const anchor=identity.find(d=>d.kind==='place');
 const address=anchor?.address||String(p.address||'');
 const addressEvidence=identity.find(d=>address&&normalize(d.text+' '+(d.address||'')).includes(normalize(address))&&geographyMatches(cr,address));
 if(!identity.length||(!anchor&&!addressEvidence))return {reason:'The exact business address could not be matched to every requested location. A matching name alone is insufficient.'};
 if(p.categoryMatch!==true||!p.categoryQuote||!identity.some(d=>normalize(d.text+' '+d.title).includes(normalize(p.categoryQuote))))return {reason:'The requested business category is not supported by a matching source quote.'};
 const phoneSet=[...new Set(identity.flatMap(d=>[phoneKey(d.phone||'',cr.countryCode),...phones(d.text,cr.countryCode)]).filter(Boolean))];
 const wantedPhone=phoneKey(String(p.phone||''),cr.countryCode);const mainPhone=phoneKey(anchor?.phone||'',cr.countryCode)||(wantedPhone&&phoneSet.includes(wantedPhone)?wantedPhone:phoneSet.length===1?phoneSet[0]:'');
 const linkedPages=docs.filter(d=>d.kind==='page'&&d.status===200&&!isListing(d.url)&&((anchor?.website&&sameSite(d.url,anchor.website))||(nameMatches(name,d.title+' '+d.text)&&geographyMatches(cr,d.text))||(mainPhone&&phones(d.text,cr.countryCode).includes(mainPhone))));
 const siteFromPlace=anchor?.website&&!isListing(anchor.website)?anchor.website:'';
 const official=siteFromPlace||linkedPages[0]?.url||'';
 const claimedSite=String(p.website||'');
 const unresolved=!official&&((claimedSite&&!isListing(claimedSite))||docs.some(d=>d.kind==='search'&&!isListing(d.url)&&nameMatches(name,d.title)));
 const dedicated=successfulQueries.filter(q=>nameMatches(name,q)&&geographyMatches(cr,q));
 const independent=new Set(identity.map(d=>{try{return new URL(d.url).hostname.replace(/^www\./,'')}catch{return d.url}}));
 if(cr.websiteMode==='missing'&&(official||unresolved))return {reason:official?'An official website was found. Excluded because this chat requires no website found.':'A possible website remains unresolved. Excluded rather than treating uncertainty as website absence.'};
 if(cr.websiteMode==='missing'&&(new Set(dedicated).size<2||(!anchor&&independent.size<2)))return {reason:'A no-website finding needs two successful business-and-location searches plus corroborating local identity sources.'};
 if(cr.websiteMode==='outdated'&&!official)return {reason:'This chat requires an existing website; no website could be linked to the local business.'};
 const audited=linkedPages.find(d=>sameSite(d.url,official));const issues=audited?.issues||[];
 if(cr.websiteMode==='outdated'&&(!audited||!issues.length))return {reason:!audited?'The business website could not be inspected, so a redesign opportunity is not verified.':'The inspected page has no supported improvement signals. It is not accepted as an outdated website.'};
 if(c.leads.some(l=>normalize(l.name)===normalize(name)||(mainPhone&&phoneKey(l.phone,cr.countryCode)===mainPhone)))return {reason:'This business or contact is already in this chat.'};
 const facts:Fact[]=[];const add=(key:string,label:string,value:any,kind:Fact['kind'],doc?:EvidenceDoc)=>{if(value!==undefined&&value!==null&&String(value).trim()&&doc?.url)facts.push({key,label,value:String(value),kind,sourceUrl:doc.url})};
 const best=anchor||addressEvidence||identity[0];add('address','Address',address,'text',best);
 const pdoc=identity.find(d=>phoneKey(d.phone||'',cr.countryCode)===mainPhone||phones(d.text,cr.countryCode).includes(mainPhone));
 const phone=mainPhone?(cr.countryCode==='in'?'+91 '+mainPhone:mainPhone):'';add('phone','Phone',phone,'phone',pdoc);
 const relevant=[...identity,...linkedPages];let email='';for(const d of relevant){const emails=[d.email||'',...(d.text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)||[])].filter(Boolean).filter(e=>{if(linkedPages.includes(d))return true;try{if(new URL(d.url).hostname.endsWith(e.split('@')[1]))return false;}catch{}const at=d.text.indexOf(e);return at>=0&&nameMatches(name,d.text.slice(Math.max(0,at-250),at+250));});if(emails.length){email=emails.includes(p.email)?p.email:emails[0];add('email','Email',email,'email',d);break;}}
 let rating:number|null=null,reviewCount:number|null=null,ratingSource='';if(anchor&&typeof anchor.rating==='number'&&anchor.rating>=0&&anchor.rating<=5){rating=anchor.rating;reviewCount=anchor.reviewCount??null;ratingSource=anchor.url;add('rating',anchor.provider==='Google Maps'?'Google rating':'Listing rating',`${rating} / 5${reviewCount!==null?' · '+reviewCount+' reviews':''}`,'rating',anchor);}
 const urls=new Map<string,EvidenceDoc>();for(const d of relevant){urls.set(d.url,d);for(const l of d.links||[]){if(linkedPages.includes(d)||nameMatches(name,l.text+' '+l.url)||(mainPhone&&l.url.replace(/\D/g,'').includes(mainPhone)))urls.set(l.url,d);}}
 const seen=new Set<string>();for(const [url,d]of urls){let u:URL;try{u=new URL(url)}catch{continue}if(!/^https?:$/.test(u.protocol))continue;let label='';if(/wa\.me|api\.whatsapp\.com|whatsapp\.com\/send/.test(u.hostname+u.pathname))label='WhatsApp';else if(/(^|\.)instagram\.com$/.test(u.hostname)&&u.pathname!=='/')label='Instagram';else if(/(^|\.)facebook\.com$/.test(u.hostname)&&u.pathname!=='/')label='Facebook';else if(/(^|\.)linkedin\.com$/.test(u.hostname)&&/company|in\//.test(u.pathname))label='LinkedIn';else if(/google\.[a-z.]+$/.test(u.hostname)&&u.pathname.includes('maps'))label='Google Maps';if(label&&!seen.has(label)){seen.add(label);add(label.toLowerCase().replace(' ','-'),label,url,'link',d);}}
 if(official)add('website','Official website',official,'link',anchor?.website?anchor:audited);
 const checks=['Business identity matched','Requested location matched',cr.websiteMode==='missing'?'Two dedicated website searches completed':'Official website linked to this business',...(audited?['Website page inspected']:[])];
 const status=official?'Website found':'No site found';const evidence=cr.websiteMode==='missing'?`No official website was identified in ${dedicated.length} successful searches for this business and location. This is not proof that a website does not exist.`:String(p.evidence||'The business and website were matched using the cited local sources.');
 const score=Math.min(100,40+(phone||email?15:0)+(anchor?15:0)+(audited?15:0)+(cr.websiteMode==='missing'?15:Math.min(15,issues.length*5)));
 return {lead:{id:crypto.randomUUID(),name,category:c.category,area:[cr.locality,cr.city].filter(Boolean).join(', '),address,phone,email,website:official,websiteStatus:status,score,reason:cr.websiteMode==='missing'?'A dedicated website could give customers a place to find this business and contact it.':issues.length?issues.join(' '):String(p.reason||'Verified local business.'),sources:[...new Set(relevant.map(d=>d.url))],evidence,rating,reviewCount,ratingSource,checkedAt:new Date().toISOString(),audit:audited?.audit||{},facts,issues,draft:{subject:'',body:''},selected:true,verification:{accepted:true,mode:cr.websiteMode,checks,checkedAt:new Date().toISOString()}}};
}
