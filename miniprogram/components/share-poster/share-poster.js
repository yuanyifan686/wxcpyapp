Component({
  properties: {
    fortune: { type: Object, value: null },
    nickname: { type: String, value: '赛博旅人' },
    width: { type: Number, value: 600 },
    height: { type: Number, value: 900 },
  },

  methods: {
    generate() {
      return new Promise((resolve, reject) => {
        const fortune = this.data.fortune
        if (!fortune) {
          reject(new Error('无运势数据'))
          return
        }
        const query = this.createSelectorQuery()
        query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            reject(new Error('Canvas 初始化失败'))
            return
          }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio
          const w = this.data.width
          const h = this.data.height
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.scale(dpr, dpr)

          const grd = ctx.createLinearGradient(0, 0, w, h)
          grd.addColorStop(0, '#0a0a12')
          grd.addColorStop(0.5, '#1a1040')
          grd.addColorStop(1, '#0a2030')
          ctx.fillStyle = grd
          ctx.fillRect(0, 0, w, h)

          ctx.fillStyle = '#6C63FF'
          ctx.font = 'bold 28px sans-serif'
          ctx.fillText('今日赛博运势', 40, 60)

          ctx.fillStyle = '#FFD700'
          ctx.font = 'bold 72px sans-serif'
          ctx.fillText(fortune.score + '%', 40, 160)

          ctx.fillStyle = '#A855F7'
          ctx.font = 'bold 36px sans-serif'
          ctx.fillText(fortune.level, 40, 210)

          ctx.fillStyle = '#F8FAFC'
          ctx.font = '24px sans-serif'
          this.wrapText(ctx, fortune.summary, 40, 280, w - 80, 36)

          ctx.fillStyle = '#94A3B8'
          ctx.font = '20px sans-serif'
          ctx.fillText('— ' + this.data.nickname, 40, h - 120)
          ctx.fillText('宇宙服务器已同步你的幸运值', 40, h - 80)

          wx.canvasToTempFilePath({
            canvas,
            success(r) { resolve(r.tempFilePath) },
            fail: reject,
          })
        })
      })
    },

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const chars = text.split('')
      let line = ''
      let cy = y
      chars.forEach((ch) => {
        const test = line + ch
        if (ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line, x, cy)
          line = ch
          cy += lineHeight
        } else {
          line = test
        }
      })
      if (line) ctx.fillText(line, x, cy)
    },
  },
})