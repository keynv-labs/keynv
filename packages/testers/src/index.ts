import { httpTester } from './http.js';
import { mysqlTester } from './mysql.js';
import { postgresTester } from './postgres.js';
import { redisTester } from './redis.js';
import { sshTester } from './ssh.js';
import type { Tester, TesterType } from './types.js';

export type {
  ResolvedSecret,
  Tester,
  TesterTarget,
  TesterType,
  TestResult,
} from './types.js';
export { DEFAULT_TIMEOUT_MS, testerEnum } from './types.js';
export { runTest, type RunArgs } from './run.js';
export { sanitizeResult } from './sanitize.js';

export const testers: ReadonlyArray<Tester> = [
  postgresTester as Tester,
  mysqlTester as Tester,
  redisTester as Tester,
  sshTester as Tester,
  httpTester as Tester,
];

export function findTester(type: TesterType): Tester | null {
  return testers.find((t) => t.type === type) ?? null;
}

export { postgresTester, mysqlTester, redisTester, sshTester, httpTester };
