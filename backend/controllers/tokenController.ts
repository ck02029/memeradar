import { FastifyRequest, FastifyReply } from 'fastify';
import { aggregatorService } from '../services/aggregatorService';
import { PaginationParams } from '../types';

export class TokenController {
  
  /**
   * GET /api/tokens
   * Returns the aggregated list of tokens from the cache with pagination.
   */
  getTokens = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as Record<string, string>;
      
      const params: PaginationParams = {
        limit: query.limit ? parseInt(query.limit) : 20,
        cursor: query.cursor,
        sortBy: query.sortBy,
        sortDir: (query.sortDir === 'asc' || query.sortDir === 'desc') ? query.sortDir : 'desc',
        search: query.search,
        timeFrame: query.timeFrame
      };

      const result = await aggregatorService.getAggregatedTokens(params);
      
      return reply.status(200).send({
        success: true,
        data: result.items,
        pagination: {
          nextCursor: result.nextCursor,
          total: result.total
        }
      });
    } catch (error) {
      console.error('[TokenController] Error:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Internal Server Error' 
      });
    }
  }
}

export const tokenController = new TokenController();
