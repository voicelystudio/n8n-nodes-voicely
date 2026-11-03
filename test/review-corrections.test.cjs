const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {Voicely} = require('../dist/nodes/Voicely/Voicely.node');
const {VoicelyAgentsTrigger} = require('../dist/nodes/VoicelyAgentsTrigger/VoicelyAgentsTrigger.node');
const {executionOption, hookOption} = require('../dist/nodes/Voicely/v2/options');
const {NodeHelpers} = require('n8n-workflow');
const studio = new Voicely().getNodeType(2), trigger = new VoicelyAgentsTrigger();
const properties = studio.description.properties;
const options = properties.find(p => p.name === 'options').options;
const visible = (params, property) => NodeHelpers.displayParameter(params, property, {parameters: params, typeVersion: 2});
function fixture(parameters, reply = {ok:true}) {
  const calls = [], creds = [];
  const ctx = {
    getInputData: () => [{json:{}}], getNodeParameter: (name, index, fallback) => parameters[name] ?? fallback,
    getNode: () => ({id:'review-node', name:'Voicely Studio', type:'voicely', typeVersion:2, parameters, position:[0,0]}),
    getWorkflow: () => ({id:'review-workflow'}), getExecutionId: () => 'review-execution', continueOnFail: () => false,
    getCredentials: async name => {creds.push(name);return {serviceUrl:'https://fixture.invalid',apiKey:'test-only',webhookSecret:'test-signing-secret'};},
    helpers: {httpRequestWithAuthentication: async (name, request) => {calls.push({name,...request});return {statusCode:200,headers:{},body:typeof reply==='function'?reply(request):reply};}},
  };
  return {ctx,calls,creds};
}
test('packed manifest has one regular node and one trigger, no standalone Agents payload', () => {
  const manifest=require('../package.json');assert.equal(manifest.n8n.nodes.length,2);
  assert.deepEqual(manifest.n8n.nodes.map(p=>new (Object.values(require(path.join('..',p)))[0])().description.name),['voicely','voicelyAgentsTrigger']);
  assert.equal(fs.existsSync(path.join(__dirname,'../dist/nodes/VoicelyAgents')),false);
  assert.equal(require('../nodes/Voicely/Voicely.node.json').nodeVersion,'1.0');
  assert.deepEqual(Object.keys(new Voicely().nodeVersions).map(Number),[1,2]);
});
test('all nine Studio resources have exactly one operation selector and the correct credentials', () => {
  const expected=['agent','call','delivery','language','model','speech','subscription','tool','voice'];
  assert.deepEqual(properties.find(p=>p.name==='resource').options.map(p=>p.value),expected);
  for(const resource of expected){
    const p={resource,operation:'getAll',returnAll:false};
    assert.equal(properties.filter(f=>f.name==='operation'&&visible(p,f)).length,1,resource);
    const credentials=studio.description.credentials.filter(c=>visible(p,c));
    assert.equal(credentials.length,1);assert.equal(credentials[0].name,['language','model','speech','voice'].includes(resource)?'voicelySuiteApi':'voicelyAutomationApi');
  }
});
test('Call Get does not show Voice locator or voice-only Simplify control', () => {
  const p={resource:'call',operation:'get'};
  assert.equal(visible(p,properties.find(f=>f.name==='voice')),false);
  assert.equal(NodeHelpers.displayParameter(p,options.find(f=>f.name==='simplify'),{parameters:p,typeVersion:2},p),false);
});
test('Get Many UI has Return All and conditional Limit for agents, deliveries, tools and voices; no Page Size',()=>{
  assert.equal(JSON.stringify([properties,trigger.description.properties]).includes('Page Size'),false);
  for(const resource of ['agent','delivery','tool','language','model','voice']){
    for(const returnAll of [false,true]){
      const p={resource,operation:'getAll',returnAll};
      assert.equal(properties.filter(f=>f.name==='returnAll'&&visible(p,f)).length,1,resource);
      assert.equal(properties.filter(f=>f.name==='limit'&&visible(p,f)).length,returnAll?0:1,resource);
    }
  }
});
test('optional Studio and Trigger parameters live in collections, including all review findings',()=>{
  for(const key of ['operationIdentity','requestTimeoutMs','includeData','purpose','effect','verifiedCaller','simplify']){
    assert.equal(properties.some(p=>p.name===key),false,key);assert.ok(options.some(p=>p.name===key),key);
  }
  assert.equal(properties.some(p=>p.name==='speechTransport'),false);assert.equal(options.some(p=>p.name==='speechTransport'),false);
  assert.deepEqual(trigger.description.properties.map(p=>p.name),['agent','options']);
  assert.deepEqual(trigger.description.properties[1].options.map(p=>p.name),['includeSynthetic','requestTimeoutMs']);
});
test('new Options override legacy values including false, zero and empty identity; omitted values keep saved expressions through n8n getter',()=>{
  let calls=[];const c={getNodeParameter:(name,index,fallback)=>{calls.push(name);return name==='options'?{requestTimeoutMs:0,simplify:false,operationIdentity:''}:999;}};
  assert.equal(executionOption(c,0,'requestTimeoutMs',42),0);assert.equal(executionOption(c,0,'simplify',true),false);assert.equal(executionOption(c,0,'operationIdentity','old'),'');assert.ok(calls.every(n=>n==='options'));
  const old={getNodeParameter:(name,index,fallback)=>name==='options'?{}:name==='requestTimeoutMs'?123:fallback};
  assert.equal(executionOption(old,0,'requestTimeoutMs',0),123);assert.equal(executionOption(old,0,'simplify',true),true);
  assert.throws(()=>executionOption({getNodeParameter:()=>[]},0,'requestTimeoutMs',0));
});
test('Hook options preserve zero/false and old saved fallback without public top-level UI',()=>{
 const fresh={getNodeParameter:(name,fallback)=>name==='options'?{requestTimeoutMs:0,includeSynthetic:false}:fallback};
 assert.equal(hookOption(fresh,'requestTimeoutMs',5000),0);assert.equal(hookOption(fresh,'includeSynthetic',true),false);
 const old={getNodeParameter:(name,fallback)=>name==='options'?{}:name==='includeSynthetic'?false:fallback};assert.equal(hookOption(old,'includeSynthetic',true),false);
});
test('consolidated Call Get uses new Include Shared Data and timeout Options with automation auth only',async()=>{
 const f=fixture({resource:'call',operation:'get',callId:'call-fixture',includeData:['context'],requestTimeoutMs:100,options:{includeData:['lead'],requestTimeoutMs:0}}, {call_id:'call-fixture'});
 await studio.execute.call(f.ctx);assert.deepEqual(f.creds,['voicelyAutomationApi']);assert.equal(f.calls[0].name,'voicelyAutomationApi');assert.equal(f.calls[0].timeout,0);assert.equal(new URL(f.calls[0].url).searchParams.get('include'),'lead');
});
test('tool register new Options preserve explicit caller verification and readonly verification rules',async()=>{
 const p={resource:'tool',operation:'register',agentId:'agent-fixture',toolName:'verify',description:'Verify test identity',destination:'https://workflow.invalid/hook',inputSchema:'{}',outputSchema:'{}',options:{purpose:'verify_caller',effect:'read',verifiedCaller:false}};
 const f=fixture(p);await studio.execute.call(f.ctx);assert.equal(f.calls[0].body.purpose,'verify_caller');assert.equal(f.calls[0].body.requires_verified_caller,false);
 const bad=fixture({...p,options:{...p.options,effect:'write'}});await assert.rejects(studio.execute.call(bad.ctx));assert.equal(bad.calls.length,0);
});
test('Agent Get Many honors Limit and Return All on the service single-list response',async()=>{
 const records=[{agent_id:'a'},{agent_id:'b'},{agent_id:'c'}];
 for(const all of [false,true]){const f=fixture({resource:'agent',operation:'getAll',limit:1,returnAll:all},{agents:records});const out=await studio.execute.call(f.ctx);assert.equal(out[0].length,all?3:1);assert.equal(f.calls.length,1);}
});
test('delivery pagination uses internal 50, respects requested limit and retains cursor',async()=>{
 let page=0;const f=fixture({resource:'delivery',operation:'getAll',limit:51,returnAll:false,pageSize:999999},req=>{const q=new URL(req.url).searchParams;assert.equal(q.get('limit'),page===0?'50':'1');if(page)assert.equal(q.get('after'),'next');return {deliveries:Array.from({length:page++===0?50:1},(_,i)=>({id:String(i)})),next_cursor:page===1?'next':null};});
 const out=await studio.execute.call(f.ctx);assert.equal(out[0].length,51);assert.equal(f.calls.length,2);
});
test('voice pagination uses internal 50 with Suite auth, independently of legacy Page Size',async()=>{
 const f=fixture({resource:'voice',operation:'getAll',returnAll:true,pageSize:0,options:{simplify:false}}, {voices:[{voice_id:'one',name:'One',extra:true}],next_cursor:null});
 const out=await studio.execute.call(f.ctx);assert.equal(out[0][0].json.extra,true);assert.equal(new URL(f.calls[0].url).searchParams.get('limit'),'50');assert.equal(f.calls[0].name,'voicelySuiteApi');
});
test('new identity option remains stable across executions and HTTP retry contract is unchanged',async()=>{
 const p={resource:'speech',operation:'textToSpeech',text:'Fixture',voice:'voice',options:{operationIdentity:'review-business',requestTimeoutMs:0}};
 const f=fixture(p,req=>{assert.equal(req.method,'POST');return {}}); // fail after request due intentionally non-audio response
 await assert.rejects(studio.execute.call(f.ctx));const g=fixture(p);g.ctx.getExecutionId=()=> 'other';await assert.rejects(studio.execute.call(g.ctx));assert.equal(f.calls[0].headers['idempotency-key'],g.calls[0].headers['idempotency-key']);assert.equal(f.calls.length,1);assert.equal(g.calls.length,1);
});
