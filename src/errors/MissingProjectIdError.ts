import { GuardError } from './GuardError.js';

export class MissingProjectIdError extends GuardError {
  public constructor() {
    super(
      'MISSING_PROJECT_ID',
      'Project ID is required. Provide context.projectId or config.defaultProjectId.',
    );
    this.name = 'MissingProjectIdError';
  }
}
