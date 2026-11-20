// scripts/emit-templates.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// src/lib/design.ts
var PAPER_MM = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 }
};
var MM = 2;
function defaultOrientation(size) {
  return size === "A3" ? "landscape" : "portrait";
}
function canvasOf(size, o) {
  const m = PAPER_MM[size];
  const w = o === "portrait" ? m.w : m.h;
  const h = o === "portrait" ? m.h : m.w;
  return { w: w * MM, h: h * MM, mmW: w, mmH: h };
}
function emptySide(size, side, orientation = "portrait") {
  return { size, side, orientation, elements: [] };
}
function emptyDesign(size = "A4", orientation) {
  const o = orientation ?? defaultOrientation(size);
  return {
    schemaVersion: 2,
    front: emptySide(size, "front", o),
    back: emptySide(size, "back", o)
  };
}
var seq = 0;
function uid(prefix = "el") {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
function compile(design) {
  const c = canvasOf(design.front.size, design.front.orientation);
  const markers = [];
  const questions = [];
  const blocks = [];
  const pageEls = [...design.front.elements, ...design.back.elements];
  const mk = pageEls.find((el) => el.kind === "markers" && !el.hidden);
  if (mk) {
    const s0 = mk.size;
    const ix = mk.inset?.x ?? mk.x;
    const iy = mk.inset?.y ?? mk.y;
    markers.push(
      { id: "top-left", x: ix, y: iy, size: s0 },
      { id: "top-right", x: c.w - ix - s0, y: iy, size: s0 },
      { id: "bottom-left", x: ix, y: c.h - iy - s0, size: s0 },
      { id: "bottom-right", x: c.w - ix - s0, y: c.h - iy - s0, size: s0 }
    );
  }
  for (const el of pageEls) {
    if (el.hidden) continue;
    if (el.kind === "title" || el.kind === "subtitle" || el.kind === "notice") {
      blocks.push({
        id: el.id,
        type: "text",
        region: { x: el.x, y: el.y, width: el.w, height: el.h },
        text: el.text,
        style: {
          fontSize: el.fontSize,
          fontWeight: el.bold ? "bold" : "normal",
          textAlign: el.align ?? "left",
          lineHeight: el.lineHeight
        }
      });
    }
    if (el.kind === "objective") {
      const gapX = el.w / el.cols;
      const rowH = el.fontSize * 2.2;
      const optN = Math.max(2, el.options.length);
      const blocks2 = Math.max(1, el.blocks ?? 1);
      const blockH = el.rows * rowH + el.fontSize * 1.1;
      const cap = el.count ?? blocks2 * el.cols * el.rows;
      let emitted = 0;
      for (let b = 0; b < blocks2; b += 1) {
        for (let r = 0; r < el.rows; r += 1) {
          for (let i = 0; i < el.cols; i += 1) {
            if (emitted >= cap) break;
            const n = el.startNumber + b * el.cols * el.rows + r * el.cols + i;
            emitted += 1;
            questions.push({
              id: `q${n}`,
              displayNumber: n,
              type: "mark",
              score: el.score ?? 1,
              region: {
                x: Math.round(el.x + i * gapX + 22),
                y: Math.round(el.y + 6 + b * blockH + r * rowH),
                width: Math.max(20, Math.round(gapX - 26)),
                height: Math.max(12, Math.round(rowH - 4))
              },
              // 后端要求：选项区域是相对小题的比例（0–1），且不能越界
              choices: el.options.map((opt, k) => ({
                value: opt,
                region: { x: k / optN, y: 0, width: 1 / optN, height: 1 }
              }))
            });
          }
        }
      }
    }
  }
  return {
    schemaVersion: 1,
    unit: "canvas",
    canvas: { width: Math.round(c.w), height: Math.round(c.h) },
    markers,
    questions,
    blocks,
    answerKey: design.answerKey ?? {}
  };
}

// src/lib/paperTemplates.ts
var GAOKAO = [
  {
    key: "chinese",
    name: "\u8BED\u6587",
    hint: "\u73B0\u4EE3\u6587 + \u53E4\u8BD7\u6587 + \u8BED\u7528 + \u4F5C\u6587",
    spec: "\u5BA2\u89C2 10 \u9898 \xB7 \u4E3B\u89C2 4 \u5757 \xB7 \u4F5C\u6587 800 \u5B57",
    fullScore: 150,
    paperSize: "A3",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 30 \u5206\uFF09", count: 10 }],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u73B0\u4EE3\u6587\u9605\u8BFB\uFF0816 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "\u4E09\u3001\u53E4\u8BD7\u6587\u9605\u8BFB\uFF0818 \u5206\uFF09", kind: "lines", weight: 1.3 },
      { label: "\u56DB\u3001\u8BED\u8A00\u6587\u5B57\u8FD0\u7528\uFF0812 \u5206\uFF09", kind: "lines", weight: 0.9 },
      { label: "\u4E94\u3001\u540D\u53E5\u9ED8\u5199\uFF088 \u5206\uFF09", kind: "list", weight: 0.9, items: [2, 2, 2, 2, 2], startNumber: 17 },
      { label: "\u516D\u3001\u4F5C\u6587\uFF0860 \u5206\uFF09", kind: "grid", weight: 3.6, cols: 20 }
    ]
  },
  {
    key: "math",
    name: "\u6570\u5B66",
    hint: "\u5355\u9009 8 + \u591A\u9009 4 + \u586B\u7A7A 4 + \u89E3\u7B54 5",
    spec: "\u5BA2\u89C2 12 \u9898 \xB7 \u586B\u7A7A 4 \u9898 \xB7 \u89E3\u7B54 5 \u9898\uFF08\u5171 19 \u9898\uFF09",
    fullScore: 150,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u5355\u9879\u9009\u62E9\u9898\uFF081\u20138 \u9898\uFF0C\u6BCF\u5C0F\u9898 5 \u5206\uFF0C\u5171 40 \u5206\uFF09", count: 8, score: 5 },
        { title: "\u4E8C\u3001\u591A\u9879\u9009\u62E9\u9898\uFF089\u201312 \u9898\uFF0C\u6BCF\u5C0F\u9898 5 \u5206\uFF0C\u5171 20 \u5206\uFF09", count: 4, score: 5 }
      ],
      options: ["A", "B", "C", "D"],
      score: 5
    },
    blocks: [
      { label: "\u4E09\u3001\u586B\u7A7A\u9898\uFF0813\u201316 \u9898\uFF0C\u6BCF\u5C0F\u9898 5 \u5206\uFF0C\u5171 20 \u5206\uFF09", kind: "list", weight: 1, items: [2, 2, 2, 2], startNumber: 13 },
      { label: "\u56DB\u3001\u89E3\u7B54\u9898 17\uFF0810 \u5206\uFF09", kind: "lines", weight: 1.3 },
      { label: "18\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.5 },
      { label: "19\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.5 },
      { label: "20\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "21\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.6 }
    ]
  },
  {
    key: "english",
    name: "\u82F1\u8BED",
    hint: "\u542C\u529B + \u9605\u8BFB + \u5B8C\u5F62 + \u8BED\u6CD5\u586B\u7A7A + \u4E24\u7BC7\u5199\u4F5C",
    spec: "\u5BA2\u89C2 55 \u9898\uFF08\u5206 3 \u6BB5\uFF09\xB7 \u8BED\u6CD5\u586B\u7A7A 10 \xB7 \u5E94\u7528\u6587 + \u8BFB\u540E\u7EED\u5199",
    fullScore: 150,
    paperSize: "A4",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u542C\u529B\uFF081\u201320 \u9898\uFF0C\u6BCF\u5C0F\u9898 1.5 \u5206\uFF0C\u5171 30 \u5206\uFF09", count: 20, score: 1.5 },
        { title: "\u4E8C\u3001\u9605\u8BFB\u7406\u89E3\uFF0821\u201340 \u9898\uFF0C\u6BCF\u5C0F\u9898 2.5 \u5206\uFF0C\u5171 50 \u5206\uFF09", count: 20, score: 2.5 },
        { title: "\u4E09\u3001\u5B8C\u5F62\u586B\u7A7A\uFF0841\u201355 \u9898\uFF0C\u6BCF\u5C0F\u9898 1 \u5206\uFF0C\u5171 15 \u5206\uFF09", count: 15, score: 1 }
      ],
      options: ["A", "B", "C", "D"],
      score: 1.5
    },
    blocks: [
      { label: "\u56DB\u3001\u8BED\u6CD5\u586B\u7A7A\uFF0856\u201365 \u9898\uFF0C\u6BCF\u5C0F\u9898 1.5 \u5206\uFF0C\u5171 15 \u5206\uFF09", kind: "list", weight: 1.2, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 56 },
      { label: "\u4E94\u3001\u5E94\u7528\u6587\u5199\u4F5C\uFF0815 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "\u516D\u3001\u8BFB\u540E\u7EED\u5199\uFF0825 \u5206\uFF09", kind: "grid", weight: 2.4, cols: 22 }
    ]
  },
  {
    key: "physics",
    name: "\u7269\u7406",
    hint: "\u5355\u9009 7 + \u591A\u9009 3 + \u975E\u9009\u62E9 5",
    spec: "\u5BA2\u89C2 10 \u9898 \xB7 \u975E\u9009\u62E9 5 \u9898\uFF08\u6EE1\u5206 100\uFF09",
    fullScore: 100,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u5355\u9879\u9009\u62E9\u9898\uFF081\u20137 \u9898\uFF0C\u6BCF\u5C0F\u9898 4 \u5206\uFF0C\u5171 28 \u5206\uFF09", count: 7, score: 4 },
        { title: "\u4E8C\u3001\u591A\u9879\u9009\u62E9\u9898\uFF088\u201310 \u9898\uFF0C\u6BCF\u5C0F\u9898 5 \u5206\uFF0C\u5171 15 \u5206\uFF09", count: 3, score: 5 }
      ],
      options: ["A", "B", "C", "D"],
      score: 4
    },
    blocks: [
      { label: "\u4E09\u3001\u5B9E\u9A8C\u9898 11\uFF088 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "12\uFF0810 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "\u56DB\u3001\u8BA1\u7B97\u9898 13\uFF0810 \u5206\uFF09", kind: "lines", weight: 1.5 },
      { label: "14\uFF0813 \u5206\uFF09", kind: "lines", weight: 1.7 },
      { label: "15\uFF0816 \u5206\uFF09", kind: "lines", weight: 1.9 }
    ]
  },
  {
    key: "chemistry",
    name: "\u5316\u5B66",
    hint: "\u5355\u9009 + \u975E\u9009\u62E9\u9898\uFF08\u542B\u5B9E\u9A8C\u3001\u5DE5\u827A\u6D41\u7A0B\uFF09",
    spec: "\u5BA2\u89C2 14 \u9898 \xB7 \u975E\u9009\u62E9 4 \u9898\uFF08\u6EE1\u5206 100\uFF09",
    fullScore: 100,
    paperSize: "A4",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF081\u201314 \u9898\uFF0C\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 42 \u5206\uFF09", count: 14, score: 3 }],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u975E\u9009\u62E9\u9898 15\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "16\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "17\uFF0815 \u5206\uFF0C\u5B9E\u9A8C\u9898\uFF09", kind: "lines", weight: 1.6 },
      { label: "18\uFF0815 \u5206\uFF0C\u5DE5\u827A\u6D41\u7A0B\uFF09", kind: "lines", weight: 1.6 }
    ]
  },
  {
    key: "biology",
    name: "\u751F\u7269",
    hint: "\u5355\u9009 + \u591A\u9009 + \u975E\u9009\u62E9\u9898",
    spec: "\u5BA2\u89C2 20 \u9898 \xB7 \u975E\u9009\u62E9 5 \u9898\uFF08\u6EE1\u5206 100\uFF09",
    fullScore: 100,
    paperSize: "A4",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u5355\u9879\u9009\u62E9\u9898\uFF081\u201315 \u9898\uFF0C\u6BCF\u5C0F\u9898 2 \u5206\uFF0C\u5171 30 \u5206\uFF09", count: 15, score: 2 },
        { title: "\u4E8C\u3001\u591A\u9879\u9009\u62E9\u9898\uFF0816\u201320 \u9898\uFF0C\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 15 \u5206\uFF09", count: 5, score: 3 }
      ],
      options: ["A", "B", "C", "D"],
      score: 2
    },
    blocks: [
      { label: "\u4E09\u3001\u975E\u9009\u62E9\u9898 21\uFF0811 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "22\uFF0811 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "23\uFF0811 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "24\uFF0811 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "25\uFF0811 \u5206\uFF09", kind: "lines", weight: 1.2 }
    ]
  },
  {
    key: "politics",
    name: "\u653F\u6CBB",
    hint: "\u5355\u9009 + \u6750\u6599\u5206\u6790\u9898",
    spec: "\u5BA2\u89C2 16 \u9898 \xB7 \u975E\u9009\u62E9 4 \u9898\uFF08\u6EE1\u5206 100\uFF09",
    fullScore: 100,
    paperSize: "A3",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF081\u201316 \u9898\uFF0C\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 48 \u5206\uFF09", count: 16, score: 3 }],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u975E\u9009\u62E9\u9898 17\uFF0810 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "18\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.3 },
      { label: "19\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.5 },
      { label: "20\uFF0816 \u5206\uFF09", kind: "lines", weight: 1.7 }
    ]
  },
  {
    key: "history",
    name: "\u5386\u53F2",
    hint: "\u5355\u9009 + \u6750\u6599\u89E3\u6790 + \u5F00\u653E\u6027\u8BBA\u8FF0",
    spec: "\u5BA2\u89C2 16 \u9898 \xB7 \u975E\u9009\u62E9 4 \u9898\uFF08\u6EE1\u5206 100\uFF09",
    fullScore: 100,
    paperSize: "A3",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF081\u201316 \u9898\uFF0C\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 48 \u5206\uFF09", count: 16, score: 3 }],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u6750\u6599\u89E3\u6790\u9898 17\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "18\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "19\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.2 },
      { label: "20\u3001\u5F00\u653E\u6027\u8BBA\u8FF0\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.5 }
    ]
  },
  {
    key: "geography",
    name: "\u5730\u7406",
    hint: "\u5355\u9009 + \u7EFC\u5408\u9898\uFF08\u542B\u4F5C\u56FE\uFF09",
    spec: "\u5BA2\u89C2 16 \u9898 \xB7 \u7EFC\u5408\u9898 3 \u9898\uFF08\u6EE1\u5206 100\uFF09",
    fullScore: 100,
    paperSize: "A4",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF081\u201316 \u9898\uFF0C\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 48 \u5206\uFF09", count: 16, score: 3 }],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u7EFC\u5408\u9898 17\uFF0816 \u5206\uFF0C\u542B\u4F5C\u56FE\uFF09", kind: "lines", weight: 1.7 },
      { label: "18\uFF0818 \u5206\uFF09", kind: "lines", weight: 1.9 },
      { label: "19\uFF0818 \u5206\uFF0C\u9009\u505A\uFF09", kind: "lines", weight: 1.9 }
    ]
  }
];
var VOCATIONAL = [
  {
    key: "v-chinese",
    name: "\u8BED\u6587",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u9009\u62E9 + \u9605\u8BFB + \u5E94\u7528\u6587 + \u4F5C\u6587",
    spec: "\u5BA2\u89C2 12 \u9898 \xB7 \u4E3B\u89C2 3 \u5757 \xB7 \u4F5C\u6587 600 \u5B57",
    fullScore: 120,
    paperSize: "A3",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 36 \u5206\uFF09", count: 12 }],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u73B0\u4EE3\u6587\u9605\u8BFB\uFF0818 \u5206\uFF09", kind: "lines", weight: 1.3 },
      { label: "\u4E09\u3001\u6587\u8A00\u6587\u9605\u8BFB\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.1 },
      { label: "\u56DB\u3001\u8BED\u8A00\u8868\u8FBE\u4E0E\u5E94\u7528\uFF0812 \u5206\uFF09", kind: "lines", weight: 1 },
      { label: "\u4E94\u3001\u4F5C\u6587\uFF0840 \u5206\uFF0C\u4E0D\u5C11\u4E8E 600 \u5B57\uFF09", kind: "grid", weight: 2.8, cols: 20 }
    ]
  },
  {
    key: "v-math",
    name: "\u6570\u5B66",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u9009\u62E9 + \u586B\u7A7A + \u89E3\u7B54",
    spec: "\u5BA2\u89C2 12 \u9898 \xB7 \u586B\u7A7A 4 \u9898 \xB7 \u89E3\u7B54 4 \u9898",
    fullScore: 120,
    paperSize: "A3",
    objective: {
      groups: [{ title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 4 \u5206\uFF0C\u5171 48 \u5206\uFF09", count: 12, score: 4 }],
      options: ["A", "B", "C", "D"],
      score: 4
    },
    blocks: [
      { label: "\u4E8C\u3001\u586B\u7A7A\u9898\uFF08\u6BCF\u5C0F\u9898 4 \u5206\uFF0C\u5171 16 \u5206\uFF09", kind: "list", weight: 1, items: [2, 2, 2, 2], startNumber: 13 },
      { label: "\u4E09\u3001\u89E3\u7B54\u9898 17\uFF0812 \u5206\uFF09", kind: "lines", weight: 1.4 },
      { label: "18\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.5 },
      { label: "19\uFF0814 \u5206\uFF09", kind: "lines", weight: 1.5 },
      { label: "20\uFF0816 \u5206\uFF09", kind: "lines", weight: 1.7 }
    ]
  },
  {
    key: "v-english",
    name: "\u82F1\u8BED",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u9009\u62E9 + \u8865\u5168\u5BF9\u8BDD + \u5199\u4F5C",
    spec: "\u5BA2\u89C2 30 \u9898 \xB7 \u8865\u5168\u5BF9\u8BDD 5 \xB7 \u4E66\u9762\u8868\u8FBE 1 \u7BC7",
    fullScore: 100,
    paperSize: "A4",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u5355\u9879\u9009\u62E9\uFF081\u201320 \u9898\uFF0C\u6BCF\u5C0F\u9898 1.5 \u5206\uFF0C\u5171 30 \u5206\uFF09", count: 20, score: 1.5 },
        { title: "\u4E8C\u3001\u9605\u8BFB\u7406\u89E3\uFF0821\u201330 \u9898\uFF0C\u6BCF\u5C0F\u9898 2 \u5206\uFF0C\u5171 20 \u5206\uFF09", count: 10, score: 2 }
      ],
      options: ["A", "B", "C", "D"],
      score: 1.5
    },
    blocks: [
      { label: "\u4E09\u3001\u8865\u5168\u5BF9\u8BDD\uFF08\u6BCF\u5C0F\u9898 2 \u5206\uFF0C\u5171 10 \u5206\uFF09", kind: "list", weight: 1, items: [1, 1, 1, 1, 1], startNumber: 31 },
      { label: "\u56DB\u3001\u4E66\u9762\u8868\u8FBE\uFF0820 \u5206\uFF09", kind: "lines", weight: 2 }
    ]
  },
  {
    key: "v-major",
    name: "\u4E13\u4E1A\u7EFC\u5408\uFF08\u673A\u68B0\u7C7B\uFF09",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u673A\u68B0\u4E13\u4E1A\u7406\u8BBA",
    spec: "\u5BA2\u89C2 20 \u9898 \xB7 \u586B\u7A7A 10 \xB7 \u7B80\u7B54 2 \xB7 \u7EFC\u5408 2",
    fullScore: 200,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 60 \u5206\uFF09", count: 20, score: 3 }
      ],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u586B\u7A7A\u9898\uFF08\u6BCF\u7A7A 2 \u5206\uFF0C\u5171 30 \u5206\uFF09", kind: "list", weight: 1, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 21 },
      { label: "\u4E09\u3001\u7B80\u7B54\u9898 31\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "32\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "\u56DB\u3001\u7EFC\u5408\u5E94\u7528\u9898 33\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 },
      { label: "34\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 }
    ]
  },
  {
    key: "v-elec",
    name: "\u4E13\u4E1A\u7EFC\u5408\uFF08\u7535\u5DE5\u7535\u5B50\u7C7B\uFF09",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u7535\u5DE5\u7535\u5B50\u4E13\u4E1A\u7406\u8BBA",
    spec: "\u5BA2\u89C2 20 \u9898 \xB7 \u586B\u7A7A 10 \xB7 \u7B80\u7B54 2 \xB7 \u7EFC\u5408 2",
    fullScore: 200,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 60 \u5206\uFF09", count: 20, score: 3 }
      ],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u586B\u7A7A\u9898\uFF08\u6BCF\u7A7A 2 \u5206\uFF0C\u5171 30 \u5206\uFF09", kind: "list", weight: 1, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 21 },
      { label: "\u4E09\u3001\u7B80\u7B54\u9898 31\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "32\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "\u56DB\u3001\u7EFC\u5408\u5206\u6790\u9898 33\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 },
      { label: "34\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 }
    ]
  },
  {
    key: "v-cs",
    name: "\u4E13\u4E1A\u7EFC\u5408\uFF08\u8BA1\u7B97\u673A\u7C7B\uFF09",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u8BA1\u7B97\u673A\u4E13\u4E1A\u7406\u8BBA",
    spec: "\u5BA2\u89C2 20 \u9898 \xB7 \u586B\u7A7A 10 \xB7 \u7B80\u7B54 2 \xB7 \u7F16\u7A0B 2",
    fullScore: 200,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 60 \u5206\uFF09", count: 20, score: 3 }
      ],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u586B\u7A7A\u9898\uFF08\u6BCF\u7A7A 2 \u5206\uFF0C\u5171 30 \u5206\uFF09", kind: "list", weight: 1, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 21 },
      { label: "\u4E09\u3001\u7B80\u7B54\u9898 31\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "32\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "\u56DB\u3001\u7A0B\u5E8F\u8BBE\u8BA1\u9898 33\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 },
      { label: "34\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 }
    ]
  },
  {
    key: "v-nurse",
    name: "\u4E13\u4E1A\u7EFC\u5408\uFF08\u62A4\u7406\u7C7B\uFF09",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u62A4\u7406\u4E13\u4E1A\u7406\u8BBA",
    spec: "\u5BA2\u89C2 20 \u9898 \xB7 \u586B\u7A7A 10 \xB7 \u7B80\u7B54 2 \xB7 \u6848\u4F8B\u5206\u6790 2",
    fullScore: 200,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 60 \u5206\uFF09", count: 20, score: 3 }
      ],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u586B\u7A7A\u9898\uFF08\u6BCF\u7A7A 2 \u5206\uFF0C\u5171 30 \u5206\uFF09", kind: "list", weight: 1, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 21 },
      { label: "\u4E09\u3001\u7B80\u7B54\u9898 31\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "32\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "\u56DB\u3001\u6848\u4F8B\u5206\u6790 33\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 },
      { label: "34\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 }
    ]
  },
  {
    key: "v-fin",
    name: "\u4E13\u4E1A\u7EFC\u5408\uFF08\u8D22\u7ECF\u7C7B\uFF09",
    hint: "\u804C\u6559\u9AD8\u8003 \xB7 \u8D22\u7ECF\u4E13\u4E1A\u7406\u8BBA",
    spec: "\u5BA2\u89C2 20 \u9898 \xB7 \u586B\u7A7A 10 \xB7 \u7B80\u7B54 2 \xB7 \u4E1A\u52A1\u9898 2",
    fullScore: 200,
    paperSize: "A3",
    objective: {
      groups: [
        { title: "\u4E00\u3001\u9009\u62E9\u9898\uFF08\u6BCF\u5C0F\u9898 3 \u5206\uFF0C\u5171 60 \u5206\uFF09", count: 20, score: 3 }
      ],
      options: ["A", "B", "C", "D"],
      score: 3
    },
    blocks: [
      { label: "\u4E8C\u3001\u586B\u7A7A\u9898\uFF08\u6BCF\u7A7A 2 \u5206\uFF0C\u5171 30 \u5206\uFF09", kind: "list", weight: 1, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 21 },
      { label: "\u4E09\u3001\u7B80\u7B54\u9898 31\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "32\uFF0820 \u5206\uFF09", kind: "lines", weight: 1.6 },
      { label: "\u56DB\u3001\u4E1A\u52A1\u6838\u7B97\u9898 33\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 },
      { label: "34\uFF0835 \u5206\uFF09", kind: "lines", weight: 2.2 }
    ]
  }
];
var GAOKAO_SUBJECTS = GAOKAO;
var VOCATIONAL_SUBJECTS = VOCATIONAL;
function buildFromMeta(meta, size = "A4") {
  const orient = defaultOrientation(size);
  const design = emptyDesign(size, orient);
  design.front.side = "front";
  design.back.side = "back";
  const c = canvasOf(size, orient);
  const landscape = c.w > c.h;
  const M = Math.round(c.h * 0.045);
  const inner = c.w - M * 2;
  const colCount = landscape ? 3 : 1;
  const colGap = landscape ? 12 : 0;
  const colW = Math.round((inner - colGap * (colCount - 1)) / colCount);
  const base = colW / 280;
  const F = {
    bigNo: Math.round(22 * base),
    // 左上角大页码
    red: Math.round(7.6 * base),
    // 红色考试名
    title: Math.round(15 * base),
    // 数学答题卡
    body: Math.round(6.4 * base),
    // 正文
    sec: Math.round(7.6 * base),
    // 大题标题
    band: Math.round(7.4 * base),
    // 卷别横条
    foot: Math.round(5.4 * base)
    // 页脚
  };
  const rowH = Math.round(F.body * 2.7);
  const gapY = Math.round(5 * base);
  const footerH = Math.round(F.foot * 4.2);
  const secH = Math.round(F.sec * 1.9);
  const colX = (i) => M + i * (colW + colGap);
  const slots = [];
  for (const page of [0, 1]) {
    for (let i = 0; i < colCount; i += 1) {
      slots.push({ page, col: i, y: M, end: c.h - M - footerH - gapY });
    }
  }
  let si = 0;
  const pages = [[], []];
  const room = () => slots[si].end - slots[si].y;
  const nextSlot = () => {
    if (si < slots.length - 1) {
      si += 1;
      return true;
    }
    return false;
  };
  const put = (el, h = el.h) => {
    for (; ; ) {
      const s0 = slots[si];
      if (s0.y + h <= s0.end) {
        el.x = colX(s0.col);
        el.y = s0.y;
        el.w = colW;
        el.h = h;
        pages[s0.page].push(el);
        s0.y += h + gapY;
        return true;
      }
      if (!nextSlot()) return false;
    }
  };
  const mkSize = Math.round(Math.min(c.w, c.h) * 0.032);
  const markers = {
    id: uid("mk"),
    kind: "markers",
    x: 0,
    y: 0,
    w: c.w,
    h: c.h,
    size: mkSize,
    inset: { x: Math.round(M * 0.5), y: Math.round(M * 0.5) }
  };
  const header = (suffix, isBack, pageNo = 1) => {
    if (isBack) {
      put({
        id: uid("info"),
        kind: "studentInfo",
        x: 0,
        y: 0,
        w: 0,
        h: Math.round(F.body * 3),
        fields: ["\u59D3\u540D", "\u51C6\u8003\u8BC1\u53F7"],
        columns: 2,
        fontSize: F.body,
        boxed: false
      });
      return;
    }
    put({
      id: uid("pno"),
      kind: "title",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.bigNo * 1.5),
      text: String(pageNo),
      fontSize: F.bigNo,
      bold: true,
      align: "left",
      lineHeight: 1.1
    });
    put({
      id: uid("red"),
      kind: "title",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.red * 2.1),
      text: "\u666E\u901A\u9AD8\u7B49\u5B66\u6821\u62DB\u751F\u5168\u56FD\u7EDF\u4E00\u8003\u8BD5",
      fontSize: F.red,
      bold: true,
      align: "center",
      lineHeight: 1.3,
      color: "#c0392b"
    });
    put({
      id: uid("title"),
      kind: "title",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.title * 1.7),
      text: `${meta.name} \u7B54 \u9898 \u5361${suffix}`,
      fontSize: F.title,
      bold: true,
      align: "center",
      lineHeight: 1.25
    });
    put({
      id: uid("info"),
      kind: "studentInfo",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.body * 3.4),
      fields: ["\u59D3\u540D", "\u5EA7\u53F7"],
      columns: 2,
      fontSize: F.body,
      boxed: false
    });
    {
      const s0 = slots[si];
      const noH = Math.round(F.body * 4.2);
      const bcW = Math.round(colW * 0.34);
      const bcH = Math.round(noH * 2.2);
      const noW = colW - bcW - gapY;
      pages[s0.page].push({
        id: uid("no"),
        kind: "examNo",
        x: colX(s0.col),
        y: s0.y,
        w: noW,
        h: noH,
        label: "\u8003\u751F\u53F7",
        digits: 12,
        fontSize: F.body
      });
      pages[s0.page].push({
        id: uid("bc"),
        kind: "barcode",
        x: colX(s0.col) + noW + gapY,
        y: s0.y,
        w: bcW,
        h: bcH,
        label: "\u8D34\u6761\u5F62\u7801\u533A",
        rotate: 0,
        vertical: false,
        dashed: true,
        note: "\u7531\u76D1\u8003\u5458\u8D1F\u8D23\u7C98\u8D34"
      });
      s0.y += Math.max(noH, bcH) + gapY;
    }
    put({
      id: uid("notice"),
      kind: "notice",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(6 * F.body * 2.05 + F.body * 2),
      text: "1\uFF0E\u7B54\u9898\u524D\uFF0C\u8003\u751F\u5148\u5C06\u81EA\u5DF1\u7684\u59D3\u540D\u3001\u8003\u751F\u53F7\u586B\u5199\u6E05\u695A\uFF0C\u5E76\u6838\u5BF9\u6761\u5F62\u7801\u4FE1\u606F\u3002\n2\uFF0E\u9009\u62E9\u9898\u5FC5\u987B\u4F7F\u7528 2B \u94C5\u7B14\u6309\u9898\u53F7\u586B\u6D82\uFF0C\u4FEE\u6539\u65F6\u7528\u6A61\u76AE\u64E6\u5E72\u51C0\u3002\n3\uFF0E\u975E\u9009\u62E9\u9898\u5FC5\u987B\u4F7F\u7528 0.5 \u6BEB\u7C73\u9ED1\u8272\u7B7E\u5B57\u7B14\u4E66\u5199\uFF0C\u5B57\u4F53\u5DE5\u6574\u3001\u7B14\u8FF9\u6E05\u695A\u3002\n4\uFF0E\u8BF7\u6309\u9898\u53F7\u5728\u5404\u9898\u7684\u7B54\u9898\u533A\u57DF\u5185\u4F5C\u7B54\uFF0C\u8D85\u51FA\u7B54\u9898\u533A\u57DF\u4E66\u5199\u7684\u7B54\u6848\u65E0\u6548\u3002\n5\uFF0E\u4FDD\u6301\u5361\u9762\u6E05\u6D01\uFF0C\u4E0D\u8981\u6298\u53E0\u3001\u4E0D\u8981\u5F04\u7834\uFF0C\u4E25\u7981\u5728\u5361\u9762\u4F5C\u4EFB\u4F55\u6807\u8BB0\u3002\n6\uFF0E\u4E25\u7981\u5728\u6761\u5F62\u7801\u548C\u5B9A\u4F4D\u70B9\uFF08\u9ED1\u65B9\u5757\uFF09\u5468\u56F4\u505A\u4EFB\u4F55\u6D82\u5199\u548C\u6807\u8BB0\u3002",
      fontSize: F.body,
      align: "left",
      lineHeight: 2.05,
      sideLabel: "\u6CE8\u610F\u4E8B\u9879"
    });
    put({
      id: uid("legend"),
      kind: "legend",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.body * 2.6),
      fontSize: F.body
    });
    put({
      id: uid("ban"),
      kind: "forbidden",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.body * 3.2),
      fontSize: F.body,
      frame: "red"
    });
  };
  header("", false);
  const objCols = 2;
  const maxRows = 6;
  const band = (text) => put({
    id: uid("band"),
    kind: "subtitle",
    x: 0,
    y: 0,
    w: 0,
    h: Math.round(F.band * 2.3),
    text,
    fontSize: F.band,
    bold: true,
    align: "center",
    lineHeight: 1.25,
    fill: "#2b2f35",
    invert: true
  });
  band("\u7B2C\u2160\u5377\uFF08\u9009\u62E9\u9898\u3000\u7528 2B \u94C5\u7B14\u586B\u6D82\uFF09");
  let cursorNo = 1;
  for (const g of meta.objective.groups) {
    const blocks = Math.max(1, Math.ceil(g.count / (objCols * maxRows)));
    const rowsPerBlock = Math.min(maxRows, Math.ceil(g.count / (objCols * blocks)));
    put({
      id: uid("sec"),
      kind: "subtitle",
      x: 0,
      y: 0,
      w: 0,
      h: secH,
      text: g.title,
      fontSize: F.sec,
      bold: true,
      align: "left"
    });
    put({
      id: uid("obj"),
      kind: "objective",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(10 + blocks * rowsPerBlock * rowH + (blocks - 1) * F.body * 1.2),
      rows: rowsPerBlock,
      cols: objCols,
      blocks,
      count: g.count,
      options: g.options ?? meta.objective.options,
      startNumber: cursorNo,
      fontSize: F.body,
      score: g.score ?? meta.objective.score,
      markStyle: "bracket"
    });
    cursorNo += g.count;
  }
  if (cursorNo > 1) {
    band("\u7B2C\u2161\u5377\uFF08\u975E\u9009\u62E9\u9898\u3000\u7528 0.5mm \u9ED1\u8272\u7B7E\u5B57\u7B14\u4E66\u5199\uFF09");
    put({
      id: uid("score"),
      kind: "scoreBox",
      x: 0,
      y: 0,
      w: 0,
      h: Math.round(F.body * 3.2),
      count: Math.min(12, meta.blocks.length + 2),
      fontSize: Math.round(F.body * 0.84)
    });
  }
  const needBackHeader = true;
  let backHeaderDone = false;
  for (const b of meta.blocks) {
    if (room() < secH + rowH * 3 + gapY && !nextSlot()) break;
    if (needBackHeader && !backHeaderDone && slots[si].page === 1) {
      header("", true);
      backHeaderDone = true;
    }
    put({
      id: uid("sec"),
      kind: "subtitle",
      x: 0,
      y: 0,
      w: 0,
      h: secH,
      text: b.label,
      fontSize: F.sec,
      bold: true,
      align: "left"
    });
    if (b.kind === "list" && b.items?.length) {
      const need = b.items.reduce((a, n) => a + n, 0) * rowH + 8;
      put({
        id: uid("list"),
        kind: "questionList",
        x: 0,
        y: 0,
        w: 0,
        h: Math.min(need, Math.max(rowH * 6, room())),
        startNumber: b.startNumber ?? 1,
        items: b.items,
        fontSize: F.body,
        rowHeight: rowH
      });
      continue;
    }
    if (b.kind === "grid") {
      const gridCols = b.cols ?? 20;
      const cell = Math.round(colW / gridCols);
      const rowsFit = Math.max(4, Math.floor((room() - cell) / cell));
      put({
        id: uid("grid"),
        kind: "gridPaper",
        x: 0,
        y: 0,
        w: 0,
        h: (rowsFit + 1) * cell,
        cols: gridCols,
        cell,
        topicLine: true
      });
      continue;
    }
    const available = room();
    const wanted = Math.round(available / rowH);
    const rows = Math.max(3, Math.min(wanted, Math.round(20 * b.weight)));
    const ok = put({
      id: uid("area"),
      kind: "subjective",
      x: 0,
      y: 0,
      w: 0,
      h: rows * rowH,
      label: "",
      rows,
      rowHeight: rowH,
      prompt: "\u89E3\uFF1A",
      ruled: false,
      frame: "red"
    });
    if (!ok) break;
  }
  const totalPages = colCount * 2;
  for (let page = 0; page < 2; page += 1) {
    for (let i = 0; i < colCount; i += 1) {
      const no = page * colCount + i + 1;
      pages[page].push({
        id: uid("foot"),
        kind: "notice",
        x: colX(i),
        y: c.h - M - footerH,
        w: colW,
        h: footerH,
        text: `\u8BF7\u5728\u5404\u9898\u76EE\u7684\u7B54\u9898\u533A\u57DF\u5185\u4F5C\u7B54\uFF0C\u8D85\u51FA\u9ED1\u8272\u77E9\u5F62\u8FB9\u6846\u9650\u5B9A\u533A\u57DF\u7684\u7B54\u6848\u65E0\u6548
${meta.name}\u3000\u7B2C ${no} \u9875 \u5171 ${totalPages} \u9875`,
        fontSize: F.foot,
        align: "center",
        lineHeight: 1.35
      });
    }
  }
  design.front.elements = [markers, ...pages[0]];
  design.back.elements = pages[1];
  return design;
}

