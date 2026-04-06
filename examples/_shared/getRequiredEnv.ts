export const getRequiredEnv = (name: string): string => {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0)
    throw new Error(`Missing required environment variable: ${name}`);

  return value;
};
