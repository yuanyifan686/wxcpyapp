const API_BASE = '/api'

export async function apiRequest(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(API_BASE + path, opts)
  const json = await res.json().catch(() => ({}))

  if (!res.ok || json.code !== 0) {
    throw new Error(json.msg || '请求失败')
  }
  return json.data
}