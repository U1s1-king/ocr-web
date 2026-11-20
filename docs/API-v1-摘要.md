

######## exam-batches
考试批次接口
考试批次是一个命名的考试 id 集合，用把多场考试保存成可重复使用的筛选条件。批次不复制成绩。
数据
exam_batches
id
name
u_time
exam_batch_items
batch_id
exam_id
position
接口
POST /api/v1/exam-batches
GET /api/v1/exam-batches
GET /api/v1/exam-batches/{id}
PUT /api/v1/exam-batches/{id}
DELETE /api/v1/exam-batches/{id}
创建批次
POST /api/v1/exam-batches
Content-Type: application/json
{
"name": "2026 高一期中考试批次",
"examIds": [1, 2, 3]
}
响应：
{
"data": {
"id": 1,
"name": "2026 高一期中考试批次",
"uTime": 1794754740,
"examIds": [1, 2, 3],
"examCount": 3
}
}
列表
GET /api/v1/exam-batches
返回所有批次，包含 examIds
和 examCount
。
修改
PUT /api/v1/exam-batches/{id}
请求体：
{
"name": "新的批次名",
"examIds": [4, 5, 6]
}
会整体替换批次的考试集合。
删除
DELETE /api/v1/exam-batches/{id}
只删除批次关系，不删除考试或成绩。
错误
400 / VALIDATION_ERROR
：名称或 examIds 不合法
404 / EXAM_NOT_FOUND
：部分考试不存在
404 / BATCH_NOT_FOUND
：批次不存在
409 / BATCH_NAME_EXISTS
：批次名重复


######## exam-results
跨考试结果接口
用于把多场考试组合成一个临时成绩视图，或按已保存的考试批次查询。
成绩列表 ： GET /api/v1/exam-results
成绩详情 ： GET /api/v1/exam-results/{id}
列表接口只返回成绩摘要；单条详情再返回每道题的 details
。


######## exam-results_get-list
跨考试成绩列表 (List)
Method: GET
Endpoint:
/api/v1/exam-results
按一个或多个考试查询成绩，支持分页和多字段排序。
查询参数
参数
类型
必填
说明
| examIds
| Integer[]
| 二选一
| 考试 id，可重复传多次，例如 examIds=1&examIds=2
| batchId
| Integer
| 二选一
| 已保存的考试批次 id
| offset
| Integer
| 否
| 偏移量，默认 0
| limit
| Integer
| 否
| 每页数量，默认 20
，最大 10000
| sortBy
| String[]
| 否
| 排序字段，可重复传多次，按顺序生效
| sortDirection
| String[]
| 否
| 排序方向， asc
/ desc
，必须和 sortBy
一一对应
examIds
和 batchId
不能同时使用。
sortBy
白名单：
examName
candidateNumber
score
uTime
examId
paperId
fileId
id
规则：
最多 5 个排序字段；
sortBy
和 sortDirection
数量必须一致；
不传排序时默认 id desc
；
相同排序值最后用结果 id 做稳定排序；
limit
最大 10000
，适合一次拉取当前规模的成绩做前端聚合。
请求示例
按考试筛选并按分数排序：
GET /api/v1/exam-results?examIds=1&examIds=2&sortBy=score&sortDirection=desc&offset=0&limit=20
多字段排序：
GET /api/v1/exam-results?examIds=1&examIds=2&sortBy=examName&sortBy=score&sortDirection=asc&sortDirection=desc
按批次查询：
GET /api/v1/exam-results?batchId=3&sortBy=score&sortDirection=desc
响应示例
{
"data": [
{
"id": 1,
"examId": 1,
"examName": "2026 演示考试 01",
"paperId": 1,
"paperName": "演示试卷 01",
"fileId": 1,
"uTime": 1788253200,
"candidateNumber": "20260001",
"score": 89
}
],
"meta": {
"total": 300,
"offset": 0,
"limit": 20,
"sortBy": ["score"],
"sortDirection": ["desc"],
"examIds": [1, 2],
"batchId": null,
"summary": {
"resultCount": 300,
"averageScore": 81.40666666666667,
"maxScore": 93
}
}
}
错误
400 / EXAM_SCOPE_REQUIRED
：既没有 examIds 也没有 batchId
400 / EXAM_SCOPE_CONFLICT
：examIds 和 batchId 同时出现
400 / SORT_LENGTH_MISMATCH
：排序字段和方向数量不一致
400 / SORT_FIELD_UNSUPPORTED
：排序字段不在白名单
400 / SORT_DIRECTION_INVALID
：排序方向不是 asc / desc
400 / DUPLICATE_SORT_FIELD
：排序字段重复
404 / BATCH_NOT_FOUND
：考试批次不存在
404 / EXAM_NOT_FOUND
：部分考试不存在


