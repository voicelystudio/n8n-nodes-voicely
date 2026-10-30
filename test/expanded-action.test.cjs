const test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs');
// Test-only source loader, never packaged or used by a node at runtime.
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {VoicelyV2:VoicelyStudio}=require('../nodes/Voicely/v2/VoicelyV2.node.ts');
const {VoicelySuiteApi}=require('../credentials/VoicelySuiteApi.credentials.ts');
const {multipart,audioMetadata,selectedId}=require('../nodes/Voicely/v2/transport.ts');
const node=new VoicelyStudio();
function fixture(params,{items=[{json:{business:'fixture'},binary:{data:{data:'not-inline',mimeType:'audio/wav',fileName:'input.wav'},consent:{data:'not-inline',mimeType:'audio/wav',fileName:'consent.wav'}}}],reply=async()=>({body:{ok:true},statusCode:200,headers:{}}),continueOnFail=false}={}){
 const calls=[],binaryReads=[];const context={
 getInputData:()=>items,getNodeParameter:(name,index,otherwise)=>{const p=Array.isArray(params)?params[index]:params;return p[name]===undefined?otherwise:p[name];},
 getCredentials:async name=>{assert.equal(name,'voicelySuiteApi');return {apiKey:'private-fixture-secret',serviceUrl:'https://node-fixture.invalid'};},
 getNode:()=>({id:'node-fixture',name:'Voicely Studio',type:'test',typeVersion:1,position:[0,0],parameters:{}}),getWorkflow:()=>({id:'workflow-fixture'}),getExecutionId:()=> 'execution-fixture',continueOnFail:()=>continueOnFail,
 helpers:{
  httpRequestWithAuthentication:async function(name,options){assert.equal(this,context);assert.equal(name,'voicelySuiteApi');calls.push(options);return reply(options);},
  assertBinaryData:(index,property)=>{const value=items[index].binary?.[property];if(!value)throw Error('missing binary');return value;},
  getBinaryDataBuffer:async(index,property)=>{binaryReads.push({index,property});return Buffer.from('bytes-'+property+'-'+index);},
  prepareBinaryData:async(bytes,fileName,mimeType)=>({data:bytes.toString('base64'),fileName,mimeType}),
 }
 };return {context,calls,binaryReads};
}
const audioReply=async options=>({body:Buffer.from('encoded-voice'),statusCode:200,headers:{'content-type':audioMetadata(new URL(options.url).searchParams.get('output_format')).mimeType}});

