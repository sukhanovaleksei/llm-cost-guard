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

  it("uses context.projectId when provided", async () => {
    const guard = createGuard({ defaultProjectId: "default-project" });

    const result = await guard.run(
      {
        projectId: "request-project",
        providerId: "openai",
        model: "gpt-4o-mini",
      },
      async () => ({ ok: true })
    );

    expect(result.context).toEqual({
      projectId: "request-project",
      providerId: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("uses config.defaultProjectId when context.projectId is missing", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    const result = await guard.run(
      { providerId: "openai", model: "gpt-4o-mini" },
      async () => ({ ok: true })
    );

    expect(result.result).toEqual({ ok: true });
    expect(result.context).toEqual({ projectId: "app-main", providerId: "openai", model: "gpt-4o-mini" });
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blocked).toBe(false);
  });

  it("throws MissingProjectIdError when neither context.projectId nor config.defaultProjectId is provided", async () => {
    const guard = createGuard();

    await expect(
      guard.run(
        { providerId: "openai", model: "gpt-4o-mini" },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingProjectIdError);
  });

  it("throws MissingProviderIdError when providerId is missing", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    await expect(
      guard.run({ model: "gpt-4o-mini" }, async () => ({ ok: true }))
    ).rejects.toBeInstanceOf(MissingProviderIdError);
  });

  it("throws MissingProviderIdError when providerId is empty string", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    await expect(
      guard.run(
        { providerId: "   ", model: "gpt-4o-mini" },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingProviderIdError);
  });

  it("throws MissingModelError when model is empty string", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    await expect(
      guard.run(
        { providerId: "openai", model: "   " },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingModelError);
  });

  it("does not call execute when run context validation fails", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });
    const execute = vi.fn(async () => ({ ok: true }));

    await expect(
      guard.run(
        { providerId: "", model: "gpt-4o-mini" },
        execute
      )
    ).rejects.toBeInstanceOf(MissingProviderIdError);

    expect(execute).not.toHaveBeenCalled();
  });

  it("calls execute exactly once for valid context", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });
    const execute = vi.fn(async () => ({ ok: true }));

    await guard.run(
      { providerId: "openai", model: "gpt-4o-mini" },
      execute
    );

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns allowed decision and resolved context for successful execution", async () => {
    const guard = createGuard({ defaultProjectId: "app-main" });

    const result = await guard.run(
      { providerId: "openai", model: "gpt-4o-mini" },
      async () => ({ text: "hello" })
    );

    expect(result).toEqual({
      result: { text: "hello" },
      context: {
        projectId: "app-main",
        providerId: "openai",
        model: "gpt-4o-mini",
      },
      decision: {
        allowed: true,
        blocked: false,
      },
    });
  });
});