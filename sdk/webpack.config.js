const path = require('path');

module.exports = {
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bezhas-sdk.min.js',
        library: 'BeZhas',
        libraryTarget: 'umd',
        globalObject: 'this',
        // clean: true // Only in Webpack 5+
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js'],
        fallback: {
            fs: false,
            path: false
        }
    },
    mode: 'production'
};
