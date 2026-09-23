import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Modal from './Modal';
const legalContentCache = new Map<string, string>();
async function loadLegalContent(src: string) {
  const cached = legalContentCache.get(src);
  if (cached) return cached;
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Unable to load legal content (${response.status})`);
  const page = new DOMParser().parseFromString(await response.text(), 'text/html'),
    content = page.querySelector('#termsBox')?.innerHTML.trim();
  if (!content) throw new Error('Legal content is missing from the document');
  legalContentCache.set(src, content);
  return content;
}
export default function LegalModal({
  title,
  src,
  accepted,
  onAccept,
  onClose,
}: {
  title: string;
  src: string;
  accepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(legalContentCache.get(src) ?? null),
    [failed, setFailed] = useState(false),
    [acceptedInModal, setAcceptedInModal] = useState(accepted),
    [reachedBottom, setReachedBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    loadLegalContent(src)
      .then((html) => alive && setContent(html))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [src]);
  useEffect(() => {
    const element = contentRef.current;
    if (content && element) checkReadToEnd(element);
  }, [content]);
  function checkReadToEnd(element: HTMLDivElement) {
    const threshold = 16;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold)
      setReachedBottom(true);
  }
  const gateOpen = reachedBottom || failed;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="legal-modal">
        <div
          ref={contentRef}
          className="legal-modal-content"
          role="region"
          aria-label={`${title} document`}
          tabIndex={0}
          onScroll={(event) => checkReadToEnd(event.currentTarget)}
        >
          {failed ? (
            <p className="legal-modal-error">
              The legal document could not be loaded.{' '}
              <a href={src} target="_blank" rel="noreferrer">
                Open the full document
              </a>{' '}
              in a new tab to review it before accepting.
            </p>
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p className="legal-modal-hint">Loading legal content…</p>
          )}
        </div>
        <div className="legal-modal-footer">
          <label className="legal-modal-acceptance">
            <input
              type="checkbox"
              checked={acceptedInModal}
              disabled={!gateOpen}
              onChange={(event) => setAcceptedInModal(event.target.checked)}
            />
            <span>
              I have read and agree to the {title}
              {!gateOpen && (
                <span className="sub">
                  Please scroll to the end of the document before accepting.
                </span>
              )}
            </span>
          </label>
          <div className="actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={onAccept} disabled={!acceptedInModal}>
              Accept
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
