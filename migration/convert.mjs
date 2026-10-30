// Original Voicely workflow conversion. Pure data transformation: no network, env, filesystem or telemetry.
const operations = {
  speech: new Set(['textToSpeech', 'speechToText', 'speechToSpeech']),
  voice: new Set(['get', 'getAll', 'createClone', 'delete']),
};
const commonFields = new Set(['resource', 'operation']);
const operationFields = {
  textToSpeech: new Set(['voice', 'text', 'additionalOptions']),
  speechToText: new Set(['file', 'additionalOptions']),
  speechToSpeech: new Set(['voice', 'file', 'additionalOptions']),
  get: new Set(['voice', 'simplify']),
  getAll: new Set(['returnAll', 'limit', 'simplify']),
  createClone: new Set(['audioFiles', 'name', 'additionalFields']),
  delete: new Set(['voice']),
};
const optionFields = {
  textToSpeech: new Set(['model','outputFormat','languageCode','voiceSettings']),
  speechToText: new Set(['model','languageCode','numberOfSpeakers','diarize']),
  speechToSpeech: new Set(['model','outputFormat','voiceSettings']),
};
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string' && v.length > 0;
const own = (o,k) => object(o) && Object.hasOwn(o,k);
const expression = v => typeof v === 'string' && v.startsWith('=');
const issue = (code,nodeId) => ({code,...(nodeId === undefined ? {} : {nodeId})});
function inlineAuth(value) {
  const stack=[value],seen=new WeakSet();
  while(stack.length){
    const v=stack.pop();if(!v||typeof v!=='object'||seen.has(v))continue;seen.add(v);
    for(const [k,x] of Object.entries(v)){
      if(/^(?:api[-_]?key|xi[-_]?api[-_]?key|authorization|password|secret|token)$/i.test(k)&&text(x)&&!expression(x))return true;
      if(x&&typeof x==='object')stack.push(x);
    }
  }
  return false;
}
function validProfile(p) {
  if(!object(p)||!Array.isArray(p.sourceTypes)||!p.sourceTypes.length||p.sourceTypes.some(x=>!text(x))
    ||!Array.isArray(p.sourceVersions)||!p.sourceVersions.length||p.sourceVersions.some(x=>!Number.isFinite(x))
    ||!object(p.target)||!text(p.target.nodeType)||!Number.isFinite(p.target.typeVersion)||!text(p.target.credentialType)
    ||!object(p.voices)||!object(p.models)||!object(p.runtimeAliases))return false;
  if(p.credentialRef!==undefined&&(!object(p.credentialRef)||!text(p.credentialRef.name)
    ||(p.credentialRef.id!==undefined&&!text(p.credentialRef.id))
    ||Object.keys(p.credentialRef).some(k=>!['id','name'].includes(k))))return false;
  return true;
}
/** Caller supplies an explicitly reviewed source/target profile. Imported workflows stay inactive. */
export function convertWorkflow(input,profile) {
  const issues=[],changes=[],requirements=[];
  const fail=()=>({ok:false,workflow:null,issues,changes:[],requirements});
  if(!validProfile(profile)){issues.push(issue('migration_profile_invalid'));return fail();}
  if(!object(input)||!Array.isArray(input.nodes)||!object(input.connections)){
    issues.push(issue('workflow_invalid'));return fail();
  }
  let workflow;
  try{workflow=structuredClone(input);}catch{issues.push(issue('workflow_invalid'));return fail();}
  const names=new Set(),ids=new Set();
  for(const n of workflow.nodes){
    if(!object(n)||!text(n.id)||!text(n.name)||!text(n.type)||names.has(n.name)||ids.has(n.id)){
      issues.push(issue('workflow_node_identity_invalid'));return fail();
    }
    names.add(n.name);ids.add(n.id);
  }
  for(const n of workflow.nodes){
    if(object(n.parameters)&&Object.keys(n.parameters).some(k=>/^(?:jsCode|pythonCode|functionCode|code)$/.test(k)))requirements.push({kind:'review_embedded_code_and_auth',nodeId:n.id});
    if(!profile.sourceTypes.includes(n.type)){
      if(object(n.parameters)&&own(n.parameters,'workflowId'))requirements.push({kind:'review_referenced_workflow',nodeId:n.id});
      continue;
    }
    const start=issues.length,p=n.parameters;
    if(!profile.sourceVersions.includes(n.typeVersion)||!object(p)||!text(p.resource)||!text(p.operation)||!own(operations,p.resource)
      ||!operations[p.resource].has(p.operation)){
      issues.push(issue('source_contract_unsupported',n.id));continue;
    }
    if(inlineAuth(p)){issues.push(issue('inline_auth_requires_credential_binding',n.id));continue;}
    if(Object.keys(p).some(k=>!commonFields.has(k)&&!operationFields[p.operation].has(k))){issues.push(issue('parameter_requires_review',n.id));continue;}
    if(p.additionalOptions!==undefined&&(!object(p.additionalOptions)
      ||Object.keys(p.additionalOptions).some(k=>!optionFields[p.operation]?.has(k)))){
      issues.push(issue('option_requires_review',n.id));continue;
    }
    if(p.operation==='createClone'&&p.additionalFields!==undefined&&(!object(p.additionalFields)
      ||Object.keys(p.additionalFields).some(k=>!['description','labels'].includes(k)))){
      issues.push(issue('clone_metadata_requires_review',n.id));continue;
    }
    const mapField=(container,key,mapping,kind,required=false)=>{
      const raw=container[key];
      if(raw===undefined||raw===null||raw===''){
        if(required)issues.push(issue(kind+'_selection_required',n.id));return;
      }
      const locator=object(raw),value=locator?raw.value:raw;
      if(!text(value)){issues.push(issue(kind+'_selection_invalid',n.id));return;}
      if(expression(value)){
        if(profile.runtimeAliases[kind]!==true){issues.push(issue(kind+'_runtime_mapping_required',n.id));return;}
        if(locator){delete raw.cachedResultName;delete raw.cachedResultUrl;}
        requirements.push({kind:'verify_runtime_'+kind+'_mapping',nodeId:n.id});return;
      }
      if(!own(mapping,value)||!object(mapping[value])||!text(mapping[value].id)||!text(mapping[value].name)){
        issues.push(issue(kind+'_mapping_required',n.id));return;
      }
      const selected=mapping[value];
      if(locator){raw.value=selected.id;raw.cachedResultName=selected.name;delete raw.cachedResultUrl;}
      else container[key]=selected.id;
    };
    if(p.resource==='speech'&&['textToSpeech','speechToSpeech'].includes(p.operation)
      ||p.resource==='voice'&&['get','delete'].includes(p.operation))mapField(p,'voice',profile.voices,'voice',true);
    if(p.resource==='speech'&&object(p.additionalOptions))mapField(p.additionalOptions,'model',profile.models,'model');
    if(p.resource==='speech'&&p.operation==='textToSpeech'&&!text(p.text))issues.push(issue('speech_text_required',n.id));
    if(p.resource==='speech'&&['speechToText','speechToSpeech'].includes(p.operation)&&!text(p.file))issues.push(issue('binary_input_property_required',n.id));
    if(p.resource==='voice'&&p.operation==='createClone'&&(!text(p.audioFiles)||!text(p.name)))issues.push(issue('clone_input_required',n.id));
    if(issues.length!==start)continue;
    if(p.resource==='voice'&&p.operation==='createClone')requirements.push({kind:'provide_authorized_consent_recording',nodeId:n.id});
    const sourceType=n.type;
    n.type=profile.target.nodeType;n.typeVersion=profile.target.typeVersion;
    // Keep the source audio output field so existing downstream binary links work.
    if(p.resource==='speech'&&['textToSpeech','speechToSpeech'].includes(p.operation))p.outputBinaryField='data';
    if(profile.credentialRef)n.credentials={[profile.target.credentialType]:structuredClone(profile.credentialRef)};
    else{delete n.credentials;requirements.push({kind:'bind_voicely_credential',nodeId:n.id});}
    if(object(workflow.pinData)&&own(workflow.pinData,n.name)){
      delete workflow.pinData[n.name];requirements.push({kind:'rerun_converted_node',nodeId:n.id});
    }
    changes.push({nodeId:n.id,sourceType,targetType:n.type});
  }
  if(issues.length)return fail();
  if(!changes.length){issues.push(issue('no_selected_source_nodes'));return fail();}
  // A migrated workflow is a new inactive copy, never a writable identity of the source.
  for(const key of ['id','versionId','activeVersionId','versionCounter','createdAt','updatedAt','shared','ownedBy','homeProject','projectId'])delete workflow[key];
  if(object(workflow.meta)){delete workflow.meta.instanceId;delete workflow.meta.templateCredsSetupCompleted;}
  workflow.active=false;
  return {ok:true,workflow,issues,changes,requirements};
}
