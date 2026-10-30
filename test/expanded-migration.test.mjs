import test from 'node:test';
import assert from 'node:assert/strict';
import {convertWorkflow} from '../migration/convert.mjs';
function profile(extra={}){return {sourceTypes:['prior.audio'],sourceVersions:[1],target:{nodeType:'voicelySuite.audio',typeVersion:1,credentialType:'voicelySuiteApi'},
 voices:{prior_voice:{id:'vly_test_voice',name:'Voicely Test Voice'}},models:{prior_model:{id:'voicely-test-model',name:'Voicely Test Model'}},
 runtimeAliases:{},credentialRef:{id:'synthetic-credential-ref',name:'Voicely'},...extra};}
function fixture(resource='speech',operation='textToSpeech'){
 const p={resource,operation};
 if(resource==='speech'){
  if(operation==='textToSpeech')p.text='={{ $json.text }}';else p.file='sourceAudio';
  if(operation!=='speechToText')p.voice={__rl:true,mode:'list',value:'prior_voice',cachedResultName:'Prior voice',cachedResultUrl:'https://invalid.example/prior'};
  p.additionalOptions={model:{__rl:true,mode:'list',value:'prior_model'}};
 }else{
  if(['get','delete'].includes(operation))p.voice='prior_voice';
  if(operation==='getAll'){p.returnAll=true;p.simplify=true;}
  if(operation==='createClone'){p.name='Owner test';p.audioFiles='sampleAudio';p.additionalFields={description:'Owner-provided sample',labels:'{"category":"test"}'};}
 }
 return {name:'Synthetic workflow',active:true,nodes:[{id:'start',name:'Start',type:'fixture.start',position:[0,0]},
 {id:'audio',name:'Existing Audio',type:'prior.audio',typeVersion:1,position:[200,0],parameters:p,credentials:{priorApi:{id:'prior-ref',name:'Prior'}}},
 {id:'consumer',name:'Use Audio',type:'fixture.consumer',position:[400,0],parameters:{input:'={{ $("Existing Audio").item.binary.data }}'}}],
 connections:{Start:{main:[[{node:'Existing Audio',type:'main',index:0}]]},'Existing Audio':{main:[[{node:'Use Audio',type:'main',index:0}]]}}};
}
for(const [resource,ops]of Object.entries({speech:['textToSpeech','speechToText','speechToSpeech'],voice:['get','getAll','createClone','delete']}))for(const operation of ops){
 test('compatible operation '+resource+'/'+operation,()=>{const r=convertWorkflow(fixture(resource,operation),profile());assert.equal(r.ok,true);assert.equal(r.workflow.nodes[1].parameters.operation,operation);assert.equal(r.changes.length,1);});
}
test('source and profile are unchanged and result imports inactive',()=>{const w=fixture(),p=profile(),before=JSON.stringify({w,p});const r=convertWorkflow(w,p);assert.equal(JSON.stringify({w,p}),before);assert.equal(w.active,true);assert.equal(r.workflow.active,false);});
test('names, IDs, positions, all connections and unrelated nodes are preserved',()=>{const w=fixture(),r=convertWorkflow(w,profile());assert.deepEqual(r.workflow.connections,w.connections);assert.deepEqual(r.workflow.nodes[0],w.nodes[0]);assert.deepEqual(r.workflow.nodes[2],w.nodes[2]);for(const k of ['id','name','position'])assert.deepEqual(r.workflow.nodes[1][k],w.nodes[1][k]);});
test('parameter expressions and downstream binary contracts remain unchanged',()=>{const w=fixture(),r=convertWorkflow(w,profile());assert.equal(r.workflow.nodes[1].parameters.text,w.nodes[1].parameters.text);assert.equal(r.workflow.nodes[2].parameters.input,w.nodes[2].parameters.input);assert.equal(convertWorkflow(fixture('speech','speechToText'),profile()).workflow.nodes[1].parameters.file,'sourceAudio');});
test('locator and nested model mappings replace stale cached metadata',()=>{const r=convertWorkflow(fixture(),profile()),p=r.workflow.nodes[1].parameters;assert.equal(p.voice.value,'vly_test_voice');assert.equal(p.voice.cachedResultName,'Voicely Test Voice');assert(!('cachedResultUrl'in p.voice));assert.equal(p.additionalOptions.model.value,'voicely-test-model');assert.equal(p.voice.__rl,true);});
test('multiple items/loop expressions are preserved as expressions, not evaluated',()=>{const w=fixture();w.nodes[1].parameters.text='={{ $json.rows[$itemIndex].text }}';const r=convertWorkflow(w,profile());assert.equal(r.workflow.nodes[1].parameters.text,w.nodes[1].parameters.text);});
test('one selected credential reference replaces prior refs without entering a key',()=>{const r=convertWorkflow(fixture(),profile());assert.deepEqual(r.workflow.nodes[1].credentials,{voicelySuiteApi:{id:'synthetic-credential-ref',name:'Voicely'}});assert(!JSON.stringify(r.workflow).includes('prior-ref'));});
test('missing credential is an explicit post-import requirement, never old credential reuse',()=>{const r=convertWorkflow(fixture(),profile({credentialRef:undefined}));assert.equal(r.ok,true);assert(!('credentials'in r.workflow.nodes[1]));assert(r.requirements.some(x=>x.kind==='bind_voicely_credential'));});
test('unmapped voices or models block the entire export, not partial workflow changes',()=>{for(const extra of [{voices:{}},{models:{}}]){const w=fixture(),before=JSON.stringify(w),r=convertWorkflow(w,profile(extra));assert.equal(r.ok,false);assert.equal(r.workflow,null);assert.deepEqual(r.changes,[]);assert.equal(JSON.stringify(w),before);}});
test('unknown source operation and version produce explicit blockers',()=>{const w=fixture();w.nodes[1].parameters.operation='unknown';assert.equal(convertWorkflow(w,profile()).ok,false);const v=fixture();v.nodes[1].typeVersion=2;assert.equal(convertWorkflow(v,profile()).issues[0].code,'source_contract_unsupported');});
test('dynamic IDs remain exact and require approved runtime alias handling',()=>{const w=fixture();w.nodes[1].parameters.voice.value='={{ $json.voice_id }}';assert.equal(convertWorkflow(w,profile()).ok,false);const r=convertWorkflow(w,profile({runtimeAliases:{voice:true}}));assert.equal(r.ok,true);assert.equal(r.workflow.nodes[1].parameters.voice.value,w.nodes[1].parameters.voice.value);assert(r.requirements.some(x=>x.kind==='verify_runtime_voice_mapping'));});
test('all AI tool connections stay attached to the same named nodes',()=>{const w=fixture();w.connections['Existing Audio']={ai_tool:[[{node:'Fixture Agent',type:'ai_tool',index:0}]]};assert.deepEqual(convertWorkflow(w,profile()).workflow.connections,w.connections);});
test('sub-workflow references are retained and reported, not claimed migrated',()=>{const w=fixture();w.nodes.push({id:'sub',name:'Run Sub',type:'fixture.sub',parameters:{workflowId:'unprovided-workflow'}});const r=convertWorkflow(w,profile());assert.deepEqual(r.workflow.nodes.at(-1),w.nodes.at(-1));assert(r.requirements.some(x=>x.kind==='review_referenced_workflow'&&x.nodeId==='sub'));});
test('inline auth blocks export and diagnostics contain no secret value',()=>{const w=fixture();w.nodes[1].parameters.apiKey='synthetic-sensitive-value';const r=convertWorkflow(w,profile());assert.equal(r.ok,false);assert(!JSON.stringify(r).includes('synthetic-sensitive-value'));assert.equal(r.issues[0].code,'inline_auth_requires_credential_binding');});
test('profile cannot inject plaintext credentials into a result',()=>{const r=convertWorkflow(fixture(),profile({credentialRef:{name:'Voicely',apiKey:'synthetic-secret'}}));assert.equal(r.ok,false);assert(!JSON.stringify(r).includes('synthetic-secret'));});
test('unknown options are review blockers, never silently ignored',()=>{const w=fixture();w.nodes[1].parameters.additionalOptions.newOption='value';assert.equal(convertWorkflow(w,profile()).issues[0].code,'option_requires_review');});
test('generic return-all and explicit user limit are retained without a numeric ceiling',()=>{const w=fixture('voice','getAll');w.nodes[1].parameters.returnAll=false;w.nodes[1].parameters.limit=100000;const r=convertWorkflow(w,profile());assert.equal(r.ok,true);assert.equal(r.workflow.nodes[1].parameters.limit,100000);});
test('mapping lookup never accepts prototype-chain keys as an approved mapping',()=>{const w=fixture();w.nodes[1].parameters.voice.value='toString';assert.equal(convertWorkflow(w,profile()).ok,false);});
test('malformed resource data is a safe error rather than property-key execution',()=>{const w=fixture();w.nodes[1].parameters.resource={toString:null};assert.equal(convertWorkflow(w,profile()).ok,false);});
test('duplicate node names/IDs and no selected source type are visible errors',()=>{const w=fixture();w.nodes[2].name=w.nodes[1].name;assert.equal(convertWorkflow(w,profile()).issues[0].code,'workflow_node_identity_invalid');const r=convertWorkflow(fixture(),profile({sourceTypes:['other.type']}));assert.equal(r.ok,false);assert.equal(r.issues[0].code,'no_selected_source_nodes');});

