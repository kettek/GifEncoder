/*!
  GifEncoder.js

  Authors
  Kevin Weiner (original Java version - kweiner@fmsware.com)
  Thibault Imbert (AS3 version - bytearray.org)
  Johan Nordberg (JS version - code@johan-nordberg.com)
  Ketchetwahmeegwun T. Southall (JavaScript restructure - kettek@kettek.net)
*/
import EventEmitter from './EventEmitter.js'
import GifFrameWorker from './GifFrame.worker.js'

class GifEncoder extends EventEmitter {
  constructor(options) {
    super()
    this._running = false
    this._options = Object.assign({
      workers: 2,
      repeat: 0,
      background: '#000',
      quality: 10,
      width: null,
      height: null,
      transparent: null,
      debug: false,
      dither: false
    }, options)
    this._frames = []
    this._freeWorkers = []
    this._activeWorkers = []
  }

  setWidth(width) {
    this._options["width"] = width
    if (this._canvas != null) {
      this._canvas.width = width
    }
  }
  setHeight(height) {
    this._options["height"] = height
    if (this._canvas != null) {
      this._canvas.height = height
    }
  }

  addFrame(image, options) {
    options = options || {}
    const frame = Object.assign({
      delay: 500,
      copy: false,
      dispose: -1,
      transparent: this._options.transparent
    }, options)

    // use the images width and height for options unless already set
    if (this._options.width == null) this.setWidth(image.width)
    if (this._options.height == null) this.setHeight(image.height)

    if (image instanceof ImageData) {
       frame.data = image.data
    } else if (image instanceof CanvasRenderingContext2D || image instanceof WebGLRenderingContext) {
      if (options.copy) {
        frame.data = this.getContextData(image)
      } else {
        frame.context = image
      }
    } else if (image.childNodes != null) {
      if (options.copy) {
        frame.data = this.getImageData(image)
      } else {
        frame.image = image
      }
    } else {
      throw new Error('Invalid image')
    }

    return this._frames.push(frame)
  }

  get running() {
    return this._running
  }

  render() {
    let i
    if (this.running) { throw new Error('Already running') }

    if ((this._options.width == null) || (this._options.height == null)) {
      throw new Error('Width and height must be set prior to rendering')
    }

    this._running = true
    this._nextFrame = 0
    this._finishedFrames = 0

    this._imageParts = (() => {
      let asc, end
      const result = []
      for (i = 0, end = this._frames.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
        result.push(null)
      }
      return result
    })()

    const numWorkers = this.spawnWorkers()
    // we need to wait for the palette
    if (this._options.globalPalette === true) {
      this.renderNextFrame()
    } else {
      let asc1, end1
      for (i = 0, end1 = numWorkers, asc1 = 0 <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) { this.renderNextFrame(); }
    }

    this.dispatchEvent(new ProgressEvent("start"))
    return this.dispatchEvent(new ProgressEvent('progress', {
      loaded: this._finishedFrames,
      total: this._frames.length
    }))
  }

  abort() {
    while (true) {
      var worker = this._activeWorkers.shift()
      if (worker == null) {
        break
      }
      worker.terminate()
    }
    this._running = false

    this.dispatchEvent(new ProgressEvent("abort")) // TODO: abort?
  }

  spawnWorkers() {
    const numWorkers = Math.min(this._options.workers, this._frames.length)

    __range__(this._freeWorkers.length, numWorkers, false).forEach(i => {
      const worker = new GifFrameWorker()
      worker.onmessage = event => {
        this._activeWorkers.splice(this._activeWorkers.indexOf(worker), 1)
        this._freeWorkers.push(worker)
        return this.frameFinished(event.data)
      }
      return this._freeWorkers.push(worker)
    })
    return numWorkers
  }

  frameFinished(frame) {
    this._finishedFrames++
    this.dispatchEvent(new ProgressEvent("progress", {
      loaded: this._finishedFrames,
      total: this._frames.length
    }))
    this._imageParts[frame.index] = frame
    // remember calculated palette, spawn the rest of the workers
    if (this._options.globalPalette === true) {
      this._options.globalPalette = frame.globalPalette
      if (this._frames.length > 2) {
        for (let i = 1, end = this._freeWorkers.length, asc = 1 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
          this._renderNextFrame()
        }
      }
    }
    if (Array.from(this._imageParts).includes(null)) {
      return this.renderNextFrame()
    } else {
      return this.finishRendering()
    }
  }

  finishRendering() {
    let frame
    let len = 0
    for (frame of Array.from(this._imageParts)) {
      len += ((frame.data.length - 1) * frame.pageSize) + frame.cursor
    }
    len += frame.pageSize - frame.cursor

    const data = new Uint8Array(len)
    let offset = 0
    for (frame of Array.from(this._imageParts)) {
      for (let i = 0; i < frame.data.length; i++) {
        const page = frame.data[i]
        data.set(page, offset)
        if (i === (frame.data.length - 1)) {
          offset += frame.cursor
        } else {
          offset += frame.pageSize
        }
      }
    }

    const image = new Blob(
      [data],
      {type: 'image/gif'}
    )

    return this.dispatchEvent(new BlobEvent("finished", {
      data: image
    }))
  }

  renderNextFrame() {
    if (this._freeWorkers.length === 0) {
      throw new Error('No free workers')
    }
    if (this._nextFrame >= this._frames.length) {
      return
    } // no new frame to render

    const frame = this._frames[this._nextFrame++]
    const worker = this._freeWorkers.shift()
    const task = this.getTask(frame)

    this._activeWorkers.push(worker)
    return worker.postMessage(task)//, [task.data.buffer]
  }

  getContextData(ctx) {
    return ctx.getImageData(0, 0, this._options.width, this._options.height).data
  }

  getImageData(image) {
    if (this._canvas == null) {
      this._canvas = document.createElement('canvas')
      this._canvas.width = this._options.width
      this._canvas.height = this._options.height
    }

    const ctx = this._canvas.getContext('2d')
    ctx.setFill = this._options.background
    ctx.fillRect(0, 0, this._options.width, this._options.height)
    ctx.drawImage(image, 0, 0)

    return this.getContextData(ctx)
  }

  getTask(frame) {
    const index = this._frames.indexOf(frame)
    const task = {
      index,
      last: index === (this._frames.length - 1),
      delay: frame.delay,
      dispose: frame.dispose,
      transparent: frame.transparent,
      width: this._options.width,
      height: this._options.height,
      quality: this._options.quality,
      dither: this._options.dither,
      globalPalette: this._options.globalPalette,
      repeat: this._options.repeat,
      //canTransfer: (browser.name === 'chrome')
    }

    if (frame.data != null) {
      task.data = frame.data
    } else if (frame.context != null) {
      task.data = this._getContextData(frame.context)
    } else if (frame.image != null) {
      task.data = this._getImageData(frame.image)
    } else {
      throw new Error('Invalid frame')
    }

    return task
  }
}

function __range__(left, right, inclusive) {
  let range = []
  let ascending = left < right
  let end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}

window.GifEncoder = GifEncoder
