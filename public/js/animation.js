export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function animateNumber(el, from, to, duration, onUpdate) {
  const start = Date.now()
  const tick = () => {
    const elapsed = Date.now() - start
    const progress = Math.min(elapsed / duration, 1)
    const value = Math.round(from + (to - from) * easeOutCubic(progress))
    if (onUpdate) onUpdate(value)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function scoreToStars(score) {
  if (score >= 90) return 5
  if (score >= 75) return 4
  if (score >= 60) return 3
  if (score >= 40) return 2
  return 1
}

export function levelColor(level) {
  const map = { SSR: '#FFD700', SR: '#A855F7', R: '#22D3EE', N: '#94A3B8' }
  return map[level] || '#6C63FF'
}