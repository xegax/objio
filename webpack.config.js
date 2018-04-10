const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

var entry = {
  'objio': './src/entry/objio-lib.ts'
};

module.exports = {
  entry: entry,
  output: {
    path: path.resolve('.'),
    filename: 'index.js',
    library: '[name]',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    modules: [
      path.resolve('./src'),
      'node_modules'
    ]
  },
  externals: {
    'objio': './objio'
  },
  module: {
    loaders: [
      {
        test: /\.tsx?$/,
        loader: "awesome-typescript-loader",
        exclude: /node_modules/,
      }
    ]
  },
  plugins: [
    new UglifyJsPlugin()
  ],
  devtool: 'source-map'
}
