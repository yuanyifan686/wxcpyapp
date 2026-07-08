Component({
  properties: {
    text: { type: String, value: '按钮' },
    type: { type: String, value: 'primary' },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      if (!this.data.disabled) this.triggerEvent('tap')
    },
  },
})