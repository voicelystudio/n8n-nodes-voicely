import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class VoicelyApi implements ICredentialType {
	name = 'voicelyApi';
	displayName = 'Voicely API';
	icon: Icon = {
		light: 'file:../nodes/Voicely/voicely.svg',
		dark: 'file:../nodes/Voicely/voicely.svg',
	};
	documentationUrl = 'https://tryvoicely.com/developers/api';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Service URL',
			name: 'serviceUrl',
			type: 'string',
			default: 'https://n8n.tryvoicely.com',
			required: true,
			description:
				'Voicely service origin. Use https://n8n-dev.tryvoicely.com for staging. This destination receives your API key.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { 'xi-api-key': '={{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serviceUrl}}',
			url: '/v1/user',
			method: 'GET',
			disableFollowRedirect: true,
		},
	};
}
