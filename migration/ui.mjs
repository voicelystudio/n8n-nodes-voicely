import {convertWorkflow} from './convert.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// All input stays in browser memory. Profiles contain only explicit ID mappings,
// never credentials, URLs, raw recordings or an automatic voice/model equivalence.
export function inspectWorkflow(value){
 if(!object(value)||!Array.isArray(value.nodes)||!object(value.connections))throw Error('workflow_invalid');
 const types=new Map();for(const node of value.nodes){if(!object(node)||typeof node.type!=='string'||!Number.isFinite(node.typeVersion))continue;const p=node.parameters;if(!object(p)||!['speech','voice'].includes(p.resource)||typeof p.operation!=='string')continue;let entry=types.get(node.type);if(!entry){entry={type:node.type,versions:new Set(),nodes:[],voices:new Set(),models:new Set(),dynamic:[]};types.set(node.type,entry);}entry.versions.add(node.typeVersion);entry.nodes.push(node.id);
  for(const [kind,raw] of [['voice',p.voice],['model',p.additionalOptions?.model]]){const selected=object(raw)?raw.value:raw;if(typeof selected!=='string'||!selected)continue;if(selected.startsWith('='))entry.dynamic.push({nodeId:node.id,kind});else entry[kind+'s'].add(selected);}
 }
 return [...types.values()].map(v=>({...v,versions:[...v.versions],voices:[...v.voices],models:[...v.models]}));
}
export function makeProfile({selection,mappings,runtimeAliases={}}){
 if(!selection||typeof selection.type!=='string'||!Array.isArray(selection.versions)||!selection.versions.length||!object(mappings))throw Error('migration_profile_invalid');
 // Node schema versions are protocol identities, not usage ceilings. Only the
 // reviewed source contract is enabled; discovering a version is not approval.
 if(!object(runtimeAliases)||Object.keys(runtimeAliases).some(k=>!['voice','model'].includes(k))||Object.values(runtimeAliases).some(v=>typeof v!=='boolean'))throw Error('migration_profile_invalid');
 if(selection.versions.some(version=>version!==1))throw Error('source_contract_unsupported');
 const voices=Object.fromEntries(selection.voices.map(value=>{const target=mappings.voice?.[value];if(typeof target!=='string'||!target.trim())throw Error('voice_mapping_required');return [value,{id:target.trim(),name:target.trim()}];}));
 const models=Object.fromEntries(selection.models.map(value=>{const target=mappings.model?.[value];if(typeof target!=='string'||!target.trim())throw Error('model_mapping_required');return [value,{id:target.trim(),name:target.trim()}];}));
 return {sourceTypes:[selection.type],sourceVersions:[...selection.versions],target:{nodeType:'@voicelystudio/n8n-nodes-voicely.voicely',typeVersion:2,credentialType:'voicelySuiteApi'},voices,models,runtimeAliases:{...runtimeAliases}};
}
export function migrationSession(){
 let source,selection,mappings={voice:{},model:{}},converted,runtimeAliases={},revision=0;
 function invalidate(){converted=undefined;revision++;}
 return Object.freeze({
  async load(file){invalidate();const own=revision;source=undefined;selection=undefined;mappings={voice:{},model:{}};runtimeAliases={};let input;try{input=JSON.parse(await file.text());}catch{throw Error('workflow_json_invalid');}const choices=inspectWorkflow(input);if(own!==revision)throw Error('workflow_read_superseded');source=input;return choices;},
  select(type){invalidate();if(!source)throw Error('workflow_required');selection=inspectWorkflow(source).find(v=>v.type===type);mappings={voice:{},model:{}};runtimeAliases={};if(!selection)throw Error('source_selection_required');return structuredClone(selection);},
  map(kind,value,target){invalidate();if(!['voice','model'].includes(kind)||!selection||!selection[kind+'s'].includes(value)||typeof target!=='string')throw Error('migration_mapping_invalid');mappings[kind]=Object.fromEntries([...Object.entries(mappings[kind]).filter(([k])=>k!==value),[value,target]]);},
  runtimeMappings(confirmed){invalidate();if(typeof confirmed!=='boolean')throw Error('migration_profile_invalid');runtimeAliases=confirmed?{voice:true,model:true}:{};},
  convert(){invalidate();if(!source||!selection)throw Error('source_selection_required');const profile=makeProfile({selection,mappings,runtimeAliases}),result=convertWorkflow(source,profile);if(result.ok)converted=result.workflow;return result;},
  download(){if(!converted)throw Error('conversion_required');return JSON.stringify(converted,null,2)+'\n';},
  clear(){invalidate();source=undefined;selection=undefined;mappings={voice:{},model:{}};runtimeAliases={};}
 });
}
export function mountMigration(document,{URL:urls,Blob:BlobClass}){
 const session=migrationSession(),by=id=>document.getElementById(id),message=text=>{by('status').textContent=text;},reset=()=>{by('download').disabled=true;by('report').textContent='';};let choices=[];
 function mappingRows(selection){by('runtimeAliases').checked=false;const holder=by('mappings');holder.replaceChildren();for(const kind of ['voice','model'])for(const source of selection[kind+'s']){const label=document.createElement('label'),name=document.createElement('span'),input=document.createElement('input');name.textContent=kind+' '+source+' → Voicely ID';input.type='text';input.autocomplete='off';input.required=true;input.addEventListener('input',()=>{reset();session.map(kind,source,input.value);});label.append(name,input);holder.append(label);}if(selection.dynamic.length)message('Dynamic IDs need explicit mappings configured in your Voicely account. Confirm that setup below before exporting.');}
 by('workflow').addEventListener('change',async()=>{reset();by('mappings').replaceChildren();by('source').replaceChildren();choices=[];try{const file=by('workflow').files?.[0];if(!file){session.clear();return;}choices=await session.load(file);for(const [index,choice] of choices.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=choice.type+' ('+choice.nodes.length+' nodes)';by('source').append(option);}if(choices.length){mappingRows(session.select(choices[0].type));message('Choose your mappings, then review the conversion. No file was uploaded.');}else message('No supported speech or voice node candidates found.');}catch{message('The workflow could not be read. Select valid exported JSON.');}});
 by('source').addEventListener('change',()=>{reset();const choice=choices[Number(by('source').value)];if(choice)mappingRows(session.select(choice.type));});
 by('runtimeAliases').addEventListener('change',()=>{reset();session.runtimeMappings(by('runtimeAliases').checked);});
 by('convert').addEventListener('click',()=>{reset();try{const r=session.convert();by('report').textContent=JSON.stringify({changes:r.changes,issues:r.issues,requirements:r.requirements},null,2);by('download').disabled=!r.ok;message(r.ok?'Inactive copy ready. Review every requirement and bind your Voicely credential after import.':'Export blocked. Resolve the compatibility issues shown below.');}catch{message('Select a workflow and fill every voice/model mapping.');}});
 by('download').addEventListener('click',()=>{let url;try{url=urls.createObjectURL(new BlobClass([session.download()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='voicely-workflow.json';a.click();}catch{message('Convert and review the workflow before downloading.');}finally{if(url)urls.revokeObjectURL(url);}});
 by('clear').addEventListener('click',()=>{session.clear();choices=[];by('runtimeAliases').checked=false;by('workflow').value='';by('source').replaceChildren();by('mappings').replaceChildren();reset();message('Workflow and mappings cleared from this page.');});
 return {clear:()=>session.clear()};
}
