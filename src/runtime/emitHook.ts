import type { MaybePromise } from '../types/storage.js';

export type HookHandler<TEvent> = (event: TEvent) => MaybePromise<void>;

export const emitHook = async <TEvent>(
  hook: HookHandler<TEvent> | undefined,
  event: TEvent,
): Promise<void> => {
  if (hook === undefined) return;

  try {
    await hook(event);
  } catch {
    // hook errors must not break the main guard flow
  }
};
