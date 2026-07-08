const BUFF_LABELS = {
  color: { label: '幸运色', emoji: '🎨' },
  number: { label: '幸运数', emoji: '🔢' },
  emoji: { label: '幸运Emoji', emoji: '✨' },
  drink: { label: '幸运饮料', emoji: '🥤' },
  song: { label: '幸运歌曲', emoji: '🎵' },
  direction: { label: '幸运方向', emoji: '🧭' },
  time: { label: '幸运时间', emoji: '⏰' },
  weather: { label: '幸运天气', emoji: '🌤' },
  career: { label: '幸运职业', emoji: '💼' },
  food: { label: '幸运食物', emoji: '🍗' },
  pet: { label: '幸运宠物', emoji: '🐱' },
  city: { label: '幸运城市', emoji: '🏙' },
}

Component({
  properties: {
    buff: { type: Object, value: {} },
  },
  data: { items: [] },
  observers: {
    buff(b) {
      if (!b) return
      const items = Object.keys(BUFF_LABELS).map((key) => ({
        label: BUFF_LABELS[key].label,
        emoji: key === 'emoji' ? (b.emoji || '✨') : BUFF_LABELS[key].emoji,
        value: String(b[key] || '-'),
      }))
      this.setData({ items })
    },
  },
})