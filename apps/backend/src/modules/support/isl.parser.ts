import type { IslComputer } from '@infra/contracts';
type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const firstString = (object: Obj, keys: string[]) =>
  keys.map((k) => object[k]).find((x) => typeof x === 'string' && x.length > 0) as
    string | undefined;

export function parseComputers(input: unknown): IslComputer[] {
  const data = isObject(input) && 'data' in input ? input.data : input;
  // Respostas variam entre versões de WebAPI2; falhar explicitamente diante de formato desconhecido.
  const options = [
    data,
    isObject(data) ? data.computers : null,
    isObject(data) ? data.items : null,
    isObject(data) ? data.list : null,
    isObject(data) ? data.results : null,
  ];
  const rows = options.find(Array.isArray) as unknown[] | undefined;
  if (!rows)
    throw new Error('Formato de lista ISL desconhecido. Verifique a versão do WebAPI2 no portal.');
  const computers = rows
    .filter(isObject)
    .map((r) => ({
      id: firstString(r, ['co_id', 'id']) ?? '',
      name: firstString(r, ['alias', 'name', 'computer_name', 'hostname', 'host']) ?? '(sem nome)',
      status: String(r.status ?? r.state ?? 'UNKNOWN'),
      hostName: firstString(r, ['computer_name', 'hostname', 'host']) ?? null,
    }))
    .filter((c) => Boolean(c.id));
  if (rows.length && !computers.length)
    throw new Error('Lista ISL não contém identificadores de computadores reconhecidos.');
  return computers;
}
