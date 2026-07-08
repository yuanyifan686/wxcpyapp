/**
 * Netlify API 代理请求封装
 */
const config = require('../config/index.js')

function getProxyBase() {
  const base = config.proxyBaseUrl
  return base ? base.replace(/\/$/, '') : ''
}

function useProxy() {
  return !!getProxyBase()
}

function proxyRequest(path, method, data, extraHeaders) {
  const base = getProxyBase()
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
    if (config.apiSecret) headers['X-API-Key'] = config.apiSecret

    wx.request({
      url: base + path,
      method,
      header: headers,
      data,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          const msg = (res.data && res.data.msg) || '代理请求失败'
          reject(new Error(msg))
        }
      },
      fail: reject,
    })
  })
}

module.exports = {
  getProxyBase,
  useProxy,
  proxyRequest,
}