import { Options } from 'amqp-connection-manager';
import { MessageType } from '../Common/types';

export type ClientConnection = {
  exchangeName: string;
  routingKey: string;
};

export type ClientConnectionRPC = {
  exchangeName: string;
  routingKey: string;
  replyQueueName: string;
};

export type ClientRPCOptions = {
  sendType?: MessageType;
  receiveType?: MessageType;
  amqpOptions?: Options.Publish;
};
