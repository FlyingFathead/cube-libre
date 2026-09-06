// Static deployment gate. No npm install, browser, or server required.
import {readFileSync,readdirSync,statSync,lstatSync,existsSync} from 'node:fs';
import {resolve,dirname,extname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),web=resolve(root,'web');
function walk(dir){return readdirSync(dir).flatMap(name=>{const p=resolve(dir,name);assert.ok(!lstatSync(p).isSymbolicLink(),`Symlink: ${p}`);return statSync(p).isDirectory()?walk(p):[p];});}
const files=walk(web);
const resolveRef=(file,ref)=>{
  if(/^(https?:|data:|#)/.test(ref))return;
  assert.ok(!ref.startsWith('/'),`Absolute URL would break project Pages: ${ref}`);
  const p=resolve(dirname(file),ref.split(/[?#]/)[0]);
  assert.ok(p.startsWith(web+'/'),`Escapes published web directory: ${ref}`);
  assert.ok(existsSync(p),`Missing ${ref} referenced by ${relative(root,file)}`);
};
for(const file of files){
  if(!file.endsWith('.nojekyll'))assert.ok(statSync(file).size>0,`Empty file: ${file}`);
  if(['.js','.mjs'].includes(extname(file))){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
    const src=readFileSync(file,'utf8');
    for(const m of src.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g))resolveRef(file,m[1]);
    for(const m of src.matchAll(/new URL\(['"]([^'"]+)['"],\s*import\.meta\.url\)/g))resolveRef(file,m[1]);
  }
  if(extname(file)==='.json')JSON.parse(readFileSync(file,'utf8'));
}
const html=readFileSync(resolve(web,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))resolveRef(resolve(web,'index.html'),m[1]);
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML id');
const app=readFileSync(resolve(web,'js/app.mjs'),'utf8');
for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1]),`Unknown UI id: ${m[1]}`);
const manifest=JSON.parse(readFileSync(resolve(web,'assets/audio/manifest.json')));
const release=JSON.parse(readFileSync(resolve(web,'version.json')));
assert.match(release.version,/^\d+\.\d+\.\d+$/,'Expected a major.minor.patch web version');
assert.equal(release.edition,'web');
assert.equal(release.repository,'https://github.com/FlyingFathead/cube-libre');
const embedded=JSON.parse(html.match(/<script id="release-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded,release,'Run node tools/prepare_web_release.mjs after changing web/version.json');
const imports=JSON.parse(html.match(/<script id="release-imports" type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const modules=files.filter(p=>/\.(mjs|js)$/.test(p)).map(p=>'./'+relative(web,p).replaceAll('\\','/')).sort();
assert.deepEqual(Object.keys(imports).sort(),modules,'Regenerate the release import map after adding/removing modules');
for(const path of modules)assert.equal(imports[path],`${path}?v=${release.version}`,'Every transitive module needs the current release URL');
assert.ok(html.includes(`href="./style.css?v=${release.version}"`),'Stylesheet release does not match');

const reference=JSON.parse(readFileSync(resolve(root,'tests/web/python-reference.json')));
assert.equal(release.upstream.commit,reference.source_commit,'PyGame provenance must match the reference fixtures');
assert.equal(Object.keys(manifest).length,20);
for(const name of ['shutter_close','shutter_open'])assert.ok(manifest[name],`Missing shutter sound: ${name}`);
for(const [name,item] of Object.entries(manifest))for(const ext of ['ogg','mp3']){
  assert.equal(item[ext],`${name}.${ext}`);
  const path=resolve(web,'assets/audio',item[ext]);assert.ok(existsSync(path)&&statSync(path).size>100,`Missing or empty sound: ${path}`);
}
const total=files.reduce((sum,p)=>sum+statSync(p).size,0);
console.log(`Static checks passed: ${files.length} files, ${Object.keys(manifest).length} sounds × 2 codecs, all module and entrypoint references resolve.`);
console.log(`Published size: ${(total/1048576).toFixed(2)} MiB. No remote runtime dependencies.`);
console.log(`Cube Libre Web v${release.version}, based on PyGame v${release.upstream.version}.`);
