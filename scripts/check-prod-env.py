"""Kiểm tra tên biến từ config stdin; không ghi/in cấu hình hoặc giá trị."""
import json
import re
import sys
from pathlib import Path

try:
    config = json.load(sys.stdin)
except (ValueError, OSError):
    print('Không đọc được cấu hình Compose production', file=sys.stderr)
    sys.exit(1)
example = Path('.env.prod.example').read_text()
required = set(re.findall(r'^# REQUIRED: (\w+)$', example, re.M))
service = None
missing = set()
for line in example.splitlines():
    if line.startswith('# SERVICE: '):
        service = line.split(': ', 1)[1]
    match = re.match(r'([A-Z][A-Z0-9_]*)=', line)
    if not match:
        continue
    key = match[1]
    settings = config.get('services', {}).get(service, {})
    values = settings.get('environment') or {}
    args = (settings.get('build') or {}).get('args') or {}
    if key not in values and key not in args:
        missing.add(key)
    elif key in required and not str(values.get(key) or args.get(key) or '').strip():
        missing.add(key)
for key in sorted(missing):
    print(key)
sys.exit(bool(missing))
