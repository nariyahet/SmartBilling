const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const serverDir = path.join(__dirname, '..');
const files = walk(serverDir);

const results = [];

files.forEach(filePath => {
  const rel = path.relative(serverDir, filePath);
  if (rel.startsWith('scripts' + path.sep)) return; // skip scripts for main audit
  const code = fs.readFileSync(filePath, 'utf8');

  // check if file contains transaction patterns
  if (!/beginTransaction|START TRANSACTION|\.commit\(|\.rollback\(/i.test(code)) {
    return;
  }

  // Scan functions in the file
  const lines = code.split('\n');

  // Find each transaction block
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\.(beginTransaction\s*\(|query\s*\(\s*["']START TRANSACTION)/i.test(line)) {
      // Look backwards up to 60 lines to find function name and conn initialization
      let fnName = 'unknown';
      let connPattern = 'unknown';
      let connVar = 'conn';

      const m = line.match(/(?:await\s+)?([a-zA-Z0-9_$]+)\.(beginTransaction|query\s*\(\s*["']START TRANSACTION)/i);
      if (m) connVar = m[1];

      for (let j = i - 1; j >= Math.max(0, i - 60); j--) {
        const prev = lines[j];
        if (fnName === 'unknown') {
          const fnMatch = prev.match(/(?:const|let|var|exports\.|async\s+function|function)\s*([a-zA-Z0-9_$]+)\s*(?:=\s*(?:async\s*)?\([^)]*\)|=\s*async|[(])/);
          if (fnMatch) {
            fnName = fnMatch[1];
          }
        }
        if (connPattern === 'unknown') {
          if (prev.includes(connVar) && (prev.includes('db.promise()') || prev.includes('getConnection') || prev.includes('db.') || prev.includes('pool'))) {
            connPattern = prev.trim();
          }
        }
      }

      // Look forwards up to 100 lines for commit, rollback, release
      let hasCommit = false;
      let hasRollback = false;
      let hasRelease = false;
      let endLine = Math.min(lines.length, i + 150);

      for (let k = i; k < endLine; k++) {
        const next = lines[k];
        if (next.includes('.commit(') || /query\s*\(\s*["']COMMIT/i.test(next)) hasCommit = true;
        if (next.includes('.rollback(') || /query\s*\(\s*["']ROLLBACK/i.test(next)) hasRollback = true;
        if (next.includes('.release()')) hasRelease = true;
      }

      results.push({
        file: rel,
        lineNum: i + 1,
        fnName,
        connVar,
        connPattern,
        hasCommit,
        hasRollback,
        hasRelease,
        isBroken: !connPattern.includes('getConnection')
      });
    }
  }
});

fs.writeFileSync(path.join(__dirname, 'audit_report.json'), JSON.stringify(results, null, 2));

console.log('Total transaction locations found:', results.length);
console.log('Broken (db.promise() without getConnection):', results.filter(r => r.isBroken).length);
console.log('Audit results saved to server/scripts/audit_report.json');
