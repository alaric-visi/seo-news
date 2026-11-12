/** Loads .env if present (Node 20.12+). In GitHub Actions the variables come from secrets instead. */
export function loadEnv() {
  try {
    process.loadEnvFile?.('.env');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export function flag(name: string): string | boolean | undefined {
  const arg = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const eq = arg.indexOf('=');
  return eq === -1 ? true : arg.slice(eq + 1);
}
