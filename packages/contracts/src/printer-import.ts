import { z } from 'zod';

const printerSourceSchema = z
  .object({
    nome_amigavel_sugerido: z.string().trim().min(1).max(120),
    setor_ou_local: z.string().max(400),
    fabricante: z.string().max(120),
    modelo: z.string().max(120),
    ip: z.union([z.ipv4(), z.ipv6()]),
    mac_address: z
      .string()
      .regex(/^([\da-f]{2}:){5}[\da-f]{2}$/i)
      .nullable(),
    servidor_impressao: z.string().trim().min(1).max(180),
    nome_compartilhamento: z.string().trim().min(1).max(180),
    caminho_compartilhado: z.string().max(400),
    driver_no_servidor: z.string().max(180),
    nome_da_fila_no_servidor_observado: z.string().max(180).optional(),
    porta_no_servidor: z.string().max(180).optional(),
    campos_a_confirmar: z.array(z.string().max(200)).max(30),
    status_e_validacao: z.object({ teste_de_impressao: z.string().max(1000) }).passthrough(),
  })
  .passthrough();

export const printerImportSchema = z
  .object({
    empresa_unidade: z.string().min(1).max(200),
    data_do_cadastro: z.iso.date(),
    impressoras: z.array(printerSourceSchema).min(1).max(100),
  })
  .passthrough();

export interface PrinterImportResult {
  applied: boolean;
  created: number;
  skipped: number;
  printers: Array<{ name: string; share: string; outcome: 'CREATE' | 'SKIP' }>;
}
