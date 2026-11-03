// Pure, offline workflow transformation. No network, filesystem, credentials lookup or activation.
const prefix = '@voicelystudio/n8n-nodes-voicely.';
const agentResources = new Set(['agent', 'call', 'delivery', 'subscription', 'tool']);
const agentOperations = {
  agent: ['getAll'], call: ['get', 'revokeExports'], delivery: ['getAll', 'redeliver'],
  subscription: ['test'], tool: ['getAll', 'register', 'disable'],
};
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Produce a new inactive copy. Conflict => no workflow returned; original is never mutated. */
export function upgradeV020Workflow(input) {
  const changes = [], issues = [], requirements = [];
  const fail = () => ({ok: false, workflow: null, changes: [], issues, requirements});
  if (!object(input) || !Array.isArray(input.nodes) || !object(input.connections)) {
    issues.push({code: 'workflow_invalid'}); return fail();
  }
  let workflow;
  try { workflow = structuredClone(input); }
  catch { issues.push({code: 'workflow_invalid'}); return fail(); }
  for (const node of workflow.nodes) {
    if (!object(node)) { issues.push({code: 'node_invalid'}); continue; }
    const agents = node.type === prefix + 'voicelyAgents';
    const studio = node.type === prefix + 'voicely' && node.typeVersion === 2;
    const trigger = node.type === prefix + 'voicelyAgentsTrigger';
    if (!agents && !studio && !trigger) continue;
    const p = node.parameters;
    if (!object(p) || (p.options !== undefined && !object(p.options))) {
      issues.push({code: 'options_invalid', nodeId: node.id}); continue;
    }
    if (agents && (node.typeVersion !== 1 || !agentResources.has(p.resource)
      || !agentOperations[p.resource].includes(p.operation))) {
      issues.push({code: 'agent_operation_unrecognized', nodeId: node.id}); continue;
    }
    const fields = trigger ? ['requestTimeoutMs', 'includeSynthetic']
      : agents ? ['requestTimeoutMs', 'includeData', 'purpose', 'effect', 'verifiedCaller']
      : ['operationIdentity', 'requestTimeoutMs', 'simplify', 'speechTransport'];
    for (const name of fields) {
      if (!Object.hasOwn(p, name)) continue;
      if (Object.hasOwn(p.options ?? {}, name) && JSON.stringify(p.options[name]) !== JSON.stringify(p[name])) {
        issues.push({code: 'option_conflict', nodeId: node.id, field: name}); continue;
      }
      (p.options ??= {})[name] = p[name]; delete p[name];
      changes.push({nodeId: node.id, field: name, action: 'move_to_options'});
    }
    if (Object.hasOwn(p, 'pageSize')) {
      delete p.pageSize; changes.push({nodeId: node.id, field: 'pageSize', action: 'use_internal_page_size_50'});
    }
    if (agents) {
      node.type = prefix + 'voicely'; node.typeVersion = 2;
      // Existing credential reference and node IDs/names remain intact; no secrets are read.
      if (p.resource === 'agent') { p.returnAll ??= true; }
      changes.push({nodeId: node.id, action: 'agents_to_studio'});
      requirements.push({nodeId: node.id, kind: 'review_automation_credential_and_resource'});
    }
  }
  if (issues.length) return fail();
  if (!changes.length) { issues.push({code: 'no_v020_changes'}); return fail(); }
  for (const key of ['id', 'versionId', 'activeVersionId', 'versionCounter', 'createdAt', 'updatedAt', 'shared', 'ownedBy', 'homeProject', 'projectId', 'staticData', 'pinData']) delete workflow[key];
  if (object(workflow.meta)) { delete workflow.meta.instanceId; delete workflow.meta.templateCredsSetupCompleted; }
  workflow.active = false;
  requirements.push({kind: 'rebind_review_credentials_and_register_trigger_for_new_copy'});
  return {ok: true, workflow, changes, issues, requirements};
}
