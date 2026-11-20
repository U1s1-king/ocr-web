# 运行命名隧道：把本机 dev/preview 暴露成一个固定 https 域名
# 用法：.\deploy\tunnel\run-tunnel.ps1
# 前置：cloudflared.exe 已安装（默认 D:\za\cf\cloudflared.exe），或设置 CLOUDFLARED 环境变量

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$tokenFile = Join-Path $PSScriptRoot 'tunnel_token.txt'
$log = Join-Path $PSScriptRoot 'named-tunnel.log'
$exe = if ($env:CLOUDFLARED) { $env:CLOUDFLARED } else { 'D:\za\cf\cloudflared.exe' }

$tok = (Get-Content $tokenFile -Raw).Trim()
$env:TUNNEL_TOKEN = $tok
& $exe tunnel --no-autoupdate run 2>&1 | Out-File -FilePath $log -Encoding utf8 -Append
