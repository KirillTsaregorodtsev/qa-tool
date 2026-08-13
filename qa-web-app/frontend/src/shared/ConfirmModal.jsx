import React, { useEffect } from 'react';

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
    margin: '16px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1A1D23',
    marginBottom: '8px',
  },
  message: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.5,
    marginBottom: '20px',
    overflowWrap: 'anywhere',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cancelBtn: {
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#F1F5F9',
    color: '#334155',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  confirmBtnDanger: {
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  confirmBtnNeutral: {
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#0066FF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
  danger = true,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>{title}</div>
        <div style={styles.message}>{message}</div>
        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={danger ? styles.confirmBtnDanger : styles.confirmBtnNeutral}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
