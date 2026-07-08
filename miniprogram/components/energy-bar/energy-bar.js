const { animateNumber } = require('../../utils/animation.js')

Component({
  properties: {
    value: { type: Number, value: 0 },
    animate: { type: Boolean, value: true },
  },
  data: { displayValue: 0 },
  observers: {
    value(v) {
      if (this.data.animate) {
        animateNumber(this, 'displayValue', this.data.displayValue, v, 1000)
      } else {
        this.setData({ displayValue: v })
      }
    },
  },
})