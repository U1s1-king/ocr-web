# -*- coding: utf-8 -*-
"""按 docs/API-v1-摘要.md 逐条实测，只做只读（GET）请求，不写不改不删。"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://8.130.177.176:64435/api/v1"


def call(path, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read()
            return r.status, dict(r.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:  # noqa: BLE001
        return 0, {}, str(e).encode()


def show(title, path, params=None, expect=None):
    status, headers, body = call(path, params)
    text = body.decode("utf-8", "replace")
    try:
        obj = json.loads(text)
    except Exception:  # noqa: BLE001
        obj = None
    ct = headers.get("Content-Type") or headers.get("content-type") or "-"
    code = obj.get("code") if isinstance(obj, dict) else None
    summary = ""
    if isinstance(obj, dict):
        if "data" in obj:
            d = obj["data"]
            if isinstance(d, list):
                summary = f"data=list[{len(d)}]"
            elif isinstance(d, dict):
                keys = list(d.keys())[:6]
                summary = f"data=dict{keys}"
            else:
                summary = f"data={type(d).__name__}"
        meta = obj.get("meta")
        if isinstance(meta, dict):
            summary += f" meta.total={meta.get('total')}"
    print(f"[{title}] {status} code={code} {summary}")
    print(f"    ct={ct}")
    if expect and code != expect:
        print(f"    !! 期望 code={expect}，实际 {code}")
    return obj, status


print("=" * 70)
papers, _ = show("试卷列表 GET /papers", "/papers")
paper_id = papers["data"][0]["id"] if papers and papers.get("data") else 1
exams, _ = show("考试列表 GET /exams", "/exams")
exam_ids = [e["id"] for e in (exams.get("data") or [])][:3]
exam_id = exam_ids[0] if exam_ids else 1

show("考试详情 GET /exams/{id}", f"/exams/{exam_id}")
show("考试成绩 GET /exams/{id}/results", f"/exams/{exam_id}/results")
show("试卷详情 GET /papers/{id}", f"/papers/{paper_id}")
show("批次列表 GET /exam-batches", "/exam-batches")
files, _ = show("文件搜索 GET /files/search", "/files/search", {"limit": 3})

print("-" * 70)
print(">> 关键：exam-results 作用域")
show("不带参数（文档要求 400 EXAM_SCOPE_REQUIRED）", "/exam-results",
     {"offset": 0, "limit": 3}, expect="EXAM_SCOPE_REQUIRED")
show("只带 batchId（未指定存在性）", "/exam-results", {"batchId": 1, "limit": 3})
show("带 examIds（前端修复方式）", "/exam-results",
     {"examIds": exam_ids, "offset": 0, "limit": 3, "sortBy": ["uTime"], "sortDirection": ["desc"]})
res, _ = show("默认排序（不传 sortBy）", "/exam-results", {"examIds": exam_ids, "limit": 2})

rid = None
if isinstance(res, dict):
    items = res.get("data") or []
    if items:
        rid = items[0]["id"]
if rid:
    detail, _ = show("成绩详情 GET /exam-results/{id}", f"/exam-results/{rid}")
    if isinstance(detail, dict) and isinstance(detail.get("data"), dict):
        d = detail["data"]
        print(f"    详情字段: {sorted(d.keys())}")
        details = d.get("details") or {}
        if details:
            q = list(details.items())[0]
            print(f"    题 {q[0]} 字段: {sorted(q[1].keys())}")
            pts = sum((v.get('points') or 0) for v in details.values())
            print(f"    details.points 求和 = {pts}，maxScore = {d.get('maxScore')}",
                  "一致" if pts == d.get("maxScore") else "不一致!!")
    show("成绩详情 非法 id", "/exam-results/abc", expect="INVALID_PATH_PARAM")
    show("成绩详情 不存在", "/exam-results/99999999", expect="RESULT_NOT_FOUND")

print("-" * 70)
print(">> 学生接口：文档只有 batch 三个")
for p in ("/students", "/students/batch"):
    s, headers, body = call(p)
    print(f"[GET {p}] {s} {body.decode('utf-8', 'replace')[:80]}")

print("-" * 70)
print(">> 排序参数错误码")
show("排序长度不一致", "/exam-results",
     {"examIds": exam_ids, "sortBy": ["score", "uTime"], "sortDirection": ["desc"]},
     expect="SORT_LENGTH_MISMATCH")
show("非法排序字段", "/exam-results",
     {"examIds": exam_ids, "sortBy": ["hack"], "sortDirection": ["desc"]},
     expect="SORT_FIELD_UNSUPPORTED")
show("order 冲突", "/exam-results", {"examIds": exam_ids, "batchId": 1},
     expect="EXAM_SCOPE_CONFLICT")

print("=" * 70)
print("编码自检：")
s, headers, body = call("/exams")
raw = body[:120]
print("  原始字节前 120:", raw)
print("  UTF-8 解码:", raw.decode("utf-8", "replace")[:80])
print("  GBK 解码:", raw.decode("gbk", "replace")[:80])
print("  headers:", {k: v for k, v in headers.items() if k.lower() in ("content-type", "content-length")})
