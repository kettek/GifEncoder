class EventEmitter {
  constructor() {
    this._listeners = {}
  }
  addEventListener(t, cb) {
    if (!(t in this._listeners)) {
      this._listeners[t] = []
    }
    this._listeners[t].push(cb)
  }
  removeEventListener(t, cb) {
    if (!(t in this._listeners)) {
      return
    }
    var stack = this._listeners[t]
    for (var i = 0, l = stack.length; i < l; i++) {
      if (stack[i] === cb) {
        stack.splice(i, 1)
        return
      }
    }
  }
  dispatchEvent(e) {
    if (!(e.type in this._listeners)) {
      return true
    }
    var stack = this._listeners[e.type].slice()

    for (var i = 0, l = stack.length; i < l; i++) {
      stack[i].call(this, e)
    }
    return !e.defaultPrevented
  }
}

module.exports = EventEmitter
