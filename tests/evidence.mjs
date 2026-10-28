import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const code=ts.transpileModule(fs.readFileSync('lib/client-hunter/evidence.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {qualify,requestedMode,phoneKey}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const cases=JSON.parse(fs.readFileSync('tests/evidence-cases.json'));
for(const f of cases){const result=qualify(f.c,f.p,f.docs,f.queries);assert.equal(!!result.lead,f.accepted,f.name+': '+result.reason);if(result.lead){assert.equal(result.lead.email,'');assert.equal(result.lead.phone,'+91 6369222709');assert.equal(result.lead.rating,4.4);assert.equal(result.lead.reviewCount,23);assert.ok(result.lead.facts.every(x=>x.value&&x.sourceUrl));assert.ok(!result.lead.sources.some(s=>s.includes('example-point')));assert.ok(!result.lead.facts.some(f=>f.value.includes('directorybrand')));}}
assert.equal(requestedMode('Find 2 paint shops who already have a website but it is not modern'),'outdated');assert.equal(requestedMode('Find shops without websites'),'missing');assert.equal(phoneKey('+91 63692 22709'),'6369222709');
console.log(`${cases.length+3} hosted qualification checks passed.`);
