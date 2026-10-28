"""Local FastAPI service: isolated accounts, encrypted keys, SQLite, durable worker."""
import hashlib,hmac,json,os,re,secrets,sqlite3,time
from pathlib import Path
from threading import RLock,Thread,Event
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI,HTTPException,Request
from fastapi.responses import JSONResponse, Response
from cryptography.fernet import Fernet
from langgraph.checkpoint.sqlite import SqliteSaver
from backend.agent import new_campaign,build_graph,advance,event,restore,progress
from backend.providers import Tools

DATA=Path(os.getenv('CLIENT_HUNTER_DATA',str(Path(__file__).parent/'data')));DATA.mkdir(parents=True,exist_ok=True)
connection=sqlite3.connect(DATA/'campaigns.sqlite',check_same_thread=False);connection.row_factory=sqlite3.Row
connection.execute('PRAGMA journal_mode=WAL');connection.execute('CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,data TEXT NOT NULL)')
for name,kind in [('owner',"TEXT NOT NULL DEFAULT ''"),('revision','INTEGER NOT NULL DEFAULT 0'),('updated','REAL NOT NULL DEFAULT 0')]:
    if name not in {r['name'] for r in connection.execute('PRAGMA table_info(campaigns)')}:connection.execute(f'ALTER TABLE campaigns ADD COLUMN {name} {kind}')
connection.executescript('''CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS settings(owner TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,started REAL NOT NULL);''');connection.commit()
keyfile=DATA/'master.key'
try:
    fd=os.open(keyfile,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'wb') as f:f.write(Fernet.generate_key())
except FileExistsError:pass
cipher=Fernet(keyfile.read_bytes())
checkpoint=SqliteSaver(sqlite3.connect(DATA/'checkpoints.sqlite',check_same_thread=False))
lock=RLock();working=set();stop=Event();tool_cache={}

def save(c,user,revision=None):
    if revision is None:connection.execute('INSERT INTO campaigns(id,data,owner,updated) VALUES(?,?,?,?)',(c['id'],json.dumps(c),user,time.time()))
    else:connection.execute('UPDATE campaigns SET data=?,updated=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?',(json.dumps(c),time.time(),c['id'],user,revision))
    connection.commit()
def keys(user):
    with lock:row=connection.execute('SELECT data FROM settings WHERE owner=?',(user,)).fetchone()
    return json.loads(cipher.decrypt(row['data'].encode())) if row else {}
def worker_step(row):
    identifier=row['id'];user=row['owner'];revision=row['revision'];c=restore(json.loads(row['data']))
    def update(e):
        with lock:
            fresh=connection.execute('SELECT data,revision FROM campaigns WHERE id=?',(identifier,)).fetchone()
            if not fresh or fresh['revision']!=revision:return
            current=json.loads(fresh['data']);current['events']=(current['events']+[e])[-180:]
            connection.execute('UPDATE campaigns SET data=? WHERE id=?',(json.dumps(current),identifier));connection.commit()
    token=progress.set(update)
    try:
        settings=keys(user);cachekey=(user,hashlib.sha256(json.dumps(settings,sort_keys=True).encode()).hexdigest())
        tools=tool_cache.setdefault(cachekey,Tools(settings));graph=build_graph(tools,checkpoint)
        state=graph.get_state({'configurable':{'thread_id':identifier}})
        if 'human_gate' in state.next:c=advance(graph,c,resume=True)
        else:c=advance(graph,c)
        with lock:save(c,user,revision)
    except Exception as exc:
        import traceback; traceback.print_exc()
        c.update(status='error',error=str(exc) or 'The worker could not complete the step. Saved progress is safe.');event(c,'System',c['error'],'error')
        with lock:save(c,user,revision)
    finally:
        progress.reset(token)
        with lock:working.discard(identifier)
