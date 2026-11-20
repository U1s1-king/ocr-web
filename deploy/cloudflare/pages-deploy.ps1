param(
  [string]$Project = "ocr-web",
  [string]$Dir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'dist'),
  [string]$Branch = "main"
)
# 在仓库根目录执行，先 npm run build；令牌从环境变量读取，避免写进仓库
$Token = $env:CF_TOKEN
$Acc   = if ($env:CF_ACCOUNT) { $env:CF_ACCOUNT } else { "dd634204b125f1fb16109afcc96864bf" }
if (-not $Token) { Write-Error "缺少 CF_TOKEN 环境变量"; exit 1 }
if (-not (Test-Path $Dir)) { Write-Error "dist 不存在：$Dir，先 npm run build"; exit 1 }
$Base  = "https://api.cloudflare.com/client/v4/accounts/$Acc/pages/projects/$Project"
$H = @{ Authorization = "Bearer $Token" }

$ctype = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript"; ".css"="text/css";
            ".svg"="image/svg+xml"; ".json"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg";
            ".webp"="image/webp"; ".ico"="image/x-icon"; ".woff2"="font/woff2"; ".txt"="text/plain" }

# 1. 收集文件并算 hash（sha256 十六进制，前 32 位）
$files = Get-ChildItem -Path $Dir -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($Dir.Length).TrimStart('\').Replace('\','/')
  $sha = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower().Substring(0,32)
  [pscustomobject]@{ Path=$rel; Full=$_.FullName; Hash=$sha; Size=$_.Length }
}
Write-Host "文件数: $($files.Count)"

# 2. 创建部署
$manifest = @{}
foreach ($f in $files) { $manifest[$f.Path] = $f.Hash }
$body = @{ branch = $Branch; manifest = $manifest } | ConvertTo-Json -Depth 5 -Compress
try {
  $dep = Invoke-RestMethod -Method Post -Uri "$Base/deployments" -Headers $H `
    -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60
} catch {
  Write-Host "创建部署失败: $($_.Exception.Message)"
  Write-Host $_.ErrorDetails.Message
  exit 1
}
Write-Host "部署ID: $($dep.result.id)  需要上传: $($dep.result.stages.Count)"

# 3. 上传缺失文件
$missing = @($dep.result.stages)
if ($missing.Count -gt 0) {
  $i = 0
  $form = @{}
  foreach ($h in $missing) {
    $f = $files | Where-Object { $_.Hash -eq $h } | Select-Object -First 1
    if ($f) {
      $i++
      $ext = [IO.Path]::GetExtension($f.Path).ToLower()
      $mime = $ctype[$ext]; if (-not $mime) { $mime = "application/octet-stream" }
      # 用 curl 传 multipart
      & curl.exe -s -X POST "$Base/deployments/$($dep.result.id)/files" `
        -H "Authorization: Bearer $Token" `
        -F "files=@$($f.Full);type=$mime;filename=$($f.Path)" | Out-Null
      Write-Host "上传 $i/$($missing.Count): $($f.Path)"
    }
  }
}

# 4. 触发部署
try {
  $r = Invoke-RestMethod -Method Post -Uri "$Base/deployments/$($dep.result.id)/uploads" -Headers $H -TimeoutSec 60
  Write-Host "提交结果: $($r.success)"
} catch { Write-Host "提交失败: $($_.Exception.Message)"; Write-Host $_.ErrorDetails.Message }
