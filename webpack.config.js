const path = require('path')

module.exports = {
  entry: './src/GifEncoder.js',
  mode: "production",
  output: {
    filename: "GifEncoder.js",
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.worker\.js$/,
        use: { 
          loader: 'worker-loader',
          options: { inline: true }
        }
      }
    ]
  }
}
