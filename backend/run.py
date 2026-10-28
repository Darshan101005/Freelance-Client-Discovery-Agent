"""Start from the project root: python -m backend.run"""
import getpass
import os
import uvicorn

if __name__ == '__main__':
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.isfile(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    if k.strip() and not os.getenv(k.strip()):
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
    if not os.getenv('GEMINI_API_KEY') and os.isatty(0):
        os.environ['GEMINI_API_KEY'] = getpass.getpass('Gemini API key (optional; configure in Settings after signup): ').strip()
    if not os.getenv('SERPER_API_KEY') and os.isatty(0):
        os.environ['SERPER_API_KEY'] = getpass.getpass('Serper API key (optional fallback; hidden): ').strip()
    print('Client Hunter backend: http://127.0.0.1:8000 — sign up locally, then configure your connections in Settings.')
    uvicorn.run('backend.server:app', host='127.0.0.1', port=8000, reload=True)
