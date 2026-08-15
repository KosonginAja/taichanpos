const fs = require('fs');
const path = require('path');

const directory = './src/app';

const replacements = [
  // Backgrounds
  { regex: /bg-slate-950/g, replacement: 'bg-slate-50' },
  { regex: /bg-slate-900/g, replacement: 'bg-white' },
  { regex: /bg-slate-800/g, replacement: 'bg-slate-100' },
  { regex: /hover:bg-slate-900/g, replacement: 'hover:bg-slate-50' },
  { regex: /hover:bg-slate-800/g, replacement: 'hover:bg-slate-100' },
  
  // Text
  { regex: /text-slate-100/g, replacement: 'text-slate-900' },
  { regex: /text-slate-200/g, replacement: 'text-slate-800' },
  { regex: /text-slate-300/g, replacement: 'text-slate-600' },
  { regex: /text-slate-400/g, replacement: 'text-slate-500' },
  { regex: /hover:text-slate-100/g, replacement: 'hover:text-slate-900' },
  { regex: /hover:text-slate-200/g, replacement: 'hover:text-slate-800' },
  { regex: /hover:text-slate-300/g, replacement: 'hover:text-slate-700' },
  
  // Borders
  { regex: /border-slate-800/g, replacement: 'border-slate-200' },
  { regex: /border-slate-700/g, replacement: 'border-slate-300' },
  
  // Colors (Indigo & Purple -> Orange)
  { regex: /bg-indigo-600/g, replacement: 'bg-orange-500' },
  { regex: /hover:bg-indigo-700/g, replacement: 'hover:bg-orange-600' },
  { regex: /text-indigo-400/g, replacement: 'text-orange-500' },
  { regex: /text-indigo-500/g, replacement: 'text-orange-600' },
  { regex: /border-indigo-500/g, replacement: 'border-orange-500' },
  { regex: /shadow-indigo-500/g, replacement: 'shadow-orange-500' },
  
  { regex: /bg-purple-600/g, replacement: 'bg-orange-500' },
  { regex: /hover:bg-purple-700/g, replacement: 'hover:bg-orange-600' },
  { regex: /text-purple-400/g, replacement: 'text-orange-500' },
  { regex: /text-purple-500/g, replacement: 'text-orange-600' },
  { regex: /border-purple-500/g, replacement: 'border-orange-500' },
  { regex: /bg-purple-900/g, replacement: 'bg-orange-100' },
  
  // Fix specifically text-white that were in dark mode backgrounds (but not on buttons)
  // This is tricky, might need manual check. I will replace text-white in specific text tags.
  // Actually, many text-white are on buttons (which we want to keep white text for orange bg).
  // So I'll NOT globally replace text-white.
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  replacements.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function traverseDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.css') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  });
}

traverseDir(directory);
console.log('Theme replacement complete.');
