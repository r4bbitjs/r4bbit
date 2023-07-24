import { ChannelWrapper, ConnectionUrl } from 'amqp-connection-manager';
import { ConsumeMessage } from 'amqplib';
import { encodeMessage } from '../Common/encodeMessage/encodeMessage';
import { prepareHeaders } from '../Common/prepareHeaders/prepareHeaders';
import { HEADER_RECEIVE_TYPE } from '../Common/types';
import { initRabbit } from '../Init/init';
import { InitRabbitOptions } from '../Init/init.type';
import {
  AckHandler,
  Handler,
  RpcHandler,
  ServerConnection,
  ServerRPCOptions,
  ServerOptions,
} from './server.type';
import { ConnectionSet } from '../Common/cache/cache';
import { logMqClose } from '../Common/logger/utils/logMqMessage';
import { prepareResponse } from '../Common/prepareResponse/prepareResponse';
import { extractAndSetReqId } from '../Common/RequestTracer/extractAndSetReqId';
import { logger } from '../Common/logger/logger';

/**
 * Server class is used to register routes to receive messages
 * @example
 * ```ts
 * const server = await getServer('amqp://localhost');
 * await server.registerRoute(
 *  {
 *    exchangeName: 'exchangeName',
 *    queueName: 'queueName',
 *    routingKey: 'routingKey',
 *  },
 *  async (message) => {
 *    console.log(message);
 *    return 'Hello World';
 *  },
 * );
 * ```
 */
export class Server {
  private channelWrapper?: ChannelWrapper;

  /**
   * Server initializes the connection to RabbitMQ
   * It is only used internally, users should not use it
   * @param connectionUrls - connection url or array of connection urls
   * @param options - options for the server
   * @returns void
   */
  public init = async (
    connectionUrls: ConnectionUrl | ConnectionUrl[],
    options?: InitRabbitOptions
  ): Promise<void> => {
    this.channelWrapper = await initRabbit(connectionUrls, options);
  };

  /**
   * It returns amqplib-connection-manager's channel wrapper
   * It is only used internally, users should not use it
   * @returns ChannelWrapper
   */
  public getWrapper(): ChannelWrapper {
    if (!this.channelWrapper) {
      throw new Error('You have to trigger init method first');
    }

    return this.channelWrapper;
  }

  /**
   * Server registers a route to receive messages
   * @param connection - connection object
   * @param handlerFunction - function to handle received message
   * @param options - options for the server
   * @returns void
   * @example
   * ```ts
   * const server = await getServer('amqp://localhost');
   * await server.registerRoute(
   *  {
   *   exchangeName: 'exchangeName',
   *  queueName: 'queueName',
   * routingKey: 'routingKey',
   * },
   * async (message) => {
   * console.log(message);
   * return 'Hello World';
   * },
   * );
   * ```
   * @example
   * ```ts
   * const server = await getServer('amqp://localhost');
   * await server.registerRoute(
   * {
   *  exchangeName: 'exchangeName',
   * queueName: 'queueName',
   * routingKey: 'routingKey',
   * },
   * async (message) => {
   * console.log(message);
   * return 'Hello World';
   * },
   * {
   * consumeOptions: {
   * noAck: true,
   * },
   * responseContains: {
   * signature: false,
   * },
   * loggerOptions: {
   * isDataHidden: false,
   * },
   * },
   * );
   * ```
   */
  async registerRoute(
    connection: ServerConnection,
    handlerFunction: Handler | AckHandler,
    options?: ServerOptions
  ): Promise<void> {
    if (!this.channelWrapper) {
      throw new Error('You have to trigger init method first');
    }
    let tempRequestId: string | undefined;

    const { exchangeName, queueName, routingKey } = connection;

    const simpleAck = (consumeMessage: ConsumeMessage): (() => void) => {
      return () => this.channelWrapper?.ack(consumeMessage);
    };

    const simpleNack = (consumeMessage: ConsumeMessage): (() => void) => {
      return () => this.channelWrapper?.nack(consumeMessage);
    };

    const defaultConsumerOptions = options?.consumeOptions ?? { noAck: false };

    try {
      await ConnectionSet.assert(
        this.channelWrapper,
        exchangeName,
        queueName,
        routingKey
      );

      await this.channelWrapper.consume(
        queueName,
        (msg: ConsumeMessage) => {
          // if in options ack => ack !== undef (with acknowledgment)
          // if in options nack => ack === undef (no acknowledgment)
          const onMessage = !options?.consumeOptions?.noAck
            ? (handlerFunction as AckHandler)({
                ack: simpleAck(msg),
                nack: simpleNack(msg),
              })
            : (handlerFunction as Handler);
          // if in options responseContains => prepareResponse
          const preparedResponse = prepareResponse(
            msg,
            options?.responseContains
          );

          const reqId = extractAndSetReqId(msg.properties.headers);
          tempRequestId = reqId;

          // if preparedResponse pass to the handlerFunc
          logger.communicationLog({
            data: preparedResponse,
            actor: 'Server',
            topic: routingKey,
            isDataHidden: options?.loggerOptions?.isDataHidden,
            action: 'receive',
            requestId: reqId,
          });
          return onMessage(preparedResponse);
        },
        defaultConsumerOptions
      );
    } catch (err) {
      logger.communicationLog({
        level: 'error',
        error: {
          description: '💥 An error occurred while receiving message',
          message: (err as Error).message,
          stack: (err as Error).stack || '',
        },
        action: 'receive',
        data: {},
        actor: 'Server',
        topic: routingKey,
        isDataHidden: false,
        requestId: tempRequestId,
      });
      throw err;
    }
  }

