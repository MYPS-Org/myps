import { useState, useCallback } from 'react';
import type { ConfirmField, ConfirmDialogProps } from './ConfirmDialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DialogRequest {
  mode: 'add' | 'edit';
  tableName: string;
  fields: ConfirmField[];
  onConfirm: () => void;
}

interface DialogState extends DialogRequest {
  open: boolean;
  loading: boolean;
}

const CLOSED: DialogState = {
  open: false, loading: false, mode: 'add', tableName: '', fields: [], onConfirm: () => {},
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Manages state for a single <ConfirmDialog /> instance.
 *
 * Usage:
 * ```tsx
 * const confirm = useConfirmDialog();
 *
 * const requestAdd = () => {
 *   confirm.request({
 *     mode: 'add',
 *     tableName: 'Agency',
 *     fields: [
 *       { label: 'NameId', value: form.NameId, mono: true },
 *       { label: 'Name',   value: form.Name },
 *     ],
 *     onConfirm: () => { doSave(); confirm.close(); },
 *   });
 * };
 *
 * // In JSX:
 * <ConfirmDialog {...confirm.dialogProps} />
 * ```
 */
export function useConfirmDialog() {
  const [state, setState] = useState<DialogState>(CLOSED);

  /** Open the dialog for an add or edit action */
  const request = useCallback((req: DialogRequest) => {
    setState({ ...req, open: true, loading: false });
  }, []);

  /** Programmatically dismiss */
  const close = useCallback(() => setState(CLOSED), []);

  /** Flip the loading flag while an async operation is in-flight */
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open:      state.open,
    mode:      state.mode,
    tableName: state.tableName,
    fields:    state.fields,
    loading:   state.loading,
    onConfirm: state.onConfirm,
    onClose:   close,
  };

  return { request, close, setLoading, dialogProps };
}