def worker_loop():
    # A single tool worker avoids concurrent browser/model use and keeps resource cost bounded.
    with ThreadPoolExecutor(max_workers=1) as pool:
        while not stop.wait(.7):
            with lock:
                if working:continue
                rows=connection.execute('SELECT * FROM campaigns WHERE owner!=\'\' ORDER BY updated ASC').fetchall()
                row=next((r for r in rows if json.loads(r['data']).get('status') in ('planning','running','drafting')),None)
                if row:working.add(row['id']);pool.submit(worker_step,dict(row))
@asynccontextmanager
async def lifespan(app):
    stop.clear();thread=Thread(target=worker_loop,daemon=True);thread.start();yield;stop.set()
GUARDRAILS = [
    r'ignore\s+(all\s+)?(previous|prior)\s+instructions',
    r'disregard\s+(all\s+)?(previous|prior)',
    r'you\s+are\s+now\s+DAN',
    r'jailbreak',
    r'developer\s+mode\s+enabled',
    r'bypass\s+(all\s+)?guardrails',
    r'reveal\s+(your\s+)?(system\s+prompt|master\s+key|passwords|instructions)',
    r'<script\b',
    r'DROP\s+TABLE',
    r'--\s*$',
    r'sudo\s+rm\s+-rf'
]

def check_guardrails(text: str):
    if not text:
        return
    for pattern in GUARDRAILS:
        if re.search(pattern, text, re.IGNORECASE):
            raise HTTPException(400, "Safety guardrail triggered: suspicious or adversarial instruction detected.")

app=FastAPI(title='Client Hunter · Local LangGraph',lifespan=lifespan)
@app.middleware('http')
async def boundary(request,call_next):
    origin=request.headers.get('origin');host=request.headers.get('host','').split(':')[0]
    if host not in ('localhost','127.0.0.1','testserver') or (origin and urlparse(origin).hostname not in ('localhost','127.0.0.1')) or request.headers.get('sec-fetch-site')=='cross-site':return JSONResponse({'error':'Local same-origin requests only.'},403)
    if int(request.headers.get('content-length','0'))>10000000:return JSONResponse({'error':'Request is too large.'},413)
    response=await call_next(request);response.headers['Cache-Control']='no-store';response.headers['X-Content-Type-Options']='nosniff';return response
def user(request,required=True):
    digest=hashlib.sha256(request.cookies.get('ch_session','').encode()).hexdigest()
    with lock:row=connection.execute('SELECT users.id,users.email,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?',(digest,time.time())).fetchone()
    if not row and required:raise HTTPException(401,'Please sign in.')
    return dict(row) if row else None
def limit(key):
    with lock:
        row=connection.execute('SELECT * FROM attempts WHERE key=?',(key,)).fetchone()
        if row and time.time()-row['started']<900:
            if row['count']>=12:raise HTTPException(429,'Too many attempts. Wait 15 minutes.')
            connection.execute('UPDATE attempts SET count=count+1 WHERE key=?',(key,))
        else:connection.execute('INSERT OR REPLACE INTO attempts VALUES(?,?,?)',(key,1,time.time()))
        connection.commit()
def digest(password,salt):return hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
def session_response(account):
    raw=secrets.token_urlsafe(40)
    with lock:connection.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(raw.encode()).hexdigest(),account['id'],time.time()+7*86400));connection.commit()
    response=JSONResponse({'user':{k:account[k] for k in ('id','name','email')}});response.set_cookie('ch_session',raw,httponly=True,samesite='strict',max_age=7*86400,path='/');return response
@app.post('/api/auth/signup')
def signup(request:Request,body:dict):
    limit('signup:'+str(request.client.host));email=str(body.get('email','')).strip().lower();password=str(body.get('password',''));name=str(body.get('name','')).strip()[:80]
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254 or not 8<=len(password)<=256 or not name:raise HTTPException(400,'Enter your name, email, and a password of at least 8 characters.')
    salt=secrets.token_hex(16);account=dict(id=secrets.token_hex(16),email=email,name=name,salt=salt,password=digest(password,salt))
    with lock:
        first=connection.execute('SELECT COUNT(*) FROM users').fetchone()[0]==0
        try:connection.execute('INSERT INTO users VALUES(:id,:email,:name,:salt,:password)',account)
        except sqlite3.IntegrityError:raise HTTPException(400,'An account already uses this email.')
        if first:connection.execute('UPDATE campaigns SET owner=? WHERE owner=\'\'',(account['id'],))
        connection.commit()
    return session_response(account)
