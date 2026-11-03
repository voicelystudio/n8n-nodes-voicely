const test=require('node:test'),assert=require('node:assert/strict');
const {Voicely}=require('../dist/nodes/Voicely/Voicely.node');
const {speechModel,catalogVoiceSelection,modelRows}=require('../dist/nodes/Voicely/v2/discovery');
const {websocketRequest}=require('../dist/nodes/Voicely/v2/websocket');
const node=new Voicely().getNodeType(2);
const models=['voicely-flash-v1','voicely-tts-hd-v1','voicely-tts-classic-pro-v1','voicely-tts-preview-v1','voicely-tts-narration-v1','voicely-tts-narration-lite-v1','voicely-tts-classic-lite-v1'].map((model_id,i)=>({model_id,name:['Voicely Classic','Voicely HD','Voicely Classic Pro','Voicely Speech Preview','Voicely Narration','Voicely Narration Lite','Voicely Classic Lite (Preview)'][i],operations:['speech.synthesize'],model_contract:'api-v1',streaming:'available',streaming_mode:i===1?'buffered_segments':'provider_streaming',transports:['http','websocket'],languages:[{language_id:'en',name:'English'}],language_options:[{language_id:'en-US',name:'English'}]}));
function fixture(params,body){const calls=[];const c={getInputData:()=>[{json:{}}],getNodeParameter:(name,index,fallback)=>params[name]===undefined?fallback:params[name],getNode:()=>({id:'fixture',name:'Voicely Studio',type:'voicely',parameters:params}),getWorkflow:()=>({id:'fixture'}),getExecutionId:()=> 'fixture',continueOnFail:()=>false,getCredentials:async()=>({serviceUrl:'https://suite.invalid',apiKey:'fixture-key'}),helpers:{httpRequestWithAuthentication:async(name,request)=>{calls.push(request);return {statusCode:200,headers:{'content-type':'audio/pcm'},body:typeof body==='function'?body(request):body};},prepareBinaryData:async(bytes,fileName,mimeType)=>({data:bytes.toString('base64'),fileName,mimeType})}};return {c,calls};}
test('Model Get Many defaults to canonical seven TTS entries with streaming/language metadata, no unfiltered legacy call',async()=>{
 const f=fixture({resource:'model',operation:'getAll',returnAll:true},models);const out=await node.execute.call(f.c);assert.deepEqual(out[0].map(x=>x.json.model_id),models.map(x=>x.model_id));assert.equal(new URL(f.calls[0].url).pathname,'/v2/models');assert.equal(out[0][1].json.streaming_mode,'buffered_segments');assert.equal(out[0][0].json.language_option_count,1);assert.equal(out[0][0].json.language_options,undefined);
});
test('canonical model dropdown discloses HD buffering and only accepts synthesis rows',async()=>{
 const f=fixture({},models);f.c.getNodeParameter=(_n,fallback)=>fallback;const out=await node.methods.listSearch.getApiModels.call(f.c);assert.equal(out.results.length,7);assert.match(out.results[1].description,/buffered/);assert.match(out.results[0].description,/streaming/);assert.equal(new URL(f.calls[0].url).pathname,'/v2/models');
});
test('new API Model uses v2 HTTP while saved Legacy Model still uses v1 with identical public ID',async()=>{
 for(const [field,path] of [['apiModel','/v2/text-to-speech/vly_f08'],['model','/v1/text-to-speech/vly_f08']]){
  const f=fixture({resource:'speech',operation:'textToSpeech',voice:'vly_f08',text:'Fixture',additionalOptions:{[field]:'voicely-flash-v1',outputFormat:'pcm_24000'}},Buffer.from([1,0]));const out=await node.execute.call(f.c);assert.equal(new URL(f.calls[0].url).pathname,path);assert.equal(f.calls[0].body.model_id,'voicely-flash-v1');assert.equal(f.calls.length,1);assert.ok(out[0][0].binary.audio);
 }
});
test('empty selection preserves legacy default; simultaneous selections or canonical STT/STS reject before networking',async()=>{
 assert.deepEqual(speechModel({}),{id:undefined});assert.deepEqual(speechModel({model:'old'}),{id:'old'});assert.throws(()=>speechModel({model:'a',apiModel:'b'}),/not both/);
 for(const operation of ['speechToText','speechToSpeech']){const f=fixture({resource:'speech',operation,additionalOptions:{apiModel:'voicely-flash-v1'}},{});await assert.rejects(node.execute.call(f.c),/API Model is for Text to Speech/);assert.equal(f.calls.length,0);}
});
test('voice filtering separates canonical TTS from legacy TTS/STS, with no silent contract fallback',()=>{
 assert.equal(catalogVoiceSelection({speechOperation:'textToSpeech',apiModel:'voicely-flash-v1'}).route,'/v2/tts/voices');assert.equal(catalogVoiceSelection({speechOperation:'textToSpeech',model:'voicely-flash-v1'}).route,'/v1/voices');assert.equal(catalogVoiceSelection({speechOperation:'speechToSpeech',model:'voicely-normal'}).route,'/v1/voices');assert.throws(()=>catalogVoiceSelection({speechOperation:'speechToSpeech',apiModel:'voicely-flash-v1'}));
});
test('canonical filtered voice list sends correct route/model on all pages without lookup or inference',async()=>{
 let n=0;const f=fixture({resource:'voice',operation:'getAll',returnAll:true,catalogOptions:{speechOperation:'textToSpeech',apiModel:'voicely-tts-hd-v1'}},req=>{assert.equal(new URL(req.url).pathname,'/v2/tts/voices');assert.equal(new URL(req.url).searchParams.get('model_id'),'voicely-tts-hd-v1');return {stock_voices:[{voice_id:'vly_f08',name:'Voice'}],voices:[],next_cursor:n++===0?'next':null};});const out=await node.execute.call(f.c);assert.equal(out[0].length,1);assert.equal(f.calls.length,2);
});
test('native WS selects v2 only for explicit canonical contract; legacy path, key safety and complete binary output remain',async()=>{
 const prior=globalThis.WebSocket,sockets=[];
 class Socket{constructor(url){this.url=url;this.handlers={};sockets.push(this);queueMicrotask(()=>this.emit('open',{}));}addEventListener(n,f){(this.handlers[n]??=[]).push(f);}removeEventListener(n,f){this.handlers[n]=(this.handlers[n]??[]).filter(x=>x!==f);}emit(n,e){for(const f of this.handlers[n]??[])f(e);}send(raw){if(JSON.parse(raw).text==='')queueMicrotask(()=>{this.emit('message',{data:JSON.stringify({audio:Buffer.from([1,0]).toString('base64'),isFinal:false})});this.emit('message',{data:JSON.stringify({audio:null,isFinal:true})});this.emit('close',{code:1000});});}close(){}}
 globalThis.WebSocket=Socket;try{for(const contract of [undefined,'api-v1']){const f=fixture({},{});const out=await websocketRequest(f.c,{voice:'vly_f08',text:'Fixture',format:'pcm_24000',model:'voicely-flash-v1',modelContract:contract,language:'en',timeout:0});assert.deepEqual(out.body,Buffer.from([1,0]));const url=new URL(sockets.at(-1).url);assert.equal(url.pathname,`/${contract?'v2':'v1'}/text-to-speech/vly_f08/stream-input`);assert.equal(url.href.includes('fixture-key'),false);}}finally{if(prior===undefined)delete globalThis.WebSocket;else globalThis.WebSocket=prior;}
});
test('canonical fields remain optional collections; legacy key preserved; one regular node and unchanged default',()=>{
 const p=node.description.properties,c=p.find(x=>x.name==='additionalOptions'),canonical=c.options.find(x=>x.name==='apiModel'),legacy=c.options.find(x=>x.name==='model');assert.equal(c.type,'collection');assert.equal(canonical.displayName,'Model');assert.equal(legacy.displayName,'Legacy Model');assert.equal(canonical.modes[0].typeOptions.searchListMethod,'getApiModels');assert.equal(legacy.modes[0].typeOptions.searchListMethod,'getModels');assert.equal(require('../package.json').n8n.nodes.length,2);assert.equal(new Voicely().description.defaultVersion,2);
});
