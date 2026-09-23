import { useEffect, useRef, type ReactNode } from 'react';
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal-card booking-dialog" aria-label={title} onCancel={onClose}>
      <div className="card-head">
        <h3>{title}</h3>
        <button className="btn secondary" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}
