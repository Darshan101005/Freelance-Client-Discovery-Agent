"""Deterministic qualification and fact provenance. Model claims alone never suffice."""
import re, uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

def now(): return datetime.now(timezone.utc).isoformat()
def norm(v): return re.sub('[^a-z0-9]','',str(v or '').lower())
def name_matches(name,text):
    key=norm(name);return len(key)>=3 and key in norm(text)
def geography(cr,text): return bool(cr.get('locationTerms')) and all(norm(t) in norm(text) for t in cr['locationTerms'])
def phone_key(value,country='in'):
    d=re.sub(r'\D','',str(value or ''))
    if country=='in':
        if len(d)==12 and d.startswith('91'): d=d[2:]
        if len(d)==11 and d.startswith('0'): d=d[1:]
        return d if len(d)==10 and d[0]!='0' else ''
    return d if 7<=len(d)<=15 else ''
def phones(text,country='in'): return list(dict.fromkeys(p for v in re.findall(r'(?:\+?\d[\d ().-]{7,}\d)',text or '') if (p:=phone_key(v,country))))
def same_site(a,b): return bool(a and b) and (urlparse(a).hostname or '').removeprefix('www.')==(urlparse(b).hostname or '').removeprefix('www.')
def listing(url):
    p=urlparse(url);h=(p.hostname or '').lower().removeprefix('www.')
    if not h: return True
    domains=('justdial.com','indiamart.com','instagram.com','facebook.com','linkedin.com','youtube.com','zomato.com','swiggy.com','magicpin.in','sulekha.com','yelp.com','dnb.com','infobel.in','infobel.com','tradeindia.com','zaubacorp.com','yellowpages.in','yellowpages.com','bizdunia.com','asklaila.com','indiabizlist.com','bharatibiz.com','cylex-india.com','finndit.com','quikr.com','olx.in','indiatrade.com','zoominfo.com','owler.com','crunchbase.com','kompass.com','bloomberg.com','wikipedia.org','twitter.com','x.com','threads.net','pinterest.com','tripadvisor.com','google.com','google.co.in','locanto.net','exportersindia.com','topranker4u.com','dialme24.com','vyaparapp.in','indiacatalog.com','citylocalpro.com','jdmagicbox.com','mapsofindia.com','indiacom.com')
    if any(h==d or h.endswith('.'+d) for d in domains): return True
    if any(k in p.path.lower() for k in ('/business-directory/','/company-profile','/profile/','/listing/','/dealer/','/store-locator/','/locator/','/store/','/company/','/b2b/','/catalog/')): return True
    return bool(re.search(r'google\.[a-z.]+$',h) and re.match(r'/(maps|search)',p.path)) or bool(re.search('dealer|store-locator|storelocator|/locator/',p.path,re.I))
def requested_mode(prompt,fallback='missing'):
    if re.search(r'(no|without|doesn.?t have|don.?t have|do not have|not have|lack\w*)\s+(an?\s+)?(official\s+)?web\s?sites?|websites?\s+(not found|missing)',prompt,re.I): return 'missing'
    if re.search(r'outdated|not modern|old website|poor website|redesign|already (have|has).*website|existing website',prompt,re.I): return 'outdated'
    return fallback

def geography(cr,text):
    t_norm=norm(text)
    if not t_norm: return False
    terms=cr.get('locationTerms',[])
    if terms and any(norm(t) in t_norm for t in terms): return True
    loc=norm(cr.get('locality','')); city=norm(cr.get('city',''))
    return bool((loc and loc in t_norm) or (city and city in t_norm))

def source_docs(c):
    docs=[]
    for o in c['observations']:
        if o['kind'] in ('search','places'):
            docs.extend(o['data'].get('documents') or [dict(url=r['url'],title=r.get('title',''),text=r.get('snippet',''),kind='search') for r in o['data'].get('results',[])])
        elif o['kind']=='page': docs.append(o['data']|dict(url=o['url'],kind='page'))
    return docs

