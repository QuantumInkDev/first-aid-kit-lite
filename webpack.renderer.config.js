const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');
const path = require('path');

rules.push(
  {
    test: /\.css$/,
    use: [
      { loader: 'style-loader' },
      { loader: 'css-loader' },
      { loader: 'postcss-loader' },
    ],
  },
  {
    test: /\.(png|jpe?g|gif|svg|ico)$/i,
    type: 'asset/resource',
    generator: {
      filename: 'assets/images/[name][ext]',
    },
  },
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/i,
    type: 'asset/resource',
    generator: {
      filename: 'assets/fonts/[name][ext]',
    },
  }
);

module.exports = {
  module: {
    rules,
  },
  plugins: plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
  },
  devServer: {
    hot: true,
    port: 3000,
  },
};