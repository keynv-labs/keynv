'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Activity, FileText, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DeleteSecretDialog, RotateSecretDialog } from './secret-dialogs';
import { TestSecretDialog } from './test-dialog';

interface Props {
  projectId: string;
  env: string;
  keyName: string;
  alias: string;
  onOptimisticDelete: (alias: string) => void;
  onDeleteError: (alias: string) => void;
}

export function RowActions({
  projectId,
  env,
  keyName,
  alias,
  onOptimisticDelete,
  onDeleteError,
}: Props) {
  const [rotateOpen, setRotateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${alias}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated-hover hover:text-fg transition-colors duration-fast ease-snap"
          >
            <MoreHorizontal size={15} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setTestOpen(true)}>
            <Activity size={13} className="text-accent" />
            Test connection
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRotateOpen(true)}>
            <RotateCcw size={13} className="text-fg-muted" />
            Rotate value
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={{
                pathname: `/projects/${projectId}/audit`,
                query: { alias },
              }}
            >
              <FileText size={13} className="text-fg-muted" />
              View audit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-danger data-[highlighted]:text-danger"
          >
            <Trash2 size={13} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TestSecretDialog
        projectId={projectId}
        env={env}
        keyName={keyName}
        alias={alias}
        open={testOpen}
        onOpenChange={setTestOpen}
      />
      <RotateSecretDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        projectId={projectId}
        env={env}
        keyName={keyName}
        alias={alias}
      />
      <DeleteSecretDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={projectId}
        env={env}
        keyName={keyName}
        alias={alias}
        onOptimisticDelete={onOptimisticDelete}
        onDeleteError={onDeleteError}
      />
    </>
  );
}
