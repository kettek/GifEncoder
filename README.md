# GifEncoder
This JavaScript library provides a single file GIF encoder that can be easily embedded via script tags or require()'d.

It is a fork of [gif.js](https://github.com/jnordberg/gif.js/) and obeys most of the same conventions. It differs in that it does not use CoffeeScript and does not require a separate workers JavaScript file. Blobs provide the Web Workers so that the entire library is self-contained.

It was largely rewritten so as to be more easily embedded into [MediaStream-GifRecorder](https://github.com/kettek/MediaStream-GifRecorder), a JavaScript class that provides a MediaStream interface for recording browser media devices, such as webcams and desktop capturing, to GIFs.

## Basic Usage

```
// let ctx = canvas.getContext('2d')...

let encoder = new GifEncoder({
  workers: 4,
  quality: 10,
  dither: true,
  width: 320,
  height: 240,
})
encoder.addEventListener('finished', e => {
  // Do something with e.data (GIF Blob)
})

encoder.addEventListener('progress', e => {
  // Do something with frame count provided by progress.loaded and progress.total
})

encoder.addFrame(ctx, { copy: true, delay: 100 })
// Render a second image to the canvas.
encoder.addFrame(ctx, { copy: true, delay: 100 })

encoder.render()
```