  /**
   * Server registers an RPC route to receive and reply to messages
   * @param connection - connection object
   * @param handlerFunction - function to handle received message
   * @param options - options for the server
   * @returns void
   * @example
   * ```ts
   * const server = await getServer('amqp://localhost');
   * await server.registerRPCRoute(
   * {
   * exchangeName: 'exchangeName',
   * queueName: 'queueName',
   * routingKey: 'routingKey',
   * },
   * async (message) => {
   * console.log(message);
   * return 'Hello World';
   * },
   * );
   * ```
   * @example
   * ```ts
   * const server = await getServer('amqp://localhost');
   * await server.registerRPCRoute(
   * {
   * exchangeName: 'exchangeName',
   * queueName: 'queueName',
   * routingKey: 'routingKey',
   * },
   * async (message) => {
   * console.log(message);
   * return 'Hello World';
   * },
   * {
   * consumeOptions: {
   * noAck: true,
   * },
   * responseContains: {
   * signature: false,
   * },
   * loggerOptions: {
   * isDataHidden: false,
   * },
   * },
   * );
   * ```
   */
  async registerRPCRoute(
    connection: ServerConnection,
    handlerFunction: RpcHandler,
    options?: ServerRPCOptions
  ): Promise<void> {
    if (!this.channelWrapper) {
      throw new Error('You have to trigger init method first');
    }
    let tempRequestId: string | undefined;
    const { exchangeName, queueName, routingKey } = connection;

    const reply =
      (consumedMessage: ConsumeMessage | null) =>
      async (replyMessage: Record<string, unknown> | string) => {
        if (!this.channelWrapper) {
          throw new Error('You have to trigger init method first');
        }

        if (!consumedMessage) {
          throw new Error('Consume message cannot be null');
        }

        const { replyTo, correlationId } = consumedMessage.properties;

        const receiveType =
          consumedMessage.properties.headers[HEADER_RECEIVE_TYPE];

        const reqId = extractAndSetReqId(consumedMessage.properties.headers);
        tempRequestId = reqId;
        logger.communicationLog({
          data: replyMessage,
          actor: 'Rpc Server',
          topic: replyTo,
          isDataHidden: options?.loggerOptions?.isConsumeDataHidden,
          action: 'publish',
          requestId: reqId,
        });
        try {
          await this.channelWrapper.publish(
            exchangeName,
            replyTo,
            encodeMessage(replyMessage, receiveType),
            {
              ...options?.publishOptions,
              correlationId,
              headers: prepareHeaders({
                isServer: true,
                signature: options?.replySignature,
                receiveType: receiveType,
                requestId: reqId,
              }),
            }
          );

          this.channelWrapper.ack.call(this.channelWrapper, consumedMessage);
        } catch (err) {
          logger.communicationLog({
            level: 'error',
            error: {
              description: '💥 An error occurred while sending message',
              message: (err as Error).message,
              stack: (err as Error).stack || '',
            },
            action: 'publish',
            data: replyMessage,
            actor: 'Rpc Server',
            topic: routingKey,
            isDataHidden: options?.loggerOptions?.isSendDataHidden,
            requestId: tempRequestId,
          });
        }
      };

    await ConnectionSet.assert(
      this.channelWrapper,
      exchangeName,
      queueName,
      routingKey
    );

    try {
      await this.channelWrapper.consume(
        queueName,
        (consumeMessage) => {
          console.log(
            'Server received the log',
            consumeMessage.properties.headers
          );
          const reqId = extractAndSetReqId(consumeMessage.properties.headers);
          const preparedResponse = prepareResponse(consumeMessage, {
            ...options?.responseContains,
            signature: false,
          });
          logger.communicationLog({
            data: preparedResponse,
            actor: 'Rpc Server',
            topic: routingKey,
            isDataHidden: options?.loggerOptions?.isConsumeDataHidden,
            action: 'receive',
            requestId: reqId,
          });
          return handlerFunction(reply(consumeMessage))(preparedResponse);
        },
        options?.consumeOptions
      );
    } catch (err) {
      logger.communicationLog({
        level: 'error',
        error: {
          description: '💥 An error occurred while receiving message',
          message: (err as Error).message,
          stack: (err as Error).stack || '',
        },
        action: 'receive',
        data: {},
        actor: 'Rpc Server',
        topic: routingKey,
        isDataHidden: options?.loggerOptions?.isConsumeDataHidden,
        requestId: tempRequestId,
      });
    }
  }

  /**
   * Closes the connection
   * @returns Promise<void>
   * @example
   * ```ts
   * const server = await getServer('amqp://localhost');
   * await server.close();
   * ```
   */
  async close() {
    logMqClose('Server');
    const channelWrapper = this.getWrapper();
    await channelWrapper.cancelAll();
    await channelWrapper.close();
  }
}

let server: Server;
/**
 * It makes a RabbitMQ connection and returns a singleton Server instance
 * @param connectionUrls - connection url or array of connection urls
 * @param options - options for the server
 * @returns Server
 * @example
 * ```ts
 * const server = await getServer('amqp://localhost');
 * ```
 */
export const getServer = async (
  connectionUrls: ConnectionUrl | ConnectionUrl[],
  options?: InitRabbitOptions
) => {
  if (!server) {
    server = new Server();
    await server.init(connectionUrls, options);
  }

  return server;
};
