const https = require('https');
const fs = require('fs');
const path = require('path');

const fileUrl = 'https://unpkg.com/tailwindcss@3.4.18/lib/lib/cacheInvalidation.js';
const targetDir = path.join(__dirname, 'node_modules', 'tailwindcss', 'lib', 'lib');
const targetFile = path.join(targetDir, 'cacheInvalidation.js');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const file = fs.createWriteStream(targetFile);

https.get(fileUrl, function (response) {
    if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', function () {
            file.close();
            console.log('✅ cacheInvalidation.js downloaded successfully.');
        });
    } else {
        console.error('❌ Failed to download file. Status Code:', response.statusCode);
        file.close();
    }
}).on('error', function (err) {
    fs.unlink(targetFile, () => { });
    console.error('❌ Error downloading:', err.message);
});