@app.post('/api/auth/login')
def login(request:Request,body:dict):
    email=str(body.get('email','')).strip().lower();password=str(body.get('password',''))[:256];limit('login:'+str(request.client.host))
    with lock:row=connection.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
    salt=row['salt'] if row else '00'*16;candidate=digest(password,salt)
    if not row or not hmac.compare_digest(candidate,row['password']):raise HTTPException(401,'Email or password is incorrect.')
    return session_response(dict(row))
@app.post('/api/auth/logout')
def logout(request:Request):
    with lock:connection.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(request.cookies.get('ch_session','').encode()).hexdigest(),));connection.commit()
    response=JSONResponse({'ok':True});response.delete_cookie('ch_session',path='/');return response
@app.get('/api/health')
def health(request:Request):
    account=user(request,False);settings=keys(account['id']) if account else {};cap=Tools.capability();cap.pop('binary',None)
    return dict(authMode='local',user=account,backgroundWorker=True,runtime='Python LangGraph · SQLite',gemini=bool(settings.get('GEMINI_API_KEY') or os.getenv('GEMINI_API_KEY')),serper=bool(settings.get('SERPER_API_KEY') or os.getenv('SERPER_API_KEY')),sender=settings.get('sender',''),**cap)
@app.get('/api/settings')
def settings_get(request:Request):return health(request)
@app.post('/api/settings')
def settings_post(request:Request,body:dict):
    account=user(request);values=keys(account['id'])
    for field,key in [('gemini','GEMINI_API_KEY'),('serper','SERPER_API_KEY')]:
        if body.get(field):values[key]=str(body[field]).strip()[:250]
    if 'sender'in body:values['sender']=str(body['sender'])[:200]
    with lock:connection.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',(account['id'],cipher.encrypt(json.dumps(values).encode()).decode()));connection.commit()
    return {'saved':True}
@app.post('/api/user/profile')
def update_profile(request:Request,body:dict):
    account=user(request);name=str(body.get('name','')).strip()[:80];current_pw=str(body.get('currentPassword',''));new_pw=str(body.get('newPassword',''))
    with lock:
        row=connection.execute('SELECT * FROM users WHERE id=?',(account['id'],)).fetchone()
        if not row:raise HTTPException(404,'User not found.')
        if new_pw:
            if not 8<=len(new_pw)<=256:raise HTTPException(400,'New password must be at least 8 characters.')
            candidate=digest(current_pw,row['salt'])
            if not hmac.compare_digest(candidate,row['password']):raise HTTPException(400,'Current password is incorrect.')
            new_salt=secrets.token_hex(16)
            connection.execute('UPDATE users SET salt=?,password=? WHERE id=?',(new_salt,digest(new_pw,new_salt),account['id']))
        if name and name!=row['name']:
            connection.execute('UPDATE users SET name=? WHERE id=?',(name,account['id']))
        connection.commit()
        updated_row=connection.execute('SELECT id,email,name FROM users WHERE id=?',(account['id'],)).fetchone()
        return {'saved':True,'user':dict(updated_row)}
@app.get('/api/domain-info')
def domain_info(domain:str):
    if not domain:raise HTTPException(400,'Domain required.')
    return Tools.whois_lookup(domain)
@app.get('/api/screenshot')
def screenshot_endpoint(url:str):
    if not url or not url.startswith('http'):
        raise HTTPException(400,'Valid HTTP(S) URL required.')
    data=Tools.capture_screenshot(url)
    if not data:
        raise HTTPException(404,'Could not capture screenshot.')
    return Response(content=data,media_type='image/png')
