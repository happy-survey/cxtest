module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
        exclude: [
          // Exclude CXONE SDK modules from source map loading
          /node_modules\/@nice-devone/,
          // Also exclude their dependencies that might have issues
          /node_modules\/rxjs/,
          /node_modules\/tslib/
        ]
      }
    ]
  },
  // Ignore source map warnings for these modules
  ignoreWarnings: [
    {
      module: /@nice-devone/,
      message: /Failed to parse source map/
    },
    {
      module: /rxjs/,
      message: /Failed to parse source map/
    }
  ]
};