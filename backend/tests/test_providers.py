import socket
import pytest
from backend.providers import public_url, Tools


@pytest.mark.parametrize('url', ['http://example.com', 'https://user:pass@example.com', 'https://example.com:8000', 'file:///etc/passwd'])
def test_unsafe_url_rejected(url):
    with pytest.raises(ValueError):
        public_url(url)


def test_dns_private_address_rejected(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **k: [(2, 1, 6, '', ('127.0.0.1', 443))])
    with pytest.raises(ValueError):
        public_url('https://public-looking.example')


def test_google_to_duckduckgo_fallback(monkeypatch):
    tools, calls = Tools(), []
    monkeypatch.setattr(tools, 'capability', lambda: {'selenium':True,'browserReason':'Chrome detected'})
    def browser(q, engine):
        calls.append(engine)
        if engine == 'Google':
            raise RuntimeError('Google requested human verification; switching provider.')
        return [{'title': 'Observed result', 'url': 'https://example.com', 'snippet': ''}]
    monkeypatch.setattr(tools, 'browser_search', browser)
    result = tools.search('tea shops Chennai')
    assert calls == ['Google', 'DuckDuckGo']
    assert result['fallback'] and result['provider'] == 'DuckDuckGo · Selenium'
