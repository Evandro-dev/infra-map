import { z } from 'zod';

export const managedCredentialProviderSchema = z.literal('WINDOWS_PRINT_SERVER');
export type ManagedCredentialProvider = z.infer<typeof managedCredentialProviderSchema>;

export const createWindowsPrintCredentialSchema = z
  .object({
    provider: managedCredentialProviderSchema,
    name: z.string().trim().min(1).max(120),
    targetServer: z.string().trim().max(180).optional().default(''),
    username: z.string().trim().min(1).max(180),
    password: z.string().min(1).max(512),
  })
  .strict();
export type CreateWindowsPrintCredential = z.infer<typeof createWindowsPrintCredentialSchema>;

export const updateManagedCredentialSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    targetServer: z.string().trim().max(180).optional().default(''),
    replaceAccount: z.boolean().default(false),
    username: z.string().trim().max(180).optional().default(''),
    password: z.string().max(512).optional().default(''),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.replaceAccount) return;
    if (!value.username)
      context.addIssue({ code: 'custom', path: ['username'], message: 'Informe o usuário.' });
    if (!value.password)
      context.addIssue({ code: 'custom', path: ['password'], message: 'Informe a senha.' });
  });
export type UpdateManagedCredential = z.infer<typeof updateManagedCredentialSchema>;

export interface ManagedCredentialSummary {
  id: string;
  provider: ManagedCredentialProvider;
  name: string;
  targetServer: string | null;
  createdAt: string;
  updatedAt: string;
}
