// eslint-disable-next-line import/no-extraneous-dependencies
import dotenv from 'dotenv'
import Dotenv from 'dotenv-webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import webpack from 'webpack'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url)
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename)

dotenv.config()
export default {
  devServer: {
    port: 3100,
    https: process.env.HTTP === undefined,
    http2: process.env.HTTP === undefined,
    historyApiFallback: true,
    hot: false,
    client: {
      overlay: false,
      progress: true
    }
  },
  cache: { type: 'filesystem' },
  module: {
    noParse: /\.wasm$/,
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: { not: [/el/] } // exclude react component if *.svg?el
      },
      {
        test: /\.svg$/i,
        resourceQuery: /el/, // *.svg?el
        use: ['@svgr/webpack']
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.less$/,
        use: [
          { loader: 'style-loader' },
          // translates CSS into CommonJS
          { loader: 'css-loader' },
          {
            loader: 'less-loader',
            options: { lessOptions: { javascriptEnabled: true } }
          }
        ]
      }
    ]
  },
  entry: { main: ['./src/index.tsx'] },
  devtool: process.env.DEBUG ? 'source-map' : undefined,
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/'
  },

  externals: {
    path: 'path',
    fs: 'fs'
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    extensions: ['.tsx', '.ts', '.js']
  },
  mode: 'production',
  optimization: { splitChunks: { chunks: 'all' } },

  plugins: [
    new Dotenv({
      allowEmptyValues: true,
      systemvars: true
    }),

    new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'index.html',
      favicon: 'assets/favicon.png',
      template: 'assets/index.html',
      environment: process.env.NODE_ENV,
      hash: true
    }),
    new webpack.ProvidePlugin({ process: 'process/browser' }),
    process.env.SIZE_ANALYSIS === 'true' ? new BundleAnalyzerPlugin({ }) : null
  ].filter(i => i)
}
