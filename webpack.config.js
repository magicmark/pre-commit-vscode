const nodeExternals = require('webpack-node-externals');

module.exports = {
    target: 'node',
    output: {
        libraryTarget: "umd"
    },
    externals: [
        'vscode',
       // nodeExternals({ whitelist: ['vscode'] })
    ],
    module: {
        rules: [
          {
            test: /\.(js)$/,
            exclude: /node_modules/,
            use: {
              loader: "babel-loader"
            }
          }
        ]
    }    
}