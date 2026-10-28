"""Create a credential-free source download from authored project files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
skip = {'.git', 'node_modules', '.venv', '.wrangler', '.sites-runtime', '.pytest_cache', '__pycache__', 'dist', 'local-dist', 'outputs', 'work', '.next', '.vinext', '.agents', '.codex'}
with ZipFile(root / 'public/client-hunter-source.zip', 'w', ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        rel = path.relative_to(root)
        if not path.is_file() or any(p in skip for p in rel.parts) or rel.parts[:2] == ('backend', 'data'):
            continue
        if path.name.startswith(('.env', '.dev.vars')) or path.suffix in ('.zip', '.tar', '.gz', '.tsbuildinfo', '.pem', '.pyc'):
            continue
        archive.write(path, 'client-hunter/' + str(rel))
print('Source archive ready; credentials and runtime data excluded.')