######## exams
考试接口
考试是批改和成绩归属的主体。每场考试绑定一张试卷，多场考试可以复用同一张试卷。
创建考试 ： POST /api/v1/exams
考试列表 ： GET /api/v1/exams
获取考试 ： GET /api/v1/exams/{id}
删除考试 ： DELETE /api/v1/exams/{id}
批量批改并记录结果 ： POST /api/v1/exams/{id}/grade
考试成绩列表 ： GET /api/v1/exams/{id}/results
试卷配置的管理在 试卷接口 。


######## exams_delete
删除考试 (Delete)
Method: DELETE
Endpoint:
/api/v1/exams/{id}
删除考试及其所有考试结果。
路径参数
参数
类型
说明
| id
| Integer
| 考试 id，必须为正整数
响应
成功返回 204 No Content
。
删除考试不会删除关联的试卷配置，也不会删除已上传文件。
错误
400 / INVALID_PATH_PARAM
：id 不是正整数
404 / EXAM_NOT_FOUND
：考试不存在


######## exams_get-list
考试列表 (List)
Method: GET
Endpoint:
/api/v1/exams
按考试 id 倒序列出所有考试。
响应示例
{
"data": [
{
"id": 2,
"name": "高一数学期末考试",
"paperId": 1,
"paperName": "高一数学第一次月考答题卡",
"uTime": 1794209000,
"resultCount": 0
},
{
"id": 1,
"name": "高一数学第一次月考",
"paperId": 1,
"paperName": "高一数学第一次月考答题卡",
"uTime": 1794208350,
"resultCount": 32
}
]
}


######## exams_get-results
考试成绩列表 (Results)
Method: GET
Endpoint:
/api/v1/exams/{id}/results
列出某场考试已经保存的所有批改结果。
路径参数
参数
类型
说明
| id
| Integer
| 考试 id
响应示例
{
"data": {
"examId": 1,
"examName": "高一数学第一次月考",
"paperId": 1,
"paperName": "高一数学第一次月考答题卡",
"results": [
{
"id": 1,
"examId": 1,
"paperId": 1,
"fileId": 1,
"uTime": 1794208350,
"candidateNumber": "20260001",
"score": 82,
"details": {
"q1": {
"type": "mark",
"answer": "A",
"expected": "A",
"correct": true,
"points": 2,
"score": 2,
"uncertain": false
}
}
}
]
}
}
错误
404 / EXAM_NOT_FOUND
：考试不存在


######## exams_get
获取考试 (Get)
Method: GET
Endpoint:
/api/v1/exams/{id}
路径参数
参数
类型
说明
| id
| Integer
| 考试 id，必须为正整数
响应示例
{
"data": {
"id": 1,
"name": "高一数学第一次月考",
"paperId": 1,
"paperName": "高一数学第一次月考答题卡",
"uTime": 1794208350,
"resultCount": 32
}
}
错误
400 / INVALID_PATH_PARAM
：id 不是正整数
404 / EXAM_NOT_FOUND
：考试不存在


