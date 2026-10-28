import json
from copy import deepcopy
from pathlib import Path
base=dict(c={'id':'test','criteria':{'websiteMode':'missing','city':'Chennai','locality':'Porur','countryCode':'in','category':'paint shops','locationTerms':['Porur','Chennai']},'category':'paint shops','location':'Porur, Chennai','leads':[]},p={'name':'Example Paints','address':'22 Arcot Road, Porur, Chennai','phone':'6369222709','email':'invented@example.test','website':'','categoryMatch':True,'categoryQuote':'paint shop'},docs=[{'kind':'place','url':'https://www.google.com/maps?cid=123','title':'Example Paints','text':'Example Paints · paint shop · 22 Arcot Road, Porur, Chennai · +91 63692 22709','address':'22 Arcot Road, Porur, Chennai','phone':'+91 63692 22709','rating':4.4,'reviewCount':23,'provider':'Google Maps'}],queries=['Example Paints Porur Chennai official website contact','Example Paints Porur Chennai business website address phone'])
cases=[]
def add(name,accepted,mutate=lambda x:None):
    f=deepcopy(base);mutate(f);cases.append(dict(name=name,accepted=accepted,**f))
add('normalizes +91 phone and keeps sourced Google rating',True)
add('cannot call a known website absent',False,lambda f:f['docs'][0].update(website='https://example-paints.test/'))
add('one search cannot prove a no-site finding',False,lambda f:f.update(queries=f['queries'][:1]))
add('wrong city cannot qualify',False,lambda f:f['docs'][0].update(address='Porur, Austin, USA',text='Example Paints paint shop Porur Austin USA'))
add('wrong neighbourhood cannot qualify',False,lambda f:f['docs'][0].update(address='Anna Nagar, Chennai',text='Example Paints paint shop Anna Nagar Chennai'))
add('unresolved possible website rejected',False,lambda f:f['p'].update(website='https://example-paints.test/',websiteRelationship='unresolved'))
add('category must have a source quote',False,lambda f:f['p'].update(categoryQuote='invented category claim'))
add('existing-website mode cannot accept absence',False,lambda f:f['c']['criteria'].update(websiteMode='outdated'))
page={'kind':'page','url':'https://example-paints.test/','title':'Example Paints','text':'Example Paints. 22 Arcot Road, Porur, Chennai. Call 6369222709','status':200,'audit':{'Mobile viewport':'Not detected'},'issues':['No mobile viewport declaration was found on the inspected page.']}
def outdated(f):f['c']['criteria']['websiteMode']='outdated';f['docs'].append(deepcopy(page))
add('existing website with inspected improvement signal',True,outdated)
def usa(f):outdated(f);f['docs'][-1].update(text='Example Paints in Austin, Texas, USA. Call 5125550101')
add('same business name in USA does not link to Chennai',False,usa)
def failed(f):outdated(f);f['docs'][-1].update(status=403,text='Forbidden')
add('blocked page is not an inspected redesign lead',False,failed)
def clean(f):outdated(f);f['docs'][-1].update(issues=[])
add('no improvement signals means no redesign lead',False,clean)
add('possible official site cannot be omitted by the model',False,lambda f:f['docs'].append({'kind':'search','url':'https://example-paints.test/','title':'Example Paints - Official site','text':'Example Paints products and contact'}))
# Add identity-confusion regressions alongside the basic qualification cases.
add('similar brand word does not attach another business',True,lambda f:f['docs'].append({'kind':'search','url':'https://www.zomato.com/chennai/example-point','title':'Example Point','text':'Example Point restaurant in Porur Chennai. Phone +91 9999999999'}))
add('unrelated social footer is not a business profile',True,lambda f:f['docs'][0].update(links=[{'url':'https://www.instagram.com/directorybrand','text':'Follow us'}]))
Path('tests/evidence-cases.json').write_text(json.dumps(cases,indent=2))
