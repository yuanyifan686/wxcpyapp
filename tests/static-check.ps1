$root = "D:\wxcpyapp\miniprogram"
$issues = @()

# S01: pages in app.json exist
$appJson = Get-Content "$root\app.json" -Raw | ConvertFrom-Json
foreach ($page in $appJson.pages) {
  $js = "$root\$page.js"
  $wxml = "$root\$page.wxml"
  if (-not (Test-Path $js)) { $issues += "S01 MISSING: $page.js" }
  if (-not (Test-Path $wxml)) { $issues += "S01 MISSING: $page.wxml" }
}

# S02: component paths in json files
Get-ChildItem -Path $root -Recurse -Filter "*.json" | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  if ($content -match '"/components/([^"]+)"') {
    $matches = [regex]::Matches($content, '"/components/([^"]+)"')
    foreach ($m in $matches) {
      $compPath = "$root\components\$($m.Groups[1].Value)"
      $base = $compPath -replace '\.[^.]+$',''
      if (-not (Test-Path "$base.js") -and -not (Test-Path "$compPath.js")) {
        # path like fortune-card/fortune-card
        $parts = $m.Groups[1].Value -split '/'
        $p = "$root\components\$($parts[0])\$($parts[1]).js"
        if (-not (Test-Path $p)) { $issues += "S02 BAD COMPONENT in $($_.Name): $($m.Groups[1].Value)" }
      }
    }
  }
}

# S03: required services exist
@("coze.js","Minimax.js","fortune.js") | ForEach-Object {
  if (-not (Test-Path "$root\services\$_")) { $issues += "S03 MISSING service: $_" }
}

# S04: config keys
$config = Get-Content "$root\config\index.js" -Raw
if ($config -notmatch "fortuneRecords:\s*'7659972934710165538'") { $issues += "S04 fortuneRecords id missing" }
if ($config -notmatch "users:\s*'7659971574405218344'") { $issues += "S04 users id missing" }

# S05: tabBar pages match custom-tab-bar
$tabPages = $appJson.tabBar.list | ForEach-Object { $_.pagePath }
$customJs = Get-Content "$root\custom-tab-bar\index.js" -Raw
foreach ($tp in $tabPages) {
  if ($customJs -notmatch [regex]::Escape($tp)) { $issues += "S05 tab mismatch: $tp" }
}

if ($issues.Count -eq 0) {
  Write-Host "STATIC CHECK: ALL PASS ($((Get-Date).ToString()))"
} else {
  Write-Host "STATIC CHECK: $($issues.Count) ISSUES"
  $issues | ForEach-Object { Write-Host "  - $_" }
}
exit $issues.Count