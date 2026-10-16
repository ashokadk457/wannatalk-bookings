export function MeetingLink({
  url,
  showUnavailable = false,
}: {
  url?: string | null;
  showUnavailable?: boolean;
}) {
  if (!url)
    return showUnavailable ? (
      <div className="meeting-link-box unavailable" role="status">
        <strong>Online session link</strong>
        <span>The secure session link has not been added yet.</span>
      </div>
    ) : null;
  let safe = false;
  try {
    safe = ['https:', 'http:'].includes(new URL(url).protocol);
  } catch {
    /* Invalid links are not clickable. */
  }
  return safe ? (
    <div className="meeting-link-box">
      <strong>Online session link</strong>
      <a className="btn meeting-join-btn appointment-icon-action" href={url} target="_blank" rel="noopener noreferrer" aria-label="Join meeting" data-tooltip="Join meeting">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </svg>
      </a>
      {/* <a className="meeting-url" href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a> */}
    </div>
  ) : showUnavailable ? (
    <div className="meeting-link-box unavailable" role="status">
      <strong>Online session link</strong>
      <span>The saved session link is invalid. Please contact WannaTalk support.</span>
    </div>
  ) : null;
}