test('exported workflow identity/publication/ownership cannot overwrite the source on import',()=>{const w=fixture();Object.assign(w,{id:'existing-workflow',versionId:'prior-version',activeVersionId:'published-version',versionCounter:9,shared:[{projectId:'old-project'}],projectId:'old-project'});const r=convertWorkflow(w,profile());assert.equal(r.ok,true);for(const k of ['id','versionId','activeVersionId','versionCounter','shared','projectId'])assert(!Object.hasOwn(r.workflow,k));assert.equal(w.id,'existing-workflow');assert.equal(w.activeVersionId,'published-version');assert.equal(r.workflow.active,false);});

test('converted nodes cannot pass a migration test by replaying old pinned outputs',()=>{const w=fixture();w.pinData={'Existing Audio':[{json:{priorResult:true}}],Start:[{json:{fixture:'retained'}}]};const r=convertWorkflow(w,profile());assert.equal(r.ok,true);assert(!Object.hasOwn(r.workflow.pinData,'Existing Audio'));assert.deepEqual(r.workflow.pinData.Start,w.pinData.Start);assert(r.requirements.some(x=>x.kind==='rerun_converted_node'));assert(Object.hasOwn(w.pinData,'Existing Audio'));});
test('source instance and stale credential-ready hints are cleared without erasing user attribution',()=>{const w=fixture();w.meta={instanceId:'source-instance',templateCredsSetupCompleted:true,licenseNotice:'retain this user notice'};const r=convertWorkflow(w,profile());assert.deepEqual(r.workflow.meta,{licenseNotice:'retain this user notice'});assert.equal(w.meta.templateCredsSetupCompleted,true);});


