function pad(n) {
  const s = String(n)
  return s.length < 2 ? '0' + s : s
}

export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-')
}

export function today() {
  return formatDate(new Date())
}

export function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatDate(d)
}

export function formatDisplay(dateStr) {
  const d = new Date(dateStr.replace(/-/g, '/'))
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${dateStr} 周${week}`
}

export function nowTimestamp() {
  return String(Date.now())
}