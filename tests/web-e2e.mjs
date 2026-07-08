/**
 * 模拟网页版完整业务流程（API 层端到端）
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8').replace(/^\uFEFF/, '')
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
  } catch (e) { /* ignore */ }
}

loadEnv()

const { handler: cozeHandler } = await import('../netlify/functions/coze.js')
const { handler: rankingHandler } = await import('../netlify/functions/ranking.js')
const { handler: minimaxHandler } = await import('../netlify/functions/minimax.js')

const results = []
function pass(name, detail) { results.push({ name, ok: true, detail }); console.log(`✓ ${name}: ${detail}`) }
function fail(name, detail) { results.push({ name, ok: false, detail }); console.log(`✗ ${name}: ${detail}`) }

async function callCoze(action, dbKey, payload, row, filter) {
  const res = await cozeHandler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ action, dbKey, payload, row, filter }),
  })
  const body = JSON.parse(res.body)
  if (res.statusCode !== 200 || body.code !== 0) throw new Error(body.msg || `HTTP ${res.statusCode}`)
  return body.data
}

const testUser = 'web_e2e_' + Date.now()
const today = new Date().toISOString().slice(0, 10)

try {
  // 1. AI 生成运势
  const miniRes = await minimaxHandler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({
      messages: [
        { role: 'system', content: '只返回JSON: {"level":"SR","score":82,"fishIndex":75,"bossRisk":40,"summary":"测试","fortune":"测试","oneLine":"测试","keywords":["好运"],"buff":{"color":"蓝","number":7,"emoji":"🚀","drink":"咖啡","food":"面","city":"上海","song":"歌","direction":"东","time":"10:00","weather":"晴","career":"码农","pet":"猫"},"avoid":["熬夜"],"title":"测试员"}' },
        { role: 'user', content: '生成今日运势' },
      ],
      max_tokens: 512,
    }),
  })
  const miniBody = JSON.parse(miniRes.body)
  if (miniRes.statusCode !== 200 || miniBody.code !== 0) throw new Error('Minimax 失败: ' + miniBody.msg)
  const aiText = miniBody.data.choices[0].message.content
  const fortune = JSON.parse(aiText.match(/\{[\s\S]*\}/)[0])
  pass('1-AI生成运势', `level=${fortune.level} score=${fortune.score}`)

  // 2. 写入运势记录
  await callCoze('insert', 'fortuneRecords', [{
    openid: testUser,
    nickname: 'E2E测试员',
    avatar_url: '',
    fortune_date: today,
    level: fortune.level,
    score: String(fortune.score),
    fish_index: String(fortune.fishIndex || 70),
    boss_risk: String(fortune.bossRisk || 50),
    summary: fortune.summary,
    fortune: fortune.fortune,
    one_line: fortune.oneLine,
    keywords: JSON.stringify(fortune.keywords || []),
    buff: JSON.stringify(fortune.buff || {}),
    avoid: JSON.stringify(fortune.avoid || []),
    title: fortune.title,
    is_official: '1',
    raw_data: '{}',
    created_at: String(Date.now()),
  }])
  pass('2-写入运势记录', `user=${testUser}`)

  // 3. 查询今日运势
  const q = await callCoze('query', 'fortuneRecords', {
    pageNum: 1, pageSize: 1,
    filter: {
      logic: 'and',
      conditions: [
        { left: 'openid', operation: 'equal', right: testUser },
        { left: 'fortune_date', operation: 'equal', right: today },
        { left: 'is_official', operation: 'equal', right: '1' },
      ],
    },
  })
  if (!q.items || !q.items.length) throw new Error('查不到今日运势')
  pass('3-查询今日运势', `score=${q.items[0].score}`)

  // 4. 排行榜
  const rankRes = await rankingHandler({ httpMethod: 'GET', queryStringParameters: { date: today }, headers: {} })
  const rankBody = JSON.parse(rankRes.body)
  if (rankRes.statusCode !== 200 || rankBody.code !== 0) throw new Error('排行榜失败')
  const onBoard = (rankBody.data.items || []).some((i) => i.openid === testUser)
  pass('4-今日欧皇榜', `total=${rankBody.data.items.length} onBoard=${onBoard}`)

  // 5. 历史记录
  const hist = await callCoze('query', 'fortuneRecords', {
    pageNum: 1, pageSize: 30,
    filter: {
      logic: 'and',
      conditions: [
        { left: 'openid', operation: 'equal', right: testUser },
        { left: 'is_official', operation: 'equal', right: '1' },
      ],
    },
    orderBy: [{ field_name: 'fortune_date', direction: 'desc' }],
  })
  pass('5-历史记录', `count=${hist.items ? hist.items.length : 0}`)

  // 6. 静态资源完整性
  const html = readFileSync(resolve(root, 'public/index.html'), 'utf8')
  const hasApp = html.includes('id="app"') && html.includes('/js/app.js')
  const css = readFileSync(resolve(root, 'public/css/app.css'), 'utf8')
  const hasStyle = css.includes('.home-page') && css.includes('.tab-bar')
  if (!hasApp || !hasStyle) throw new Error('静态资源不完整')
  pass('6-静态页面', 'index.html + app.css OK')

} catch (err) {
  fail('E2E', err.message)
}

const failed = results.filter((r) => !r.ok).length
console.log(`\nE2E 结果: ${results.length - failed}/${results.length} 通过`)
process.exit(failed > 0 ? 1 : 0)