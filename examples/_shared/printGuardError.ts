export const printGuardError = (title: string, error: Error): void => {
  console.error(`\n=== ${title} / error ===`);
  console.error('name:', error.name);
  console.error('message:', error.message);

  if (error.stack !== undefined) {
    console.error('stack:');
    console.error(error.stack);
  }
};
