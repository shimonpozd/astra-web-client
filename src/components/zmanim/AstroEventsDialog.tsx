import { useMemo, useState } from 'react';
import * as Astronomy from 'astronomy-engine';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type AstroEvent = {
  time: Date;
  title: string;
  description: string;
};

const toDate = (value: any) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.date instanceof Date) return value.date;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatEventTime = (value: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
};

const moonQuarterLabel = (quarter: number) => {
  if (quarter === 0) return 'New Moon';
  if (quarter === 1) return 'First Quarter';
  if (quarter === 2) return 'Full Moon';
  return 'Last Quarter';
};

const apsisLabel = (kind: number) => (kind === 0 ? 'Perigee' : 'Apogee');

const eclipseLabel = (kind: string, type: 'Lunar' | 'Solar') =>
  `${type} Eclipse (${kind})`;

export function AstroEventsDialog({
  lat,
  lon,
  elevation = 0,
  timestamp,
  timeZone,
}: {
  lat: number;
  lon: number;
  elevation?: number;
  timestamp: Date;
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);

  const data = useMemo(() => {
    const events: AstroEvent[] = [];
    let librationText = '';

    try {
      if (typeof Astronomy.Libration === 'function') {
        const lib = Astronomy.Libration(timestamp);
        librationText = `Current libration: lat ${lib.lat.toFixed(2)} deg, lon ${lib.lon.toFixed(2)} deg.`;
      }
    } catch {
      librationText = '';
    }

    try {
      let mq = Astronomy.SearchMoonQuarter(timestamp);
      for (let i = 0; i < 4; i += 1) {
        const date = toDate(mq.time);
        if (date) {
          events.push({
            time: date,
            title: moonQuarterLabel(mq.quarter),
            description: 'Quarter lunar phase (new/full/quarters).',
          });
        }
        mq = Astronomy.NextMoonQuarter(mq);
      }
    } catch {
      // ignore
    }

    try {
      let apsis = Astronomy.SearchLunarApsis(timestamp);
      for (let i = 0; i < 4; i += 1) {
        const date = toDate(apsis.time);
        if (date) {
          events.push({
            time: date,
            title: `Moon ${apsisLabel(apsis.kind)}`,
            description: `${apsisLabel(apsis.kind)}: distance ${Math.round(apsis.dist_km)} km.`,
          });
        }
        apsis = Astronomy.NextLunarApsis(apsis);
      }
    } catch {
      // ignore
    }

    try {
      let lunar = Astronomy.SearchLunarEclipse(timestamp);
      for (let i = 0; i < 2; i += 1) {
        const date = toDate(lunar.peak);
        if (date) {
          events.push({
            time: date,
            title: eclipseLabel(lunar.kind, 'Lunar'),
            description: `Peak obscuration ${Math.round(lunar.obscuration * 100)}%.`,
          });
        }
        lunar = Astronomy.NextLunarEclipse(lunar.peak);
      }
    } catch {
      // ignore
    }

    try {
      let solar = Astronomy.SearchGlobalSolarEclipse(timestamp);
      for (let i = 0; i < 2; i += 1) {
        const date = toDate(solar.peak);
        if (date) {
          events.push({
            time: date,
            title: eclipseLabel(solar.kind, 'Solar'),
            description: `Global eclipse peak (not location-specific).`,
          });
        }
        solar = Astronomy.NextGlobalSolarEclipse(solar.peak);
      }
    } catch {
      // ignore
    }

    events.sort((a, b) => a.time.getTime() - b.time.getTime());
    return {
      librationText,
      events: events.slice(0, 10),
    };
  }, [timestamp, lat, lon, elevation]);

  return (
    <>
      <Button variant="secondary" className="h-9" onClick={() => setOpen(true)}>
        Astronomy Events
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nearest Astronomy Events</DialogTitle>
            <DialogDescription>
              Apogee/perigee, lunar phases, and eclipses. Times are shown in your selected time zone.
            </DialogDescription>
          </DialogHeader>
          {data.librationText ? (
            <div className="text-sm text-muted-foreground">{data.librationText}</div>
          ) : null}
          <div className="mt-4 space-y-3">
            {data.events.map((event) => (
              <div key={`${event.title}-${event.time.toISOString()}`} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{event.title}</span>
                  <span className="font-mono">{formatEventTime(event.time, timeZone)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{event.description}</div>
              </div>
            ))}
            {data.events.length === 0 ? (
              <div className="text-sm text-muted-foreground">No events found.</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