######## exams_post-create
创建考试 (Create)
Method: POST
Endpoint:
/api/v1/exams
创建一场考试，并指定使用的试卷。考试 id 独立自增；多场考试可以引用同一张试卷。
请求参数
Body (JSON):
字段
类型
必填
说明
| name
| String
| 是
| 考试名
| paperId
| Integer
| 是
| 使用的试卷 id
示例：
{
"name": "高一数学第一次月考",
"paperId": 1
}
响应示例
{
"data": {
"id": 1,
"name": "高一数学第一次月考",
"paperId": 1,
"paperName": "高一数学第一次月考答题卡",
"uTime": 1794208350,
"resultCount": 0
}
}
错误
400 / VALIDATION_ERROR
： name
或 paperId
不合法
404 / PAPER_NOT_FOUND
：试卷不存在


######## exams_post-grade
批量批改并记录结果 (Grade)
Method: POST
Endpoint:
/api/v1/exams/{id}/grade
按考试 id 读取绑定的试卷，对一批已上传文件进行识别、批改，并把成功结果写入 exam_results
。
路径参数
参数
类型
说明
| id
| Integer
| 考试 id
请求参数
Body (JSON):
字段
类型
必填
说明
| fileIds
| Integer[]
| 是
| 要批改的文件 id，1–50 个，不能重复
| candidateNumbers
| Object
| 否
| 文件 id 到考号的映射，例如 { "1": "20260001" }
；未提供时结果为 null
文件 id 来自 搜索文件 返回的 items[].fileId
。
示例：
{
"fileIds": [1, 2],
"candidateNumbers": {
"1": "20260001",
"2": "20260002"
}
}
批改规则
考试绑定的试卷必须已经配置 answerKey
；
每道题按自己的 score
计分，答对得该题 score
，答错或未填得 0
分；
没有配置答案键的题不计入可得分；
type: "other"
的题不参与自动得分，但会记录在 details
中；
成功结果写入 exam_results
， exam_id
是当前考试 id；
失败文件不会写入结果表，只在响应中返回失败原因。
响应示例
{
"data": {
"examId": 1,
"examName": "高一数学第一次月考",
"paperId": 1,
"paperName": "高一数学第一次月考答题卡",
"total": 2,
"successCount": 1,
"failureCount": 1,
"totalScore": 2,
"results": [
{
"fileId": 1,
"success": true,
"candidateNumber": "20260001",
"score": 2,
"maxScore": 2,
"correctCount": 1,
"gradedCount": 1,
"details": {
"q1": {
"type": "mark",
"answer": "A",
"expected": "A",
"correct": true,
"points": 2,
"score": 2,
"uncertain": false
}
},
"resultId": 1,
"examId": 1,
"answers": {
"q1": "A"
},
"metrics": {},
"markers": [],
"image": {
"width": 1920,
"height": 2400
}
},
{
"fileId": 2,
"success": false,
"code": "GRADE_FAILED",
"error": "识别失败原因"
}
]
}
}
错误
400 / VALIDATION_ERROR
：请求参数不合法、 fileIds
重复
404 / EXAM_NOT_FOUND
：考试不存在
409 / PAPER_EMPTY
：试卷还没有配置内容
409 / PAPER_ANSWER_KEY_EMPTY
：试卷还没有配置答案键
422 / PAPER_CONFIG_INVALID
：试卷 JSON 无效


######## files
文件接口
上传待检查的答题卡文件，按 SHA-256 hash 存储；文件名和后缀单独建立索引。
上传文件 ： POST /api/v1/files
搜索文件 ： GET /api/v1/files/search


