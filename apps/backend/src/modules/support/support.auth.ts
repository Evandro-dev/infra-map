import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';

// O mapa permanece sem login, mas TODO endpoint de suporte exige segredo local separado.
// Nunca incluir este token em NEXT_PUBLIC_*, no código-fonte ou em links.
export async function requireSupportOperator(req: FastifyRequest, reply: FastifyReply) {
  const configured = env.SUPPORT_OPERATOR_TOKEN;
  if (configured.length < 32) {
    return reply
      .code(503)
      .send({ error: 'Configure SUPPORT_OPERATOR_TOKEN (32+ caracteres) no backend/.env.' });
  }
  const supplied = req.headers['x-support-token'];
  const token = typeof supplied === 'string' ? supplied : '';
  const a = Buffer.from(configured),
    b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return reply.code(401).send({ error: 'Chave de suporte inválida.' });
}
