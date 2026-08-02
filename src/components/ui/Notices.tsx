/**
 * Transient notice stack.
 *
 * Used for save-recovery messages and storage warnings. Notices are announced
 * politely rather than assertively, and are dismissed by the player rather than
 * on a timer, so a warning about lost progress cannot disappear unread.
 */

import { useGameStore } from '../../state/gameStore.ts';

export function Notices() {
  const notices = useGameStore((state) => state.notices);
  const dismiss = useGameStore((state) => state.dismissNotice);

  if (notices.length === 0) return null;

  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className={`notice notice--${notice.tone}`}>
          <span aria-hidden="true">{notice.tone === 'warning' ? '⚠' : 'ℹ'}</span>
          <span>{notice.message}</span>
          <button
            type="button"
            className="notice__dismiss"
            onClick={() => dismiss(notice.id)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
