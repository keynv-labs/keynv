'use client';

import { cn } from '@/lib/cn';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  password: string;
  userInputs?: string[];
}

type Score = 0 | 1 | 2 | 3 | 4;

const LABELS: Record<Score, string> = {
  0: 'Very weak',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
  4: 'Excellent',
};

const TONES: Record<Score, string> = {
  0: 'bg-danger',
  1: 'bg-danger',
  2: 'bg-warn',
  3: 'bg-success',
  4: 'bg-success',
};

const LABEL_TONES: Record<Score, string> = {
  0: 'text-danger',
  1: 'text-danger',
  2: 'text-warn',
  3: 'text-success',
  4: 'text-success',
};

interface Result {
  score: Score;
  warning: string;
  suggestions: string[];
}

/**
 * Lightweight wrapper around zxcvbn-ts. The library is ~50 KB so we
 * dynamic-import it on first keystroke — costs nothing on a page
 * load where the user just bounces.
 */
export function PasswordStrength({ password, userInputs = [] }: Props) {
  const [result, setResult] = useState<Result | null>(null);
  const inputsKey = useMemo(() => userInputs.join('|'), [userInputs]);

  useEffect(() => {
    let cancelled = false;
    if (!password) {
      setResult(null);
      return;
    }

    const inputs = inputsKey.split('|').filter(Boolean);

    (async () => {
      const [{ zxcvbn, zxcvbnOptions }, common, en] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
        import('@zxcvbn-ts/language-en'),
      ]);
      zxcvbnOptions.setOptions({
        translations: en.translations,
        graphs: common.adjacencyGraphs,
        dictionary: { ...common.dictionary, ...en.dictionary },
      });
      const out = zxcvbn(password, inputs);
      if (cancelled) return;
      setResult({
        score: out.score as Score,
        warning: out.feedback.warning ?? '',
        suggestions: out.feedback.suggestions ?? [],
      });
    })().catch(() => {
      // zxcvbn failing must never block sign-up; degrade silently
      if (!cancelled) setResult(null);
    });

    return () => {
      cancelled = true;
    };
  }, [password, inputsKey]);

  if (!password) return null;

  const score = result?.score ?? 0;
  const label = result ? LABELS[score] : 'Checking…';

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-[3px] flex-1 rounded-full transition-colors duration-fast ease-snap',
              i <= score ? TONES[score] : 'bg-border',
            )}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'font-mono text-[10px] font-medium uppercase tracking-[0.14em]',
            result ? LABEL_TONES[score] : 'text-fg-subtle',
          )}
        >
          {label}
        </span>
        {result?.warning ? (
          <span className="text-[11px] text-fg-subtle truncate text-right">{result.warning}</span>
        ) : result?.suggestions[0] ? (
          <span className="text-[11px] text-fg-subtle truncate text-right">
            {result.suggestions[0]}
          </span>
        ) : null}
      </div>
    </div>
  );
}
