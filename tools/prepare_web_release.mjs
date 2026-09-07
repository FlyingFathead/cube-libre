// Refresh the static entrypoint after changing web/version.json or adding modules.
// No dependency install/build service is required; commit the generated index.html.
import {readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,relative} from 'node:path';
const web=resolve(dirname(fileURLToPath(import.meta.url)),'../web');
const release=JSON.parse(readFileSync(resolve(web,'version.json'),'utf8'));
copyFileSync(resolve(web,'../docs/PHILOSOPHY.md'),resolve(web,'assets/PHILOSOPHY.md'));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const modules=walk(web).filter(p=>/\.(mjs|js)$/.test(p)).map(p=>'./'+relative(web,p).replaceAll('\\','/')).sort();
const imports=Object.fromEntries(modules.map(path=>[path,`${path}?v=${release.version}`]));
const components=walk(web).filter(p=>/\.(?:mjs|js|css|json|svg|ogg|mp3|md)$/.test(p)&&relative(web,p)!=='version.json').map(p=>'./'+relative(web,p).replaceAll('\\','/')).sort();
const entry=resolve(web,'index.html');let html=readFileSync(entry,'utf8');
html=html.replace(/(<script id="release-data" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(release).replaceAll('<','\\u003c')+b);
html=html.replace(/(<script id="release-imports" type="importmap">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify({imports},null,2)+b);
const componentTag='<script id="release-components" type="application/json">'+JSON.stringify(components)+'</script>';
if(html.includes('id="release-components"'))html=html.replace(/<script id="release-components" type="application\/json">[\s\S]*?<\/script>/,componentTag);
else html=html.replace('  <script>','  '+componentTag+'\n  <script>');
html=html.replace(/href="\.\/style\.css(?:\?[^\"]*)?"/,`href="./style.css?v=${release.version}"`);
writeFileSync(entry,html);
console.log(`Prepared v${release.version}: ${modules.length} versioned modules, stylesheet and embedded release metadata.`);
