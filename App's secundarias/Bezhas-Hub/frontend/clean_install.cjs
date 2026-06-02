
const fs = require('fs');
const path = require('path');

const deleteFolderRecursive = function(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
};

console.log('Cleaning node_modules...');
try {
    deleteFolderRecursive(path.join(__dirname, 'node_modules'));
    console.log('node_modules deleted.');
} catch (e) {
    console.error('Error deleting node_modules:', e);
}

if (fs.existsSync(path.join(__dirname, 'package-lock.json'))) {
    fs.unlinkSync(path.join(__dirname, 'package-lock.json'));
    console.log('package-lock.json deleted.');
}
