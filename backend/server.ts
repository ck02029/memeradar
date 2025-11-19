import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';
import { wss } from './services/socketServer';

const PORT = parseInt(process.env.PORT || '3000');

const app = Fastify({
  logger: true
});

// Register Middleware
app.register(cors, {
  origin: '*', // Allow all origins for demo purposes
  methods: ['GET', 'POST']
});

// Register Routes
registerRoutes(app);

// Start Server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Server] HTTP API running on http://localhost:${PORT}`);
    
    // Initialize WebSocket Server (attached to same port conceptually, or separate)
    // wss is self-initializing in its file
  } catch (err) {
    app.log.error(err);
    (process as any).exit(1);
  }
};

start();

export default app;