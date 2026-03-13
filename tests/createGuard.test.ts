import { describe, expect, it, vi } from "vitest";

import { createGuard, MissingModelError, MissingProjectIdError, MissingProviderIdError } from "../src/index.js";

describe("createGuard", () => {
  it("creates guard with default hard mode", () => {
    const guard = createGuard();
    expect(guard.config.mode).toBe("hard");
  });

  it("uses provided mode", () => {
    const guard = createGuard({ mode: "soft" });
    expect(guard.config.mode).toBe("soft");
  });

  it("uses context.project.id when provided", async () => {
    const guard = createGuard({ defaultProjectId: "default-project" });
    const result = await guard.run(
      {
        project: { id: "request-project" },
        provider: { id: "openai", model: "gpt-4o-mini" }
      },
      async () => ({ ok: true })
    );

    expect(result.context).toEqual({
      project: { id: "request-project" },
      provider: { id: "openai", model: "gpt-4o-mini" },
      attribution: { tags: [] },
      metadata: {},
      request: undefined,
    });
  });

  it("uses config.defaultProjectId when context.project.id is missing", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    const result = await guard.run(
      { provider: { id: "openai", model: "gpt-4o-mini" } },
      async () => ({ ok: true })
    );

    expect(result.result).toEqual({ ok: true });
    expect(result.context).toEqual({
      project: { id: "app-main" },
      provider: { id: "openai", model: "gpt-4o-mini" },
      attribution: { tags: [] },
      metadata: {},
      request: undefined,
    });
    expect(result.decision.allowed).toBe(true);
  });

  it("throws MissingProjectIdError when neither context.project.id nor config.defaultProjectId is provided", async () => {
    const guard = createGuard();

    await expect(
      guard.run(
        { provider: { id: "openai", model: "gpt-4o-mini" } },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingProjectIdError);
  });

  it("throws MissingProviderIdError when providerId is missing", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    await expect(
      guard.run({ provider: { model: "gpt-4o-mini" } }, async () => ({ ok: true }))
    ).rejects.toBeInstanceOf(MissingProviderIdError);
  });

  it("throws MissingProviderIdError when providerId is empty string", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    await expect(
      guard.run(
        { provider: { id: "   ", model: "gpt-4o-mini" } },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingProviderIdError);
  });

  it("throws MissingModelError when model is empty string", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    await expect(
      guard.run(
        { provider: { id: "openai", model: "   " } },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingModelError);
  });

  it("does not call execute when run context validation fails", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });
    const execute = vi.fn(async () => ({ ok: true }));

    await expect(
      guard.run(
        { provider: { id: "", model: "gpt-4o-mini" } },
        execute
      )
    ).rejects.toBeInstanceOf(MissingProviderIdError);

    expect(execute).not.toHaveBeenCalled();
  });

  it("calls execute exactly once for valid context", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });
    const execute = vi.fn(async () => ({ ok: true }));

    await guard.run(
      { provider: { id: "openai", model: "gpt-4o-mini" } },
      execute
    );

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns allowed decision and resolved context for successful execution", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    const result = await guard.run(
      { provider: { id: "openai", model: "gpt-4o-mini" } },
      async () => ({ text: "hello" })
    );

    expect(result).toEqual({
      result: { text: "hello" },
      context: {
        project: { id: "app-main" },
        provider: { id: "openai", model: "gpt-4o-mini" },
        attribution: { tags: [] },
        metadata: {},
        request: undefined,
      },
      decision: { allowed: true },
    });
  });

  it("resolves nested context and calls execute", async () => {
    const guard = createGuard({ defaultProjectId: "default-project" });
    const result = await guard.run(
      {
        provider: { id: "openai", model: "gpt-4o-mini" },
      },
      async (context) => {
        expect(context).toEqual({
          project: { id: "default-project" },
          provider: { id: "openai", model: "gpt-4o-mini" },
          attribution: { tags: [] },
          metadata: {},
        });

        return "ok";
      }
    );

    expect(result.result).toBe("ok");
    expect(result.decision.allowed).toBe(true);
  });

  it("prefers context project.id over defaultProjectId", async () => {
    const guard = createGuard({ defaultProjectId: "default-project" });
    const result = await guard.run(
      {
        project: { id: "project-1" },
        provider: { id: "openai", model: "gpt-4o-mini" },
      },
      async (context) => context.project.id
    );

    expect(result.result).toBe("project-1");
  });

  it("trims nested string fields", async () => {
    const guard = createGuard();
    const result = await guard.run(
      {
        project: { id: "  app-1  " },
        provider: { id: "  openai  ", model: "  gpt-4o-mini  " },
        user: { id: "  user-1  " },
        attribution: { feature: "  chat  ", endpoint: "  /api/chat  " },
      },
      async (context) => context
    );

    expect(result.context).toEqual({
      project: { id: "app-1" },
      provider: { id: "openai", model: "gpt-4o-mini" },
      user: { id: "user-1" },
      attribution: { feature: "chat", endpoint: "/api/chat", tags: [] },
      metadata: {},
    });
  });

  it("normalizes and deduplicates tags", async () => {
    const guard = createGuard();
    const result = await guard.run(
      {
        project: { id: "p1" },
        provider: { id: "openai", model: "gpt-4o-mini" },
        attribution: {
          tags: [" chat ", "", "prod", "chat", "prod", "  "],
        },
      },
      async (context) => context
    );

    expect(result.context.attribution.tags).toEqual(["chat", "prod"]);
  });

  it("keeps only primitive metadata values", async () => {
    const guard = createGuard();
    const result = await guard.run(
      {
        project: { id: "p1" },
        provider: { id: "openai", model: "gpt-4o-mini" },
        metadata: {
          env: "prod",
          retries: 2,
          cached: true,
          nested: { bad: true } as unknown as boolean,
        },
      },
      async (context) => context
    );

    expect(result.context.metadata).toEqual({
      env: "prod",
      retries: 2,
      cached: true,
    });
  });

  it("accepts valid provider.maxTokens", async () => {
    const guard = createGuard();
    const result = await guard.run(
      {
        project: { id: "p1" },
        provider: { id: "openai", model: "gpt-4o-mini", maxTokens: 512 }
      },
      async (context) => context
    );

    expect(result.context.provider.maxTokens).toBe(512);
  });

  it("throws on invalid provider.maxTokens", async () => {
    const guard = createGuard();

    await expect(
      guard.run(
        {
          project: { id: "p1" },
          provider: { id: "openai", model: "gpt-4o-mini", maxTokens: 0 }
        },
        async () => "ok"
      )
    ).rejects.toThrow("provider.maxTokens must be a positive integer");
  });

  it("does not call execute when provider.maxTokens is invalid", async () => {
    const guard = createGuard();
    const execute = vi.fn();

    await expect(
      guard.run(
        {
          project: { id: "p1" },
          provider: { id: "openai", model: "gpt-4o-mini", maxTokens: -1 }
        },
        execute
      )
    ).rejects.toThrow();

    expect(execute).not.toHaveBeenCalled();
  });
});