test('known fields belonging to another operation are explicit review blockers',()=>{
 for(const [resource,operation,key,value] of [
  ['voice','getAll','text','otherwise silently ignored'],
  ['speech','speechToText','voice','prior_voice'],
  ['voice','get','additionalFields',{description:'not a get option'}],
 ]){
  const w=fixture(resource,operation);w.nodes[1].parameters[key]=value;
  const r=convertWorkflow(w,profile());
  assert.equal(r.ok,false);assert.equal(r.workflow,null);
  assert.equal(r.issues[0].code,'parameter_requires_review');
 }
});
test('dynamic mappings retain expressions but remove stale source locator hints',()=>{
 const w=fixture(),p=w.nodes[1].parameters;
 p.voice.value='={{ $json.voice_id }}';
 p.additionalOptions.model.value='={{ $json.model_id }}';
 p.additionalOptions.model.cachedResultName='Prior model';
 p.additionalOptions.model.cachedResultUrl='https://invalid.example/model';
 const r=convertWorkflow(w,profile({runtimeAliases:{voice:true,model:true}}));
 assert.equal(r.ok,true);
 for(const value of [r.workflow.nodes[1].parameters.voice,r.workflow.nodes[1].parameters.additionalOptions.model]){
  assert(!Object.hasOwn(value,'cachedResultName'));assert(!Object.hasOwn(value,'cachedResultUrl'));
 }
 assert.equal(r.workflow.nodes[1].parameters.voice.value,p.voice.value);
 assert.equal(r.workflow.nodes[1].parameters.additionalOptions.model.value,p.additionalOptions.model.value);
 assert(Object.hasOwn(p.voice,'cachedResultUrl'));
});

test('custom code auth review and genuine clone consent are explicit post-import requirements',()=>{
 const w=fixture('voice','createClone');w.nodes.push({id:'code',name:'Custom',type:'fixture.code',typeVersion:1,parameters:{jsCode:'return items;'}});const result=convertWorkflow(w,profile());assert.equal(result.ok,true);assert.ok(result.requirements.some(v=>v.kind==='review_embedded_code_and_auth'&&v.nodeId==='code'));assert.ok(result.requirements.some(v=>v.kind==='provide_authorized_consent_recording'));assert.equal(result.workflow.nodes.at(-1).parameters.jsCode,'return items;');
});

test('converted speech preserves the source binary.data contract without changing new node defaults',()=>{
 for(const operation of ['textToSpeech','speechToSpeech']){
  const source=fixture('speech',operation),result=convertWorkflow(source,profile());
  assert.equal(result.ok,true);
  assert.equal(result.workflow.nodes[1].parameters.outputBinaryField,'data');
  assert.equal(source.nodes[1].parameters.outputBinaryField,undefined);
  assert.equal(result.workflow.nodes[2].parameters.input,source.nodes[2].parameters.input);
 }
 const transcription=convertWorkflow(fixture('speech','speechToText'),profile());
 assert.equal(transcription.workflow.nodes[1].parameters.outputBinaryField,undefined);
});

test('reviewed Get voice Simplify values and expressions migrate without losing downstream metadata choice',()=>{
 for(const simplify of [true,false,'={{ $json.useFullMetadata ? false : true }}']){
  const w=fixture('voice','get');w.nodes[1].parameters={resource:'voice',operation:'get',voice:{mode:'id',value:'prior_voice'},simplify};const original=structuredClone(w);
  const r=convertWorkflow(w,profile());assert.equal(r.ok,true,JSON.stringify(r.issues));assert.equal(r.workflow.nodes[1].parameters.simplify,simplify);assert.equal(r.workflow.nodes[1].parameters.voice.value,'vly_test_voice');assert.deepEqual(w,original);
 }
});
