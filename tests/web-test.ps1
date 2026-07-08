$ErrorActionPreference = "Stop"
$root = "D:\wxcpyapp"
$results = @()

function Add-Result($case, $pass, $msg) {
  $script:results += [PSCustomObject]@{
    Case = $case
    Result = $(if ($pass) { "PASS" } else { "FAIL" })
    Msg = $msg
  }
}

# W01 static files
$files = @(
  "public\index.html",
  "public\css\app.css",
  "public\js\app.js",
  "public\js\fortune.js",
  "netlify\functions\ranking.js",
  "netlify.toml"
)
foreach ($f in $files) {
  Add-Result "W01-$f" (Test-Path "$root\$f") $(if (Test-Path "$root\$f") { "ok" } else { "missing" })
}

# W02 ranking function
$env:COZE_TOKEN = "pat_CrM6cOMwx8Ok43BNYytpVRFrPlWpqB5GYsLcdEdiYGfE1v5AasVV1hThvTNcJFtG"
$env:COZE_FORTUNE_DB = "7659972934710165538"
$env:COZE_USERS_DB = "7659971574405218344"
$rankOut = node -e "const h=require('./netlify/functions/ranking.js');h.handler({httpMethod:'GET',queryStringParameters:{},headers:{}}).then(r=>console.log(r.statusCode+':'+JSON.parse(r.body).data.items.length)).catch(e=>console.log('ERR:'+e.message))" 2>&1
Add-Result "W02-ranking-fn" ($rankOut -match "^200:") $rankOut

# W03 coze proxy function
$cozeOut = node -e "const h=require('./netlify/functions/coze.js');const b=JSON.stringify({action:'query',dbKey:'users',payload:{pageNum:1,pageSize:1}});h.handler({httpMethod:'POST',body:b,headers:{}}).then(r=>console.log(r.statusCode+':'+JSON.parse(r.body).code)).catch(e=>console.log('ERR:'+e.message))" 2>&1
Add-Result "W03-coze-fn" ($cozeOut -match "^200:0") $cozeOut

# W04 minimax function
$env:MINIMAX_API_KEY = "sk-cp-E_6tH9ibf312F0-2RIMmCrPhzEW4KEjeByatLVYj3yjCM3BpRllLQbOQvzd26SZAzXdJVdNIFxN3hCnVGv2JFpS2XsjI7RgCAD7Sg90IVGUjXfSkERQQQ0o"
$miniOut = node -e "const h=require('./netlify/functions/minimax.js');const b=JSON.stringify({messages:[{role:'user',content:'hi'}],max_tokens:16});h.handler({httpMethod:'POST',body:b,headers:{}}).then(r=>console.log(r.statusCode+':'+JSON.parse(r.body).code)).catch(e=>console.log('ERR:'+e.message))" 2>&1
Add-Result "W04-minimax-fn" ($miniOut -match "^200:0") $miniOut

$results | Format-Table -AutoSize
$fail = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host ""
Write-Host "Total: $($results.Count)  PASS: $($results.Count - $fail)  FAIL: $fail"
exit $fail