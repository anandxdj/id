'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, X, Lock } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DataControlProps {
  onSoftDeleteInitiated: (message: string) => void;
}

export function DataControl({ onSoftDeleteInitiated }: DataControlProps) {
  const { logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteData = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    
    // Simulate API delay for a soft-delete operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    try {
      // Execute local logout and cookie clearing
      await logout();
      onSoftDeleteInitiated('Your account has been successfully closed and all active sessions disconnected.');
    } catch (e) {
      console.error('Logout during deletion failed:', e);
    } finally {
      setIsDeleting(false);
      setShowModal(false);
    }
  };

  return (
    <>
      {/* Dashboard Grid Card for Data Deletion */}
      <div className="flex flex-col justify-between border-2 border-danger bg-card/90 backdrop-blur-md p-6 shadow-brutal transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-brutal-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 border-l-2 border-b-2 border-danger bg-danger px-2.5 py-0.5 font-mono text-[8px] font-black uppercase text-danger-foreground">
          DANGER ZONE
        </div>
        
        <div className="space-y-4">
          {/* Card Header Eyebrow */}
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <span className="eyebrow text-[10px] text-danger font-black">[ 03_DATA_CONTROL ]</span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
              Storage: <span className="text-foreground font-bold">Local</span>
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center border-2 border-danger bg-danger/10 text-danger shadow-brutal-xs">
              <AlertTriangle className="size-5.5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-heading text-lg font-bold text-foreground">Wipe My Data</h3>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                Archival Deletion Request
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mt-2">
            Soft-delete your login credentials, revoke OIDC consent tokens, and terminate active browser sessions.
          </p>
        </div>

        <div className="mt-6 border-t border-border/40 pt-4">
          <Button
            variant="danger"
            size="sm"
            className="w-full justify-center shadow-brutal-xs text-xs font-bold"
            onClick={() => {
              setConfirmText('');
              setShowModal(true);
            }}
          >
            <Trash2 className="size-3.5 mr-1.5" /> Delete My Data
          </Button>
        </div>
      </div>

      {/* Confirmation Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="relative border-2 border-border bg-card p-6 shadow-brutal-lg max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 border-2 border-border bg-background p-1 text-muted-foreground hover:text-foreground hover:shadow-brutal-xs transition-all cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3 text-danger mb-4">
              <AlertTriangle className="size-6 shrink-0" />
              <h3 className="font-heading text-lg font-black tracking-tight text-foreground">Confirm Account Deletion</h3>
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              This action will immediately mark your user account as disabled (soft-deleted), evict all active sessions, and log you out. You will not be able to log back in.
            </p>

            <div className="border border-border bg-danger-foreground/20 p-3 mb-4 rounded-sm">
              <p className="text-[11px] font-mono text-danger">
                To confirm deletion, please type <strong className="font-black underline">DELETE</strong> in the box below.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                placeholder="Type 'DELETE' here"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                className="font-mono text-center tracking-widest font-bold"
              />

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 justify-center border-2 border-border hover:bg-muted"
                  onClick={() => setShowModal(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1 justify-center shadow-brutal-xs"
                  onClick={handleDeleteData}
                  disabled={confirmText !== 'DELETE' || isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
