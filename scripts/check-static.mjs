import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';
const root=path.resolve('dist');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(ref==='./'||/^(https?:|#)/.test(ref))continue;const file=ref.split(/[?#]/)[0];if(!fs.existsSync(path.join(root,file)))throw Error('Missing asset: '+ref)}
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js'))){execFileSync(process.execPath,['--check',path.join(root,name)]);for(const [,ref]of fs.readFileSync(path.join(root,name),'utf8').matchAll(/from\s*['"](\.\/[^'"]+)['"]/g))if(!fs.existsSync(path.join(root,ref)))throw Error('Missing module: '+ref)}
console.log('Static assets and JavaScript entrypoints verified.');

const app=fs.readFileSync(path.join(root,'app.js'),'utf8');if(/(?<!\$)\$\([^;\n]*?\)\.forEach/.test(app))throw Error('Single-element selector used as a collection');
