const test=require('node:test'),assert=require('node:assert/strict');
const {Voicely}=require('../dist/nodes/Voicely/Voicely.node');
const {languageRows,speechLanguage}=require('../dist/nodes/Voicely/v2/discovery');
const {NodeHelpers}=require('n8n-workflow');
const node=new Voicely().getNodeType(2);
const ids=['voicely-flash-v1','voicely-tts-hd-v1','voicely-tts-classic-pro-v1','voicely-tts-preview-v1','voicely-tts-narration-v1','voicely-tts-narration-lite-v1','voicely-tts-classic-lite-v1'];
const choices=[{language_id:'ur-PK',name:'Urdu',preview_in_voicely:false},{language_id:'vly-lang:acehnese',name:'Acehnese',preview_in_voicely:true}];
function fixture(params,reply){const calls=[];const context={getInputData:()=>[{json:{}}],getNodeParameter:(n,i,f)=>params[n]===undefined?f:params[n],getNode:()=>({id:'fixture',name:'Voicely Studio',parameters:params}),getWorkflow:()=>({id:'fixture'}),getExecutionId:()=> 'fixture',continueOnFail:()=>false,getCredentials:async()=>({serviceUrl:'https://suite.invalid',apiKey:'fixture-key'}),helpers:{httpRequestWithAuthentication:async(n,r)=>{calls.push(r);return {statusCode:200,headers:{'content-type':'audio/pcm'},body:typeof reply==='function'?reply(r):reply};},prepareBinaryData:async(b,f,m)=>({data:b.toString('base64'),fileName:f,mimeType:m})}};return {context,calls};}
function picker(params,reply){const f=fixture(params,reply);f.context.getNodeParameter=(n,d)=>params[n]===undefined?d:params[n];return f;}
test('compact Model Get Many omits large language arrays; detailed mode restores metadata, paired IDs and streaming remain',async()=>{
 const models=ids.map(model_id=>({model_id,name:model_id,operations:['speech.synthesize'],model_contract:'api-v1',preview:false,streaming:'available',streaming_mode:'provider_streaming',transports:['http','websocket'],languages:choices,language_options:choices}));
 for(const simplify of [true,false]){const f=fixture({resource:'model',operation:'getAll',returnAll:true,options:{simplify}},models);const out=(await node.execute.call(f.context))[0];assert.equal(out.length,7);for(const row of out){assert.equal(row.pairedItem.item,0);assert.ok(row.json.model_id);if(simplify){assert.equal(row.json.languages,undefined);assert.equal(row.json.language_options,undefined);assert.equal(row.json.language_option_count,2);assert.equal(row.json.preview_language_option_count,1);assert.ok(Object.keys(row.json).length<=10);}else assert.deepEqual(row.json.language_options,choices);}}
});
for(const id of ids)test('Language Get Many uses exactly the selected canonical model: '+id,async()=>{
 const f=fixture({resource:'language',operation:'getAll',languageModel:{mode:'id',value:id},limit:1},{model_id:id,languages:choices});const out=(await node.execute.call(f.context))[0];assert.equal(out.length,1);assert.equal(out[0].json.language_id,'ur-PK');assert.equal(out[0].json.model_id,id);assert.equal(new URL(f.calls[0].url).pathname,'/v2/tts/languages');assert.equal(new URL(f.calls[0].url).searchParams.get('model_id'),id);assert.equal(f.calls[0].method,'GET');assert.equal(f.calls.length,1);
});
test('language discovery Return All and invalid model/Limit behave without inference',async()=>{
 const f=fixture({resource:'language',operation:'getAll',languageModel:ids[0],returnAll:true},{model_id:ids[0],languages:choices});assert.equal((await node.execute.call(f.context))[0].length,2);
 for(const p of [{languageModel:''},{languageModel:ids[0],limit:0}]){const g=fixture({resource:'language',operation:'getAll',...p},{});await assert.rejects(node.execute.call(g.context));assert.equal(g.calls.length,0);}
});
test('language picker is selected-model searchable and distinguishes Voicely preview without new provider promises',async()=>{
 for(const resource of ['speech','voice']){const params=resource==='speech'?{resource,operation:'textToSpeech',additionalOptions:{apiModel:ids[4]}}:{resource,operation:'getAll',catalogOptions:{speechOperation:'textToSpeech',apiModel:ids[4]}};const f=picker(params,{model_id:ids[4],languages:choices});const out=await node.methods.listSearch.getLanguages.call(f.context,'aceh');assert.equal(out.results.length,1);assert.equal(out.results[0].value,'vly-lang:acehnese');assert.match(out.results[0].name,/Preview/);assert.match(out.results[0].description,/Voicely/);assert.equal(new URL(f.calls[0].url).searchParams.get('model_id'),ids[4]);}
});
test('language picker requires canonical Model; mismatched, malformed and duplicate catalogs fail closed',async()=>{
 for(const additionalOptions of [{},{model:'voicely-flash-v1'},{model:'old',apiModel:ids[0]}]){const f=picker({resource:'speech',operation:'textToSpeech',additionalOptions},{});await assert.rejects(node.methods.listSearch.getLanguages.call(f.context));assert.equal(f.calls.length,0);}
 for(const body of [{},{model_id:ids[0],languages:'bad'},{model_id:ids[0],languages:[...choices,choices[0]]},{model_id:ids[0],languages:[{language_id:'en',name:'English'}]}])assert.throws(()=>languageRows(body));
 assert.throws(()=>languageRows({model_id:ids[1],languages:choices},ids[0]));
});
test('generation and Voice catalog refresh/filter use exact selected model AND language; no silent voice change',async()=>{
 for(const id of ids){const f=picker({resource:'speech',operation:'textToSpeech',additionalOptions:{apiModel:id,language:{mode:'id',value:'ur-PK'}}},{voices:[],stock_voices:[{voice_id:'vly_f08',name:'Female08'}],next_cursor:null});const out=await node.methods.listSearch.getVoices.call(f.context);assert.equal(out.results[0].value,'vly_f08');const u=new URL(f.calls[0].url);assert.equal(u.pathname,'/v2/tts/voices');assert.equal(u.searchParams.get('model_id'),id);assert.equal(u.searchParams.get('language_code'),'ur-PK');}
 const f=fixture({resource:'voice',operation:'getAll',limit:2,catalogOptions:{speechOperation:'textToSpeech',apiModel:ids[4],language:'vly-lang:acehnese'}},{voices:[],stock_voices:[],next_cursor:null});await node.execute.call(f.context);assert.equal(new URL(f.calls[0].url).searchParams.get('language_code'),'vly-lang:acehnese');
});
test('canonical generation transmits model, language and chosen voice once; saved legacy code/default request remains unchanged',async()=>{
 for(const p of [{apiModel:ids[4],language:{mode:'list',value:'ur-PK'}},{model:'voicely-flash-v1',languageCode:'ur'},{}]){const f=fixture({resource:'speech',operation:'textToSpeech',text:'Fixture',voice:'vly_f08',additionalOptions:{...p,outputFormat:'pcm_24000'}},Buffer.from([1,0]));await node.execute.call(f.context);assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.language_code,p.language?'ur-PK':p.languageCode);assert.equal(new URL(f.calls[0].url).pathname,p.apiModel?'/v2/text-to-speech/vly_f08':'/v1/text-to-speech/vly_f08');}
});
test('mixed or orphaned language selections error before HTTP; old strings accepted, no coercion of malformed objects',async()=>{
 for(const additionalOptions of [{apiModel:ids[0],language:'ur-PK',languageCode:'en'},{language:'ur-PK'},{apiModel:ids[0],languageCode:{bad:true}}]){const f=fixture({resource:'speech',operation:'textToSpeech',text:'F',voice:'vly_f08',additionalOptions},{});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);}
 assert.equal(speechLanguage({languageCode:'en'}),'en');assert.equal(speechLanguage({}),undefined);
});
test('dependency UI stays in collections; model-aware language is optional, required Language discovery Model explicit, one action + Trigger',()=>{
 const props=node.description.properties,additional=props.find(p=>p.name==='additionalOptions'),lang=additional.options.find(p=>p.name==='language'),voice=props.find(p=>p.name==='voice');assert.equal(additional.type,'collection');assert.equal(lang.type,'resourceLocator');assert.equal(lang.required,undefined);assert.ok(lang.typeOptions.loadOptionsDependsOn.includes('additionalOptions.apiModel'));assert.ok(voice.typeOptions.loadOptionsDependsOn.includes('additionalOptions.language'));assert.ok(voice.typeOptions.loadOptionsDependsOn.includes('catalogOptions.language'));
 const p={resource:'language',operation:'getAll',returnAll:false};const visible=x=>NodeHelpers.displayParameter(p,x,{parameters:p,typeVersion:2});assert.equal(props.filter(x=>x.name==='operation'&&visible(x)).length,1);assert.equal(props.filter(x=>x.name==='limit'&&visible(x)).length,1);assert.equal(props.find(x=>x.name==='languageModel').required,true);assert.equal(node.description.credentials.filter(visible)[0].name,'voicelySuiteApi');assert.equal(require('../package.json').n8n.nodes.length,2);assert.doesNotMatch(JSON.stringify(props),/Page Size/);
});
