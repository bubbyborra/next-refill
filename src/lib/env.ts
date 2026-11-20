// Settings from the environment with surrounding whitespace and quotes removed. A key saved
// with a trailing line break makes an Agora agent fail one second after it starts ("agent
// exits with reason: RTC connection error"), so no value is used as pasted.
export function envValue(name: string): string | undefined {
  let v = process.env[name]?.trim();
  if (v && v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) v = v.slice(1, -1).trim();
  return v ? v : undefined;
}

export function requireEnv(name: string): string {
  const v = envValue(name);
  if (!v) throw new Error(`Missing ${name} in the environment`);
  return v;
}