@app.get('/api/campaigns')
def campaigns(request:Request):
    account=user(request)
    with lock:return [restore(json.loads(r['data'])) for r in connection.execute('SELECT data FROM campaigns WHERE owner=? ORDER BY updated DESC LIMIT 100',(account['id'],))]
@app.post('/api/campaigns')
def create(request:Request,body:dict):
    account=user(request);prompt=str(body.get('prompt') or '').strip()
    check_guardrails(prompt)
    if not 8<=len(prompt)<=4000:raise HTTPException(400,'Describe the business and location in 8–4,000 characters.')
    c=new_campaign(prompt,str(body.get('service') or 'Website design')[:1000],str(body.get('sender') or keys(account['id']).get('sender') or '')[:200])
    with lock:save(c,account['id'])
    return c
@app.post('/api/action')
def action(request:Request,body:dict):
    account=user(request)
    with lock:
        row=connection.execute('SELECT * FROM campaigns WHERE id=? AND owner=?',(str(body.get('id')),account['id'])).fetchone()
        if not row:raise HTTPException(404,'Chat not found.')
        c=restore(json.loads(row['data']));a=body.get('action')
        if a=='step':return c # The durable server worker owns execution, independent of browser navigation.
        if a=='delete':
            connection.execute('DELETE FROM campaigns WHERE id=? AND owner=?',(c['id'],account['id']))
            try:
                checkpoint.conn.execute('DELETE FROM checkpoints WHERE thread_id=?',(c['id'],))
                checkpoint.conn.execute('DELETE FROM checkpoint_writes WHERE thread_id=?',(c['id'],))
                checkpoint.conn.commit()
            except Exception:
                pass
            connection.commit()
            return {'deleted':True,'id':c['id']}
        if a=='pause':c['status']='paused';event(c,'You','Research paused. Progress saved.')
        elif a=='resume':c.update(error='',status='running' if c['plan'] else 'planning')
        elif a=='reject_lead':
            lead=next((l for l in c['leads'] if l['id']==body.get('leadId')),None)
            if not lead:raise HTTPException(404,'Lead not found.')
            lead['rejected']=not lead.get('rejected',False)
            event(c,'You',f"{'Excluded' if lead['rejected'] else 'Restored'} {lead['name']}.")
        elif a=='reply':
            reply=str(body.get('message') or '').strip()[:3000]
            image=body.get('image')
            image_type=body.get('imageType')
            if not reply and not image:raise HTTPException(400,'Enter a reply or attach an image.')
            check_guardrails(reply)
            msg_obj={'role':'user','content':reply or 'Sent an image attachment.'}
            if image and image_type:
                msg_obj['image']=image
                msg_obj['imageType']=image_type
            c['messages'].append(msg_obj)
            c.update(question='',error='',pendingCandidate=None)
            try:
                settings=keys(account['id'])
                cachekey=(account['id'],hashlib.sha256(json.dumps(settings,sort_keys=True).encode()).hexdigest())
                tools=tool_cache.setdefault(cachekey,Tools(settings))
                leads_info=[{'name':l['name'],'area':l.get('area'),'address':l.get('address'),'phone':l.get('phone'),'website':l.get('website'),'rating':l.get('rating'),'status':l.get('websiteStatus'),'facts':l.get('facts',[])} for l in c.get('leads',[]) if not l.get('rejected')]
                
                parse_prompt=(
                    "You are the Client Hunter AI assistant. Analyze the user's latest message in this ongoing conversation.\n"
                    f"Context: Category: {c.get('category')}, Location: {c.get('location')}\n"
                    f"Leads found: {json.dumps(leads_info)}\n"
                    f"Recent conversation: {json.dumps(c.get('messages',[])[-4:])}\n"
                    f"User latest message: {reply}\n\n"
                    "Determine:\n"
                    "1. If the user explicitly asks to find MORE/NEW business leads (e.g. 'find 2 more', 'find another shop', 'search plumbers'): set type='more_leads', additionalTarget: number (default 1), message: string.\n"
                    "2. If the user asks a question about a business, location, years in business, owner, products, or says 'search on google' / 'find it': set type='search_qa', searchQuery: string (targeted search query for Google/DDG).\n"
                    "3. Otherwise (general question, chat, or answering from existing known details or inspecting attached image): set type='chat_qa', answer: string (clear markdown answer).\n"
                    "Return JSON: {type: 'more_leads' | 'search_qa' | 'chat_qa', additionalTarget?: number, searchQuery?: string, answer?: string, message?: string}"
                )
                parsed=tools.gemini(parse_prompt, image_data=image, image_mime=image_type)
                if isinstance(parsed,list) and parsed: parsed=parsed[0]
                elif not isinstance(parsed,dict): parsed={}
                
                req_type=parsed.get('type','chat_qa')
                if req_type=='search_qa':
                    lead_name=c['leads'][0]['name'] if c.get('leads') else ''
                    sq=parsed.get('searchQuery') or f"{lead_name} {c.get('location','')} {reply}"
                    event(c,'Assistant',f'Searching web for: {sq}')
                    try:
                        s_res=tools.search(sq)
                        snippets=[r.get('title','')+' - '+r.get('snippet','') for r in s_res.get('results',[])[:6]]
                    except Exception:
                        snippets=[]
                    qa_prompt=(
                        "Answer the user's question directly, accurately, and conversationally using these search results.\n"
                        f"User asked: {reply}\n"
                        f"Search results: {json.dumps(snippets)}\n"
                        f"Business details: {json.dumps(leads_info)}\n"
                        "Provide a direct markdown answer. If the year/duration or fact is mentioned in the snippets (e.g. from Justdial, IndiaMART, Sulekha, or official records), state it clearly with the source. If not exact, give the closest verified information."
                    )
                    ans_data=tools.gemini(qa_prompt)
                    ans_text=ans_data.get('answer') or ans_data.get('reply') or ans_data.get('message') if isinstance(ans_data,dict) else str(ans_data)
                    c['messages'].append({'role':'assistant','content':str(ans_text or 'I checked online records for you.')})
                    event(c,'Assistant','Answered your question.','success')
                elif req_type=='more_leads':
                    add_t=parsed.get('additionalTarget') or 1
                    msg=parsed.get('message') or f"Searching for additional {c.get('category','business')} in {c.get('location','')}..."
                    c['messages'].append({'role':'assistant','content':msg})
                    c.update(target=min(30,c.get('target',1)+add_t),status='running' if c.get('plan') else 'planning',phase='research',stalledTurns=0)
                    event(c,'Supervisor','Continuing research for additional leads...')
                else:
                    ans=parsed.get('answer') or parsed.get('reply')
                    if not ans:
                        gen_prompt=f"Answer the user conversationally.\nContext: {json.dumps(leads_info)}\nConversation: {json.dumps(c.get('messages',[])[-4:])}\nUser: {reply}\nReturn JSON: {{answer: string}}"
                        ans_obj=tools.gemini(gen_prompt, image_data=image, image_mime=image_type)
                        ans=ans_obj.get('answer') or ans_obj.get('reply') or ans_obj.get('message') if isinstance(ans_obj,dict) else "I have reviewed your message."
                    c['messages'].append({'role':'assistant','content':str(ans)})
                    event(c,'Assistant','Answered your question.')
            except Exception as exc:
                import traceback; traceback.print_exc()
                c['messages'].append({'role':'assistant','content':'I have received your message. Please let me know what specific details you would like to know.'})
        elif a=='drafts':c.update(phase='research',status='running',error='')
        elif a=='lead':
            lead=next((l for l in c['leads'] if l['id']==body.get('leadId')),None)
            if not lead:raise HTTPException(404,'Lead not found.')
            if isinstance(body.get('draft'),dict):lead['draft']={k:str(body['draft'].get(k) or '')[:200 if k=='subject' else 5000] for k in ('subject','body')}
        elif a=='extend':c.update(status='running',steps=0,searches=0,pages=0,error='',target=min(30,c['target']+5))
        else:raise HTTPException(400,'Unknown action.')
        save(c,account['id'],row['revision']);return c