######## files_get-search
搜索文件 (Search)
Method: GET
Endpoint:
/api/v1/files/search
按文件名搜索已上传文件。文件名使用 simple
分词器，支持中文和拼音；后缀使用精确匹配。
查询参数
参数
类型
必填
说明
| q
| String
| 否
| 文件名关键词
| suffix
| String
| 否
| 后缀名，可带点，不区分大小写
| limit
| Integer
| 否
| 每页数量，1–100，默认 20
| offset
| Integer
| 否
| 偏移量，默认 0
q
和 suffix
可以同时使用；都不传时按上传时间倒序列出文件。
请求示例
GET /api/v1/files/search?q=数学月考&suffix=pdf
GET /api/v1/files/search?q=gaoyishuxue
GET /api/v1/files/search?suffix=.PDF
响应示例
{
"data": {
"query": "数学月考",
"suffix": "pdf",
"total": 1,
"limit": 20,
"offset": 0,
"items": [
{
"fileId": 1,
"hash": "623099066de4cbef710c0f36302f31f49e9e607654f879ace5cd536ab16833b7",
"uTime": 1794208350,
"name": "高一数学第一次月考答题卡.pdf",
"suffix": "pdf"
}
]
}
}
错误
400 / VALIDATION_ERROR
：查询参数类型或范围不合法


######## files_post-upload
上传文件 (Upload)
Method: POST
Endpoint:
/api/v1/files
请求参数
Content-Type: multipart/form-data
表单中必须且只能包含一个文件
文件大小必须严格小于 10 MiB
服务端计算文件内容的 SHA-256 作为 hash
同一内容重复上传不会产生新记录，直接返回已有 fileId
表单字段：
file=<二进制文件>
响应示例
首次上传返回 201
：
{
"data": {
"fileId": 1,
"hash": "623099066de4cbef710c0f36302f31f49e9e607654f879ace5cd536ab16833b7",
"uTime": 1794208350,
"name": "高一数学第一次月考答题卡.pdf",
"suffix": "pdf"
}
}
重复上传同一内容返回 200
，结构相同；已有非空文件名保持不变。
fileId
用于 检查试卷 或 批改考试 。
存储
文件按 hash 分级保存：
data/files/ab/cd/abcdef...
文件名、后缀、hash 和时间保存在独立的 data/files.db
：
字段
说明
| id
| 文件 id
| hash
| SHA-256
| u_time
| Unix 秒级时间戳
| name
| 原始文件名
| suffix
| 小写后缀名，不带点
name
使用 simple
分词器建立全文索引，支持中文和拼音搜索；
suffix
使用普通索引，按完整值匹配。
错误
400 / INVALID_FORM_DATA
：不是合法的 multipart 表单
400 / INVALID_FILE_COUNT
：文件数量不是 1
400 / INVALID_FILE_NAME
：文件名为空
413 / FILE_TOO_LARGE
：文件大小达到或超过 10 MiB


######## papers
试卷接口
负责试卷配置的创建、读取、内容替换、答案键设置、删除和检查。一场考试引用一张试卷，多场考试可以复用同一张试卷。
创建空试卷 ： POST /api/v1/papers
试卷列表 ： GET /api/v1/papers
获取试卷 ： GET /api/v1/papers/{id}
修改试卷 ： PUT /api/v1/papers/{id}
设置涂卡题答案 ： PUT /api/v1/papers/{id}/answers
删除试卷 ： DELETE /api/v1/papers/{id}
批量检查试卷 ： POST /api/v1/papers/{id}/check
试卷名在创建时通过请求体 name
传入，不写入试卷 JSON。
试卷 JSON 标准见 试卷 JSON 标准 。


######## papers_delete
删除试卷 (Delete)
Method: DELETE
Endpoint:
/api/v1/papers/{id}
路径参数
参数
类型
说明
| id
| Integer
| 试卷 id，必须为正整数
响应
成功返回 204 No Content
。
删除试卷不会删除已经上传的文件；文件按 hash 独立保存。
如果试卷已经被某场考试引用，接口返回 409
，不会删除。
错误
400 / INVALID_PATH_PARAM
：id 不是正整数
404 / PAPER_NOT_FOUND
：试卷不存在
409 / PAPER_IN_USE
：试卷已被考试引用