test('new credential/type names coexist with the unchanged old node and credential',()=>{
 const credentials=new VoicelySuiteApi();assert.equal(node.description.name,'voicely');assert.equal(credentials.name,'voicelySuiteApi');assert.equal(credentials.properties.find(p=>p.name==='apiKey').typeOptions.password,true);assert.equal(credentials.test.request.disableFollowRedirect,true);assert.equal(node.description.usableAsTool,true);
});
test('all seven mandatory operations and all 19 formats are declared without parameter maximum caps',()=>{
 const resources=node.description.properties.filter(p=>p.name==='operation');assert.deepEqual(resources.flatMap(p=>p.options.map(o=>o.value)),['textToSpeech','speechToText','speechToSpeech','get','getAll','createClone','delete']);const collection=node.description.properties.find(p=>p.name==='additionalOptions');assert.equal(collection.options.find(p=>p.name==='outputFormat').options.length,19);assert.equal(JSON.stringify(node.description).includes('maxValue'),false);
});
test('TTS preserves locator/expression results and control values with one binary output per input item',async()=>{
 const f=fixture([{resource:'speech',operation:'textToSpeech',text:'first',voice:{mode:'id',value:'vly_voice_first'},additionalOptions:{model:{mode:'list',value:'vly_model_a'},languageCode:'es',voiceSettings:{speed:1.2,stability:0.7}},outputBinaryField:'speech'}, {resource:'speech',operation:'textToSpeech',text:'second',voice:'vly_voice_second'}],{items:[{json:{keep:1},binary:{keep:{data:'x',mimeType:'test'}}},{json:{keep:2}}],reply:audioReply});
 const [result]=await node.execute.call(f.context);assert.equal(result.length,2);assert.deepEqual(result.map(r=>r.pairedItem),[{item:0},{item:1}]);assert.equal(result[0].binary.speech.mimeType,'audio/mpeg');assert.equal(result[0].binary.keep.data,'x');assert.equal(result[1].binary.audio.fileName,'speech.mp3');assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0].body,{text:'first',model_id:'vly_model_a',language_code:'es',voice_settings:{speed:1.2,stability:0.7}});assert.notEqual(f.calls[0].headers['idempotency-key'],f.calls[1].headers['idempotency-key']);assert.ok(f.calls.every(c=>c.disableFollowRedirect===true&&c.timeout===0));
});
test('same business identity is stable across executions, without embedding credential or input text',async()=>{
 const params={resource:'speech',operation:'textToSpeech',text:'Private text',voice:'vly_voice_fixture',operationIdentity:'order-123'};const a=fixture(params,{reply:audioReply}),b=fixture(params,{reply:audioReply});b.context.getExecutionId=()=> 'other-execution';await node.execute.call(a.context);await node.execute.call(b.context);assert.equal(a.calls[0].headers['idempotency-key'],b.calls[0].headers['idempotency-key']);assert.match(a.calls[0].headers['idempotency-key'],/^op_[a-f0-9]+$/);assert.equal(a.calls[0].headers['idempotency-key'].includes('order-123'),false);
});
test('STT uses n8n binary helpers and multipart real bytes, retains actual transcript fields',async()=>{
 let sent;const f=fixture({resource:'speech',operation:'speechToText',file:'data',additionalOptions:{languageCode:'en-US',diarize:true,numberOfSpeakers:2}},{reply:async options=>{sent=await new Response(options.body,{headers:{'content-type':options.headers['content-type']}}).formData();return {body:JSON.stringify({text:'Hello',words:[{text:'Hello',start:0,end:0.2,speaker_id:'speaker_0'}]}),statusCode:200,headers:{}};}});const [result]=await node.execute.call(f.context);assert.deepEqual(f.binaryReads,[{index:0,property:'data'}]);assert.equal(await sent.get('file').text(),'bytes-data-0');assert.equal(sent.get('num_speakers'),'2');assert.equal(result[0].json.words[0].end,0.2);assert.equal(f.calls.length,1);
});
test('STS uses source performance audio and selected voice, returns truthful non-MP3 binary metadata',async()=>{
 const f=fixture({resource:'speech',operation:'speechToSpeech',file:'data',voice:{mode:'id',value:'vly_voice_fixture'},additionalOptions:{outputFormat:'pcm_16000',voiceSettings:{speed:0.9}}},{reply:audioReply});const [result]=await node.execute.call(f.context);assert.equal(result[0].binary.audio.mimeType,'audio/pcm');assert.equal(result[0].binary.audio.fileName,'speech.pcm');assert.match(f.calls[0].url,/\/speech-to-speech\/vly_voice_fixture\?output_format=pcm_16000$/);assert.equal(f.binaryReads.length,1);
});
test('clone sends every selected reference and separate consent, preserves metadata and public voice identity',async()=>{
 let sent;const items=[{json:{},binary:{a:{data:'n',mimeType:'audio/wav'},b:{data:'n',mimeType:'audio/wav'},consent:{data:'n',mimeType:'audio/wav'}}}];const f=fixture({resource:'voice',operation:'createClone',name:'My own voice',audioFiles:'a, b',consentFile:'consent',additionalFields:{description:'Mine',labels:'{"label":"owned"}'}},{items,reply:async options=>{sent=await new Response(options.body,{headers:{'content-type':options.headers['content-type']}}).formData();return {body:{voice_id:'vly_voice_new'},statusCode:200,headers:{}};}});const [result]=await node.execute.call(f.context);assert.equal(result[0].json.voice_id,'vly_voice_new');assert.equal(sent.getAll('reference').length,2);assert.equal(await sent.get('consent').text(),'bytes-consent-0');assert.equal(sent.get('description'),'Mine');assert.deepEqual(f.binaryReads.map(r=>r.property),['a','b','consent']);
});
test('get/delete use encoded user selection and correct methods, no forced voice remapping',async()=>{
 for(const operation of ['get','delete']){const f=fixture({resource:'voice',operation,voice:{mode:'id',value:'own/id'}},{reply:async()=>({body:{voice_id:'own/id',name:'Fixture voice',...(operation==='delete'?{deleted:true}:{})},statusCode:200,headers:{}})});const [result]=await node.execute.call(f.context);assert.equal(result[0].json.voice_id,'own/id');if(operation==='delete')assert.equal(result[0].json.deleted,true);assert.equal(f.calls[0].method,operation==='get'?'GET':'DELETE');assert.match(f.calls[0].url,/own%2Fid$/);}
});
test('return all pages deduplicate repeated stock voices, preserve linked items and never impose a page count ceiling',async()=>{
 let page=0;const f=fixture({resource:'voice',operation:'getAll',returnAll:true,pageSize:2,simplify:false},{reply:async()=>({statusCode:200,headers:{},body:++page===1?{voices:[{voice_id:'custom-a',name:'A'}],stock_voices:[{voice_id:'stock',name:'Stock'}],next_cursor:'cursor-a'}:{voices:[{voice_id:'custom-b',name:'B'}],stock_voices:[{voice_id:'stock',name:'Stock'}],next_cursor:null}})});const [result]=await node.execute.call(f.context);assert.deepEqual(result.map(r=>r.json.voice_id),['stock','custom-a','custom-b']);assert.ok(result.every(r=>r.pairedItem.item===0));assert.equal(f.calls.length,2);assert.match(f.calls[1].url,/after=cursor-a/);
});
test('limit/simplify obey user settings and repeated cursor fails rather than looping indefinitely',async()=>{
 const f=fixture({resource:'voice',operation:'getAll',returnAll:false,limit:1,pageSize:50,simplify:true},{reply:async()=>({statusCode:200,headers:{},body:{voices:[{voice_id:'a',name:'A',privateUnexpected:'not-a-public-field'}],next_cursor:'a'}})});const [result]=await node.execute.call(f.context);assert.equal(result.length,1);assert.equal(result[0].json.privateUnexpected,undefined);assert.match(f.calls[0].url,/limit=1$/);
 const repeated=fixture({resource:'voice',operation:'getAll',returnAll:true,pageSize:2},{reply:async()=>({statusCode:200,headers:{},body:{voices:[],next_cursor:'stuck'}})});await assert.rejects(node.execute.call(repeated.context));assert.equal(repeated.calls.length,2);
});
test('dynamic voice/model discovery uses service credentials and preserves direct public IDs',async()=>{
 const f=fixture({},{reply:async options=>({statusCode:200,headers:{},body:options.url.includes('/voices')?{voices:[{voice_id:'vly_voice_own',name:'My voice'}],next_cursor:null}:{models:[{model_id:'vly_model_a',name:'Voicely Model'}]}})});assert.deepEqual((await node.methods.listSearch.getVoices.call(f.context,'My')).results,[{name:'My voice',value:'vly_voice_own'}]);assert.deepEqual((await node.methods.listSearch.getModels.call(f.context)).results,[{name:'Voicely Model',value:'vly_model_a'}]);
});
test('failure never exposes secrets/provider fingerprints, retries or loses failed-item linking',async()=>{
 const f=fixture({resource:'speech',operation:'textToSpeech',text:'Hello',voice:'vly_voice_fixture'},{reply:async()=>{throw Error('UpstreamFixture/private-fixture-secret/internal-owner');},continueOnFail:true});const [result]=await node.execute.call(f.context);assert.equal(result[0].pairedItem.item,0);assert.equal(JSON.stringify(result).includes('UpstreamFixture'),false);assert.equal(JSON.stringify(result).includes('private-fixture-secret'),false);assert.equal(f.calls.length,1);
});
test('invalid/missing binary, target, URL and policy values refuse without provider request',async()=>{
 for(const params of [{resource:'speech',operation:'speechToText',file:'missing'},{resource:'speech',operation:'textToSpeech',voice:{value:''},text:'Hello'},{resource:'voice',operation:'getAll',returnAll:false,limit:0},{resource:'voice',operation:'get',voice:'own',requestTimeoutMs:-1}]){const f=fixture(params);await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);}
 const f=fixture({resource:'voice',operation:'get',voice:'own'});f.context.getCredentials=async()=>({serviceUrl:'https://user:private@wrong.invalid',apiKey:'secret'});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);
});
test('multipart quoting cannot inject headers; output names/types follow actual requested format family',async()=>{
 const part=multipart({'name':'Own voice'},[{name:'reference',bytes:Buffer.from('source bytes'),filename:'bad\r\nInjected: header.wav',mimeType:'audio/wav'}]);assert.equal(part.body.includes('\r\nInjected:'),false);const parsed=await new Response(part.body,{headers:{'content-type':part.contentType}}).formData();assert.equal(await parsed.get('reference').text(),'source bytes');assert.equal(audioMetadata('opus_48000_64').mimeType,'audio/ogg');assert.equal(audioMetadata('ulaw_8000').fileName,'speech.ulaw');assert.throws(()=>selectedId({mode:'list',value:''}));
});

