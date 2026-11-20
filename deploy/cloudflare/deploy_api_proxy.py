"""部署/更新独立 API 代理 Worker（Cloudflare Workers）。

用法：
    set CF_TOKEN=...
    python deploy/cloudflare/deploy_api_proxy.py [worker-name]

前端 `.env.production` 的 VITE_API_BASE 指向该 Worker 地址，例如：
    https://ocr-api-proxy.<your-subdomain>.workers.dev
"""
import json
import os
import sys
from pathlib import Path

import requests

API = 'https://api.cloudflare.com/client/v4'
PROXY = {'http': 'http://127.0.0.1:7897', 'https': 'http://127.0.0.1:7897'}
ROOT = Path(__file__).resolve().parents[2]
WORKER_FILE = Path(__file__).resolve().parent / 'api-proxy-worker.mjs'
SCRIPT_NAME = (sys.argv[1] if len(sys.argv) > 1 else 'ocr-api-proxy').strip()

TOKEN = os.environ.get('CF_TOKEN', '')
ACCOUNT = os.environ.get('CF_ACCOUNT', 'dd634204b125f1fb16109afcc96864bf')


def pick_proxies():
    try:
        requests.get(f'{API}/user/tokens/verify', headers={'Authorization': f'Bearer {TOKEN}'}, proxies=PROXY, timeout=8)
        return PROXY
    except Exception:
        return None


def main():
    if not TOKEN:
        sys.exit('缺少 CF_TOKEN 环境变量')
    proxies = pick_proxies()
    headers = {'Authorization': f'Bearer {TOKEN}'}

    # 1. 上传 Worker 模块脚本
    code = WORKER_FILE.read_text(encoding='utf-8')
    meta = json.dumps({'main_module': f'{SCRIPT_NAME}.mjs', 'compatibility_date': '2025-01-01'})
    r = requests.put(
        f'{API}/accounts/{ACCOUNT}/workers/scripts/{SCRIPT_NAME}',
        headers=headers,
        files={
            'metadata': (None, meta, 'application/json'),
            f'{SCRIPT_NAME}.mjs': (f'{SCRIPT_NAME}.mjs', code, 'application/javascript+module'),
        },
        proxies=proxies,
        timeout=60,
    )
    if r.status_code >= 300:
        sys.exit(f'上传 Worker 失败：{r.status_code} {r.text[:300]}')
    print('Worker 已上传:', SCRIPT_NAME)

    # 2. 开启 workers.dev 子域
    r = requests.put(
        f'{API}/accounts/{ACCOUNT}/workers/scripts/{SCRIPT_NAME}/subdomain',
        headers=headers,
        json={'enabled': True, 'previews_enabled': False},
        proxies=proxies,
        timeout=30,
    )
    if r.status_code >= 300:
        print('开启子域失败（可能已开启）:', r.status_code, r.text[:200])

    # 3. 拼出访问地址
    r = requests.get(f'{API}/accounts/{ACCOUNT}/workers/subdomain', headers=headers, proxies=proxies, timeout=30)
    sub = r.json().get('result', {}).get('subdomain', '')
    if not sub:
        sys.exit('读取 workers 子域失败')
    url = f'https://{SCRIPT_NAME}.{sub}.workers.dev'
    print('Worker 地址:', url)

    # 4. 冒烟：>/api/v1/templates 应返回 JSON（后端不可达时也是 JSON 502）
    try:
        t = requests.get(url + '/api/v1/templates', proxies=proxies, timeout=45)
        print('冒烟:', t.status_code, t.headers.get('content-type'), t.text[:120].replace('\n', ' '))
    except Exception as e:
        print('冒烟请求失败（不影响部署）:', type(e).__name__)


if __name__ == '__main__':
    main()