def qualify(c,p,docs,queries):
    cr=c.get('criteria') or {};name=str(p.get('name') or '').strip()
    if not name: return None,'Business name could not be identified.'
    identity=[d for d in docs if (name_matches(name,d.get('title','')) or name_matches(name,d.get('text','')) or name_matches(d.get('title',''),name))]
    if not identity: return None,'Exact local business identity could not be established.'
    anchor=next((d for d in identity if d.get('kind')=='place'),{})
    address=anchor.get('address') or p.get('address') or ''
    if not address:
        for d in identity:
            if d.get('address'): address=d['address']; break
            if cr.get('locality') and norm(cr['locality']) in norm(d.get('text','')):
                address=f"{cr.get('locality')}, {cr.get('city','')}".strip(', ')
                break
    if not address and cr.get('location'): address=cr['location']

    cat_words=[w for w in re.split(r'\s+',cr.get('category','').lower()) if len(w)>=3]
    cat_match=p.get('categoryMatch') is True or any(w in name.lower() for w in cat_words) or any(any(w in d.get('title','').lower() or w in d.get('text','').lower() for w in cat_words) for d in identity)
    if not cat_match and cat_words: return None,'The business category is not supported by the sources.'

    country=cr.get('countryCode','in')
    numbers=list(dict.fromkeys(n for d in identity for n in [phone_key(d.get('phone'),country)]+phones(d.get('text',''),country) if n))
    wanted=phone_key(p.get('phone'),country)
    number=phone_key(anchor.get('phone'),country) or (wanted if wanted in numbers else numbers[0] if numbers else '')

    pages=[d for d in docs if d['kind']=='page' and d.get('status')==200 and not listing(d['url'])]
    site_candidate = anchor.get('website') or p.get('website') or ''
    if listing(site_candidate): site_candidate = ''
    website = site_candidate or (pages[0]['url'] if pages else '')
    if listing(website): website = ''

    if cr.get('websiteMode')=='missing':
        if website: return None,f'An official website exists ({website}); excluded from no-website leads.'
    page=next((d for d in pages if same_site(d['url'],website)),{});issues=page.get('issues',[])
    if cr.get('websiteMode')=='outdated' and not (website and page and issues): return None,'A matched, inspected official website with observed improvement signals is required.'
    if any(norm(l['name'])==norm(name) or (number and phone_key(l['phone'],country)==number) for l in c.get('leads',[])): return None,'Business or contact is already saved in this chat.'

    facts=[]
    def add(key,label,value,kind,doc):
        if value is not None and str(value).strip() and doc.get('url'): facts.append(dict(key=key,label=label,value=str(value),kind=kind,sourceUrl=doc['url']))
    best=anchor or (identity[0] if identity else {})
    add('address','Address',address or c.get('location',''),'text',best)
    phone=('+91 '+number if country=='in' else number) if number else ''
    pdoc=next((d for d in identity if number and (phone_key(d.get('phone'),country)==number or number in phones(d.get('text',''),country))),best)
    add('phone','Phone',phone,'phone',pdoc)
    relevant=identity+pages;email=''
    for d in relevant:
        emails=re.findall(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}',d.get('text',''))
        if d not in pages:
            emails=[e for e in emails if not (urlparse(d['url']).hostname or '').endswith(e.split('@')[1]) and name_matches(name,d.get('text','')[max(0,d.get('text','').find(e)-250):d.get('text','').find(e)+250])]
        if emails: email=p.get('email') if p.get('email') in emails else emails[0];add('email','Email',email,'email',d);break
    rating=anchor.get('rating');rating=rating if isinstance(rating,(float,int)) and 0<=rating<=5 else None
    reviews=anchor.get('reviews') or anchor.get('reviewCount') or anchor.get('user_ratings_total')
    reviews=int(reviews) if isinstance(reviews,(int,float)) and reviews>=0 else None
    if rating is not None: add('rating','Google rating',f'{rating} / 5'+(f' · {reviews} reviews' if reviews is not None else ''),'rating',anchor)
    hours = anchor.get('hours')
    hours_summary = ''
    if hours:
        if isinstance(hours, dict):
            days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            ordered = [(d, hours[d]) for d in days_order if d in hours]
            for k, v in hours.items():
                if k not in days_order:
                    ordered.append((k, v))
            hours_summary = '\n'.join(f"{d}: {t}" for d, t in ordered) if ordered else '\n'.join(f"{k}: {v}" for k, v in hours.items())
        elif isinstance(hours, list):
            hours_summary = '\n'.join(str(x) for x in hours)
        elif isinstance(hours, str):
            hours_summary = hours
        if hours_summary:
            add('hours', 'Opening hours', hours_summary, 'text', anchor)
    seen=set()
    for d in relevant:
        for u in [d['url']]+[l['url'] for l in d.get('links',[]) if d in pages or name_matches(name,l.get('text','')+' '+l['url']) or (number and number in re.sub(r'\D','',l['url']))]:
            parsed=urlparse(u);h=parsed.hostname or '';label=''
            if parsed.scheme not in ('http','https'): continue
            if h in ('wa.me','api.whatsapp.com'): label='WhatsApp'
            elif h=='instagram.com' or h.endswith('.instagram.com'): label='Instagram'
            elif h=='facebook.com' or h.endswith('.facebook.com'): label='Facebook'
            elif h=='linkedin.com' or h.endswith('.linkedin.com'): label='LinkedIn'
            elif 'google.' in h and '/maps' in parsed.path: label='Google Maps'
            if label and label not in seen: seen.add(label);add(label.lower().replace(' ','-'),label,u,'link',d)
    if website: add('website','Official website',website,'link',anchor if anchor.get('website') else page)
    evidence=f'No official website was found for this business. Local directory listings (Sulekha, Indiamart, Infobel, etc.) exist but no dedicated domain.' if cr.get('websiteMode')=='missing' else 'The official website was matched to this local business and inspected.'
    score=min(100,50+(15 if phone or email else 0)+(15 if address else 0)+(20 if cr.get('websiteMode')=='missing' else min(20,len(issues)*5)))
    return dict(id=str(uuid.uuid4()),name=name,category=c.get('category','Local business'),area=c.get('location',''),address=address,phone=phone,email=email,website=website,websiteStatus='Website found' if website else 'No site found',score=score,reason='A dedicated website could help customers find and contact this business directly.' if cr.get('websiteMode')=='missing' else ' '.join(issues),sources=list(dict.fromkeys(d['url'] for d in relevant if d.get('url'))),evidence=evidence,rating=rating,reviewCount=reviews,hours=hours,hoursSummary=hours_summary,ratingSource=anchor.get('url','') if rating is not None else '',checkedAt=now(),audit=page.get('audit',{}),facts=facts,issues=issues,draft={'subject':'','body':''},selected=True,verification={'accepted':True,'mode':cr.get('websiteMode','missing'),'checks':['Business identity matched','Requested location matched','Online directories checked']+(['Website inspected'] if page else ['No official website found']),'checkedAt':now()}),None
