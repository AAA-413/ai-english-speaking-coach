import type { EventLogEntry } from "@/shared/practice";

export function EventLog({ events }: { events: EventLogEntry[] }) {
  return (
    <details className="event-log-panel">
      <summary>Session events</summary>
      <div className="event-log-list">
        {events.length ? events.map((event) => (
          <div className="event-log-row" key={event.id}>
            <time>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
            <strong>{event.type}</strong>
            <p>{event.detail}</p>
          </div>
        )) : (
          <div className="event-log-row">
            <time>--</time>
            <strong>idle</strong>
            <p>No events yet</p>
          </div>
        )}
      </div>
    </details>
  );
}
