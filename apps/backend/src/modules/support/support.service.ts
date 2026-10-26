import { setTimeout } from 'node:timers/promises';
import type { z } from 'zod';
import type {
  islLinkSchema,
  printerConfigSchema,
  supportExecutionSchema,
  SupportSettings,
  IslPresence,
} from '@infra/contracts';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { actionCommand, actionList } from './support.actions.js';
import { isl, inspectIslResponse, type IslClient } from './isl.client.js';
import { islLauncher } from './isl.launcher.js';
import { supportRepository } from './support.repository.js';
import { monitoringService } from '../monitoring/monitoring.service.js';

interface Dependencies {
  repository: typeof supportRepository;
  client: Pick<
    IslClient,
    'list' | 'actionStart' | 'actionInfo' | 'actionAuthenticate' | 'downloadResult'
  >;
  launcher: typeof islLauncher;
  config: Pick<
    typeof env,
    | 'ISL_MODE'
    | 'ISL_API_USERNAME'
    | 'ISL_API_PASSWORD'
    | 'ISL_SERVER_URL'
    | 'ISL_REMOTE_EXEC_ENABLED'
  >;
  wait: (ms: number) => Promise<unknown>;
  recordDiagnostic: typeof monitoringService.diagnostic;
}

export function createSupportService(dependencies: Partial<Dependencies> = {}) {
  const { repository, client, launcher, config, wait, recordDiagnostic }: Dependencies = {
    repository: supportRepository,
    client: isl,
    launcher: islLauncher,
    config: env,
    wait: setTimeout,
    recordDiagnostic: (id, action, content) => monitoringService.diagnostic(id, action, content),
    ...dependencies,
  };
  const getDevice = async (id: string, kind?: 'COMPUTER' | 'PRINTER') => {
    const device = await repository.byId(id);
    if (!device) throw new AppError(404, 'Equipamento não encontrado.');
    if (kind && device.kind !== kind)
      throw new AppError(
        400,
        kind === 'COMPUTER'
          ? 'Selecione um computador cadastrado.'
          : 'Selecione uma impressora cadastrada.',
      );
    return device;
  };
  const getJob = async (id: string) => {
    const job = await repository.job(id);
    if (!job) throw new AppError(404, 'Operação inexistente.');
    return job;
  };

  return {
    settings(): SupportSettings {
      return {
        mode: config.ISL_MODE,
        configured:
          config.ISL_MODE !== 'disabled' &&
          Boolean(config.ISL_API_USERNAME && config.ISL_API_PASSWORD),
        server:
          config.ISL_MODE === 'hosted'
            ? 'https://islonline.net'
            : config.ISL_MODE === 'self-hosted'
              ? config.ISL_SERVER_URL
              : null,
        remoteExecuteEnabled:
          config.ISL_MODE !== 'disabled' && config.ISL_REMOTE_EXEC_ENABLED === 'true',
        localLauncherReady: launcher.ready(),
        actions: [...actionList],
      };
    },
    computers: (search: string) => client.list(search),
    async details(id: string) {
      const device = await repository.details(id);
      if (!device) throw new AppError(404, 'Equipamento não encontrado.');
      return device;
    },
    async link(id: string, body: z.infer<typeof islLinkSchema>) {
      await getDevice(id, 'COMPUTER');
      const found = (await client.list(body.islComputerName ?? '')).find(
        (c) => c.id === body.islComputerId,
      );
      if (!found) throw new AppError(400, 'Computador não consta na lista ISL autorizada.');
      return repository.link(id, found);
    },
    async unlink(id: string) {
      await getDevice(id, 'COMPUTER');
      return repository.link(id, null);
    },
    async presence(id: string): Promise<IslPresence> {
      const device = await getDevice(id, 'COMPUTER');
      if (!device.islComputerId)
        throw new AppError(409, 'Vincule primeiro este computador ao ISL.');
      // Não interpretar ausência na conta autorizada como OFFLINE nem alterar o status manual.
      const computers = await client.list('');
      return {
        source: 'ISL',
        checkedAt: new Date().toISOString(),
        computer: computers.find((c) => c.id === device.islComputerId) ?? null,
      };
    },
    async configurePrinter(id: string, body: z.infer<typeof printerConfigSchema>) {
      await getDevice(id, 'PRINTER');
      return repository.configurePrinter(id, body);
    },
    async assign(id: string, printerId: string) {
      await getDevice(id, 'COMPUTER');
      await getDevice(printerId, 'PRINTER');
      return repository.assignPrinter(id, printerId);
    },
    async unassign(id: string, printerId: string) {
      await getDevice(id, 'COMPUTER');
      await getDevice(printerId, 'PRINTER');
      await repository.unassignPrinter(id, printerId);
    },
    async open(id: string) {
      const device = await getDevice(id, 'COMPUTER');
      if (!device.islComputerId)
        throw new AppError(409, 'Vincule primeiro este computador ao ISL.');
      await launcher.open(device.islComputerId);
      return { ok: true, message: 'ISL Light iniciado no computador onde a API está rodando.' };
    },
    async execute(id: string, body: z.infer<typeof supportExecutionSchema>) {
      if (config.ISL_MODE === 'disabled' || config.ISL_REMOTE_EXEC_ENABLED !== 'true')
        throw new AppError(
          403,
          'Execute remoto está desativado. Configure e homologue a integração antes de habilitar.',
        );
      if (body.action === 'clear_spooler' && !body.confirmDataLoss)
        throw new AppError(
          400,
          'A limpeza exige confirmação explícita da exclusão dos trabalhos de impressão.',
        );
      const device = await getDevice(id, 'COMPUTER');
      if (!device.islComputerId) throw new AppError(409, 'Computador não vinculado ao ISL.');
      const job = await repository.startJob(id, body.action);
      let providerStarted = false;
      try {
        const start = await client.actionStart(device.islComputerId, actionCommand(body.action));
        providerStarted = true;
        const actionId = inspectIslResponse(start, 'action_id');
        if (!actionId)
          throw new AppError(
            502,
            'ISL não retornou identificador da operação. Verifique no portal antes de repetir.',
          );
        // Preservar o ID mesmo se a autenticação ou a rede falhar depois.
        await repository.updateJob(job.id, { providerActionId: actionId });
        let challenge: string | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) await wait(300);
          challenge = inspectIslResponse(await client.actionInfo(actionId), 'chmd5');
          if (challenge) break;
        }
        if (!challenge)
          throw new AppError(
            409,
            'Desafio ISL ainda indisponível. Confira a operação no portal antes de repetir.',
          );
        await client.actionAuthenticate(
          device.islComputerId,
          actionId,
          challenge,
          body.accessPassword,
        );
        await repository.updateJob(job.id, {
          status: 'SUBMITTED',
          resultSummary: 'Autenticação enviada; aguardando relatório do ISL.',
        });
        return { jobId: job.id, status: 'SUBMITTED' };
      } catch (error) {
        // Falha de transporte após o envio não prova que o computador não executou a ação.
        await repository.updateJob(job.id, {
          status: 'REVIEW_REQUIRED',
          resultSummary: providerStarted
            ? 'Envio ou autenticação inconclusivos. Confira no portal ISL antes de repetir.'
            : 'Falha ou timeout ao iniciar. Confirme no portal ISL se houve execução antes de repetir.',
        });
        if (error instanceof AppError) throw error;
        throw new AppError(
          502,
          'Falha na operação ISL. Consulte o histórico e o portal antes de repetir.',
        );
      }
    },
    async job(id: string) {
      const record = await getJob(id);
      if (!record.providerActionId || !['STARTING', 'SUBMITTED'].includes(record.status))
        return record;
      const info = await client.actionInfo(record.providerActionId);
      if (!inspectIslResponse(info, 'fid')) return record;
      return repository.updateJob(id, {
        status: 'RESULT_AVAILABLE',
        resultSummary: 'Relatório disponível; consulte o conteúdo para confirmar o resultado.',
      });
    },
    async review(id: string) {
      const record = await getJob(id);
      if (!['STARTING', 'SUBMITTED', 'REVIEW_REQUIRED'].includes(record.status))
        throw new AppError(409, 'Esta operação já foi encerrada ou possui relatório.');
      return repository.updateJob(id, {
        status: 'REVIEWED',
        resultSummary:
          'Operador confirmou conferência manual no portal ISL. Este registro não comprova sucesso nem cancela a ação remota.',
      });
    },
    async result(id: string) {
      const record = await getJob(id);
      if (!record.providerActionId)
        throw new AppError(409, 'Operação sem identificador ISL disponível.');
      const info = await client.actionInfo(record.providerActionId);
      const fid = inspectIslResponse(info, 'fid'),
        file = inspectIslResponse(info, 'file');
      if (!fid || !file) throw new AppError(409, 'Resultado ainda não está disponível no ISL.');
      const content = await client.downloadResult(fid, file);
      await recordDiagnostic(record.deviceId, record.action, content);
      // Relatório disponível não significa reparo bem-sucedido. Nunca persistir sua saída bruta.
      if (record.status === 'SUBMITTED' || record.status === 'STARTING') {
        await repository.updateJob(id, {
          status: 'RESULT_AVAILABLE',
          resultSummary: 'Relatório recebido; confira o conteúdo e o equipamento.',
        });
      }
      return { content };
    },
  };
}

export const supportService = createSupportService();
