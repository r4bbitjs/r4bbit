import { getClient } from '../src/Client/client';
import { getServer } from '../src/Server/server';
import { Reply, RpcHandler } from '../src/Server/server.type';

const localUrl = 'amqp://guest:guest@localhost:5672/';

(async () => {
  const server = await getServer(localUrl);
  const client = await getClient(localUrl);

  const handler: RpcHandler =
    (reply: Reply) => (msg: Record<string, unknown> | string) => {
      const processingTime = 500;
      setTimeout(async () => {
        if (!msg) {
          return;
        }
        console.log('incomin message', msg);
        await reply(msg);
      }, processingTime);
    };

  const exchangeName = 'testExchange';
  const objectMessage = { message: 'OurMessage' };
  const routingKey = 'testRoutingKey';
  const serverQueueName = 'testServerQueue';
  const replyQueueName = 'testReplyQueue';

  await server.registerRPCRoute(
    {
      queueName: serverQueueName,
      routingKey,
      exchangeName,
    },
    handler,
    {
      replySignature: 'server-1',
    }
  );

  await server.registerRPCRoute(
    {
      queueName: 'complete-different-queue',
      routingKey,
      exchangeName,
    },
    handler,
    {
      replySignature: 'server-2',
    }
  );

  await server.registerRPCRoute(
    {
      queueName: 'complete-different-queue-123',
      routingKey,
      exchangeName,
    },
    handler,
    {
      replySignature: 'server-3',
    }
  );

  const response = await client.publishMultipleRPC(
    objectMessage,
    {
      exchangeName,
      routingKey,
      replyQueueName,
    },
    {
      timeout: 2_000,
      responseContains: {
        content: true,
        headers: true,
        signature: true,
      },
      handler: async (msg) => {
        let file: number;
        switch (msg.signature) {
          case 'server-1':
            file = await new Promise((resolve) =>
              setTimeout(() => resolve(123), 1000)
            );
            console.log('file', file);
            console.log('Server-1 Received:', msg);
            break;
          case 'server-2':
            console.log('Server-2 Received:', msg);
            break;
          default:
            await new Promise((r) => setTimeout(r, 1000));
            console.log('Unknown resource Received', msg);
        }
      },
    }
  );

  console.log('response', response, typeof response);
})();
