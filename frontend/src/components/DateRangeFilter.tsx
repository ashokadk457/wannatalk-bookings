import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker, type DateRange } from '@daypicker/react';
import '@daypicker/react/style.css';
import { formatDate, isoDate } from '../lib/dates';
export default function DateRangeFilter({
  value,
  onChange,
  label = 'Date range',
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  label?: string;
}) {
  const id = useId(),
    rootRef = useRef<HTMLDivElement>(null),
    [open, setOpen] = useState(false),
    [months, setMonths] = useState(2);
  useEffect(() => {
    const resize = () => setMonths(window.innerWidth < 1200 ? 1 : 2);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (event: Event) => {
      if (event.type === 'keydown') {
        if ((event as KeyboardEvent).key === 'Escape') setOpen(false);
      } else if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', away);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', away);
    };
  }, [open]);
  const text = !value?.from
    ? 'Pick date range'
    : !value.to
      ? `From ${formatDate(isoDate(value.from))}`
      : `${formatDate(isoDate(value.from))} – ${formatDate(isoDate(value.to))}`;
  return (
    <div className="field date-range-field" ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        id={id}
        className="date-range-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className={value?.from ? 'date-range-value' : 'date-range-placeholder'}>{text}</span>
        <svg
          className="date-range-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </svg>
      </button>
      {open && (
        <div className="date-range-popover" role="dialog" aria-label={label}>
          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={months}
            defaultMonth={value?.from}
            weekStartsOn={1}
            resetOnSelect
            animate
          />
          <div className="date-range-footer">
            <span className="date-range-hint">
              {!value?.from
                ? 'Pick a start date'
                : !value.to
                  ? 'Now pick an end date'
                  : 'Range selected'}
            </span>
            <button
              type="button"
              className="btn secondary small"
              disabled={!value?.from}
              onClick={() => onChange(undefined)}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
