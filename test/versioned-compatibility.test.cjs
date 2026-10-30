const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {Voicely} = require('../dist/nodes/Voicely/Voicely.node');
const root = path.join(__dirname, '..');
const expected = {"node": "ae461a955ee9683e0c00715b35e81733e99ecab8a9a0286d97e5bcaf70caa084", "transport": "eaacb216ade0e933a11c5f06da5ef6cc4bc976ff09bc09b5d48f751f3f5e7d89", "websocket": "743552d080c4a66325f7c4c1bc36debb39e636bbe32e3b231d907a8ad68c5065", "credential": "55590dc85572c711691d981d63990eec6034da2c025c8fe59438568892bf7312"};

test('saved v1 resolves the legacy implementation and fresh workflows select expanded v2', () => {
 const node = new Voicely();
 assert.equal(node.description.name, 'voicely');
 assert.equal(node.description.defaultVersion, 2);
 assert.equal(node.getNodeType().description.version, 2);
 const old = node.getNodeType(1);
 assert.equal(old.description.version, 1);
 assert.equal(old.description.credentials[0].name, 'voicelyApi');
 assert.equal(old.description.properties.find(x=>x.name==='operation').default, 'generate');
 const next = node.getNodeType(2);
 assert.equal(next.description.name, 'voicely');
 assert.equal(next.description.credentials[0].name, 'voicelySuiteApi');
 assert.equal(next.description.properties.find(x=>x.name==='operation').default, 'textToSpeech');
 assert.throws(()=>node.getNodeType(99));
});

test('legacy behavior and credentials match the verified v0.1.1 source, apart from the required class identifier', () => {
 const files = {node:'nodes/Voicely/v1/VoicelyV1.node.ts', transport:'nodes/Voicely/v1/transport.ts', websocket:'nodes/Voicely/v1/websocket.ts', credential:'credentials/VoicelyApi.credentials.ts'};
 for(const [name,file] of Object.entries(files)) {
  let source = fs.readFileSync(path.join(root,file),'utf8');
  if(name==='node')source=source.replace('export class VoicelyV1 implements','export class Voicely implements');
  assert.equal(createHash('sha256').update(source).digest('hex'),expected[name],name);
 }
});

test('one same-name package registers exactly Studio, Agents and Trigger with no duplicate legacy node', () => {
 const manifest = require('../package.json');
 assert.equal(manifest.name,'@voicelystudio/n8n-nodes-voicely');
 assert.equal(manifest.version,'0.2.0');
 assert.notEqual(manifest.private,true);
 assert.equal(manifest.n8n.nodes.length,3);
 const names=manifest.n8n.nodes.map(file=>{
  const exports=require(path.join(root,file));
  const Node=Object.values(exports)[0];
  return new Node().description.name;
 });
 assert.deepEqual(names,['voicely','voicelyAgents','voicelyAgentsTrigger']);
 assert.equal(manifest.dependencies,undefined);
});

test('migration UI targets the existing package node version 2 without silently upgrading saved v1 workflows', async () => {
 const {makeProfile} = await import('../migration/ui.mjs');
 const profile = makeProfile({selection:{type:'prior.audio',versions:[1],nodes:['source'],voices:[],models:[],dynamic:[]},mappings:{voice:{},model:{}}});
 assert.equal(profile.target.nodeType,'@voicelystudio/n8n-nodes-voicely.voicely');
 assert.equal(profile.target.typeVersion,2);
 assert.equal(profile.target.credentialType,'voicelySuiteApi');
});
