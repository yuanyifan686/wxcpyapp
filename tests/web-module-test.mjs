import { parseRecord } from '../public/js/fortune.js'
import { getUserId } from '../public/js/storage.js'

const sample = {
  openid: 't',
  nickname: 'test',
  score: '88',
  fish_index: '70',
  boss_risk: '40',
  keywords: '["好运"]',
  buff: '{}',
  avoid: '[]',
  is_official: '1',
  fortune_date: '2026-07-08',
  level: 'SR',
  title: '测试',
}

const r = parseRecord(sample)
const uid = getUserId()
console.log('parseRecord:', r.score, r.keywords[0], r.level)
console.log('userId:', uid.slice(0, 10) + '...')
console.log('MODULE TEST: PASS')