######## papers_get-list
试卷列表 (List)
Method: GET
Endpoint:
/api/v1/papers
列出所有试卷配置，用于创建考试时选择 paperId
。
响应示例
{
"data": [
{
"id": 1,
"name": "高一数学第一次月考答题卡"
},
{
"id": 2,
"name": "高一英语第一次月考答题卡"
}
]
}
错误
500 / INTERNAL_ERROR
：服务器内部错误


######## papers_get
获取试卷 (Get)
Method: GET
Endpoint:
/api/v1/papers/{id}
路径参数
参数
类型
说明
| id
| Integer
| 试卷 id，必须为正整数
响应示例
{
"data": {
"id": 1,
"name": "高一数学第一次月考答题卡",
"paper": {
"schemaVersion": 1,
"unit": "canvas",
"canvas": {
"width": 300,
"height": 424.26
},
"markers": [],
"questions": []
}
}
}
新创建、尚未 PUT
内容时：
{
"data": {
"id": 1,
"name": "高一数学第一次月考答题卡",
"paper": {}
}
}
错误
400 / INVALID_PATH_PARAM
：id 不是正整数
404 / PAPER_NOT_FOUND
：试卷不存在
422 / PAPER_CONFIG_INVALID
：数据库中的 JSON 已损坏
完整结构见 试卷 JSON 标准 。


######## papers_post-check
批量检查试卷 (Check Batch)
Method: POST
Endpoint:
/api/v1/papers/{id}/check
一次检查多个已经上传的答题卡文件。试卷 id 放在路径里，文件 id 放在请求体中。
路径参数
参数
类型
说明
| id
| Integer
| 要检查的试卷 id
请求参数
Body (JSON):
字段
类型
必填
说明
| fileIds
| Integer[]
| 是
| 上传文件 id 数组，1–50 个，不能重复
示例：
{
"fileIds": [1, 2, 3]
}
fileIds
来自 上传文件 返回的 data.fileId
。
响应示例
{
"data": {
"paperId": 1,
"total": 2,
"successCount": 1,
"failureCount": 1,
"results": [
{
"fileId": 1,
"success": true,
"answers": {
"q1": "A",
"q13": null
},
"metrics": {
"q1": {
"type": "mark",
"answer": "A",
"mode": "single",
"selected": 0,
"selectedOptions": ["A"],
"markedCount": 1,
"ratios": [0.91, 0.02, 0.01, 0],
"confidence": 0.89,
"points": 2,
"expected": "A",
"correct": true,
"uncertain": false
},
"q13": {
"type": "other",
"answer": null,
"mode": "other",
"points": 10,
"expected": null,
"correct": null,
"uncertain": false
}
},
"markers": [
{ "x": 100, "y": 100 },
{ "x": 1800, "y": 100 },
{ "x": 1800, "y": 2400 },
{ "x": 100, "y": 2400 }
],
"image": {
"width": 1920,
"height": 2560
}
},
{
"fileId": 2,
"success": false,
"code": "CHECK_FAILED",
"error": "未找到四个角定位块"
}
]
}
}
批量语义
一份试卷只解析一次；
按 fileIds
顺序逐个检查；
单个文件失败不会中断整个批次；
单个文件失败时，对应结果包含 success: false
、 code
和 error
；
total
、 successCount
、 failureCount
是本次批次的汇总；
整个请求只有在试卷不存在、试卷为空或试卷配置损坏时才直接返回错误。
错误
整批错误：
400 / VALIDATION_ERROR
： fileIds
不合法
400 / INVALID_JSON
：请求体不是合法 JSON
404 / PAPER_NOT_FOUND
：试卷不存在
409 / PAPER_EMPTY
：试卷还没有配置内容
422 / PAPER_CONFIG_INVALID
：已保存的试卷 JSON 不合法
415 / UNSUPPORTED_MEDIA_TYPE
：不是 application/json
单个文件结果中的错误：
FILE_NOT_FOUND
：文件 id 不存在或磁盘文件丢失
CHECK_FAILED
：图片定位或识别失败


