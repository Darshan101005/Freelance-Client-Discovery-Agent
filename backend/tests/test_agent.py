import json,sqlite3
from pathlib import Path
import pytest
from langgraph.checkpoint.sqlite import SqliteSaver
from backend.agent import new_campaign,build_graph,advance
from backend.evidence import qualify,phone_key,requested_mode
CASES=json.loads((Path(__file__).parents[2]/'tests/evidence-cases.json').read_text())
@pytest.mark.parametrize('f',CASES,ids=[f['name'] for f in CASES])
def test_evidence_contract(f):
    lead,reason=qualify(f['c'],f['p'],f['docs'],f['queries']);assert bool(lead)==f['accepted'],reason
    if lead:
        assert lead['phone']=='+91 6369222709';assert lead['rating']==4.4;assert lead['reviewCount']==23;assert lead['email']==''
        assert all(x['value'] and x['sourceUrl'] for x in lead['facts'])
        assert not any('example-point' in s for s in lead['sources'])
        assert not any('directorybrand' in f['value'] for f in lead['facts'])
class FakeTools:
    model='test-model'
    def __init__(self,responses):self.responses=iter(responses)
    def gemini(self,_):return next(self.responses)
    def capability(self):return {'browserReason':'Test runtime','selenium':False}
def test_interrupt_survives_restart(tmp_path):
    path=str(tmp_path/'graph.sqlite')
    with SqliteSaver.from_conn_string(path) as saver:
        graph=build_graph(FakeTools([{'category':'Tea shops','question':'Which city?'}]),saver)
        c=advance(graph,new_campaign('Find tea shops'));assert c['status']=='needs_input'
        assert graph.get_state({'configurable':{'thread_id':c['id']}}).next==('human_gate',)
    with SqliteSaver.from_conn_string(path) as saver:
        graph=build_graph(FakeTools([]),saver);c['status']='planning';c['messages'].append({'role':'user','content':'Chennai'})
        resumed=advance(graph,c,resume=True);assert resumed['messages'][-1]['content']=='Chennai'
        assert not graph.get_state({'configurable':{'thread_id':c['id']}}).next

def test_confirmed_lead_drafts_automatically_without_review_gate():
    f=CASES[0];lead,_=qualify(f['c'],f['p'],f['docs'],f['queries']);c=new_campaign('Find 1 paint shop in Porur Chennai');c.update(status='running',target=1,leads=[lead])
    graph=build_graph(FakeTools([{'subject':'A website idea','body':'A personalized draft based on verified facts.'}]),SqliteSaver(sqlite3.connect(':memory:',check_same_thread=False)))
    c=advance(graph,c);assert c['leads'][0]['draft']['body'];assert c['status']=='running'
    c=advance(graph,c);assert c['status']=='complete'

def test_error_retains_lead():
    f=CASES[0];lead,_=qualify(f['c'],f['p'],f['docs'],f['queries']);c=new_campaign('Find paint shops Chennai');c.update(status='running',leads=[lead])
    class Failed(FakeTools):
        def gemini(self,_):raise RuntimeError('Quota reached')
    graph=build_graph(Failed([]),SqliteSaver(sqlite3.connect(':memory:',check_same_thread=False)));c=advance(graph,c)
    assert c['status']=='running';assert c['leads'][0]['draft']['source']=='template'
    assert '[Your name]' in c['leads'][0]['draft']['body']
    c=advance(graph,c)
    assert c['status']=='error';assert len(c['leads'])==1;assert c['error']=='Quota reached'

def test_supervisor_repeat_switches_to_unused_observed_business():
    from copy import deepcopy
    f=deepcopy(CASES[0]);c=new_campaign('Find paint shops in Porur Chennai');c.update(status='running',criteria=f['c']['criteria'],location=f['c']['location'],category=f['c']['category'],rejected=[{'name':'Example Paints','reason':'Already reviewed','time':'now'}])
    first=f['docs'][0];second=first|{'title':'Other Paints','text':first['text'].replace('Example Paints','Other Paints'),'url':'https://www.google.com/maps?cid=456'}
    c['observations']=[{'kind':'places','data':{'documents':[first,second],'results':[]}}]
    graph=build_graph(FakeTools([{'action':'verify','candidate':{'name':'Example Paints'},'message':'Checking candidate'}]),SqliteSaver(sqlite3.connect(':memory:',check_same_thread=False)))
    result=advance(graph,c);assert result['pendingCandidate']['name']=='Other Paints'
    assert any('Repeat candidate blocked' in e['message'] for e in result['events'])
