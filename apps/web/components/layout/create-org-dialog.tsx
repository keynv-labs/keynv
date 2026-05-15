'use client';

import { createOrgAction } from '@/app/(authed)/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ErrorBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface CreateOrgDialogProps {
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export function CreateOrgDialog({ children, onOpenChange }: CreateOrgDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setPending(true);
    setError(null);

    const result = await createOrgAction(name.trim());
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    setOpen(false);
    setName('');
    router.push('/dashboard');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Create organization</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <label
              htmlFor="org-name"
              className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle"
            >
              Organization name
            </label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
              required
              autoFocus
            />
          </div>

          {error ? <ErrorBlock message={error} /> : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