######## papers_post-create
创建空试卷 (Create)
Method: POST
Endpoint:
/api/v1/papers
创建一张空试卷，先占坑并登记试卷名。新试卷的 json
初始为 {}
。
请求参数
Body (JSON):
字段
类型
必填
说明
| name
| String
| 是
| 试卷名，1–100 字符，不能重复
规则：
不能有首尾空白；
不能包含 Windows 文件名非法字符 <>:"/\|?*
；
数据库对 papers.name
建立唯一索引，同名返回 409
，不会覆盖旧记录。
请求示例：
{
"name": "高一数学第一次月考答题卡"
}
响应示例
首次创建返回 201
：
{
"data": {
"id": 1,
"name": "高一数学第一次月考答题卡",
"paper": {}
}
}
错误
400 / VALIDATION_ERROR
： name
缺失或格式不合法
409 / PAPER_NAME_EXISTS
：存在同名试卷
415 / UNSUPPORTED_MEDIA_TYPE
：不是 application/json


######## papers_put-answers
设置涂卡题答案 (Answers)
Method: PUT
Endpoint:
/api/v1/papers/{id}/answers
为已配置的试卷设置涂卡题答案键。答案键按小题 id
索引，值必须是该题已配置的选项。
请求参数
Body (JSON):
字段
类型
必填
说明
| answerKey
| Object
| 是
| 题号到答案的映射
示例：
{
"answerKey": {
"q1": "A",
"q2": "B",
"q3": "AC"
}
}
q1
、 q2
必须是 type: "mark"
的题目 id
；
答案必须存在于该题的 choices
中；
多选答案按选项顺序拼接，例如 "AC"
；
传空对象 { "answerKey": {} }
可以清空答案键。
响应示例
{
"data": {
"id": 1,
"name": "高一数学第一次月考",
"answerKey": {
"q1": "A",
"q2": "B",
"q3": "AC"
}
}
}
答案键保存在试卷 JSON 的 answerKey
字段中，不新增数据库列。
错误
404 / PAPER_NOT_FOUND
：试卷不存在
409 / PAPER_EMPTY
：试卷还没有配置内容
422 / PAPER_CONFIG_INVALID
：题号不存在、选项不存在或试卷配置无效


######## papers_put
修改试卷 (Update)
Method: PUT
Endpoint:
/api/v1/papers/{id}
用完整 JSON 替换试卷内容，不修改试卷名。
路径参数
参数
类型
说明
| id
| Integer
| 试卷 id，必须为正整数
请求参数
Body (JSON):
请求体是完整 paper JSON， 不包含 name
。如果出现 name
会返回 400
。
示例：
{
"schemaVersion": 1,
"unit": "canvas",
"canvas": { "width": 300, "height": 424.26 },
"markers": [
{ "id": "top-left", "x": 9, "y": 12.73, "size": 10.5 },
{ "id": "top-right", "x": 280.5, "y": 12.73, "size": 10.5 },
{ "id": "bottom-left", "x": 9, "y": 396.68, "size": 10.5 },
{ "id": "bottom-right", "x": 280.5, "y": 396.68, "size": 10.5 }
],
"questions": [
{
"id": "q1",
"displayNumber": 1,
"type": "mark",
"score": 2,
"region": { "x": 18, "y": 169.7, "width": 114, "height": 21.21 },
"choices": [
{ "value": "A", "region": { "x": 0, "y": 0, "width": 0.2, "height": 1 } },
{ "value": "B", "region": { "x": 0.25, "y": 0, "width": 0.2, "height": 1 } },
{ "value": "C", "region": { "x": 0.5, "y": 0, "width": 0.2, "height": 1 } },
{ "value": "D", "region": { "x": 0.75, "y": 0, "width": 0.2, "height": 1 } }
]
}
],
"answerKey": {
"q1": "A"
}
}
响应
成功返回 200
。响应结构与 获取试卷 相同， data.paper
为刚刚提交的完整对象。
错误
400 / VALIDATION_ERROR
：JSON 结构不合法，或顶层出现 name
400 / INVALID_JSON
：请求体不是合法 JSON
404 / PAPER_NOT_FOUND
：试卷不存在
415 / UNSUPPORTED_MEDIA_TYPE
：不是 application/json


