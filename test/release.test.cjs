'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('node enables native AI-tool use without disabling a verification rule', () => {
	const { Voicely } = require('../dist/nodes/Voicely/Voicely.node');
	assert.equal(new Voicely().description.usableAsTool, true);
	const source = fs.readFileSync(path.join(root, 'nodes/Voicely/Voicely.node.ts'), 'utf8');
	assert.doesNotMatch(source, /eslint-disable/);
});

test('AI example wires the native voice tool to an agent and separate model without secrets', () => {
	const workflow = JSON.parse(fs.readFileSync(path.join(root, 'examples/ai-agent-voices.json'), 'utf8'));
	const tool = workflow.nodes.find((node) => node.name === 'Voicely Voices');
	const agent = workflow.nodes.find((node) => node.name === 'AI Agent');
	const model = workflow.nodes.find((node) => node.name === 'Chat Model');
	assert.equal(workflow.active, false);
	assert.equal(tool.type, require('../package.json').name + '.voicelyTool');
	assert.equal(tool.parameters.resource, 'voice');
	assert.equal(tool.parameters.operation, 'getMany');
	assert.equal(tool.retryOnFail, false);
	assert.equal(workflow.connections.Start.main[0][0].node, agent.name);
	assert.equal(workflow.connections[tool.name].ai_tool[0][0].node, agent.name);
	assert.equal(workflow.connections[model.name].ai_languageModel[0][0].node, agent.name);
	for (const node of workflow.nodes) assert.equal(node.credentials, undefined);
	assert.doesNotMatch(JSON.stringify(workflow), /apiKey|vly_live_|127\.0\.0\.1|n8n-dev\.tryvoicely/);
	assert.equal(require('../package.json').version, require('../package-lock.json').version);
});

test('public example workflows are inactive, credential-free and match compiled node parameters', () => {
	for (const [file, operation] of [
		['http-speech.json', 'generate'],
		['websocket-speech.json', 'generateWebSocket'],
	]) {
		const workflow = JSON.parse(fs.readFileSync(path.join(root, 'examples', file), 'utf8'));
		const node = workflow.nodes.find((n) => n.name === 'Voicely');
		assert.equal(workflow.active, false);
		assert.equal(node.type, require('../package.json').name + '.voicely');
		assert.equal(node.parameters.operation, operation);
		assert.equal(node.parameters.binaryProperty, 'audio');
		assert.equal(node.credentials, undefined);
		assert.equal(node.parameters.options.idempotencyKey, undefined);
		assert.equal(workflow.connections.Start.main[0][0].node, node.name);
		if (operation === 'generateWebSocket') assert.equal(node.retryOnFail, false);
		assert.doesNotMatch(JSON.stringify(workflow), /apiKey|vly_live_|n8n-dev\.tryvoicely/);
	}
});

test('publication is tag-matched, test-gated and provenance-capable without writing tokens into the repo', () => {
	const yaml = fs.readFileSync(path.join(root, '.github/workflows/publish.yml'), 'utf8');
	assert.match(yaml, /id-token: write/);
	assert.match(yaml, /registry-url: 'https:\/\/registry\.npmjs\.org'/);
	assert.match(yaml, /node-version: '24'/);
	assert.match(yaml, /package-manager-cache: false/);
	assert.match(yaml, /GITHUB_REF_NAME !== require\("\.\/package\.json"\)\.version/);
	assert.ok(yaml.indexOf('run: npm test') < yaml.indexOf('run: npm stage publish'));
	assert.match(yaml, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
	assert.doesNotMatch(yaml, /npm config set|pull_request_target/);
});

test('stage-only release preserves owner approval and uses a staging-capable npm CLI', () => {
	const yaml = fs.readFileSync(path.join(root, '.github/workflows/publish.yml'), 'utf8');
	assert.match(yaml, /run: npm install --global npm@11\.15\.0 --ignore-scripts --no-audit --no-fund/);
	assert.match(yaml, /run: npm stage publish --access public --provenance/);
	assert.match(yaml, /RELEASE_MODE: 'true'/);
	assert.ok(yaml.indexOf('run: npm test') < yaml.indexOf('run: npm stage publish'));
	assert.doesNotMatch(yaml, /run: npm run release|run: npm publish|run: npm stage approve|--otp|NPM_CONFIG_OTP/);
});
