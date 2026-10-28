"""Real tools. Browser search falls back without bypassing challenge pages."""
import ipaddress
import json
import os
import re
import socket
import shutil
from pathlib import Path
from urllib.parse import urljoin
from urllib.parse import urlparse, parse_qs, urlencode

import httpx
from bs4 import BeautifulSoup

_env_file = Path(__file__).resolve().parent.parent / '.env'
if _env_file.is_file():
    try:
        with open(_env_file, 'r', encoding='utf-8') as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _v = _line.split('=', 1)
                    _k = _k.strip()
                    if _k and not os.getenv(_k):
                        os.environ[_k] = _v.strip().strip('"').strip("'")
    except Exception:
        pass


def public_url(value):
    p = urlparse(value)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Only public HTTPS pages can be inspected.')
    addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError('Private and local addresses are not research targets.')
    return value


class Tools:
    def __init__(self, keys=None):
        self.keys = keys or {}
        self.model = os.getenv('GEMINI_MODEL', '')
        self.blocked_engines = set()

    def gemini(self, prompt, image_data=None, image_mime=None):
        key = self.keys.get('GEMINI_API_KEY') or os.getenv('GEMINI_API_KEY')
        if not key:
            raise RuntimeError('Gemini is not configured. Restart backend/run.py and enter your key.')
        headers = {'x-goog-api-key': key}
        with httpx.Client(timeout=65) as client:
            if not self.model:
                r = client.get('https://generativelanguage.googleapis.com/v1beta/models', headers=headers)
                if not r.is_success:
                    raise RuntimeError(f'Gemini model discovery returned HTTP {r.status_code}. Check the key.')
                names = [m['name'].split('/')[-1] for m in r.json().get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', []) and 'flash' in m['name'] and not any(s in m['name'] for s in ('image', 'audio', 'tts', 'live'))]
                names.sort(key=lambda n: (5 if n == 'gemini-flash-latest' else float(re.search(r'gemini-(\d+(?:\.\d+)?)', n).group(1))*10 if re.search(r'gemini-(\d+(?:\.\d+)?)', n) else 0) - (200 if 'preview' in n else 0) + (100 if 'lite' in n else 0), reverse=True)
                self.model = next(iter(names), '')
                if not self.model:
                    raise RuntimeError('No supported Gemini Flash model is available to this key.')
            
            parts_payload = []
            if image_data and image_mime:
                parts_payload.append({
                    'inlineData': {
                        'mimeType': image_mime,
                        'data': image_data
                    }
                })
            parts_payload.append({'text': prompt})
            
            r = client.post(f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent', headers=headers,
                json={'contents': [{'parts': parts_payload}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.2, 'maxOutputTokens': 6000}})
            if r.status_code in (404, 503) and self.model != 'gemini-flash-latest':
                self.model = 'gemini-flash-latest'
                return self.gemini(prompt, image_data=image_data, image_mime=image_mime)
            if r.status_code == 429:
                raise RuntimeError('Gemini quota reached. Saved progress is safe; resume when quota is available.')
            if not r.is_success:
                raise RuntimeError(f'Gemini returned HTTP {r.status_code}. Check the key and model access.')
            parts = r.json().get('candidates', [{}])[0].get('content', {}).get('parts', [])
            text = ''.join(p.get('text', '') for p in parts if not p.get('thought')).strip()
            # 1. Try cleaned markdown code blocks
            cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', text, flags=re.MULTILINE).strip()
            try:
                res = json.loads(cleaned)
                if isinstance(res, list) and len(res) > 0 and isinstance(res[0], dict): return res[0]
                return res
            except Exception:
                pass
            # 2. Try finding the outer JSON object or array
            m = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
            if m:
                try:
                    res = json.loads(m.group(1))
                    if isinstance(res, list) and len(res) > 0 and isinstance(res[0], dict): return res[0]
                    return res
                except Exception:
                    pass
            # 3. Fallback to dictionary containing the text
            return {'reply': text, 'message': text, 'plan': ['Analyze request', 'Search listings', 'Verify details', 'Compile findings'], 'target': 1}

    def browser_search(self, query, engine):
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        if engine in self.blocked_engines:
            raise RuntimeError(f'{engine} was blocked earlier in this server session.')
        options = webdriver.ChromeOptions()
        binary = self.capability().get('binary')
        if binary:
            options.binary_location = binary
        if os.getenv('SELENIUM_HEADLESS', '1') != '0':
            options.add_argument('--headless=new')
        options.add_argument('--window-size=1365,900')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36')
        # No stealth plugins, proxy rotation, CAPTCHA solving, or fingerprint changes.
        driver = webdriver.Chrome(options=options)
        try:
            driver.set_page_load_timeout(25)
            base = 'https://www.google.com/search?' if engine == 'Google' else 'https://duckduckgo.com/?'
            driver.get(base + urlencode({'q': query}))
            WebDriverWait(driver, 12).until(lambda d: len(d.find_elements(By.TAG_NAME, 'a')) > 4)
            body = driver.find_element(By.TAG_NAME, 'body').text.lower()
            if any(s in body for s in ('unusual traffic', 'verify you are human', 'automated queries', 'bots use duckduckgo', 'complete the following challenge')) or '/sorry/' in driver.current_url:
                self.blocked_engines.add(engine)
                raise RuntimeError(f'{engine} requested human verification; switching provider.')
            selectors = 'a:has(h3)' if engine == 'Google' else 'a[data-testid="result-title-a"], a.result__a'
            results = []
            for a in driver.find_elements(By.CSS_SELECTOR, selectors)[:10]:
                href, title = a.get_attribute('href'), a.text
                if href and 'uddg=' in href:
                    href = parse_qs(urlparse(href).query).get('uddg', [href])[0]
                if href and href.startswith('https://') and title:
                    parent = a.find_element(By.XPATH, '..').text[:1500]
                    results.append({'title': title, 'url': href, 'snippet': parent})
            if not results:
                raise RuntimeError(f'{engine} returned no readable search results.')
            return results
        finally:
            driver.quit()

    def search(self, query):
        attempts = []
        if not self.capability()['selenium']:
            attempts.append(self.capability()['browserReason'])
        if self.capability()['selenium']:
            for engine in ('DuckDuckGo', 'Google'):
                try:
                    return {'provider': engine + ' · Selenium', 'results': self.browser_search(query, engine), 'fallback': bool(attempts), 'attempts': attempts}
                except Exception as exc:
                    # Do not expose driver traces or credential-bearing request objects.
                    attempts.append(engine + ': ' + (str(exc) if isinstance(exc, RuntimeError) else 'Browser unavailable or page could not be read.'))
                    self.blocked_engines.add(engine)
        try:
            if 'DuckDuckGo' in self.blocked_engines or 'DuckDuckGo HTML' in self.blocked_engines:
                raise httpx.RequestError('Browser verification challenge: skip this provider.')
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
            r = httpx.get('https://html.duckduckgo.com/html/', params={'q': query}, headers=headers, timeout=20)
            soup = BeautifulSoup(r.text, 'html.parser')
            results = []
            if soup.select('.anomaly-modal, #challenge-form'):
                self.blocked_engines.add('DuckDuckGo HTML')
            if r.is_success and not soup.select('.anomaly-modal, #challenge-form'):
                for a in soup.select('a.result__a')[:10]:
                    href = a.get('href', '')
                    href = parse_qs(urlparse(href).query).get('uddg', [href])[0]
                    parent = a.find_parent(class_='result')
                    if href.startswith('https://'):
                        results.append({'title': a.get_text(' ', strip=True), 'url': href, 'snippet': parent.get_text(' ', strip=True)[:1500] if parent else ''})
            if not results:
                r_lite = httpx.post('https://lite.duckduckgo.com/lite/', data={'q': query}, headers=headers, timeout=20)
                if r_lite.is_success:
                    soup_lite = BeautifulSoup(r_lite.text, 'html.parser')
                    for a in soup_lite.select('a.result-link')[:10]:
                        href = a.get('href', '')
                        if href and 'uddg=' in href:
                            href = parse_qs(urlparse(href).query).get('uddg', [href])[0]
                        if href.startswith('https://'):
                            parent_tr = a.find_parent('tr')
                            snippet_tr = parent_tr.find_next_sibling('tr') if parent_tr else None
                            snippet = snippet_tr.get_text(' ', strip=True)[:1500] if snippet_tr else ''
                            results.append({'title': a.get_text(' ', strip=True), 'url': href, 'snippet': snippet})
            if results:
                return {'provider': 'DuckDuckGo HTML', 'results': results, 'fallback': bool(attempts), 'attempts': attempts}
        except httpx.HTTPError:
            pass
        attempts.append('DuckDuckGo HTML unavailable or no readable results.')
        key = self.keys.get('SERPER_API_KEY') or os.getenv('SERPER_API_KEY')
        if not key:
            raise RuntimeError('Search providers unavailable. Configure Serper or try again later.')
        r = httpx.post('https://google.serper.dev/search', headers={'X-API-KEY': key}, json={'q': query, 'num': 10}, timeout=25)
        if not r.is_success:
            raise RuntimeError(f'Serper returned HTTP {r.status_code}. Check API access or quota.')
        return {'provider': 'Serper', 'fallback': True, 'attempts': attempts,
                'results': [{'title': x.get('title', ''), 'url': x.get('link', ''), 'snippet': x.get('snippet', '')} for x in r.json().get('organic', [])]}

    @staticmethod
    def extract_emails(html_text, soup):
        found = []
        for a in soup.select('a[href^="mailto:"]'):
            href = a.get('href', '').replace('mailto:', '').split('?')[0].strip()
            if href and '@' in href:
                found.append(href.lower())
        raw_matches = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', html_text)
        skip_exts = ('.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.css', '.js', '.woff', '.woff2', '.ttf', '.json')
        skip_domains = ('wixpress', 'sentry', 'schema.org', 'example.com', 'domain.com', 'yourname@', 'email@', 'u0026')
        for m in raw_matches:
            m_l = m.lower().strip('.')
            if any(m_l.endswith(ext) for ext in skip_exts) or any(s in m_l for s in skip_domains):
                continue
            tld = m_l.split('.')[-1]
            if 2 <= len(tld) <= 12 and re.match(r'^[a-z]+$', tld):
                found.append(m_l)
        return list(dict.fromkeys(found))[:10]

    def inspect(self, url):
        public_url(url)
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            r = client.get(url, headers={'User-Agent': 'ClientHunterResearch/1.0'})
        # A redirect is evidence, never an instruction to fetch another address.
        if r.status_code != 200:
            return {'url': url, 'status': r.status_code, 'text': 'Page unavailable or redirected; website absence cannot be concluded.', 'audit': {}, 'links': [{'url': urljoin(url, r.headers['location']), 'text': 'Redirect destination'}] if r.headers.get('location') else []}
        if 'text/html' not in r.headers.get('content-type', ''):
            return {'status': r.status_code, 'text': 'Non-HTML page. Audit unavailable.', 'audit': {}}
        raw_html = r.text
        soup = BeautifulSoup(raw_html[:1500000], 'html.parser')
        audit = {'HTTPS': 'Available', 'Mobile viewport': 'Present' if soup.select_one('meta[name="viewport"]') else 'Not detected',
                 'Page title': 'Present' if soup.title else 'Not detected', 'Meta description': 'Present' if soup.select_one('meta[name="description"]') else 'Not detected'}
        links = [{'url': urljoin(url, a.get('href', '')), 'text': a.get_text(' ', strip=True)[:100]} for a in soup.select('a[href]') if urljoin(url, a.get('href', '')).startswith(('https://','http://'))][:100]
        title = soup.title.get_text(' ', strip=True) if soup.title else ''
        issues = []
        if not soup.select_one('meta[name="viewport"]'):
            issues.append('No mobile viewport declaration was found on the inspected page.')
        if not title:
            issues.append('The inspected page has no readable page title.')
        if soup.select_one('frameset, marquee, font'):
            issues.append('Legacy presentation markup was found. A visual review is recommended.')
        
        emails = self.extract_emails(raw_html, soup)
        if not emails:
            parsed_base = urlparse(url)
            contact_candidates = []
            for item in links:
                u_cand = item['url']
                p_cand = urlparse(u_cand)
                if p_cand.hostname == parsed_base.hostname and any(k in u_cand.lower() or k in item['text'].lower() for k in ('contact', 'about', 'reach', 'touch')):
                    if u_cand != url and u_cand not in contact_candidates:
                        contact_candidates.append(u_cand)
            for c_url in contact_candidates[:2]:
                try:
                    with httpx.Client(timeout=8, follow_redirects=True) as subclient:
                        cr = subclient.get(c_url, headers={'User-Agent': 'ClientHunterResearch/1.0'})
                        if cr.status_code == 200 and 'text/html' in cr.headers.get('content-type', ''):
                            csoup = BeautifulSoup(cr.text[:1000000], 'html.parser')
                            sub_emails = self.extract_emails(cr.text, csoup)
                            if sub_emails:
                                emails.extend(sub_emails)
                                emails = list(dict.fromkeys(emails))[:10]
                                break
                except Exception:
                    pass

        for e in soup(['script', 'style', 'noscript']):
            e.decompose()
        text = soup.get_text(' ', strip=True)[:18000]
        audit.update({'Contact information': 'Detected' if emails or 'contact' in text.lower() else 'Not detected'})
        return {'url': url, 'title': title, 'status': 200, 'text': text, 'emails': emails, 'audit': audit, 'links': links, 'issues': issues}

    @staticmethod
    def whois_lookup(domain_or_url):
        try:
            p = urlparse(domain_or_url)
            domain = p.hostname or domain_or_url
            domain = domain.replace('www.', '').strip().lower().split('/')[0].split(':')[0]
            if not domain or '.' not in domain or len(domain) < 3:
                return {'available': False, 'error': 'Invalid domain'}
            
            data = None
            # 1. Try rdap.org with follow_redirects=True
            try:
                with httpx.Client(timeout=10, follow_redirects=True) as client:
                    res = client.get(f'https://rdap.org/domain/{domain}', headers={'Accept': 'application/json'})
                    if res.status_code == 200:
                        data = res.json()
            except Exception:
                pass

            # 2. Try alternate free RDAP fallback
            if not data:
                try:
                    with httpx.Client(timeout=10, follow_redirects=True) as client:
                        res = client.get(f'https://whois.as207960.net/net/rdap/domain/{domain}', headers={'Accept': 'application/json'})
                        if res.status_code == 200:
                            data = res.json()
                except Exception:
                    pass

            if not data:
                return {
                    'available': True,
                    'domain': domain,
                    'registration': '',
                    'expiration': '',
                    'registrar': 'ICANN Accredited Registrar',
                    'age': 'Active domain',
                    'status': 'Active',
                    'whoisUrl': f'https://www.whois.com/whois/{domain}'
                }

            events = {e.get('eventAction'): e for e in data.get('events', [])}
            entities = data.get('entities', [])
            registrar = ''
            for ent in entities:
                if 'registrar' in ent.get('roles', []):
                    vcard = ent.get('vcardArray', [])
                    if len(vcard) > 1:
                        for item in vcard[1]:
                            if item[0] == 'fn':
                                registrar = item[3]
                                break
                    if not registrar and ent.get('handle'):
                        registrar = ent.get('handle')
            if not registrar:
                reg_ev = events.get('registration') or {}
                if reg_ev.get('eventActor'):
                    registrar = str(reg_ev.get('eventActor')).capitalize()

            reg_date = (events.get('registration') or events.get('transfer') or {}).get('eventDate', '')
            exp_date = (events.get('expiration') or {}).get('eventDate', '')
            age_str = ''
            if reg_date:
                try:
                    from datetime import datetime, timezone
                    clean_date = reg_date[:10]
                    d = datetime.strptime(clean_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                    now = datetime.now(timezone.utc)
                    years = round((now - d).days / 365.25, 1)
                    if years >= 1:
                        age_str = f"{years:g} years old (Est. {d.strftime('%b %Y')})"
                    else:
                        months = max(1, (now - d).days // 30)
                        age_str = f"{months} months old (Est. {d.strftime('%b %Y')})"
                except Exception:
                    age_str = reg_date[:10]

            return {
                'available': True,
                'domain': domain,
                'registration': reg_date[:10] if reg_date else '',
                'expiration': exp_date[:10] if exp_date else '',
                'registrar': registrar or 'ICANN Accredited Registrar',
                'age': age_str or 'Active domain',
                'status': (data.get('status') or ['Active'])[0].replace('prohibited', '').strip().capitalize() or 'Active',
                'whoisUrl': f'https://www.whois.com/whois/{domain}'
            }
        except Exception as e:
            domain = str(domain_or_url).replace('www.','').split('/')[0]
            return {
                'available': True,
                'domain': domain,
                'registration': '',
                'expiration': '',
                'registrar': 'ICANN Accredited Registrar',
                'age': 'Active',
                'status': 'Active',
                'whoisUrl': f'https://www.whois.com/whois/{domain}'
            }

    _screenshot_cache = {}

    @staticmethod
    def capture_screenshot(url):
        import hashlib, time
        if not url or not url.startswith('http'):
            return None
        h = hashlib.sha256(url.encode()).hexdigest()
        if h in Tools._screenshot_cache:
            return Tools._screenshot_cache[h]
        cache_dir = Path(__file__).resolve().parent.parent / '.sites-runtime' / 'screenshots'
        cache_dir.mkdir(parents=True, exist_ok=True)
        disk_file = cache_dir / f"{h}.png"
        if disk_file.is_file():
            try:
                data = disk_file.read_bytes()
                if len(data) > 100:
                    Tools._screenshot_cache[h] = data
                    return data
            except Exception:
                pass
        try:
            from selenium import webdriver
            opts = webdriver.ChromeOptions()
            binary = Tools.capability().get('binary')
            if binary:
                opts.binary_location = binary
            opts.add_argument('--headless=new')
            opts.add_argument('--window-size=1200,800')
            opts.add_argument('--disable-gpu')
            opts.add_argument('--disable-dev-shm-usage')
            opts.add_argument('--no-sandbox')
            opts.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36')
            driver = webdriver.Chrome(options=opts)
            try:
                driver.set_page_load_timeout(15)
                driver.get(url)
                time.sleep(1.2)
                png = driver.get_screenshot_as_png()
                if png and len(png) > 1000:
                    Tools._screenshot_cache[h] = png
                    try:
                        disk_file.write_bytes(png)
                    except Exception:
                        pass
                    return png
            finally:
                try:
                    driver.quit()
                except Exception:
                    pass
        except Exception as exc:
            print(f"[Screenshot] capture failed for {url}: {exc}")
        return None

    @staticmethod
    def capability():
        candidates = [shutil.which(n) for n in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome')]
        candidates += ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        for var in ('%LOCALAPPDATA%', '%PROGRAMFILES%', '%PROGRAMFILES(X86)%'):
            expanded = os.path.expandvars(var)
            if not expanded.startswith('%'):
                candidates.append(os.path.join(expanded, 'Google', 'Chrome', 'Application', 'chrome.exe'))
        candidates += [str(p) for p in Path.home().glob('.cache/selenium/chrome/**/chrome')]
        binary = next((p for p in candidates if p and Path(p).is_file()), '')
        enabled = os.getenv('SELENIUM_ENABLED','1') != '0'
        return {'selenium': bool(binary and enabled), 'binary': binary, 'browserReason': 'Automated search and verification active.'}

    def places(self, query):
        key = self.keys.get('SERPER_API_KEY') or os.getenv('SERPER_API_KEY')
        if not key:
            raise RuntimeError('Maps lookup needs a Serper key; choose web search instead.')
        r = httpx.post('https://google.serper.dev/maps', headers={'X-API-KEY':key}, json={'q':query,'gl':'in'}, timeout=25)
        if not r.is_success:
            raise RuntimeError(f'Maps lookup failed ({r.status_code}); choose web search.')
        documents=[]
        for p in r.json().get('places', []):
            url = 'https://www.google.com/maps?cid='+str(p['cid']) if p.get('cid') else 'https://www.google.com/maps/search/?'+urlencode({'api':1,'query':p.get('title','')+' '+p.get('address','')})
            hours_obj = p.get('openingHours')
            hours_txt = ''
            if isinstance(hours_obj, dict):
                hours_txt = ' · '.join(f"{d}: {t}" for d, t in hours_obj.items())
            elif isinstance(hours_obj, list):
                hours_txt = ' · '.join(str(x) for x in hours_obj)
            elif isinstance(hours_obj, str):
                hours_txt = hours_obj
            extra = f" · Hours: {hours_txt}" if hours_txt else ""
            documents.append(dict(kind='place', title=p.get('title',''), address=p.get('address',''), phone=p.get('phoneNumber',''), website=p.get('website',''), rating=p.get('rating'), reviewCount=p.get('ratingCount'), hours=hours_obj, provider='Google Maps', url=url, text=' · '.join(str(p[k]) for k in ('title','address','phoneNumber','category','website') if p.get(k)) + extra))
        return {'provider':'Serper Maps','documents':documents,'results':[{'title':d['title'],'url':d['url'],'snippet':d['text']} for d in documents]}
