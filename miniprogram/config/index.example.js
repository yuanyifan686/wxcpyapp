/**
 * 配置模板 — 复制为 index.js 并填入真实值
 * index.js 已加入 .gitignore，不会提交到仓库
 */
module.exports = {
  // 部署 Netlify 后填入，例如 https://your-site.netlify.app/api
  // 留空则直连 Coze / Minimax（需在微信后台配置对应域名）
  proxyBaseUrl: '',
  // 若 Netlify 设置了 API_SECRET，在此填入相同值
  apiSecret: '',
  coze: {
    token: 'pat_xxxxxxxx',
    workspaceId: 'YOUR_WORKSPACE_ID',
    collections: {
      fortuneRecords: 'YOUR_FORTUNE_RECORDS_DATABASE_ID',
      users: 'YOUR_USERS_DATABASE_ID',
      checkIns: 'YOUR_CHECK_INS_DATABASE_ID',
    },
    baseUrl: 'https://api.coze.cn/v1',
  },
  minimax: {
    apiKey: 'sk-cp-xxxxxxxx',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'Minimax-M3',
  },
}