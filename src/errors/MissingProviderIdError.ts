import { GuardError } from "./GuardError.js";

export class MissingProviderIdError extends GuardError {
  public constructor() {
    super(
      "MISSING_PROVIDER_ID",
      "Provider ID is required. Provide context.providerId."
    );
    this.name = "MissingProviderIdError";
  }
}