test('mislabeled audio and unknown format refuse instead of returning a wrong file type',async()=>{
 const bad=fixture({resource:'speech',operation:'textToSpeech',text:'Hi',voice:'own',additionalOptions:{outputFormat:'pcm_16000'}},{reply:async()=>({body:Buffer.from('not pcm'),statusCode:200,headers:{'content-type':'application/json'}})});await assert.rejects(node.execute.call(bad.context));assert.equal(bad.calls.length,1);
 const format=fixture({resource:'speech',operation:'textToSpeech',text:'Hi',voice:'own',additionalOptions:{outputFormat:'mp3_made_up'}});await assert.rejects(node.execute.call(format.context));assert.equal(format.calls.length,0);
});

test('workflow cancellation propagates to n8n helper and pre-cancel starts no request',async()=>{
 const c=new AbortController(),params={resource:'voice',operation:'get',voice:'own'};const f=fixture(params);f.context.getExecutionCancelSignal=()=>c.signal;await node.execute.call(f.context);assert.equal(f.calls[0].abortSignal,c.signal);c.abort();const stopped=fixture(params);stopped.context.getExecutionCancelSignal=()=>c.signal;await assert.rejects(node.execute.call(stopped.context));assert.equal(stopped.calls.length,0);
});

test('existing converter output binds to the actual new action names and preserves downstream binary wiring',async()=>{
 const {convertWorkflow}=await import('../migration/convert.mjs');const converted=convertWorkflow({nodes:[{id:'original-node',name:'Generate',type:'source.speech',typeVersion:1,parameters:{resource:'speech',operation:'textToSpeech',voice:{mode:'id',value:'old-id'},text:'Exact unchanged words',additionalOptions:{outputFormat:'mp3_44100_128'}}}],connections:{Generate:{main:[[{node:'Downstream',type:'main',index:0}]]}}},{sourceTypes:['source.speech'],sourceVersions:[1],target:{nodeType:'@voicelystudio/n8n-nodes-voicely.voicely',typeVersion:1,credentialType:'voicelySuiteApi'},credentialRef:{name:'Selected Voicely credential'},voices:{'old-id':{id:'vly_voice_own',name:'My own voice'}},models:{},runtimeAliases:{voice:false,model:false}});
 assert.equal(converted.ok,true);assert.equal(converted.workflow.active,false);assert.equal(converted.workflow.nodes[0].id,'original-node');assert.equal(converted.workflow.nodes[0].type.split('.').at(-1),node.description.name);assert.deepEqual(converted.workflow.nodes[0].credentials,{voicelySuiteApi:{name:'Selected Voicely credential'}});
 const f=fixture(converted.workflow.nodes[0].parameters,{reply:audioReply});const [result]=await node.execute.call(f.context);assert.equal(converted.workflow.nodes[0].parameters.outputBinaryField,'data');assert.equal(result[0].binary.data.fileName,'speech.mp3');assert.equal(f.calls[0].body.text,'Exact unchanged words');assert.match(f.calls[0].url,/vly_voice_own/);assert.equal(converted.workflow.connections.Generate.main[0][0].node,'Downstream');
});

