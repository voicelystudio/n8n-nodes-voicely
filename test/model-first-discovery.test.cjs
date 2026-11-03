const test=require('node:test'),assert=require('node:assert/strict');
const {Voicely}=require('../dist/nodes/Voicely/Voicely.node');
const {NodeHelpers}=require('n8n-workflow');
const {modelRows,voiceFilters,CatalogSelectionError}=require('../dist/nodes/Voicely/v2/discovery');
const node=new Voicely().getNodeType(2);
const models=[{model_id:'tts-a',name:'Voicely Narration',operations:['speech.synthesize'],privateMapping:'not-public'},{model_id:'tts-b',name:'Voicely Classic',operations:['speech.synthesize']},{model_id:'stt-a',name:'Voicely Transcribe',operations:['speech.transcribe']},{model_id:'sts-a',name:'Voicely Expressive',operations:['speech.convert']}];
function fixture(parameters,reply,items=1){
 const calls=[],creds=[];
 const context={getInputData:()=>Array.from({length:items},()=>({json:{}})),getNodeParameter:(name,index,fallback)=>parameters[name]===undefined?fallback:parameters[name],getNode:()=>({id:'fixture-node',name:'Voicely Studio',type:'voicely',typeVersion:2,position:[0,0],parameters}),getWorkflow:()=>({id:'fixture-workflow'}),getExecutionId:()=> 'fixture-execution',continueOnFail:()=>false,getCredentials:async name=>{creds.push(name);assert.equal(name,'voicelySuiteApi');return {serviceUrl:'https://service.invalid',apiKey:'fixture-private-key'};},helpers:{httpRequestWithAuthentication:async(name,request)=>{assert.equal(name,'voicelySuiteApi');calls.push(request);return {statusCode:200,headers:{},body:typeof reply==='function'?await reply(request):reply};}}};
 return {context,calls,creds};
}
function picker(parameters,reply){const f=fixture(parameters,reply);f.context.getNodeParameter=(name,fallback)=>parameters[name]===undefined?fallback:parameters[name];return f;}
test('Model Get Many uses live service catalog, safe fields, limit and paired item; no speech request',async()=>{
 const f=fixture({resource:'model',operation:'getAll',returnAll:false,limit:1},models);const out=await node.execute.call(f.context);
 assert.equal(out[0].length,1);assert.deepEqual(out[0][0].json,{model_id:'tts-a',name:'Voicely Narration',operations:['speech.synthesize']});assert.deepEqual(out[0][0].pairedItem,{item:0});assert.equal(f.calls.length,1);assert.equal(new URL(f.calls[0].url).pathname,'/v2/models');assert.equal(f.calls[0].method,'GET');assert.equal(f.calls[0].body,undefined);
});
test('Model Get Many Return All accepts array and envelope, outputs one model per item without invented languages/defaults',async()=>{
 for(const body of [models,{models}]){const f=fixture({resource:'model',operation:'getAll',returnAll:true},body);const out=await node.execute.call(f.context);assert.equal(out[0].length,2);assert.ok(out[0].every(v=>v.json.languages===undefined&&v.json.default===undefined));}
});
test('Model Get Many filters TTS, STT and STS by advertised operations',async()=>{
 const f=fixture({resource:'model',operation:'getAll',returnAll:true,catalogOptions:{speechOperation:'textToSpeech'}},models);assert.deepEqual((await node.execute.call(f.context))[0].map(v=>v.json.model_id),['tts-a','tts-b']);
 for(const speechOperation of ['speechToText','speechToSpeech']){const g=fixture({resource:'model',operation:'getAll',returnAll:true,catalogOptions:{speechOperation}},models);await assert.rejects(node.execute.call(g.context),/lists TTS models/);assert.equal(g.calls.length,0);}
});
test('Model Get Many invalid operation or limit rejects before any request',async()=>{
 for(const params of [{catalogOptions:{speechOperation:'unknown'}},{limit:0}]){const f=fixture({resource:'model',operation:'getAll',limit:3,...params},models);await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);}
});
test('Model empty/unknown catalog handling does not fabricate entries',async()=>{
 assert.deepEqual(modelRows([]),[]);assert.deepEqual(modelRows([{model_id:'unknown',name:'Unknown'}],'speech.synthesize'),[]);
 for(const body of [{},{models:'wrong'},[{model_id:'a',name:''}],[...models,models[0]],[{model_id:'a',name:'A',operations:'speech.synthesize'}]])assert.throws(()=>modelRows(body));
});
test('Model Get Many supports input item linkage and Continue On Fail without automatic retry',async()=>{
 const f=fixture({resource:'model',operation:'getAll',returnAll:true},models,2);const out=await node.execute.call(f.context);assert.equal(out[0].length,4);assert.equal(out[0][3].pairedItem.item,1);
 const g=fixture({resource:'model',operation:'getAll',returnAll:true},()=>{throw Error('private-provider-mapping');},2);g.context.continueOnFail=()=>true;const bad=await node.execute.call(g.context);assert.equal(bad[0].length,2);assert.equal(g.calls.length,2);assert.doesNotMatch(JSON.stringify(bad),/private-provider/);
});
test('Voice Get Many forwards selected model and operation on every cursor page and deduplicates repeated stock voices',async()=>{
 let page=0;const f=fixture({resource:'voice',operation:'getAll',returnAll:true,catalogOptions:{speechOperation:'textToSpeech',model:{mode:'id',value:'tts-a'}}},request=>{
 const q=new URL(request.url).searchParams;assert.equal(q.get('model_id'),'tts-a');assert.equal(q.get('operation'),'speech.synthesize');assert.equal(q.get('limit'),'50');if(page)assert.equal(q.get('after'),'next');return {voices:[{voice_id:'own-'+page,name:'Owned'}],stock_voices:[{voice_id:'stock',name:'Stock'}],next_cursor:page++===0?'next':null};});
 const out=await node.execute.call(f.context);assert.deepEqual(out[0].map(v=>v.json.voice_id),['stock','own-0','own-1']);assert.equal(f.calls.length,2);
});
test('Voice Get Many STS filter uses server results without a client-side cloned-only guess',async()=>{
 const f=fixture({resource:'voice',operation:'getAll',returnAll:true,catalogOptions:{speechOperation:'speechToSpeech',model:'sts-a'}},{voices:[{voice_id:'own',name:'Own'}],stock_voices:[{voice_id:'reference-stock',name:'Reference'}],next_cursor:null});const out=await node.execute.call(f.context);assert.equal(out[0].length,2);assert.equal(new URL(f.calls[0].url).searchParams.get('operation'),'speech.convert');
});
test('Voice generic legacy listing is unchanged; operation-only uses service default without inventing model ID',async()=>{
 for(const catalogOptions of [undefined,{}, {speechOperation:'textToSpeech'}]){const f=fixture({resource:'voice',operation:'getAll',limit:3,catalogOptions},{voices:[],next_cursor:null});await node.execute.call(f.context);const q=new URL(f.calls[0].url).searchParams;assert.equal(q.get('model_id'),null);assert.equal(q.get('operation'),catalogOptions?.speechOperation?'speech.synthesize':null);}
});
test('Voice model without operation and STT voice selection refuse clearly before networking',async()=>{
 for(const [catalogOptions,message] of [[{model:'tts-a'},/Choose Speech Operation/],[{speechOperation:'speechToText'},/has no voice selection/],[{speechOperation:'bad'},/supported speech operation/]]){const f=fixture({resource:'voice',operation:'getAll',returnAll:true,catalogOptions},{voices:[],next_cursor:null});await assert.rejects(node.execute.call(f.context),message);assert.equal(f.calls.length,0);}
});
test('Voice model filter respects Limit and encoded IDs without mutating account/provider identifiers',async()=>{
 const f=fixture({resource:'voice',operation:'getAll',limit:1,catalogOptions:{speechOperation:'textToSpeech',model:'a/b?x=y&z'}},{voices:[{voice_id:'a',name:'A'},{voice_id:'b',name:'B'}],next_cursor:'another'});const out=await node.execute.call(f.context);assert.equal(out[0].length,1);assert.equal(f.calls.length,1);assert.equal(new URL(f.calls[0].url).searchParams.get('model_id'),'a/b?x=y&z');
});
test('Voice filtered discovery retains nonadvancing cursor protection',async()=>{
 const f=fixture({resource:'voice',operation:'getAll',returnAll:true,catalogOptions:{speechOperation:'textToSpeech',model:'tts-a'}},{voices:[],next_cursor:'same'});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,2);assert.ok(f.calls.every(req=>new URL(req.url).searchParams.get('model_id')==='tts-a'));
});
test('catalog model picker restricts by selected intended operation and supports search by ID',async()=>{
 for(const [speechOperation,id] of [['textToSpeech','tts-a'],['speechToSpeech','sts-a']]){const f=picker({resource:'voice',operation:'getAll',catalogOptions:{speechOperation}},models);const out=await node.methods.listSearch.getModels.call(f.context,id);assert.deepEqual(out.results,[{name:models.find(m=>m.model_id===id).name,value:id}]);}
});
test('generation model picker keeps speech operation filtering and refreshed voice queries on model switch',async()=>{
 const f=picker({resource:'speech',operation:'textToSpeech',additionalOptions:{model:'tts-a'}},models);assert.deepEqual((await node.methods.listSearch.getModels.call(f.context)).results.map(v=>v.value),['tts-a','tts-b']);
 const calls=[];for(const model of ['tts-a','tts-b']){const v=picker({resource:'speech',operation:'textToSpeech',additionalOptions:{model}}, {voices:[{voice_id:model+'-voice',name:model}],next_cursor:null});const result=await node.methods.listSearch.getVoices.call(v.context);calls.push(new URL(v.calls[0].url).searchParams.get('model_id'));assert.equal(result.results[0].value,model+'-voice');}
 assert.deepEqual(calls,['tts-a','tts-b']);
});
test('existing Voice Get and Delete picker remain unfiltered management views',async()=>{
 for(const operation of ['get','delete']){const f=picker({resource:'voice',operation,catalogOptions:{speechOperation:'textToSpeech',model:'tts-a'}},{voices:[],next_cursor:null});await node.methods.listSearch.getVoices.call(f.context);assert.equal(new URL(f.calls[0].url).searchParams.get('model_id'),null);assert.equal(new URL(f.calls[0].url).searchParams.get('operation'),null);}
});
test('STT model discovery works without voice selection, voice model picker refuses STT',async()=>{
 const f=picker({resource:'model',operation:'getAll',catalogOptions:{speechOperation:'speechToText'}},models);assert.deepEqual((await node.methods.listSearch.getModels.call(f.context)).results,[{name:'Voicely Transcribe',value:'stt-a'}]);
 const g=picker({resource:'voice',operation:'getAll',catalogOptions:{speechOperation:'speechToText'}},models);await assert.rejects(node.methods.listSearch.getModels.call(g.context),/has no voice selection/);assert.equal(g.calls.length,0);
});
test('model-first UI preserves original saved model key, collection conventions, credential and no new regular node',()=>{
 const props=node.description.properties;assert.ok(props.findIndex(p=>p.name==='additionalOptions')<props.findIndex(p=>p.name==='voice'));
 assert.equal(props.find(p=>p.name==='additionalOptions').displayName,'Model and Speech Options');assert.equal(props.some(p=>p.name==='model'),false);
 const catalog=props.find(p=>p.name==='catalogOptions');assert.equal(catalog.type,'collection');assert.deepEqual(catalog.default,{});
 const voice=props.find(p=>p.name==='voice');assert.ok(voice.typeOptions.loadOptionsDependsOn.includes('additionalOptions.model'));assert.ok(voice.typeOptions.loadOptionsDependsOn.includes('catalogOptions.model'));
 const speechModel=props.find(p=>p.name==='additionalOptions').options.find(p=>p.name==='model');assert.ok(speechModel.typeOptions.loadOptionsDependsOn.includes('operation'));
 assert.equal(require('../package.json').n8n.nodes.length,2);
});
test('all eight resources show exactly one operation, correct credential, and conditional Get Many limits',()=>{
 const props=node.description.properties;for(const resource of ['agent','call','delivery','model','speech','subscription','tool','voice']){
 const p={resource,operation:'getAll',returnAll:false},visible=x=>NodeHelpers.displayParameter(p,x,{parameters:p,typeVersion:2});
 assert.equal(props.filter(x=>x.name==='operation'&&visible(x)).length,1);assert.equal(node.description.credentials.filter(visible)[0].name,['model','speech','voice'].includes(resource)?'voicelySuiteApi':'voicelyAutomationApi');
 }
});
test('compatibility filter validation never includes supplied model ID in its safe error',()=>{
 assert.throws(()=>voiceFilters({model:'sensitive-model-value'}),error=>error instanceof CatalogSelectionError&&!error.message.includes('sensitive-model-value'));
});
test('Catalog Options reveals Model only after choosing TTS or STS; STT is not a voice-operation option',()=>{
 const catalog=node.description.properties.find(p=>p.name==='catalogOptions'),model=catalog.options.find(p=>p.name==='model');
 for(const [speechOperation,expected] of [['all',false],['textToSpeech',true],['speechToSpeech',true],['speechToText',false]]){
  const root={resource:'voice',operation:'getAll',catalogOptions:{speechOperation}};
  assert.equal(NodeHelpers.displayParameter(root.catalogOptions,model,{parameters:root,typeVersion:2},node.description,root),expected);
 }
 for(const resource of ['model','voice']){
  const root={resource,operation:'getAll'},selectors=catalog.options.filter(p=>p.name==='speechOperation'&&NodeHelpers.displayParameter({},p,{parameters:root,typeVersion:2},node.description,root));assert.equal(selectors.length,1);
  assert.equal(selectors[0].options.some(o=>o.value==='speechToText'),resource==='model');
 }
});
test('changing Model refreshes voices while configured generation uses one request without mandatory discovery nodes',async()=>{
 const f=fixture({resource:'speech',operation:'textToSpeech',text:'Fixture',voice:'saved-voice',additionalOptions:{model:'saved-model'}},req=>{
  assert.equal(new URL(req.url).pathname,'/v1/text-to-speech/saved-voice');assert.equal(req.body.model_id,'saved-model');assert.equal(req.method,'POST');return {};
 });
 // Deliberately non-audio response: transport rejects it without discovery, retry or engine substitution.
 await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,1);assert.doesNotMatch(f.calls[0].url,/\/voices\?|\/models/);
});