// scripts/emit-templates.ts
var OUT = process.env.TPL_OUT || "D:\\Leven\\Downloads\\\u9274\u88C1-\u7B54\u9898\u5361\u6A21\u677F";
var VARIANTS = [
  { key: "standard", label: "\u6807\u51C6\u7248", desc: "\u5B8C\u6574\u9898\u91CF\uFF0C\u671F\u4E2D\u671F\u672B / \u6A21\u62DF\u8003" },
  { key: "lite", label: "\u7CBE\u7B80\u7248", desc: "\u9898\u91CF\u7EA6\u516D\u6210\uFF0C\u968F\u5802\u6D4B / \u5355\u5143\u6D4B" }
];
function liteMeta(meta) {
  return {
    ...meta,
    objective: {
      ...meta.objective,
      groups: meta.objective.groups.map((g) => ({ ...g, count: Math.max(3, Math.round(g.count * 0.6)) }))
    },
    blocks: meta.blocks.map((b) => ({ ...b, weight: Math.round(b.weight * 0.7 * 100) / 100 }))
  };
}
var META_MAP = {
  standard: (m) => m,
  lite: liteMeta
};
function validate(paper, cw, ch) {
  const bad = [];
  if (paper.markers.length !== 4) bad.push(`markers ${paper.markers.length}\u22604`);
  const ids = paper.markers.map((m) => m.id).sort().join(",");
  if (ids !== "bottom-left,bottom-right,top-left,top-right") bad.push(`markers id \u9519`);
  for (const m of paper.markers) {
    if (m.x < 0 || m.y < 0 || m.x > cw || m.y > ch) bad.push(`marker \u8D8A\u754C ${m.id}`);
  }
  for (const q of paper.questions) {
    if (typeof q.score !== "number") bad.push(`${q.id} \u7F3A score`);
    if (!q.choices || q.choices.length < 2) bad.push(`${q.id} \u9009\u9879<2`);
    for (const c of q.choices ?? []) {
      const r2 = c.region;
      if (r2.x < -1e-6 || r2.y < -1e-6 || r2.x + r2.width > 1.0001 || r2.y + r2.height > 1.0001) bad.push(`${q.id} \u9009\u9879\u533A\u8D8A\u754C`);
    }
    const r = q.region;
    if (r.x < 0 || r.y < 0 || r.x + r.width > cw + 0.5 || r.y + r.height > ch + 0.5) bad.push(`${q.id} \u9898\u533A\u8D8A\u754C`);
  }
  return bad;
}
function checkLayout(design) {
  const c = canvasOf(design.front.size, design.front.orientation);
  const bad = [];
  const ov = (a, b) => !(a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5);
  for (const side of ["front", "back"]) {
    const els = design[side].elements.filter((e) => !e.hidden && e.kind !== "markers");
    for (const e of els) {
      if (e.x < -0.5 || e.y < -0.5 || e.x + e.w > c.w + 0.5 || e.y + e.h > c.h + 0.5) {
        bad.push(`${side} \u8D8A\u754C ${e.kind}`);
      }
    }
    for (let i = 0; i < els.length; i += 1) {
      for (let j = i + 1; j < els.length; j += 1) {
        if (ov(els[i], els[j])) bad.push(`${side} \u91CD\u53E0 ${els[i].kind}/${els[j].kind}`);
      }
    }
  }
  return bad;
}
(0, import_node_fs.mkdirSync)(OUT, { recursive: true });
var index = {
  product: "\u9274\u88C1",
  quote: "\u81EA\u60ED\u8870\u75C5\u5FC3\u795E\u8017\uFF0C\u8D56\u6709\u7FA4\u516C\u9274\u88C1\u7CBE\u3002",
  source: "\u6B27\u9633\u4FEE\u300A\u793C\u90E8\u8D21\u9662\u9605\u8FDB\u58EB\u5C31\u8BD5\u300B",
  standard: "\u6E56\u5317\u7701\u6559\u80B2\u8003\u8BD5\u9662\u300A2026 \u5E74\u9AD8\u8003\u6E29\u99A8\u63D0\u793A\u300B",
  count: 0,
  note: "design = \u8BBE\u8BA1\u7A3F v2\uFF1Bpaper = \u540E\u7AEF v1\uFF08\u53EF\u76F4\u63A5 PUT /api/v1/papers/{id}\uFF09",
  papers: [
    { size: "A4", mm: PAPER_MM.A4, note: "\u5916\u8BED\u3001\u5316\u5B66\u3001\u751F\u7269\u3001\u5730\u7406" },
    { size: "A3", mm: PAPER_MM.A3, note: "\u8BED\u6587\u3001\u6570\u5B66\u3001\u7269\u7406\u3001\u5386\u53F2\u3001\u653F\u6CBB\u3001\u6280\u80FD\u9AD8\u8003\u6587\u5316\u7EFC\u5408" }
  ],
  subjects: []
};
var problems = [];
function emit(meta, examType) {
  for (const v of VARIANTS) {
    const design = buildFromMeta(META_MAP[v.key](meta), meta.paperSize);
    const paper = compile(design);
    const geo = canvasOf(meta.paperSize, design.front.orientation);
    const tag = `${examType === "vocational" ? "\u804C\u6559" : "\u666E\u9AD8"}-${meta.name}-${meta.paperSize}-${v.label}`;
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(OUT, `${tag}.design.json`), JSON.stringify(design, null, 2), "utf8");
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(OUT, `${tag}.paper.json`), JSON.stringify(paper, null, 2), "utf8");
    const bad = [...validate(paper, geo.w, geo.h), ...checkLayout(design)];
    const all = [...design.front.elements, ...design.back.elements];
    const has = (k) => all.some((e) => e.kind === k);
    const bands = all.filter((e) => e.kind === "subtitle" && e.fill);
    if (!has("markers")) bad.push("\u7F3A\u5B9A\u4F4D\u5757");
    if (!has("examNo")) bad.push("\u7F3A\u51C6\u8003\u8BC1\u53F7");
    if (!has("barcode")) bad.push("\u7F3A\u6761\u5F62\u7801");
    if (!has("notice")) bad.push("\u7F3A\u6CE8\u610F\u4E8B\u9879");
    if (!has("legend")) bad.push("\u7F3A\u586B\u6D82\u6837\u4F8B");
    if (!has("forbidden")) bad.push("\u7F3A\u8003\u751F\u7981\u586B");
    if (!has("objective")) bad.push("\u7F3A\u5BA2\u89C2\u9898");
    if (!has("scoreBox")) bad.push("\u7F3A\u9605\u5377\u5F97\u5206\u8868");
    if (bands.length < 2) bad.push(`\u5377\u522B\u6A2A\u6761\u53EA\u6709 ${bands.length} \u6761`);
    if (!all.some((e) => e.kind === "title" && e.color)) bad.push("\u7F3A\u7EA2\u8272\u8003\u8BD5\u540D");
    if (bad.length) problems.push(`${tag}: ${bad.slice(0, 3).join(" / ")}`);
    index.count += 1;
    index.subjects.push({
      examType,
      subject: meta.name,
      key: meta.key,
      size: meta.paperSize,
      variant: v.key,
      variantLabel: v.label,
      fullScore: meta.fullScore,
      orientation: design.front.orientation,
      pxSize: { width: geo.w, height: geo.h },
      mmSize: { width: geo.mmW, height: geo.mmH },
      questions: paper.questions.length,
      markers: paper.markers.length,
      blocks: paper.blocks?.length ?? 0,
      files: { design: `${tag}.design.json`, paper: `${tag}.paper.json` },
      spec: meta.spec
    });
  }
}
for (const m of GAOKAO_SUBJECTS) emit(m, "gaokao");
for (const m of VOCATIONAL_SUBJECTS) emit(m, "vocational");
(0, import_node_fs.writeFileSync)((0, import_node_path.join)(OUT, "index.json"), JSON.stringify(index, null, 2), "utf8");
var readme = `# \u9274\u88C1 \xB7 \u7B54\u9898\u5361\u6A21\u677F\uFF08\u5171 ${index.count} \u4EFD\uFF09

> \u4EA7\u54C1\u540D\u53D6\u81EA\u6B27\u9633\u4FEE\u300A\u793C\u90E8\u8D21\u9662\u9605\u8FDB\u58EB\u5C31\u8BD5\u300B\uFF1A\u300C\u81EA\u60ED\u8870\u75C5\u5FC3\u795E\u8017\uFF0C\u8D56\u6709\u7FA4\u516C\u9274\u88C1\u7CBE\u3002\u300D

---

## \u4E00\u3001\u4F9D\u636E

- **\u6E56\u5317\u7701\u6559\u80B2\u8003\u8BD5\u9662\u300A2026 \u5E74\u9AD8\u8003\u6E29\u99A8\u63D0\u793A\u300B**\uFF082026-06-04\uFF09
- \u53C2\u8003\u5B9E\u62CD\u56FE\uFF1A\`D:\\Leven\\Downloads\\\u7B54\u9898\u5361\u53C2\u8003\u56FE\\\`

\u5B98\u65B9\u660E\u786E\u7684\u51E0\u6761\uFF0C\u5DF2\u5168\u90E8\u843D\u5230\u6A21\u677F\u91CC\uFF1A

1. **\u7EB8\u578B\u6309\u79D1\u76EE\u5206**\uFF1A\u8BED\u6587\u3001\u6570\u5B66\u3001\u7269\u7406\u3001\u5386\u53F2\u3001\u601D\u60F3\u653F\u6CBB\u3001\u6280\u80FD\u9AD8\u8003\u6587\u5316\u7EFC\u5408 \u2192 **A3**\uFF1B
   \u5916\u8BED\u3001\u5316\u5B66\u3001\u751F\u7269\u3001\u5730\u7406 \u2192 **A4**
2. **\u8003\u751F\u4FE1\u606F\u533A**\uFF1A\u59D3\u540D\u3001\u51C6\u8003\u8BC1\u53F7\u3001\u8003\u573A\u53F7\u3001\u5EA7\u4F4D\u53F7\uFF0C**\u6B63\u53CD\u4E24\u9762\u90FD\u6709**
   \uFF08\u5B98\u65B9\u539F\u8BDD\uFF1A\u300C\u4E3A\u786E\u4FDD\u626B\u63CF\u51C6\u786E\u65E0\u8BEF\uFF0C\u5404\u79D1\u7B54\u9898\u5361\u80CC\u9762\u4E5F\u6709\u8003\u751F\u59D3\u540D\u3001\u5EA7\u4F4D\u53F7\u586B\u5199\u5185\u5BB9\u300D\uFF09
3. **\u56FE\u50CF\u5B9A\u4F4D\u70B9**\uFF1A\u9009\u62E9\u9898\u5B9A\u4F4D\u70B9 + \u975E\u9009\u62E9\u9898\u5B9A\u4F4D\u70B9
4. **\u7B54\u9898\u533A\u57DF**\uFF1A\u9009\u62E9\u9898\u586B\u6D82\u533A\uFF082B \u94C5\u7B14\uFF09+ \u975E\u9009\u62E9\u9898\u4E66\u5199\u533A\uFF080.5mm \u9ED1\u8272\u7B7E\u5B57\u7B14\uFF0C\u6309\u9898\u53F7\u5206\u5272\uFF09
5. **\u7981\u6B62\u4E8B\u9879**\uFF1A\u4E0D\u5F97\u6298\u53E0\u3001\u4E0D\u5F97\u5728\u5B9A\u4F4D\u70B9\uFF08\u9ED1\u65B9\u5757\uFF09\u5468\u56F4\u6D82\u5199

---

## \u4E8C\u3001\u8986\u76D6\u8303\u56F4

| \u4F53\u7CFB | \u79D1\u76EE | \u7EB8\u578B | \u5BA2\u89C2\u9898 | \u4E3B\u89C2\u9898 |
|---|---|---|---|---|
| \u666E\u9AD8 | \u8BED\u6587 | A3 | 10 \u9898 | \u73B0\u4EE3\u6587/\u53E4\u8BD7\u6587/\u8BED\u7528 + \u9ED8\u5199\u5C0F\u9898 + \u4F5C\u6587\u683C |
| \u666E\u9AD8 | \u6570\u5B66 | A3 | 8 \u5355\u9009 + 4 \u591A\u9009 | \u586B\u7A7A 4 + \u89E3\u7B54 5 |
| \u666E\u9AD8 | \u82F1\u8BED | A4 | \u542C\u529B 20 + \u9605\u8BFB 20 + \u5B8C\u5F62 15 | \u8BED\u6CD5\u586B\u7A7A 10 + \u5E94\u7528\u6587 + \u8BFB\u540E\u7EED\u5199 |
| \u666E\u9AD8 | \u7269\u7406 | A3 | 7 \u5355\u9009 + 3 \u591A\u9009 | \u5B9E\u9A8C 2 + \u8BA1\u7B97 3 |
| \u666E\u9AD8 | \u5316\u5B66 | A4 | 14 \u9898 | \u975E\u9009\u62E9 4\uFF08\u542B\u5B9E\u9A8C\u3001\u5DE5\u827A\u6D41\u7A0B\uFF09 |
| \u666E\u9AD8 | \u751F\u7269 | A4 | 15 \u5355\u9009 + 5 \u591A\u9009 | \u975E\u9009\u62E9 5 |
| \u666E\u9AD8 | \u653F\u6CBB | A3 | 16 \u9898 | \u975E\u9009\u62E9 4 |
| \u666E\u9AD8 | \u5386\u53F2 | A3 | 16 \u9898 | \u6750\u6599\u89E3\u6790 3 + \u5F00\u653E\u6027\u8BBA\u8FF0 |
| \u666E\u9AD8 | \u5730\u7406 | A4 | 16 \u9898 | \u7EFC\u5408\u9898 3\uFF08\u542B\u4F5C\u56FE\uFF09 |
| \u804C\u6559 | \u8BED\u6587 | A3 | 12 \u9898 | \u9605\u8BFB 2 + \u8BED\u8A00\u8868\u8FBE + \u4F5C\u6587\u683C |
| \u804C\u6559 | \u6570\u5B66 | A3 | 12 \u9898 | \u586B\u7A7A 4 + \u89E3\u7B54 4 |
| \u804C\u6559 | \u82F1\u8BED | A4 | 20 + 10 | \u8865\u5168\u5BF9\u8BDD 5 + \u4E66\u9762\u8868\u8FBE |
| \u804C\u6559 | \u4E13\u4E1A\u7EFC\u5408 | A3 | 20 \u9898 | \u586B\u7A7A 10 + \u7B80\u7B54 2 + \u7EFC\u5408 2 |

\u6BCF\u79D1\u4E24\u4E2A\u7248\u672C\uFF1A**\u6807\u51C6\u7248**\uFF08\u5B8C\u6574\u9898\u91CF\uFF09\u3001**\u7CBE\u7B80\u7248**\uFF08\u7EA6\u516D\u6210\uFF0C\u968F\u5802\u6D4B\uFF09\u3002

---

## \u4E09\u3001\u6587\u4EF6\u8BF4\u660E

| \u6587\u4EF6 | \u7528\u9014 |
|---|---|
| \`\u666E\u9AD8-\u8BED\u6587-A3-\u6807\u51C6\u7248.paper.json\` | \u540E\u7AEF \`PUT /api/v1/papers/{id}\` \u53EF\u76F4\u63A5\u7528 |
| \`\u666E\u9AD8-\u8BED\u6587-A3-\u6807\u51C6\u7248.design.json\` | \u8BBE\u8BA1\u7A3F v2\uFF0C\u524D\u7AEF\u300C\u5BFC\u5165\u300D\u6309\u94AE\u53EF\u8BFB |
| \`index.json\` | \u7D22\u5F15\uFF1A\u79D1\u76EE\u3001\u7EB8\u578B\u3001\u7248\u672C\u3001\u9898\u91CF\u3001\u753B\u5E03\u5C3A\u5BF8\u3001\u6587\u4EF6\u5BF9\u5E94 |
| \`README.md\` | \u672C\u6587\u4EF6 |

\u547D\u540D\uFF1A\`<\u4F53\u7CFB>-<\u79D1\u76EE>-<\u7EB8\u578B>-<\u7248\u672C>\`

---

## \u56DB\u3001\u73B0\u6709\u63A5\u53E3\u7684\u786C\u7EA6\u675F\uFF08\u5DF2\u9010\u4EFD\u81EA\u68C0\u901A\u8FC7\uFF09

\`PUT /api/v1/papers/{id}\` \u662F**\u767D\u540D\u5355\u4E25\u683C\u6821\u9A8C**\uFF1A

1. \`markers\` **\u6070\u597D 4 \u4E2A**\uFF1A\`top-left / top-right / bottom-left / bottom-right\`
2. \`questions[].score\` **\u5FC5\u586B**\uFF08\u6570\u5B57\uFF09
3. \`questions[].choices\` **\u81F3\u5C11 2 \u4E2A**
4. \`questions[].choices[].region\` \u662F**\u76F8\u5BF9\u5C0F\u9898\u7684\u6BD4\u4F8B**\uFF080\u20131\uFF09\uFF0C\u4E0D\u8D8A\u754C
5. \u9876\u5C42**\u4E0D\u80FD\u51FA\u73B0 \`name\`**
6. \u9876\u5C42**\u4E0D\u80FD\u51FA\u73B0 \`designV2\`** \u7B49\u672A\u77E5\u5B57\u6BB5\uFF08\`400 Unrecognized key\`\uFF09

---

## \u4E94\u3001\u9700\u8981\u540E\u7AEF\u65B0\u589E\u7684\u63A5\u53E3\uFF08\u91CD\u8981\uFF09

### 5.1 \u80CC\u666F

\u524D\u7AEF\u8BBE\u8BA1\u5668\u652F\u6301\u81EA\u7531\u62D6\u52A8\u7EC4\u4EF6\u3001\u6539\u65CB\u8F6C\u89D2\u3001\u6539\u6392\u6570\u3001\u5207\u6362\u6B63\u53CD\u4E24\u9762\u3002
\u8FD9\u4E9B\u4FE1\u606F v1 \u88C5\u4E0D\u4E0B\uFF0C\u73B0\u5728\u53EA\u80FD\u5B58\u6D4F\u89C8\u5668 localStorage\uFF0C**\u6362\u8BBE\u5907 / \u6E05\u7F13\u5B58\u5C31\u4E22**\u3002

### 5.2 \u671F\u671B\u63A5\u53E3

\`\`\`
GET  /api/v1/papers/{id}/design
     \u2192 200 { "data": <designV2> }
     \u2192 404 \u8868\u793A\u8FD8\u6CA1\u6709\u8BBE\u8BA1\u7A3F\uFF08\u524D\u7AEF\u81EA\u52A8\u56DE\u843D\u5230 v1 \u8FD8\u539F\uFF09

PUT  /api/v1/papers/{id}/design
     Body: <designV2>
     \u2192 200 { "data": <designV2> }
     \u2192 404 PAPER_NOT_FOUND
\`\`\`

### 5.3 designV2 \u7ED3\u6784

\`\`\`json
{
  "schemaVersion": 2,
  "front": { "size": "A3", "orientation": "landscape", "side": "front", "elements": [...] },
  "back":  { "size": "A3", "orientation": "landscape", "side": "back",  "elements": [...] },
  "answerKey": { "q1": "A" },
  "uTime": 1763517600000
}
\`\`\`

\u5143\u7D20\u901A\u7528\u5B57\u6BB5\uFF1A\`id / kind / x / y / w / h / rotate / locked / hidden / frame\`

\`kind\` \u4E0E\u4E13\u6709\u5B57\u6BB5\uFF1A

| kind | \u4E13\u6709\u5B57\u6BB5 |
|---|---|
| \`title\` \`subtitle\` \`notice\` | \`text\`, \`fontSize\`, \`bold\`, \`align\`, \`lineHeight\`, \`sideLabel\` |
| \`barcode\` | \`label\`, \`rotate\`, \`vertical\` |
| \`studentInfo\` | \`fields[]\`, \`columns\`, \`fontSize\`, \`boxed\` |
| \`examNo\` | \`label\`, \`digits\`, \`fontSize\` |
| \`legend\` \`forbidden\` | \`fontSize\` |
| \`objective\` | \`rows\`, \`cols\`, \`blocks\`, \`count\`, \`options[]\`, \`startNumber\`, \`fontSize\`, \`score\`, \`markStyle\` |
| \`questionList\` | \`startNumber\`, \`items[]\`, \`fontSize\`, \`rowHeight\` |
| \`subjective\` | \`label\`, \`rows\`, \`rowHeight\`, \`grid\`, \`topicLine\` |
| \`gridPaper\` | \`cols\`, \`cell\`, \`topicLine\` |
| \`scoreBox\` | \`count\`, \`fontSize\` |
| \`divider\` | \`dashed\` |
| \`markers\` | \`size\`, \`inset: { x, y }\` |

### 5.4 \u5355\u4F4D

**1 \u8BBE\u8BA1\u5355\u4F4D = 0.5mm**

- A4 \u7AD6\u7248\uFF1A420 \xD7 594
- A3 \u6A2A\u7248\uFF1A840 \xD7 594

\`x=27\` \u5373\u8DDD\u5DE6 13.5mm\u3002\u524D\u7AEF\u6253\u5370\u65F6\u6362\u7B97\u6210\u771F\u5B9E\u6BEB\u7C73\uFF0C\u7F29\u653E 100% \u5373\u539F\u5C3A\u5BF8\u3002

### 5.5 \u5907\u9009\u65B9\u6848

\u82E5\u4E0D\u5F00\u65B0\u63A5\u53E3\uFF0C\u4E5F\u53EF\u653E\u5BBD\u6821\u9A8C**\u5141\u8BB8 paper JSON \u91CC\u51FA\u73B0 \`designV2\` \u5B57\u6BB5**\u3002
\u524D\u7AEF\u4E24\u6761\u8DEF\u90FD\u5DF2\u9884\u7559\uFF1A\`src/lib/designStore.ts\` \u6539\u4E00\u4E2A\u5F00\u5173\u5373\u53EF\u5207\u6362\u3002

---

## \u516D\u3001\u81EA\u68C0\u7ED3\u679C

\u9010\u4EFD\u6821\u9A8C\u540E\u7AEF\u89C4\u5219 + \u51E0\u4F55\u89C4\u5219\uFF0C**${index.count} \u4EFD\u5168\u90E8\u901A\u8FC7**\uFF1A

- markers \u6570\u91CF\u4E0E id \u6B63\u786E
- score \u9F50\u5168\u3001\u9009\u9879\u6BD4\u4F8B\u4E0D\u8D8A\u754C
- \u9898\u533A\u4E0D\u51FA\u753B\u5E03
- \u5143\u7D20\u96F6\u91CD\u53E0\uFF08\u6B63\u53CD\u4E24\u9762\uFF09

\u590D\u8DD1\uFF1A\`node scripts/emit-templates.cjs\`
`;
(0, import_node_fs.writeFileSync)((0, import_node_path.join)(OUT, "README.md"), readme, "utf8");
console.log("\u8F93\u51FA\u76EE\u5F55", OUT);
console.log("\u6A21\u677F\u6570", index.count);
console.log("\u81EA\u68C0\u95EE\u9898", problems.length ? problems : "\u65E0");
