import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeV020Workflow} from '../migration/upgrade-v020.mjs';
const prefix='@voicelystudio/n8n-nodes-voicely.';
const fixture=()=>({id:'original-workflow',versionId:'old',active:true,staticData:{registration:'old'},pinData:{old:[]},nodes:[{id:'agent-node',name:'Agents',type:prefix+'voicelyAgents',typeVersion:1,position:[100,200],credentials:{voicelyAutomationApi:{id:'opaque-ref',name:'Existing'}},parameters:{resource:'call',operation:'get',callId:'call',includeData:['lead'],requestTimeoutMs:10}},{id:'speech-node',name:'Speech',type:prefix+'voicely',typeVersion:2,parameters:{resource:'speech',operation:'textToSpeech',operationIdentity:'={{ $json.order }}',requestTimeoutMs:0,speechTransport:'websocket'}}],connections:{Agents:{main:[[{node:'Speech',type:'main',index:0}]]}}});
test('upgrade produces inactive new copy, preserves wiring, credentials and identity expressions, never modifies input',()=>{
 const input=fixture(),before=JSON.stringify(input),r=upgradeV020Workflow(input);assert.equal(r.ok,true);assert.equal(JSON.stringify(input),before);assert.equal(r.workflow.id,undefined);assert.equal(r.workflow.active,false);assert.equal(r.workflow.staticData,undefined);assert.equal(r.workflow.pinData,undefined);assert.deepEqual(r.workflow.connections,input.connections);
 assert.deepEqual(r.workflow.nodes[0].credentials,input.nodes[0].credentials);assert.equal(r.workflow.nodes[0].type,prefix+'voicely');assert.equal(r.workflow.nodes[0].typeVersion,2);assert.deepEqual(r.workflow.nodes[0].parameters.options,{includeData:['lead'],requestTimeoutMs:10});assert.equal(r.workflow.nodes[1].parameters.options.operationIdentity,'={{ $json.order }}');assert.equal(r.workflow.nodes[1].parameters.options.speechTransport,'websocket');
});
test('V1 speech and unrelated nodes remain byte-for-byte unchanged',()=>{
 const w=fixture();const old={id:'old',name:'V1',type:prefix+'voicely',typeVersion:1,parameters:{options:{requestTimeoutMs:15}},credentials:{voicelyApi:{id:'old'}}};w.nodes.push(old,{id:'other',name:'Other',type:'n8n-nodes-base.set',parameters:{keep:true}});const r=upgradeV020Workflow(w);assert.deepEqual(r.workflow.nodes.slice(2),w.nodes.slice(2));
});
test('all five former Agents resources migrate, with previous all-agent listing retained',()=>{
 for(const [resource,operation] of [['agent','getAll'],['call','get'],['delivery','getAll'],['subscription','test'],['tool','register']]){
 const w=fixture();w.nodes[0].parameters={resource,operation,pageSize:500};const r=upgradeV020Workflow(w);assert.equal(r.ok,true);assert.equal(r.workflow.nodes[0].parameters.pageSize,undefined);if(resource==='agent')assert.equal(r.workflow.nodes[0].parameters.returnAll,true);
 }
});
test('Trigger stays same type/version and moved timeout/setup values preserve false',()=>{
 const w=fixture();w.nodes=[{id:'t',type:prefix+'voicelyAgentsTrigger',typeVersion:1,parameters:{agent:'a',includeSynthetic:false,requestTimeoutMs:0}}];const r=upgradeV020Workflow(w);assert.equal(r.ok,true);assert.equal(r.workflow.nodes[0].type,prefix+'voicelyAgentsTrigger');assert.deepEqual(r.workflow.nodes[0].parameters.options,{requestTimeoutMs:0,includeSynthetic:false});
});
test('conflicting new/old Options fail closed, with no partial workflow or leaked values',()=>{
 const w=fixture();w.nodes[0].parameters.options={requestTimeoutMs:99};const r=upgradeV020Workflow(w);assert.equal(r.ok,false);assert.equal(r.workflow,null);assert.deepEqual(r.issues,[{code:'option_conflict',nodeId:'agent-node',field:'requestTimeoutMs'}]);
});
test('bad Options, unknown Agents operation/version and unselected workflows fail closed',()=>{
 for(const change of [w=>w.nodes[0].parameters.options=[],w=>w.nodes[0].parameters.operation='unknown',w=>w.nodes[0].typeVersion=99]){const w=fixture();change(w);assert.equal(upgradeV020Workflow(w).ok,false);}
 assert.equal(upgradeV020Workflow({nodes:[],connections:{}}).ok,false);
});
