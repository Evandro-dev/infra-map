import type { ManagedCredentialProvider } from '@infra/contracts';
import { Server } from 'lucide-react';

export interface CredentialProviderDefinition {
  id: ManagedCredentialProvider;
  name: string;
  category: string;
  description: string;
  icon: typeof Server;
  fields: readonly {
    name: 'targetServer' | 'username' | 'password';
    label: string;
    type: string;
  }[];
}

export const credentialProviders: readonly CredentialProviderDefinition[] = [
  {
    id: 'WINDOWS_PRINT_SERVER',
    name: 'Windows Print Server',
    category: 'Servidores',
    description:
      'Conta usada somente para consultar filas, drivers e portas do servidor de impressão. Não habilita ações administrativas nos computadores.',
    icon: Server,
    fields: [
      { name: 'targetServer', label: 'Servidor permitido (opcional)', type: 'text' },
      { name: 'username', label: 'Usuário Windows', type: 'text' },
      { name: 'password', label: 'Senha Windows', type: 'password' },
    ],
  },
];

export const unsupportedCredentialProviders = [
  {
    name: 'Impressoras Epson',
    description:
      'Os CSVs indicam SNMP ativo e portas, mas não registram versão, comunidade nem usuário/senha para as WF-M5899 e WF-C878R.',
  },
  {
    name: 'ISL Light / WebAPI2',
    description:
      'A conexão atual é configurada no backend por variáveis de ambiente e não é selecionável por credencial na Central de suporte.',
  },
] as const;
