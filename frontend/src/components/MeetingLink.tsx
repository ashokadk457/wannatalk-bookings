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
      <a className="btn meeting-join-btn" href={url} target="_blank" rel="noopener noreferrer">
        Join session
      </a>
      <a className="meeting-url" href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    </div>
  ) : showUnavailable ? (
    <div className="meeting-link-box unavailable" role="status">
      <strong>Online session link</strong>
      <span>The saved session link is invalid. Please contact WannaTalk support.</span>
    </div>
  ) : null;
}
