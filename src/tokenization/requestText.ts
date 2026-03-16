import type {
  MessageLike,
  MessagesRequestLike,
  RequestLike,
  RequestRecord,
  RequestRecordValue,
} from '../types/requests.js';

const isStringArray = (value: RequestRecordValue): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isMessageLikeArray = (value: RequestRecordValue): value is MessageLike[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null);
};

const isMessageLike = (value: RequestLike): value is MessageLike => {
  return typeof value === 'object' && value !== null && ('content' in value || 'role' in value);
};

const isMessagesRequestLike = (value: RequestLike): value is MessagesRequestLike => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'messages' in value &&
    Array.isArray(value.messages)
  );
};

const isRequestRecord = (value: RequestLike): value is RequestRecord => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('messages' in value) &&
    !('content' in value) &&
    !('role' in value)
  );
};

const extractFromMessage = (message: MessageLike): string => {
  const parts: string[] = [];

  if (message.role) {
    parts.push(message.role);
  }

  if (message.content) {
    parts.push(message.content);
  }

  return parts.join(' ');
};

export const extractTextForEstimation = (request: RequestLike | undefined): string => {
  if (request === undefined) return '';

  if (typeof request === 'string') return request;

  if (isMessagesRequestLike(request))
    return request.messages?.map(extractFromMessage).join(' ') || '';

  if (isMessageLike(request)) return extractFromMessage(request);

  if (isRequestRecord(request)) {
    const parts: string[] = [];

    for (const key in request) {
      const value = request[key];

      if (typeof value === 'string') {
        parts.push(value);
        continue;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        parts.push(String(value));
        continue;
      }

      if (isStringArray(value)) {
        parts.push(value.join(' '));
        continue;
      }

      if (isMessageLikeArray(value)) parts.push(value.map(extractFromMessage).join(' '));
    }

    return parts.join(' ');
  }

  return '';
};
