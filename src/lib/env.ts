// Settings from the environment with surrounding whitespace removed. A key saved in the
// host's settings with a trailing line break made every Agora agent fail one second after it
// started ("agent exits with reason: RTC connection error"), so no value is used untrimmed.
export function envValue(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function requireEnv(name: string): string {
  const v = envValue(name);
  if (!v) throw new Error(`Missing ${name} in the environment`);
  return v;
}
