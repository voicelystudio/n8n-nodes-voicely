const test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true}).outputText,file);
const {VoicelyV2}=require('../nodes/Voicely/v2/VoicelyV2.node.ts'),node=new VoicelyV2();
function fixture({resource='tool',operation='getAll',parameters={},reply,items=1,continueOnFail=false}={}){
 const calls=[],values={resource,operation,requestTimeoutMs:0,agentId:'agent-fixture',callId:'call-fixture',deliveryId:'delivery-fixture',subscriptionId:'subscription-fixture',toolId:'tool-fixture',returnAll:false,limit:2,pageSize:1,toolName:'order_status',description:'Check order status',effect:'read',verifiedCaller:true,destination:'https://workflow.invalid/hook',inputSchema:'{"type":"object","properties":{},"required":[],"additionalProperties":false}',outputSchema:'{"type":"object","properties":{},"required":[],"additionalProperties":false}',...parameters};
 const context={getInputData:()=>Array.from({length:items},()=>({json:{}})),getNodeParameter:(name,index,fallback)=>values[name]===undefined?fallback:values[name],getNode:()=>({id:'node-fixture',name:'Voicely Agents',type:'voicelyAgents',typeVersion:1,position:[0,0],parameters:{}}),getWorkflow:()=>({id:'workflow-fixture'}),getExecutionId:()=> 'execution-fixture',continueOnFail:()=>continueOnFail,getCredentials:async name=>{assert.equal(name,'voicelyAutomationApi');return {apiKey:'private-fixture-key',serviceUrl:'https://service.invalid',webhookSecret:'private-signing-fixture-secret'};},helpers:{httpRequestWithAuthentication:async function(name,o){assert.equal(this,context);assert.equal(name,'voicelyAutomationApi');assert.equal(o.disableFollowRedirect,true);calls.push(o);return {statusCode:200,body:reply?await reply(o):{tools:[{id:'tool-fixture'}],next_cursor:null}};}}};return {context,calls};
}
test('Studio exposes agent resources using the scoped automation credential without Page Size',()=>{assert.equal(node.description.name,'voicely');assert.equal(node.description.usableAsTool,true);assert.ok(node.description.credentials.some(p=>p.name==='voicelyAutomationApi'));assert.equal(node.description.properties.some(p=>p.name==='pageSize'),false);});
test('tool registration forwards typed policy and credential secret once; no secret enters output item',async()=>{
 const f=fixture({operation:'register',reply:async()=>({id:'registered-fixture',state:'active'})}),out=await node.execute.call(f.context);assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'POST');assert.equal(f.calls[0].body.webhook_secret,'private-signing-fixture-secret');assert.equal(f.calls[0].body.requires_verified_caller,true);assert.equal(f.calls[0].body.effect,'read');assert.equal(f.calls[0].body.agent_id,'agent-fixture');assert.equal(typeof f.calls[0].body.input_schema,'object');assert.equal(JSON.stringify(out).includes('private-signing'),false);assert.deepEqual(out[0][0].pairedItem,{item:0});
});
test('list pagination preserves cursor/agent and requested limit; return-all has no hidden positive ceiling',async()=>{
 let count=0;const f=fixture({reply:async o=>{const url=new URL(o.url);assert.equal(url.searchParams.get('agent_id'),'agent-fixture');count++;return {tools:[{id:'tool-'+count}],next_cursor:count<4?'cursor-'+count:null};}});const out=await node.execute.call(f.context);assert.equal(out[0].length,2);assert.equal(f.calls.length,2);assert.match(f.calls[1].url,/after=cursor-1/);
 const g=fixture({parameters:{returnAll:true,pageSize:100000},reply:async()=>({tools:[{id:'one'}],next_cursor:null})});assert.equal((await node.execute.call(g.context))[0].length,1);assert.match(g.calls[0].url,/limit=50/);
});
test('delivery redelivery retains original event route; no paid speech or grant request',async()=>{
 const f=fixture({resource:'delivery',operation:'redeliver',reply:async()=>({state:'pending'})});const out=await node.execute.call(f.context);assert.match(f.calls[0].url,/\/deliveries\/delivery-fixture\/redeliver$/);assert.equal(f.calls[0].method,'POST');assert.deepEqual(f.calls[0].body,{});assert.equal(out[0][0].json.state,'pending');assert.equal(f.calls.length,1);
});
test('agent/call/disable/setup routes preserve IDs and synthetic event identity with input item pairing',async()=>{
 for(const [resource,operation,route,reply] of [['agent','getAll','/v1/agents',{agents:[{agent_id:'one'},{agent_id:'two'}]}],['call','get','/v1/calls/call-fixture',{call_id:'call-fixture'}],['tool','disable','/v1/automation/tools/tool-fixture',{state:'disabled'}],['subscription','test','/v1/automation/subscriptions/subscription-fixture/test',{synthetic:true,event_id:'setup'}]]){
  const f=fixture({resource,operation,reply:async()=>reply,items:2}),out=await node.execute.call(f.context);assert.equal(f.calls.length,2);assert.ok(f.calls[0].url.endsWith(route));assert.equal(out[0].at(-1).pairedItem.item,1);if(operation==='test'){assert.notEqual(f.calls[0].headers['idempotency-key'],f.calls[1].headers['idempotency-key']);assert.equal(out[0][0].json.synthetic,true);}
 }
});
test('repeated/nonadvancing cursor, invalid count and unknown operation refuse without an unbounded loop',async()=>{
 const f=fixture({parameters:{returnAll:true},reply:async()=>({tools:[],next_cursor:'same'})});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,2);
 for(const parameters of [{requestTimeoutMs:-1},{limit:0}]){const g=fixture({parameters});await assert.rejects(node.execute.call(g.context));assert.equal(g.calls.length,0);}
 const g=fixture({operation:'unrecognized'});await assert.rejects(node.execute.call(g.context));assert.equal(g.calls.length,0);
});
test('request errors are sanitized and continue-on-fail preserves item linkage without automatic retry',async()=>{
 const f=fixture({resource:'call',operation:'get',reply:async()=>{throw Error('UpstreamFixture/account-key-private');},items:2,continueOnFail:true}),out=await node.execute.call(f.context);assert.equal(f.calls.length,2);assert.equal(out[0].length,2);assert.equal(out[0][1].pairedItem.item,1);assert.doesNotMatch(JSON.stringify(out),/UpstreamFixture|account-key/);
});
test('malformed schema/effect rejects before credential reaches any destination',async()=>{
 for(const parameters of [{inputSchema:'invalid JSON'},{outputSchema:'[]'},{effect:'unrecognized'}]){const f=fixture({operation:'register',parameters});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);}
});

