import { describe, expect, it } from 'vitest';

import { estimateInputTokens } from '../src/index.js';
import { extractTextForEstimation } from '../src/tokenization/requestText.js';

describe('tokenization', () => {
  it('extracts text from string request', () => {
    const text = extractTextForEstimation('Hello world');
    expect(text).toBe('Hello world');
  });

  it('extracts text from messages request', () => {
    const text = extractTextForEstimation({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(text).toContain('You are helpful');
    expect(text).toContain('Hello');
  });

  it('returns 0 tokens for empty request', () => {
    expect(estimateInputTokens(undefined)).toBe(0);
    expect(estimateInputTokens('')).toBe(0);
  });

  it('estimates tokens from string request', () => {
    const tokens = estimateInputTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  it('estimates tokens from messages request', () => {
    const tokens = estimateInputTokens({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(tokens).toBeGreaterThan(0);
  });
});
