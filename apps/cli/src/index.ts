export const VERSION = '0.0.0-phase0';

if (import.meta.main) {
  process.stdout.write(`keynv ${VERSION}\n`);
}
