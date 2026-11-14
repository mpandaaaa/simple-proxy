// Deploy perfectxi.app by changing only the files named, and carrying every
// other live file across by its sha, untouched.
//
// The site was uploaded by hand and Netlify rewrites some pages as it serves
// them, so a whole-folder deploy would send slightly different copies of
// pages nobody meant to change, and would drop netlify.toml, which is not
// served publicly. Naming the files avoids both.
//
//   node deploy.mjs index.html s27.css            a preview link, live site untouched
//   node deploy.mjs index.html s27.css --live     publish to perfectxi.app
//
// Needs the Netlify CLI signed in (npx netlify-cli login).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = '547282a9-af48-456a-b3d6-aac333439aef';
const API = 'https://api.netlify.com/api/v1';
const live = process.argv.includes('--live');
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!names.length) throw new Error('name the files to deploy');

const cfg = JSON.parse(readFileSync(join(process.env.APPDATA, 'netlify', 'Config', 'config.json'), 'utf8'));
const token = cfg.users?.[cfg.userId]?.auth?.token;
if (!token) throw new Error('Netlify CLI is not signed in');
const H = { Authorization: `Bearer ${token}` };
const get = async (p) => {
  const r = await fetch(API + p, { headers: H });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.json();
};

const site = await get(`/sites/${SITE}`);
if (site.ssl_url !== 'https://perfectxi.app' && site.url !== 'https://perfectxi.app') throw new Error(`unexpected site ${site.url}`);
const files = await get(`/sites/${SITE}/files`);
const map = {};
for (const f of files) map[f.id.startsWith('/') ? f.id : '/' + f.id] = f.sha;
const before = Object.keys(map).length;

const changed = {};
for (const n of names) {
  const path = '/' + n.replace(/\\/g, '/').replace(/^\//, '');
  const body = readFileSync(join(HERE, n));
  const sha = createHash('sha1').update(body).digest('hex');
  changed[path] = { body, sha, isNew: !(path in map) };
  map[path] = sha;
}
console.log(`${before} files live. Sending ${names.length}, carrying ${before - Object.values(changed).filter((c) => !c.isNew).length} across untouched.`);
for (const [p, c] of Object.entries(changed)) console.log(`  ${c.isNew ? 'new    ' : 'changed'} ${p}`);

const r = await fetch(`${API}/sites/${SITE}/deploys`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ files: map, draft: !live, title: live ? 'Season 26/27 look' : 'Season 26/27 look, preview' }),
});
if (!r.ok) throw new Error(`create deploy: ${r.status} ${await r.text()}`);
const dep = await r.json();
const wanted = new Set(Object.values(changed).map((c) => c.sha));
if (dep.required.some((s) => !wanted.has(s))) throw new Error('Netlify asked for a file that was not named. Stopping.');
for (const [p, c] of Object.entries(changed)) {
  if (!dep.required.includes(c.sha)) continue;
  const u = await fetch(`${API}/deploys/${dep.id}/files${p}`, {
    method: 'PUT',
    headers: { ...H, 'Content-Type': 'application/octet-stream' },
    body: c.body,
  });
  if (!u.ok) throw new Error(`upload ${p}: ${u.status} ${await u.text()}`);
}
for (let i = 0; i < 40; i++) {
  const d = await get(`/deploys/${dep.id}`);
  if (d.state === 'ready') {
    console.log(live ? `live at https://perfectxi.app` : `preview at ${d.deploy_ssl_url}`);
    process.exit(0);
  }
  if (d.state === 'error') throw new Error(d.error_message);
  await new Promise((res) => setTimeout(res, 2000));
}
console.log('still processing');
