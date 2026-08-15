const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outPath = path.resolve(__dirname, 'preview_captured.png');

console.log('Taking screenshot with chrome...');
const res = spawnSync(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--window-size=1440,4600',
  `--screenshot=${outPath}`,
  '--virtual-time-budget=4000',
  'http://localhost:3000/preview'
]);

console.log('Finished. Status:', res.status);
console.log('File created:', fs.existsSync(outPath), 'Size:', fs.existsSync(outPath) ? fs.statSync(outPath).size : 0);
