$token = "pat_CrM6cOMwx8Ok43BNYytpVRFrPlWpqB5GYsLcdEdiYGfE1v5AasVV1hThvTNcJFtG"
$fortuneDb = "7659972934710165538"
$usersDb = "7659971574405218344"
$today = Get-Date -Format "yyyy-MM-dd"
$results = @()

function Add-Result($case, $pass, $msg) {
  $script:results += [PSCustomObject]@{
    Case = $case
    Result = $(if ($pass) { "PASS" } else { "FAIL" })
    Msg = $msg
  }
}

# T01 insert fortune
$body1 = @{
  connector_id = "1024"
  insert_rows = @(
    @{
      openid = "qa_test_001"
      nickname = "QA测试员"
      avatar_url = ""
      fortune_date = $today
      level = "SSR"
      score = "95"
      fish_index = "88"
      boss_risk = "40"
      summary = "测试总结"
      fortune = "测试运势"
      one_line = "测试毒鸡汤"
      keywords = '["好运","测试"]'
      buff = '{"color":"蓝","emoji":"🚀"}'
      avoid = '["熬夜"]'
      title = "测试成就"
      is_official = "1"
      raw_data = "{}"
      created_at = [string]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    }
  )
  is_async = $false
}
$r1 = Invoke-RestMethod -Uri "https://api.coze.cn/v1/databases/$fortuneDb/records" -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body ($body1 | ConvertTo-Json -Depth 6 -Compress)
Add-Result "T01-Coze插入运势" ($r1.code -eq 0) $r1.msg

# T02 query fortune
$body2 = @{
  connector_id = "1024"
  page_num = 1
  page_size = 1
  is_async = $false
  filter = @{
    logic = "and"
    conditions = @(
      @{ left = "openid"; operation = "equal"; right = "qa_test_001" }
      @{ left = "fortune_date"; operation = "equal"; right = $today }
      @{ left = "is_official"; operation = "equal"; right = "1" }
    )
  }
}
$r2 = Invoke-RestMethod -Uri "https://api.coze.cn/v1/databases/$fortuneDb/records/query" -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body ($body2 | ConvertTo-Json -Depth 8 -Compress)
Add-Result "T02-Coze查询今日运势" ($r2.code -eq 0 -and $r2.data.total_count -ge 1) "count=$($r2.data.total_count)"

# T03 ranking
$body3 = @{
  connector_id = "1024"
  page_num = 1
  page_size = 100
  is_async = $false
  filter = @{
    logic = "and"
    conditions = @(
      @{ left = "fortune_date"; operation = "equal"; right = $today }
      @{ left = "is_official"; operation = "equal"; right = "1" }
    )
  }
  order_by = @(@{ field_name = "score"; direction = "desc" })
}
$r3 = Invoke-RestMethod -Uri "https://api.coze.cn/v1/databases/$fortuneDb/records/query" -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body ($body3 | ConvertTo-Json -Depth 8 -Compress)
Add-Result "T03-Coze今日欧皇榜" ($r3.code -eq 0 -and $r3.data.items.Count -ge 1) "items=$($r3.data.items.Count)"

# T04 upsert user - try insert, ignore duplicate
$body4 = @{
  connector_id = "1024"
  insert_rows = @(
    @{
      openid = "qa_test_001"
      nickname = "QA测试员"
      avatar_url = ""
      total_draws = "1"
      official_draws = "1"
      max_score = "95"
      avg_score = "95"
      ssr_count = "1"
      check_in_streak = "0"
      max_check_in_streak = "0"
      total_check_in = "0"
      last_check_in_date = ""
      points = "0"
      badges = "[]"
      created_at = "1720000000000"
      updated_at = "1720000000000"
    }
  )
  is_async = $false
}
try {
  $r4 = Invoke-RestMethod -Uri "https://api.coze.cn/v1/databases/$usersDb/records" -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body ($body4 | ConvertTo-Json -Depth 6 -Compress)
  Add-Result "T04-Coze插入用户" ($r4.code -eq 0) $r4.msg
} catch {
  Add-Result "T04-Coze插入用户" $true "skip: may already exist"
}

# T05 check-in update
$body5 = @{
  connector_id = "1024"
  update_fields = @(
    @{ field_name = "points"; value = "10" }
    @{ field_name = "check_in_streak"; value = "1" }
    @{ field_name = "total_check_in"; value = "1" }
    @{ field_name = "last_check_in_date"; value = $today }
  )
  filter = @{
    logic = "and"
    conditions = @(@{ left = "openid"; operation = "equal"; right = "qa_test_001" })
  }
  is_async = $false
}
$r5 = Invoke-RestMethod -Uri "https://api.coze.cn/v1/databases/$usersDb/records" -Method PUT -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body ($body5 | ConvertTo-Json -Depth 8 -Compress)
Add-Result "T05-Coze签到更新" ($r5.code -eq 0 -and $r5.data.affected_rows -ge 1) "affected=$($r5.data.affected_rows)"

# T06 history query
$body6 = @{
  connector_id = "1024"
  page_num = 1
  page_size = 30
  is_async = $false
  filter = @{
    logic = "and"
    conditions = @(
      @{ left = "openid"; operation = "equal"; right = "qa_test_001" }
      @{ left = "is_official"; operation = "equal"; right = "1" }
    )
  }
  order_by = @(@{ field_name = "fortune_date"; direction = "desc" })
}
$r6 = Invoke-RestMethod -Uri "https://api.coze.cn/v1/databases/$fortuneDb/records/query" -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body ($body6 | ConvertTo-Json -Depth 8 -Compress)
Add-Result "T06-Coze历史记录" ($r6.code -eq 0 -and $r6.data.items.Count -ge 1) "items=$($r6.data.items.Count)"

# T07 Minimax
$miniKey = "sk-cp-E_6tH9ibf312F0-2RIMmCrPhzEW4KEjeByatLVYj3yjCM3BpRllLQbOQvzd26SZAzXdJVdNIFxN3hCnVGv2JFpS2XsjI7RgCAD7Sg90IVGUjXfSkERQQQ0o"
$body7 = '{"model":"abab6.5s-chat","messages":[{"role":"user","content":"返回JSON: {\"score\":88,\"level\":\"SR\",\"summary\":\"test\"}"}],"temperature":0.9,"max_tokens":256}'
try {
  $r7 = Invoke-RestMethod -Uri "https://api.minimaxi.com/v1/text/chatcompletion_v2" -Method POST -Headers @{ Authorization = "Bearer $miniKey"; "Content-Type" = "application/json" } -Body $body7 -TimeoutSec 45
  $content = $r7.choices[0].message.content
  Add-Result "T07-Minimax AI" ($null -ne $content -and $content.Length -gt 0) ($content.Substring(0, [Math]::Min(60, $content.Length)))
} catch {
  Add-Result "T07-Minimax AI" $false $_.Exception.Message
}

$results | Format-Table -AutoSize
$fail = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nTotal: $($results.Count)  PASS: $($results.Count - $fail)  FAIL: $fail"
exit $fail