test('uncertain failed item exposes only its safe operation identity and accepts that same identity on workflow retry',async()=>{
 const params={resource:'speech',operation:'textToSpeech',text:'Hello',voice:'own'};const fail=fixture(params,{continueOnFail:true,reply:async()=>{throw Error('private helper body');}});const [rows]=await node.execute.call(fail.context);const operationId=rows[0].json.operationId;assert.equal(operationId,fail.calls[0].headers['idempotency-key']);
 const retry=fixture({...params,operationIdentity:operationId},{reply:audioReply});retry.context.getExecutionId=()=> 'different-execution';await node.execute.call(retry.context);assert.equal(retry.calls[0].headers['idempotency-key'],operationId);
});

test('voice settings retain the compatible JSON parameter shape and preserve JSON strings/expressions evaluated by n8n',async()=>{
 const options=node.description.properties.find(p=>p.name==='additionalOptions');assert.equal(options.options.find(p=>p.name==='voiceSettings').type,'json');const f=fixture({resource:'speech',operation:'textToSpeech',voice:'own',text:'Hi',additionalOptions:{voiceSettings:'{"stability":0.7,"speed":1.2}'}},{reply:audioReply});await node.execute.call(f.context);assert.deepEqual(f.calls[0].body.voice_settings,{stability:0.7,speed:1.2});
});

