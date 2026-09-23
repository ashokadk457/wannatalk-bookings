// One-time migration utility. The original page remains an untouched rollback reference.
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);
fs.mkdirSync(new URL('src/styles/', root), { recursive: true });
fs.mkdirSync(new URL('public/assets/', root), { recursive: true });
const styles = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map(m => m[1]);
const workflows = fs.readFileSync(new URL('../../public/wannatalk-workflows.js', import.meta.url), 'utf8');
styles.push(...[...workflows.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map(m => m[1]));
fs.writeFileSync(new URL('src/styles/original.css', root), styles.join('\n\n'));
for (const [variable, name] of [['brandLogoTransparentData', 'logo-transparent'], ['welcomeBackgroundData', 'welcome']]) {
  const match = html.match(new RegExp(`${variable}\\s*=\\s*['\"]data:image/(\\w+);base64,([^'\"]+)`));
  if (!match) throw new Error(`Missing design asset: ${variable}`);
  fs.writeFileSync(new URL(`public/assets/${name}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`, root), Buffer.from(match[2], 'base64'));
}
fs.copyFileSync(new URL('../../public/wannatalk-logo.png', import.meta.url), new URL('public/assets/wannatalk-logo.png', root));
