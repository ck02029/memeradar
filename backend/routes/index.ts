import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tokenController } from '../controllers/tokenController';

export function registerRoutes(fastify: any) {
  
  // Token Routes
  fastify.get('/api/tokens', tokenController.getTokens);
  
  // Health Check
  fastify.get('/health', (req: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'ok', timestamp: Date.now() });
  });

}