test('Get voice honors simplified and full public metadata with one paired result',async()=>{
 const metadata={voice_id:'vly_voice_fixture',name:'My owned voice',description:'Owned',labels:{use:'fixture'},category:'cloned',custom_metadata:{sample_seconds:3}};
 for(const simplify of [true,false]){
  const f=fixture({resource:'voice',operation:'get',voice:{mode:'id',value:metadata.voice_id},simplify},{reply:async()=>({body:metadata,statusCode:200,headers:{}})});
  const [result]=await node.execute.call(f.context);assert.equal(f.calls.length,1);assert.equal(result.length,1);assert.deepEqual(result[0].pairedItem,{item:0});assert.equal(result[0].json.voice_id,metadata.voice_id);
  if(simplify)assert.equal(result[0].json.custom_metadata,undefined);else assert.deepEqual(result[0].json.custom_metadata,metadata.custom_metadata);
 }
 const control=node.description.properties.find(p=>p.name==='simplify');assert.deepEqual(control.displayOptions.show.operation,['get','getAll']);
});

test('model discovery offers only models supporting the selected speech operation',async()=>{
 const models=[{model_id:'tts-id',name:'Voicely Speech',operations:['speech.synthesize']},{model_id:'stt-id',name:'Voicely Transcription',operations:['speech.transcribe']},{model_id:'sts-id',name:'Voicely Conversion',operations:['speech.convert']},{model_id:'unknown-id',name:'Unspecified model'}];
 for(const [operation,id] of [['textToSpeech','tts-id'],['speechToText','stt-id'],['speechToSpeech','sts-id']]){
  const f=fixture({operation},{reply:async()=>({statusCode:200,headers:{},body:models})});
  const result=await node.methods.listSearch.getModels.call(f.context);assert.deepEqual(result.results.map(v=>v.value),[id]);assert.equal(f.calls.length,1);
 }
});
test('model discovery keeps operation filtering when searching and accepts object envelopes',async()=>{
 const f=fixture({operation:'textToSpeech'},{reply:async()=>({statusCode:200,headers:{},body:{models:[{model_id:'tts',name:'Voicely Clear',operations:['speech.synthesize']},{model_id:'stt',name:'Voicely Clear Transcription',operations:['speech.transcribe']},{model_id:'other',name:'Voicely Warm',operations:['speech.synthesize']}]}})});
 assert.deepEqual((await node.methods.listSearch.getModels.call(f.context,'CLEAR')).results,[{name:'Voicely Clear',value:'tts'}]);
});
test('model locator refreshes its choices when the operation changes',()=>{
 const options=node.description.properties.find(p=>p.name==='additionalOptions');const model=options.options.find(p=>p.name==='model');
 assert(model.typeOptions.loadOptionsDependsOn.includes('operation'));
});

