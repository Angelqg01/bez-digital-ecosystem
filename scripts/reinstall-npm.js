// Download and reinstall npm from scratch
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NPM_VERSION = '11.11.0';
const REGISTRY_URL = `https://registry.npmjs.org/npm/${NPM_VERSION}`;
const TEMP = process.env.TEMP || 'C:\\Temp';
const TARBALL_PATH = path.join(TEMP, `npm-${NPM_VERSION}.tgz`);
const NPM_DIR = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node_modules', 'npm');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return fetchJSON(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const doGet = (u) => {
      https.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400) {
          return doGet(res.headers.location);
        }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on('finish', () => { stream.close(); resolve(); });
        stream.on('error', reject);
      }).on('error', reject);
    };
    doGet(url);
  });
}

async function main() {
  console.log('Fetching npm package metadata...');
  const meta = await fetchJSON(REGISTRY_URL);
  const tarballURL = meta.dist.tarball;
  console.log('Tarball URL:', tarballURL);

  console.log('Downloading tarball...');
  await downloadFile(tarballURL, TARBALL_PATH);
  const size = fs.statSync(TARBALL_PATH).size;
  console.log(`Downloaded: ${(size / 1024 / 1024).toFixed(2)} MB`);

  // Extract using Windows tar command
  const extractDir = path.join(TEMP, 'npm-extract');
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });
  
  console.log('Extracting tarball...');
  execSync(`tar -xzf "${TARBALL_PATH}" -C "${extractDir}"`, { stdio: 'inherit' });
  
  // The tarball extracts to a 'package' subdirectory
  const srcDir = path.join(extractDir, 'package');
  if (!fs.existsSync(srcDir)) {
    console.error('ERROR: Expected "package" directory not found in tarball');
    process.exit(1);
  }

  // Copy only the lib and node_modules directories over
  const dirsToCopy = ['lib', 'node_modules'];
  for (const dir of dirsToCopy) {
    const src = path.join(srcDir, dir);
    const dest = path.join(NPM_DIR, dir);
    if (fs.existsSync(src)) {
      console.log(`Copying ${dir}/ to npm installation...`);
      // Use robocopy for reliable Windows copying
      try {
        execSync(`robocopy "${src}" "${dest}" /E /NFL /NDL /NJH /NJS /NC /NS /NP`, { 
          stdio: 'pipe',
          timeout: 120000  
        });
      } catch (e) {
        // Robocopy returns non-zero exit codes for success (1 = files copied)
        if (e.status > 7) {
          console.error(`robocopy failed with status ${e.status}`);
        }
      }
    }
  }

  // Also copy bin directory
  const binSrc = path.join(srcDir, 'bin');
  const binDest = path.join(NPM_DIR, 'bin');
  if (fs.existsSync(binSrc)) {
    console.log('Copying bin/ to npm installation...');
    try {
      execSync(`robocopy "${binSrc}" "${binDest}" /E /NFL /NDL /NJH /NJS /NC /NS /NP`, { 
        stdio: 'pipe',
        timeout: 30000  
      });
    } catch (e) {
      if (e.status > 7) console.error(`robocopy bin failed: ${e.status}`);
    }
  }

  // Cleanup
  console.log('Cleaning up...');
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.rmSync(TARBALL_PATH, { force: true });

  // Verify
  console.log('Verifying...');
  const result = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log('npm version:', result);
  
  // Test requiring a module that was broken
  try {
    require(path.join(NPM_DIR, 'node_modules', 'pacote', 'lib', 'util', 'cache-dir.js'));
    console.log('pacote cache-dir: OK');
  } catch (e) {
    console.log('pacote cache-dir: STILL BROKEN -', e.message);
  }

  console.log('npm reinstallation complete!');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
