const test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),{createHmac}=require('node:crypto');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true}).outputText,file);
const {VoicelyAgentsTrigger}=require('../nodes/VoicelyAgentsTrigger/VoicelyAgentsTrigger.node.ts'),{VoicelyAutomationApi}=require('../credentials/VoicelyAutomationApi.credentials.ts'),node=new VoicelyAgentsTrigger();
const secret='fixture-webhook-secret-that-stays-in-credentials';
function fixture({mode='trigger',agent='agent',workflow='workflow',state={},reply}={}){
 const calls=[],response={statusCode:0,body:null,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};let raw,headers={};
 const context={getMode:()=>mode,getActivationMode:()=> 'activate',getNode:()=>({id:'node',name:'Voicely Agents Trigger',type:'voicelyAgentsTrigger',typeVersion:1,parameters:{},position:[0,0]}),getWorkflow:()=>({id:workflow}),getWorkflowStaticData:()=>state,getNodeParameter:(key,otherwise)=>key==='agent'?agent:otherwise,getNodeWebhookUrl:()=> 'https://workflow.invalid/events',getCredentials:async name=>{assert.equal(name,'voicelyAutomationApi');return {apiKey:'fixture-api-key',serviceUrl:'https://service.invalid',webhookSecret:secret};},getRequestObject:()=>({rawBody:raw}),getHeaderData:()=>headers,getResponseObject:()=>response,getBodyData:()=>({forged:'must never be reserialized'}),helpers:{httpRequestWithAuthentication:async function(name,o){assert.equal(this,context);assert.equal(name,'voicelyAutomationApi');assert.equal(o.disableFollowRedirect,true);calls.push(o);return reply?reply(o):{statusCode:200,body:{subscription_id:'sub',agent_id:agent,workflow_id:workflow+'/node',mode:mode==='manual'?'test':'production',state:'active',destination:'https://workflow.invalid/events',signature_window_ms:1000,event_body_bytes:10000}};}}};
 return {context,calls,response,state,setRequest(value,extra={}){raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));const stamp=String(Date.now()),id=Buffer.isBuffer(value)?'event':value.event_id;headers={'x-voicely-event-id':id,'x-voicely-timestamp':stamp,'x-voicely-signature':'v1='+createHmac('sha256',secret).update(JSON.stringify([1,Number(stamp),id])+'\n').update(raw).digest('hex'),...extra};},get raw(){return raw;},set raw(v){raw=v;},get headers(){return headers;}};
}
const payload=(extra={})=>({event_id:'event',event_type:'call.completed',schema_version:1,occurred_at:new Date().toISOString(),data:{agent_id:'agent',call_id:'call',duration_ms:1000,charged_micro:'33334'},...extra});
const registered=()=>({voicelyRegistrations:{production:{id:'sub',agent:'agent',workflow:'workflow/node',destination:'https://workflow.invalid/events',windowMs:1000,bodyBytes:10000}}});
test('separate original trigger credential protects secrets and tests only agent metadata',()=>{
 const c=new VoicelyAutomationApi();assert.equal(c.name,'voicelyAutomationApi');assert.equal(c.properties.find(p=>p.name==='webhookSecret').typeOptions.password,true);assert.equal(c.properties.find(p=>p.name==='previousWebhookSecrets').typeOptions.password,true);assert.equal(c.test.request.url,'/v1/agents');assert.equal(node.description.name,'voicelyAgentsTrigger');assert.equal(node.description.webhooks[0].rawBody,true);
});
test('activation registers exact workflow/node/agent/mode and stores only non-secret server policy',async()=>{
 const f=fixture();await node.webhookMethods.default.create.call(f.context);assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.workflow_id,'workflow/node');assert.equal(f.calls[0].body.webhook_secret,secret);assert.equal(f.calls[0].body.mode,'production');assert.equal(f.state.voicelyRegistrations.production.windowMs,1000);assert.equal(JSON.stringify(f.state).includes(secret),false);assert.equal(JSON.stringify(f.state).includes('fixture-api-key'),false);assert.equal(await node.webhookMethods.default.checkExists.call(f.context),true);
});
test('test/production registrations stay separate and cloned workflows never delete the source registration',async()=>{
 const state=registered(),f=fixture({mode:'manual',state});await node.webhookMethods.default.create.call(f.context);assert.ok(state.voicelyRegistrations.test);assert.ok(state.voicelyRegistrations.production);assert.equal(f.calls[0].body.mode,'test');
 const clone=fixture({workflow:'cloned',state:registered(),reply:async()=>({statusCode:200,body:{workflow_id:'workflow/node',mode:'production'}})});await node.webhookMethods.default.delete.call(clone.context);assert.equal(clone.calls.length,1);assert.equal(clone.state.voicelyRegistrations.production,undefined);
});
test('deactivation removes only its owned workflow registration and selected mode',async()=>{
 const f=fixture({state:{...registered(),voicelyRegistrations:{...registered().voicelyRegistrations,test:{id:'test-sub'}}}});await node.webhookMethods.default.delete.call(f.context);assert.equal(f.calls.length,2);assert.equal(f.calls[1].method,'DELETE');assert.ok(f.state.voicelyRegistrations.test);assert.equal(f.state.voicelyRegistrations.production,undefined);
});
test('valid raw body signature emits unchanged payload without a service request or credential leakage',async()=>{
 const f=fixture({state:registered()}),body=payload();f.setRequest(body);const out=await node.webhook.call(f.context);assert.deepEqual(out.workflowData,[[{json:body}]]);assert.equal(f.calls.length,0);assert.equal(JSON.stringify(out).includes(secret),false);assert.equal(JSON.stringify(out).includes('signature'),false);
});
test('missing raw bytes, reserialized body, invalid/stale headers and wrong agent refuse before workflow',async()=>{
 for(const change of [f=>{f.raw=undefined;},f=>{f.raw=Buffer.from('{ "event_id":"event" }');},f=>{f.headers['x-voicely-timestamp']=String(Date.now()-1001);},f=>{f.headers['x-voicely-signature']=['v1=bad'];}]){const f=fixture({state:registered()});f.setRequest(payload());change(f);assert.equal((await node.webhook.call(f.context)).noWebhookResponse,true);assert.equal(f.response.statusCode,401);assert.equal(f.calls.length,0);}
 const other=fixture({state:registered()});other.setRequest(payload({data:{agent_id:'different'}}));assert.equal((await node.webhook.call(other.context)).noWebhookResponse,true);assert.equal(other.response.statusCode,400);
});
test('configured server body bound is enforced; unregistered webhook fails closed without guessed defaults',async()=>{
 const f=fixture({state:registered()});f.state.voicelyRegistrations.production.bodyBytes=1;f.setRequest(payload());await node.webhook.call(f.context);assert.equal(f.response.statusCode,401);const off=fixture();off.setRequest(payload());await node.webhook.call(off.context);assert.equal(off.response.statusCode,503);
});
test('synthetic events remain marked and can be excluded without running a business workflow',async()=>{
 const f=fixture({state:registered()});f.setRequest(payload({event_type:'automation.test',synthetic:true}));assert.equal((await node.webhook.call(f.context)).workflowData[0][0].json.synthetic,true);const g=fixture({state:registered()}),param=g.context.getNodeParameter;g.context.getNodeParameter=(key,otherwise)=>key==='includeSynthetic'?false:param(key,otherwise);g.setRequest(payload({event_type:'automation.test',synthetic:true}));assert.equal((await node.webhook.call(g.context)).noWebhookResponse,true);assert.equal(g.response.statusCode,200);
});
test('secret rotation verifies former credential-held keys without storing them in workflow static data',async()=>{
 const f=fixture({state:registered()});f.setRequest(payload());f.context.getCredentials=async()=>({webhookSecret:'new-fixture-secret',previousWebhookSecrets:JSON.stringify([secret])});assert.ok((await node.webhook.call(f.context)).workflowData);assert.equal(JSON.stringify(f.state).includes(secret),false);
});
test('repeated valid deliveries retain event identity; no unsafe pre-execution consumed marker is written',async()=>{
 const f=fixture({state:registered()});f.setRequest(payload());const before=JSON.stringify(f.state);const first=await node.webhook.call(f.context),again=await node.webhook.call(f.context);assert.equal(first.workflowData[0][0].json.event_id,again.workflowData[0][0].json.event_id);assert.equal(JSON.stringify(f.state),before);
});
