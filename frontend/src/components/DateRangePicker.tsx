import { useEffect, useMemo, useRef, useState } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const parseUtc = (value: string) => new Date(`${value}${value.length === 16 ? ':00' : ''}Z`);
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const firstOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addMonths = (date: Date, amount: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));

function replaceDate(value: string, date: Date): string {
  const time = value.slice(11, 19) || '00:00:00';
  return `${dayKey(date)}T${time}`;
}

function replaceTime(value: string, time: string): string {
  return `${value.slice(0, 10)}T${time.length === 5 ? `${time}:00` : time}`;
}

function displayValue(value: string): string {
  const date = parseUtc(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCFullYear()}, ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:00`;
}

function displayDateValue(value: string): string {
  const date = parseUtc(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

function monthDays(month: Date): Date[] {
  const mondayOffset = (month.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * 86_400_000));
}

export function DateRangePicker({ start, end, onChange, dateOnly = false }: { start: string; end: string; onChange: (start: string, end: string) => void; dateOnly?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const [cursor, setCursor] = useState(() => firstOfMonth(parseUtc(start)));
  const [choosingEnd, setChoosingEnd] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const show = () => {
    setDraftStart(start);
    setDraftEnd(end);
    setCursor(firstOfMonth(parseUtc(start)));
    setChoosingEnd(false);
    setOpen(true);
  };

  const chooseDay = (date: Date) => {
    if (!choosingEnd) {
      const nextStart = replaceDate(draftStart, date);
      setDraftStart(nextStart);
      if (parseUtc(nextStart) > parseUtc(draftEnd)) setDraftEnd(replaceDate(draftEnd, date));
      setChoosingEnd(true);
      return;
    }
    const selectedEnd = replaceDate(draftEnd, date);
    const beforeStart = parseUtc(selectedEnd) < parseUtc(draftStart);
    const nextStart = beforeStart ? replaceDate(draftStart, date) : draftStart;
    const nextEnd = beforeStart ? replaceDate(draftEnd, parseUtc(draftStart)) : selectedEnd;
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setChoosingEnd(false);
    if (dateOnly) {
      onChange(nextStart, nextEnd);
      setOpen(false);
    }
  };

  const valid = parseUtc(draftEnd).getTime() > parseUtc(draftStart).getTime();

  return (
    <div className="range-picker" ref={root}>
      <button className={`range-picker-trigger ${dateOnly ? 'date-only' : ''} ${open ? 'open' : ''}`} type="button" onClick={() => open ? setOpen(false) : show()} aria-haspopup="dialog" aria-expanded={open}>
        <CalendarIcon />
        <span>{dateOnly ? displayDateValue(start) : displayValue(start)}&nbsp;&nbsp; - &nbsp;&nbsp;{dateOnly ? displayDateValue(end) : displayValue(end)}</span>
        {!dateOnly && <ChevronIcon />}
      </button>
      {open && (
        <div className={`range-popover single-month ${dateOnly ? 'date-only-popover' : 'timed-popover'}`} role="dialog" aria-label={dateOnly ? 'Choose date range' : 'Choose date and time range'}>
          <div className="range-calendars">
            <CalendarMonth month={cursor} start={draftStart} end={draftEnd} onChoose={chooseDay} onMonthChange={setCursor} simpleHeader previous={() => setCursor(addMonths(cursor, -1))} next={() => setCursor(addMonths(cursor, 1))} />
          </div>
          {!dateOnly && <>
            <div className="range-time-row">
              <label><span>From:</span><input type="time" step="1" value={draftStart.slice(11, 19)} onChange={(event) => setDraftStart(replaceTime(draftStart, event.target.value))} /></label>
              <label><span>To:</span><input type="time" step="1" value={draftEnd.slice(11, 19)} onChange={(event) => setDraftEnd(replaceTime(draftEnd, event.target.value))} /></label>
              <span className="range-time-zone">GMT</span>
            </div>
            <div className="range-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={!valid} onClick={() => { onChange(draftStart, draftEnd); setOpen(false); }}>Apply</button>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}

function CalendarMonth({ month, start, end, onChoose, onMonthChange, simpleHeader = false, previous, next }: {
  month: Date;
  start: string;
  end: string;
  onChoose: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  simpleHeader?: boolean;
  previous?: () => void;
  next?: () => void;
}) {
  const days = useMemo(() => monthDays(month), [month]);
  const startKey = start.slice(0, 10);
  const endKey = end.slice(0, 10);
  const years = Array.from({ length: 7 }, (_, index) => month.getUTCFullYear() - 3 + index);
  return (
    <div className="calendar-month">
      <div className="calendar-head">
        {previous ? <button type="button" onClick={previous} aria-label="Previous month">‹</button> : <span />}
        {simpleHeader ? <div className="calendar-title">{MONTHS[month.getUTCMonth()].slice(0, 3)}&nbsp; {month.getUTCFullYear()}</div> : <div className="calendar-selects">
          <select aria-label="Month" value={month.getUTCMonth()} onChange={(event) => onMonthChange(new Date(Date.UTC(month.getUTCFullYear(), Number(event.target.value), 1)))}>
            {MONTHS.map((name, index) => <option value={index} key={name}>{name}</option>)}
          </select>
          <select aria-label="Year" value={month.getUTCFullYear()} onChange={(event) => onMonthChange(new Date(Date.UTC(Number(event.target.value), month.getUTCMonth(), 1)))}>
            {years.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </div>}
        {next ? <button type="button" onClick={next} aria-label="Next month">›</button> : <span />}
      </div>
      <div className="calendar-grid calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {days.map((date) => {
          const key = dayKey(date);
          const outside = date.getUTCMonth() !== month.getUTCMonth();
          const selected = key === startKey || key === endKey;
          const between = key > startKey && key < endKey;
          return <button type="button" key={key} className={`${outside ? 'outside' : ''} ${selected ? 'selected' : ''} ${between ? 'between' : ''}`} onClick={() => onChoose(date)}>{date.getUTCDate()}</button>;
        })}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

function ChevronIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
