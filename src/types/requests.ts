export interface MessageLike {
  role?: string;
  content?: string;
}

export interface MessagesRequestLike {
  messages?: MessageLike[];
}

export type RequestRecordValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | MessageLike[];

export type RequestRecord = Record<string, RequestRecordValue>;

export type RequestLike = string | MessageLike | MessagesRequestLike | RequestRecord;
