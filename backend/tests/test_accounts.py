import importlib,sys
from fastapi.testclient import TestClient

def test_accounts_isolate_chats_and_encrypt_keys(tmp_path,monkeypatch):
    monkeypatch.setenv('CLIENT_HUNTER_DATA',str(tmp_path));sys.modules.pop('backend.server',None);server=importlib.import_module('backend.server')
    # No lifespan context: intentionally no worker/API calls in this auth test.
    a=TestClient(server.app);b=TestClient(server.app)
    assert a.get('/api/campaigns').status_code==401
    assert a.post('/api/auth/signup',json={'email':'a@example.test','password':'correct-test-password','name':'A'}).status_code==200
    created=a.post('/api/campaigns',json={'prompt':'Find 2 paint shops in Porur Chennai'}).json()
    assert b.post('/api/auth/signup',json={'email':'b@example.test','password':'different-test-password','name':'B'}).status_code==200
    assert b.get('/api/campaigns').json()==[]
    assert b.post('/api/action',json={'id':created['id'],'action':'pause'}).status_code==404
    assert a.post('/api/settings',json={'gemini':'fake-secret-for-unit-test','sender':'A'}).status_code==200
    assert 'fake-secret-for-unit-test' not in a.get('/api/settings').text
    assert 'fake-secret-for-unit-test' not in server.connection.execute('SELECT data FROM settings').fetchone()['data']
    assert server.keys(a.get('/api/health').json()['user']['id'])['GEMINI_API_KEY']=='fake-secret-for-unit-test'
    assert a.post('/api/action',json={'id':created['id'],'action':'pause'}).status_code==200
    a.post('/api/auth/logout',json={});assert a.get('/api/campaigns').status_code==401
    assert a.post('/api/auth/login',json={'email':'a@example.test','password':'wrong-password'}).status_code==401
    assert a.post('/api/auth/login',json={'email':'a@example.test','password':'correct-test-password'}).status_code==200
    assert a.get('/api/campaigns').json()[0]['status']=='paused'
    assert a.post('/api/action',json={'id':created['id'],'action':'resume'},headers={'origin':'https://evil.example'}).status_code==403

def test_server_worker_advances_without_browser_step_requests(tmp_path,monkeypatch):
    import time
    monkeypatch.setenv('CLIENT_HUNTER_DATA',str(tmp_path));sys.modules.pop('backend.server',None);server=importlib.import_module('backend.server')
    monkeypatch.setattr(server.Tools,'gemini',lambda self,prompt:{'category':'paint shops','question':'Which city?','plan':[]})
    with TestClient(server.app) as client:
        client.post('/api/auth/signup',json={'email':'worker@example.test','password':'test-worker-password','name':'Worker test'})
        c=client.post('/api/campaigns',json={'prompt':'Find some paint shops'}).json()
        # No /api/action or browser tab activity is needed for execution.
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            rows=client.get('/api/campaigns').json();state=next(x for x in rows if x['id']==c['id'])
            if state['status']=='needs_input':break
            time.sleep(.1)
        assert state['status']=='needs_input'
        assert state['question']=='Which city?'
        assert state['events']
