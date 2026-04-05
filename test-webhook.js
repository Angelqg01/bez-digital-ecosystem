const https = require('https');

const data = JSON.stringify({
  message: {
    // Usando el ID real para pasar el bloque de seguridad y testear la IA.
    chat: { id: "1887083098" },
    text: "Hola IA, manda un resumen de metricas",
    from: {
      first_name: "Yoe",
      username: "Yoelandro"
    }
  }
});

const options = {
  hostname: '127.0.0.1',
  port: 8080,
  path: '/api/telegram/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