test('Custom style input preserves precision, expression values and existing JSON controls in one STS request',async()=>{
 for(const [styleStrength,expected]of [['0.123456789',0.123456789],[0,0],[1,1]]){
  let fields;const f=fixture({resource:'speech',operation:'speechToSpeech',voice:'owned',file:'data',additionalOptions:{model:{mode:'id',value:'operator-public-custom'},styleStrength,voiceSettings:{speed:0.9}}},{reply:async options=>{fields=await new Response(options.body,{headers:{'content-type':options.headers['content-type']}}).formData();return audioReply(options);}});
  await node.execute.call(f.context);assert.equal(f.calls.length,1);assert.equal(fields.get('model_id'),'operator-public-custom');assert.deepEqual(JSON.parse(fields.get('voice_settings')),{speed:0.9,style:expected});
 }
});
test('unset or empty Custom style never injects a client default or changes the selected server preset',async()=>{
 for(const additionalOptions of [{},{styleStrength:''},{styleStrength:'   '}]){
  let fields;const f=fixture({resource:'speech',operation:'speechToSpeech',voice:'owned',file:'data',additionalOptions},{reply:async options=>{fields=await new Response(options.body,{headers:{'content-type':options.headers['content-type']}}).formData();return audioReply(options);}});
  await node.execute.call(f.context);assert.equal(fields.has('voice_settings'),false);assert.equal(fields.has('model_id'),false);assert.equal(f.calls.length,1);
 }
});
test('invalid or conflicting Custom style inputs refuse before any network request; no hidden override',async()=>{
 for(const additionalOptions of [{styleStrength:-0.1},{styleStrength:1.1},{styleStrength:NaN},{styleStrength:Infinity},{styleStrength:false},{styleStrength:null},{styleStrength:[]},{styleStrength:{}},{styleStrength:'not-a-number'},{styleStrength:0.7,voiceSettings:{style:0.2}}]){
  const f=fixture({resource:'speech',operation:'speechToSpeech',voice:'owned',file:'data',additionalOptions},{reply:audioReply});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);
 }
 const f=fixture({resource:'speech',operation:'textToSpeech',voice:'owned',text:'Hello',additionalOptions:{styleStrength:0.5}},{reply:audioReply});await assert.rejects(node.execute.call(f.context));assert.equal(f.calls.length,0);
});
test('optional Custom style is STS-specific and leaves default resolution with the service',()=>{
 const fields=node.description.properties.find(p=>p.name==='additionalOptions').options,p=fields.find(p=>p.name==='styleStrength');assert.ok(p);assert.equal(p.default,'');assert.deepEqual(p.displayOptions.show['/operation'],['speechToSpeech']);assert.match(p.description,/service default/i);assert.equal(p.typeOptions?.maxValue,undefined);
});

 test('voice picker requests only usable voices for selected speech operation/model and preserves pagination',async()=>{
 for(const [operation,model,expected]of [['speechToSpeech','voicely-custom','speech.convert'],['textToSpeech','native-text','speech.synthesize'],['getAll',undefined,undefined]]){
 const values={operation,additionalOptions:model?{model:{mode:'id',value:model}}:{}};const f=fixture({}, {reply:async()=>({statusCode:200,headers:{},body:{voices:[],stock_voices:[],next_cursor:null}})});f.context.getNodeParameter=(name,fallback)=>values[name]??fallback;
 await node.methods.listSearch.getVoices.call(f.context,'','cursor-next');const url=new URL(f.calls[0].url);assert.equal(url.searchParams.get('after'),'cursor-next');assert.equal(url.searchParams.get('operation'),expected??null);assert.equal(url.searchParams.get('model_id'),expected?model:null);assert.equal(f.calls.length,1);
 }
 });