######## students
学生接口
学生注册接口。
字段固定为：
id
name
：名字
candidateNumber
：考生号
className
：班级
grade
：年级
major
：专业
接口：
批量增加学生 ： POST /api/v1/students/batch
批量修改学生 ： PUT /api/v1/students/batch
批量删除学生 ： DELETE /api/v1/students/batch
单个学生也使用批量接口，数组中放一项即可。


######## students_delete-batch
批量删除学生 (Batch Delete)
Method: DELETE
Endpoint:
/api/v1/students/batch
请求参数
Body (JSON):
{
"ids": [1, 2, 3]
}
规则：
ids
数量 1–1000；
id 不能重复；
任意 id 不存在时返回 404 / STUDENT_NOT_FOUND
，不会部分删除。
响应示例
{
"data": {
"deletedCount": 3,
"ids": [1, 2, 3]
}
}
错误
400 / VALIDATION_ERROR
：ids 缺失或格式不正确
400 / DUPLICATE_IDS
：请求中存在重复 id
404 / STUDENT_NOT_FOUND
：部分学生不存在
415 / UNSUPPORTED_MEDIA_TYPE
：不是 application/json


######## students_post-batch
批量增加学生 (Batch Add)
Method: POST
Endpoint:
/api/v1/students/batch
请求参数
Body (JSON):
{
"students": [
{
"name": "张三",
"candidateNumber": "2026001",
"className": "1班",
"grade": "2026级",
"major": "计算机"
},
{
"name": "李四",
"candidateNumber": "2026002",
"className": "1班",
"grade": "2026级",
"major": "计算机"
}
]
}
限制：
students
数量 1–1000；
单个请求内考生号不能重复；
数据库对 candidate_number
建唯一索引，重复考生号返回 409
。
响应示例
首次创建返回 201
：
{
"data": {
"count": 2,
"students": [
{
"id": 1,
"name": "张三",
"candidateNumber": "2026001",
"className": "1班",
"grade": "2026级",
"major": "计算机"
}
]
}
}
错误
400 / VALIDATION_ERROR
：字段缺失或格式不正确
400 / INVALID_JSON
：请求体不是合法 JSON
409 / CANDIDATE_NUMBER_EXISTS
：考生号已存在
415 / UNSUPPORTED_MEDIA_TYPE
：不是 application/json


######## students_put-batch
批量修改学生 (Batch Update)
Method: PUT
Endpoint:
/api/v1/students/batch
请求参数
Body (JSON):
{
"students": [
{
"id": 1,
"name": "张三",
"candidateNumber": "2026001",
"className": "2班",
"grade": "2026级",
"major": "软件"
}
]
}
规则：
每条必须带 id
；
id
不能重复；
请求内考生号不能重复；
不存在或重复 id 会返回 404 / STUDENT_NOT_FOUND
；
修改后的考生号不能与其他学生冲突。
响应示例
{
"data": {
"count": 1,
"students": [
{
"id": 1,
"name": "张三",
"candidateNumber": "2026001",
"className": "2班",
"grade": "2026级",
"major": "软件"
}
]
}
}
错误
400 / VALIDATION_ERROR
：字段缺失或格式不正确
400 / DUPLICATE_IDS
：请求中存在重复 id
404 / STUDENT_NOT_FOUND
：部分学生不存在
409 / CANDIDATE_NUMBER_EXISTS
：考生号已存在
415 / UNSUPPORTED_MEDIA_TYPE
：不是 application/json