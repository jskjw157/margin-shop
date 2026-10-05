/** Dependency-free deterministic bundler for this single-file application. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(resolve(root,file),'utf8');
const template=await read('src/template.html');
const css=(await read('src/tailwind.css'))+'\n'+(await Promise.all(['styles','inputs','results','guide','responsive'].map(name=>read(`src/${name}.css`)))).join('');
const modules=await Promise.all(['calculator','storage','app'].map(name=>read(`src/${name}.mjs`)));
const js='(()=>{\n"use strict";\n'+modules.map(source=>source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n})();';
new vm.Script(js,{filename:'margin-shop.js'});
if(!template.includes('<!-- APP_STYLES -->') || !template.includes('<!-- APP_SCRIPT -->'))throw Error('Missing build placeholders');
const notice=await read('THIRD_PARTY_NOTICES.md');
const output=template.replace('<!-- APP_STYLES -->',()=>`<!--\n${notice.replace(/-->/g,'-- >')}\n-->\n<style>\n${css}\n</style>`).replace('<!-- APP_SCRIPT -->',()=>`<script>\n${js.replace(/<\/script/gi,'<\\/script')}\n</script>`);
await mkdir(resolve(root,'dist'),{recursive:true});
await writeFile(resolve(root,'index.html'),output);
await writeFile(resolve(root,'dist/index.html'),output);
console.log(`Built index.html and dist/index.html (${Buffer.byteLength(output).toLocaleString()} bytes). No external runtime assets.`);
