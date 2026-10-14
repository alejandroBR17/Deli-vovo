import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function secretKinds(contents) {
  // This exact credential-shaped fixture is deliberately fake and never calls Stripe.
  const text = contents.replaceAll('sk_test_local_fixture_no_network', 'LOCAL_FIXTURE');
  return [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['provider-token', /(?:sk_live_|sk_test_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/],
    ['mercado-pago-token', /(?:APP_USR|TEST)-\d{8,}-\d{6,}-[a-zA-Z0-9]+-\d+/],
    ['google-api-key', /AIza[A-Za-z0-9_-]{35}/],
  ].filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
}

export function scanTrackedFiles() {
  const files = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
  const findings = [];
  for (const file of files) {
    if (/^(?:data|\.vercel|node_modules)\//.test(file) || /(?:^|\/)\.env(?!\.example$)|\.private\.|\.(?:sqlite|db)$/.test(file)) findings.push({file, kind:'private-file'});
    if (!fs.existsSync(file) || !/\.(?:md|mjs|cjs|js|ts|tsx|json|env|example|txt|yml|yaml|html)$/.test(file)) continue;
    for (const kind of secretKinds(fs.readFileSync(file,'utf8'))) findings.push({file,kind});
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const findings=scanTrackedFiles();
  if(findings.length){for(const {file,kind} of findings)console.error(`${file}: ${kind}`);process.exitCode=1;}
  else console.log('Tracked files passed the credential-pattern check. This is not a complete secret audit.');
}