test('verified-caller false is retained and string booleans are not silently coerced',async()=>{
 const f=fixture({operation:'register',parameters:{verifiedCaller:false},reply:async()=>({id:'fixture'})});await node.execute.call(f.context);assert.equal(f.calls[0].body.requires_verified_caller,false);const g=fixture({operation:'register',parameters:{verifiedCaller:'false'}});await assert.rejects(node.execute.call(g.context));assert.equal(g.calls.length,0);
});

test('verification registration is explicit, read-only and cannot require an already verified caller',async()=>{
 const f=fixture({operation:'register',parameters:{purpose:'verify_caller',verifiedCaller:false},reply:async()=>({id:'verification-tool'})});await node.execute.call(f.context);assert.equal(f.calls[0].body.purpose,'verify_caller');assert.equal(f.calls[0].body.effect,'read');assert.equal(f.calls[0].body.requires_verified_caller,false);
 for(const parameters of [{purpose:'verify_caller',verifiedCaller:true},{purpose:'verify_caller',verifiedCaller:false,effect:'write'},{purpose:'unknown'}]){const g=fixture({operation:'register',parameters});await assert.rejects(node.execute.call(g.context));assert.equal(g.calls.length,0);}
});

test('call shared-data retrieval is explicit and revocation uses only the same protected owner credential',async()=>{const f=fixture({resource:'call',operation:'get',parameters:{includeData:['lead','transcript','context']},reply:async()=>({call_id:'call-fixture',exports:{state:'available'}})});await node.execute.call(f.context);assert.equal(new URL(f.calls[0].url).searchParams.get('include'),'lead,transcript,context');const g=fixture({resource:'call',operation:'revokeExports',reply:async()=>({export_state:'revoked'})});await node.execute.call(g.context);assert.ok(g.calls[0].url.endsWith('/v1/calls/call-fixture/exports/revoke'));assert.equal(g.calls[0].method,'POST');assert.deepEqual(g.calls[0].body,{});for(const includeData of [['audio'],['lead','lead'],'all']){const h=fixture({resource:'call',operation:'get',parameters:{includeData}});await assert.rejects(node.execute.call(h.context));assert.equal(h.calls.length,0);}});
