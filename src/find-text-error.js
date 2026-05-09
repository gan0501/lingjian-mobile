const fs = require('fs');
const path = require('path');

function walk(dir, results = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item === 'node_modules' || item === 'build' || item === '.git') continue;
      walk(fullPath, results);
    } else if (/\.(tsx|jsx)$/.test(item)) {
      results.push(fullPath);
    }
  }
  return results;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Pattern 1: {condition && 'string'} or {condition && number}
    // Look for && followed by something that isn't a JSX tag or expression block
    const andMatch = line.match(/\{\s*[^}]*&&\s*([^<{][^}]*)\}/);
    if (andMatch) {
      const afterAnd = andMatch[1].trim();
      // If it's not starting with < or {, it might be a string/number variable
      if (!afterAnd.startsWith('<') && !afterAnd.startsWith('{')) {
        // Exclude common safe patterns
        if (!/^(null|undefined|false|true)$/i.test(afterAnd)) {
          issues.push({ line: lineNum, text: line.trim(), type: '&&-value' });
        }
      }
    }

    // Pattern 2: {array.length && <Component />}
    const lengthMatch = line.match(/\{\s*\w+\.length\s*&&\s*[^}]*\}/);
    if (lengthMatch) {
      issues.push({ line: lineNum, text: line.trim(), type: 'length-&&' });
    }

    // Pattern 3: > followed by text content and < (bare text in JSX)
    // This is a simplified check - look for >text< patterns
    const bareTextMatch = line.match(/>\s*([^\s<][^<]*)</g);
    if (bareTextMatch) {
      for (const match of bareTextMatch) {
        const text = match.replace(/^>\s*/, '').replace(/<$/, '');
        // Skip if it's just whitespace or common JSX content
        if (text.trim() && !/^\s*\{\s*.*\}\s*$/.test(text)) {
          // Skip style/prop values (inside {} blocks in non-JSX contexts)
          issues.push({ line: lineNum, text: line.trim(), type: 'bare-text' });
        }
      }
    }
  }

  return issues;
}

const srcDir = __dirname;
const files = walk(srcDir);

console.log(`Scanning ${files.length} files...\n`);

let totalIssues = 0;
for (const file of files) {
  const issues = analyzeFile(file);
  if (issues.length > 0) {
    console.log(`\n=== ${path.relative(srcDir, file)} ===`);
    for (const issue of issues) {
      console.log(`  Line ${issue.line} [${issue.type}]: ${issue.text.substring(0, 120)}`);
      totalIssues++;
    }
  }
}

console.log(`\n\nTotal potential issues found: ${totalIssues}`);
