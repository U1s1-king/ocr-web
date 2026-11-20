"""
Cloudflare Pages 一键部署脚本（绕过 wrangler / Node，纯 Python + requests）

用法（在仓库根目录执行，先 npm run build）：
    set CF_TOKEN=你的 Cloudflare API Token
    python deploy/cloudflare/deploy_pages.py

前置：
    pip install requests
    本机代理 127.0.0.1:7897 可用则自动走代理，否则直连
"""
import base64
import hashlib
import json
import mimetypes
import os
import sys
from pathlib import Path

import requests

TOKEN = os.environ.get("CF_TOKEN", "")
ACCOUNT = os.environ.get("CF_ACCOUNT", "dd634204b125f1fb16109afcc96864bf")
PROJECT = os.environ.get("CF_PROJECT", "ocr-web")
BRANCH = os.environ.get("CF_BRANCH", "main")
# deploy/cloudflare/ 往上两级 = 仓库根目录
ROOT = Path(__file__).resolve().parents[2]
DIST = Path(os.environ.get("CF_DIST", ROOT / "dist"))
PROXY = {"http": "http://127.0.0.1:7897", "https": "http://127.0.0.1:7897"}
API = "https://api.cloudflare.com/client/v4"


def pick_proxy():
    """探测 7897 代理是否可用，不可用就走直连。"""
    try:
        requests.get(f"{API}/user/tokens/verify",
                     headers={"Authorization": f"Bearer {TOKEN}"},
                     proxies=PROXY, timeout=8)
        print("使用代理 127.0.0.1:7897")
        return PROXY
    except Exception:
        print("代理不可用，直连")
        return None


def collect(dist: Path):
    """读取 dist 下所有文件，按 CF 规则算 blake2b hash。"""
    out = []
    for f in sorted(dist.rglob("*")):
        if not f.is_file():
            continue
        rel = "/" + f.relative_to(dist).as_posix()
        body = f.read_bytes()
        h = hashlib.blake2b(body + rel.encode(), digest_size=16).hexdigest()
        ct = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        out.append({"path": rel, "hash": h, "body": body, "ct": ct})
    return out


def main():
    if not TOKEN:
        sys.exit("缺少 CF_TOKEN 环境变量（Cloudflare API Token）")
    if not DIST.exists():
        sys.exit(f"dist 不存在，先跑 npm run build：{DIST}")

    proxies = pick_proxy()
    auth = {"Authorization": f"Bearer {TOKEN}"}
    files = collect(DIST)
    print(f"待部署文件 {len(files)} 个")

    # 1. 取上传专用 JWT（300 秒有效）
    r = requests.get(
        f"{API}/accounts/{ACCOUNT}/pages/projects/{PROJECT}/upload-token",
        headers=auth, proxies=proxies, timeout=40,
    )
    r.raise_for_status()
    jwt = r.json()["result"]["jwt"]
    upload_auth = {"Authorization": f"Bearer {jwt}"}

    # 2. 上传资源（50MB 一批）
    payload = [
        {
            "key": f["hash"],
            "value": base64.b64encode(f["body"]).decode(),
            "metadata": {"contentType": f["ct"]},
            "base64": True,
        }
        for f in files
    ]
    r = requests.post(f"{API}/pages/assets/upload", headers=upload_auth,
                      json=payload, proxies=proxies, timeout=120)
    r.raise_for_status()
    print("上传:", r.json()["result"])

    # 3. 登记 hash
    r = requests.post(f"{API}/pages/assets/upsert-hashes", headers=upload_auth,
                      json={"hashes": [f["hash"] for f in files]},
                      proxies=proxies, timeout=60)
    r.raise_for_status()

    # 4. 创建部署：manifest 必须用 multipart/form-data 提交（关键！）
    manifest = {f["path"]: f["hash"] for f in files}
    r = requests.post(
        f"{API}/accounts/{ACCOUNT}/pages/projects/{PROJECT}/deployments",
        headers=auth,
        files={
            "manifest": (None, json.dumps(manifest), "application/json"),
            "branch": (None, BRANCH),
        },
        proxies=proxies, timeout=90,
    )
    r.raise_for_status()
    res = r.json()["result"]
    print("部署完成:", res["url"])
    print("生产域名: https://ocr-web-eww.pages.dev")


if __name__ == "__main__":
    main()
