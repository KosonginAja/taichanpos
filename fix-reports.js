const fs = require('fs');
const path = require('path');

const files = [
  './src/app/api/reports/dashboard/route.ts',
  './src/app/api/reports/export/route.ts',
  './src/app/api/reports/profit-loss/route.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace o.revenueTotal with o.grandTotal
  content = content.replace(/o\.revenueTotal\.toString\(\)/g, 'o.grandTotal.toString()');
  content = content.replace(/orders\.revenueTotal/g, 'orders.grandTotal');
  
  // Replace o.profitTotal with (o.profitTotal + roundingAdjustment) or (grandTotal - hppTotal)
  // Actually, wait, let's just use `(parseFloat(o.profitTotal.toString()) + parseFloat(o.roundingAdjustment?.toString() || "0"))` where needed.
  // It's safer to just replace `parseFloat(o.profitTotal.toString())` with `(parseFloat(o.grandTotal.toString()) - parseFloat(o.hppTotal.toString()))`
  // Let's do string replacement:
  content = content.replace(/parseFloat\(o\.profitTotal\.toString\(\)\)/g, '(parseFloat(o.grandTotal.toString()) - parseFloat(o.hppTotal.toString()))');

  // Specific for export
  content = content.replace(/revenueTotal: orders.grandTotal,/g, 'revenueTotal: orders.grandTotal, roundingAdjustment: orders.roundingAdjustment,');

  fs.writeFileSync(file, content, 'utf8');
});
console.log("Reports updated.");
