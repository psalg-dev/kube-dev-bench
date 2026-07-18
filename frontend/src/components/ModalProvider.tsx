import { useEffect, useReducer, useState } from 'react';
import { BaseModal, ModalButton, ModalDangerButton, ModalPrimaryButton } from './BaseModal';

const confirmQueue: Array<{
  resolve: (_value: boolean) => void;
  message: string;
}> = [];

const promptQueue: Array<{
  resolve: (_value: string | null) => void;
  message: string;
  defaultValue: string;
}> = [];

// Re-renders the mounted provider whenever a dialog is queued or resolved.
let notifyProvider: (() => void) | null = null;

// Test-only: drain both queues so each test starts from a clean module state.
export function __resetModalQueuesForTests(): void {
  confirmQueue.length = 0;
  promptQueue.length = 0;
}

export function showModalConfirm(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmQueue.push({ resolve, message });
    notifyProvider?.();
  });
}

export function showModalPrompt(message: string, defaultValue: string = ''): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    promptQueue.push({ resolve, message, defaultValue });
    notifyProvider?.();
  });
}

export function ModalProvider() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    notifyProvider = force;
    return () => {
      notifyProvider = null;
    };
  }, []);

  const confirmItem = confirmQueue[0] ?? null;
  const promptItem = promptQueue[0] ?? null;

  // Seed the input with the prompt's default synchronously when the active
  // prompt changes — an effect would render one frame with a stale value first.
  const [seededFor, setSeededFor] = useState(promptItem);
  if (promptItem !== seededFor) {
    setSeededFor(promptItem);
    setPromptValue(promptItem?.defaultValue ?? '');
  }

  const settleConfirm = (confirmed: boolean) => {
    const item = confirmQueue.shift();
    item?.resolve(confirmed);
    force();
  };

  const settlePrompt = (value: string | null) => {
    const item = promptQueue.shift();
    item?.resolve(value);
    force();
  };

  return (
    <>
      {confirmItem && (
        <BaseModal isOpen={true} onClose={() => settleConfirm(false)} title="Confirm Action">
          <div className="modal-content">
            <p>{confirmItem.message}</p>
            <div className="modal-footer">
              <ModalButton onClick={() => settleConfirm(false)}>Cancel</ModalButton>
              <ModalDangerButton onClick={() => settleConfirm(true)}>Confirm</ModalDangerButton>
            </div>
          </div>
        </BaseModal>
      )}

      {promptItem && (
        <BaseModal isOpen={true} onClose={() => settlePrompt(null)} title="Input Required">
          <div className="modal-content">
            <div className="form-group">
              <label htmlFor="prompt-input">{promptItem.message}</label>
              <input
                id="prompt-input"
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    settlePrompt(promptValue);
                  }
                }}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <ModalButton onClick={() => settlePrompt(null)}>Cancel</ModalButton>
              <ModalPrimaryButton onClick={() => settlePrompt(promptValue)}>OK</ModalPrimaryButton>
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
}

export default ModalProvider;
