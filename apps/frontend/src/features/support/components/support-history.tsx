'use client';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { secureRequest } from '../api';
import type { SupportDevice } from '../types';

interface Props {
  jobs: SupportDevice['supportJobs'];
  accessKey: string;
  working: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  onMessage: (message: string) => void;
  onReport: (action: string, content: string) => void;
}

export function SupportHistory({ jobs, accessKey, working, run, onMessage, onReport }: Props) {
  if (!jobs.length) return null;
  return (
    <>
      <h4>
        <ClipboardList size={15} /> Histórico de solicitações
      </h4>
      {jobs.slice(0, 8).map((job) => (
        <div className="support-result" key={job.id}>
          <div>
            <strong>{job.action}</strong>
            <small>
              {job.status} · {new Date(job.createdAt).toLocaleString('pt-BR')}
            </small>
            {job.resultSummary && <small>{job.resultSummary}</small>}
          </div>
          <div className="support-actions">
            <button
              className="btn icon-btn"
              title="Consultar status"
              aria-label="Consultar status da operação"
              disabled={working}
              onClick={() =>
                void run(async () => {
                  const result = await secureRequest<{ status: string; resultSummary?: string }>(
                    `/jobs/${job.id}`,
                    accessKey,
                  );
                  onMessage(`${result.status}: ${result.resultSummary ?? ''}`);
                })
              }
            >
              <ChevronDown size={14} />
            </button>
            <button
              className="btn icon-btn"
              title="Ler resultado"
              aria-label="Ler resultado da operação"
              disabled={working}
              onClick={() =>
                void run(async () => {
                  const result = await secureRequest<{ content: string }>(
                    `/jobs/${job.id}/result`,
                    accessKey,
                  );
                  onReport(job.action, result.content);
                  onMessage('Relatório recebido do ISL; confira o conteúdo.');
                })
              }
            >
              <ClipboardList size={14} />
            </button>
            {['STARTING', 'SUBMITTED', 'REVIEW_REQUIRED'].includes(job.status) && (
              <button
                className="btn"
                disabled={working}
                onClick={() =>
                  void run(async () => {
                    if (
                      !window.confirm(
                        'Você conferiu esta operação e seu resultado no portal ISL? Encerrar o registro libera novas solicitações, mas não cancela uma execução remota em andamento nem comprova sucesso.',
                      )
                    )
                      return;
                    await secureRequest(`/jobs/${job.id}/review`, accessKey, {
                      method: 'POST',
                      body: JSON.stringify({ confirm: true }),
                    });
                    onMessage('Conferência manual registrada.');
                  })
                }
              >
                Registrar conferência manual
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
