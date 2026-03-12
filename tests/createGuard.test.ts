import { describe, expect, it, vi } from "vitest";

import { MissingProjectIdError } from "../src/errors/MissingProjectIdError.js";
import { createGuard } from "../src/index.js";

describe("createGuard", () => {
  it("creates guard with default hard mode", () => {
    const guard = createGuard();
    expect(guard.config.mode).toBe("hard");
  });

  it("uses provided mode", () => {
    const guard = createGuard({ mode: "soft" });
    expect(guard.config.mode).toBe("soft");
  });

  it("uses defaultProjectId from config when projectId is not provided in context", async () => {
    const guard = createGuard({
      defaultProjectId: "app-main",
    });

    const result = await guard.run(
      { model: "gpt-4o-mini", providerId: "openai" },
      async () => ({ ok: true })
    );

    expect(result.result).toEqual({ ok: true });
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blocked).toBe(false);
  });

  it("uses projectId from context when provided", async () => {
    const guard = createGuard({
      defaultProjectId: "default-project",
    });

    const result = await guard.run(
      {
        projectId: "request-project",
        model: "gpt-4o-mini",
        providerId: "openai",
      },
      async () => ({ project: "request-project" })
    );

    expect(result.result).toEqual({ project: "request-project" });
  });

  it("throws MissingProjectIdError when neither context.projectId nor config.defaultProjectId is provided", async () => {
    const guard = createGuard();

    await expect(
      guard.run(
        {
          model: "gpt-4o-mini",
          providerId: "openai",
        },
        async () => ({ ok: true })
      )
    ).rejects.toBeInstanceOf(MissingProjectIdError);
  });

  it("calls execute exactly once", async () => {
    const guard = createGuard({
      defaultProjectId: "app-main",
    });

    const execute = vi.fn(async () => ({ ok: true }));

    await guard.run(
      {
        model: "gpt-4o-mini",
        providerId: "openai",
      },
      execute
    );

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns allowed decision for successful execution", async () => {
    const guard = createGuard({
      defaultProjectId: "app-main",
    });

    const result = await guard.run(
      { model: "gpt-4o-mini", providerId: "openai" },
      async () => ({ text: "hello" })
    );

    expect(result).toEqual({
      result: { text: "hello" },
      decision: {
        allowed: true,
        blocked: false,
      },
    });
  });
});