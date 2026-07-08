/**
 * 日期工具
 */

function pad(n) {
  const s = String(n)
  return s.length < 2 ? '0' + s : s
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-')
}

function today() {
  return formatDate(new Date())
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatDate(d)
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr.replace(/-/g, '/'))
  d.setDate(d.getDate() + delta)
  return formatDate(d)
}

const RANKING_HISTORY_DAYS = 30

function formatDisplay(dateStr) {
  const d = new Date(dateStr.replace(/-/g, '/'))
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${dateStr} 周${week}`
}

function nowTimestamp() {
  return String(Date.now())
}

module.exports = {
  formatDate,
  today,
  daysAgo,
  shiftDate,
  formatDisplay,
  nowTimestamp,
  RANKING_HISTORY_DAYS,
}