const http = require('http');

const req = http.get('http://127.0.0.1:3006/api/ai/agents', (res) => {
    console.log('STATUS: ' + res.statusCode);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log('BODY: ' + chunk);
    });
});

req.on('error', (e) => {
    console.log('problem with request: ' + e.message);
});
