import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { readLimitedText } from '../../shared/http.js';
import { parseComputers } from './isl.parser.js';

type Obj = Record<string, unknown>;
type IslConfig = Pick<
  typeof env,
  'ISL_MODE' | 'ISL_SERVER_URL' | 'ISL_API_USERNAME' | 'ISL_API_PASSWORD'
>;
const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class IslClient {
  private sid: string | null = null;
  private expiry = 0;
  private loginPending: Promise<string> | null = null;

  constructor(
    private readonly config: IslConfig = env,
    private readonly request: typeof fetch = fetch,
  ) {}

  private baseUrl() {
    if (this.config.ISL_MODE === 'disabled')
      throw new AppError(503, 'Integração ISL desligada. Configure o modo de integração.');
    const base =
      this.config.ISL_MODE === 'hosted' ? 'https://islonline.net' : this.config.ISL_SERVER_URL;
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      throw new AppError(503, 'Endereço do servidor ISL inválido.');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new AppError(
        503,
        'O servidor ISL deve ser uma origem HTTPS, sem caminho ou credenciais.',
      );
    }
    return url.origin;
  }

  private async call(method: string, args: Obj = {}, authenticated = true): Promise<unknown> {
    const base = this.baseUrl();
    const body = new URLSearchParams({
      method,
      he: 'JSON1',
      ho: 'JSON1',
      hedata: JSON.stringify(args),
    });
    if (authenticated) body.set('hs', await this.login());
    try {
      const response = await this.request(`${base}/webapi2`, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      const raw: unknown = JSON.parse(await readLimitedText(response, 2_000_000));
      if (!isObject(raw) || !isObject(raw.result))
        throw new AppError(502, 'Resposta inesperada da API ISL.');
      if (raw.result.code !== 'OK') {
        // Descrições do provedor podem conter parâmetros e segredos. Não propagá-las.
        this.sid = null;
        this.expiry = 0;
        throw new AppError(
          502,
          'O ISL recusou a solicitação. Confira credenciais e permissões no portal.',
        );
      }
      if (typeof raw.result.hs === 'string' && raw.result.hs.length > 0) {
        this.sid = raw.result.hs;
        this.expiry = Date.now() + 8 * 60 * 1000;
      }
      return raw.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        502,
        'Falha ao comunicar com o ISL. Confira disponibilidade, TLS e configuração.',
      );
    }
  }

  private async login(): Promise<string> {
    if (this.sid && Date.now() < this.expiry) return this.sid;
    if (this.loginPending) return this.loginPending;
    this.loginPending = this.authenticate();
    try {
      return await this.loginPending;
    } finally {
      this.loginPending = null;
    }
  }

  private async authenticate(): Promise<string> {
    if (!this.config.ISL_API_USERNAME || !this.config.ISL_API_PASSWORD)
      throw new AppError(503, 'Credenciais ISL pendentes.');
    const data = await this.call(
      'utils/login/1',
      { user: this.config.ISL_API_USERNAME, pwd: this.config.ISL_API_PASSWORD },
      false,
    );
    if (!isObject(data) || typeof data.sid !== 'string' || !data.sid)
      throw new AppError(502, 'Login ISL sem identificador de sessão.');
    this.sid ??= data.sid;
    this.expiry = Date.now() + 8 * 60 * 1000;
    return this.sid;
  }

  async list(search: string) {
    const data = await this.call('islalwayson/computer/search/1', {
      simple_search: 'true',
      search,
    });
    try {
      return parseComputers(data);
    } catch {
      throw new AppError(502, 'Formato de lista ISL desconhecido. Confira a versão da WebAPI2.');
    }
  }

  actionStart(coId: string, args: string[]) {
    return this.call('islalwayson/actions/start/1', {
      co_id: coId,
      name: 'execute',
      arguments: args,
    });
  }

  actionInfo(actionId: string) {
    return this.call('islalwayson/actions/info/1', {
      action_id: actionId,
      info: 'computers',
      events: 'true',
    });
  }

  actionAuthenticate(coId: string, actionId: string, challenge: string, accessPassword: string) {
    return this.call('islalwayson/actions/authenticate/1', {
      co_id: coId,
      action_id: actionId,
      chmd5: challenge,
      plain_password: accessPassword,
    });
  }

  async downloadResult(fid: string, file: string) {
    const response = await this.call('islalwayson/file/download/1', { fid, file, type: 'file' });
    const location =
      typeof response === 'string'
        ? response
        : (inspectIslResponse(response, 'url') ??
          inspectIslResponse(response, 'link') ??
          inspectIslResponse(response, 'download'));
    if (!location)
      throw new AppError(409, 'Link de resultado desconhecido. Consulte o portal ISL.');
    const host = new URL(this.baseUrl());
    let target: URL;
    try {
      target = new URL(location, host);
    } catch {
      throw new AppError(502, 'Link de resultado inválido.');
    }
    if (
      target.origin !== host.origin ||
      target.protocol !== 'https:' ||
      target.username ||
      target.password
    ) {
      throw new AppError(409, 'Resultado em endereço externo. Consulte o arquivo pelo portal ISL.');
    }
    try {
      const downloaded = await this.request(target, {
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      return await readLimitedText(downloaded, 128_000);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'Não foi possível baixar o relatório ISL.');
    }
  }
}

// Respostas de actions/info contêm objetos e arrays de eventos/computadores.
export function inspectIslResponse(response: unknown, key: string): string | null {
  const find = (value: unknown, depth: number): string | null => {
    if (depth > 8 || typeof value !== 'object' || value === null) return null;
    if (isObject(value) && (typeof value[key] === 'string' || typeof value[key] === 'number'))
      return String(value[key]);
    for (const child of Object.values(value)) {
      const found = find(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return find(response, 0);
}

export const isl = new IslClient();
