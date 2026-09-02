export interface FullHorizonsPayload {
  header: {
    apiVersion: string;
    apiSource: string;
    revisedDate: string;
    targetName: string;
    targetId: string;
    urls: string[];
    background: {
      summary: string;
      launchDateUtc: string;
      launchVehicle: string;
      launchSite: string;
      targetOrbit: string;
      objectives: string[];
    };
    spacecraftSpecs: Record<string, string>;
    instruments: Array<{ name: string; description: string }>;
    trajectoryFiles: Array<{ name: string; startTdb: string; endTdb: string }>;
  };
  requestInfo: {
    ephemerisType: string;
    generatedAt: string;
    targetBody: { name: string; id: string; source: string };
    centerBody: { name: string; id: string; source: string };
    centerSite: string;
    startTime: string; // raw, e.g. "A.D. 2026-Aug-30 11:59:09.1830 TDB"
    stopTime: string; // raw, as above
    startTimeUtc: string; // ISO-8601, parseable by new Date()
    stopTimeUtc: string; // ISO-8601, parseable by new Date()
    stepSize: string;
    centerGeodetic: string;
    centerCylindric: string;
    centerRadiiKm: string;
    outputUnits: string;
    calendarMode: string;
    outputType: string;
    outputFormat: string;
    referenceFrame: string;
  };
  trajectory: TrajectoryPoint[];
  documentation: {
    timeSystemNotes: string;
    calendarSystemNotes: string;
    referenceFrameNotes: string;
    aberrationsNotes: string;
    symbols: Record<string, string>;
    contactInfo: Record<string, string>;
  };
}

export interface TrajectoryPoint {
  jdtdb: number;
  utcDate: string;
  positionKm: { x: number; y: number; z: number };
  velocityKmSec: { vx: number; vy: number; vz: number };
  lightTimeSec: number;
  rangeKm: number;
  rangeRateKmSec: number;
}

export function parseHorizonsCompletely(text: string): FullHorizonsPayload {
  const soeIdx = text.indexOf('$$SOE');
  const eoeIdx = text.indexOf('$$EOE');

  if (soeIdx === -1 || eoeIdx === -1) {
    throw new Error('Invalid Horizons format: Missing $$SOE or $$EOE markers.');
  }

  const headerBlock = text.slice(0, soeIdx);
  const ephemerisBlock = text.slice(soeIdx + 5, eoeIdx).trim();
  const footerBlock = text.slice(eoeIdx + 5);

  return {
    header: parseHeader(headerBlock),
    requestInfo: parseRequestInfo(headerBlock),
    trajectory: parseTrajectory(ephemerisBlock),
    documentation: parseFooter(footerBlock)
  };
}

function parseHeader(text: string) {
  const objectives: string[] = [];
  const objMatches = text.matchAll(/\*\s+([^\n]+)/g);
  for (const m of objMatches) {
    objectives.push(m[1].trim());
  }

  const instruments: Array<{ name: string; description: string }> = [];
  const instBlock = text.match(/Instruments:\s*([\s\S]*?)(?=\n\s*\n|\n [A-Z ]+:)/);
  if (instBlock) {
    const instMatches = instBlock[1].matchAll(/\*\s*([^\n]+)\n\s*([^\n*]+)/g);
    for (const m of instMatches) {
      instruments.push({ name: m[1].trim(), description: m[2].trim() });
    }
  }

  const trajFiles: Array<{ name: string; startTdb: string; endTdb: string }> = [];
  const trajMatches = text.matchAll(/^ (RST_\S+)\s+(.*?)\s\s+(.*?)$/gm);
  for (const m of trajMatches) {
    trajFiles.push({ name: m[1].trim(), startTdb: m[2].trim(), endTdb: m[3].trim() });
  }

  return {
    apiVersion: extractRegex(text, /API VERSION:\s*(.*)/),
    apiSource: extractRegex(text, /API SOURCE:\s*(.*)/),
    revisedDate: extractRegex(text, /Revised:\s*([A-Za-z0-9,\s]+)/),
    targetName: extractRegex(text, /Revised:.*?\s{2,}(.*?)\s+-/),
    targetId: extractRegex(text, /Revised:.*?\s+-(\d+)/),
    urls: Array.from(text.matchAll(/https?:\/\/\S+/g), m => m[0]),
    background: {
      summary: extractRegex(text, /BACKGROUND:\s*([\s\S]*?)(?=\r?\n\r?\n\s*\*|\r?\n\s*Objectives:)/),
      launchDateUtc: extractRegex(text, /launched\s+([0-9-]+\s+[0-9:]+\s+UTC)/),
      launchVehicle: extractRegex(text, /on a\s+(.*?)\s+from/),
      launchSite: extractRegex(text, /from\s+(.*?)\s+and/),
      targetOrbit: extractRegex(text, /will orbit the\s+(.*?)\./),
      objectives
    },
    spacecraftSpecs: {
      primaryMirrorSize: extractRegex(text, /Primary mirror size:\s*(.*)/),
      effectiveDiameter: extractRegex(text, /Primary mirror effective diameter:\s*(.*)/),
      operatingTemperature: extractRegex(text, /Operating temperature:\s*(.*)/),
      downlinkRate: extractRegex(text, /Downlink rate:\s*(.*)/),
      dataVolume: extractRegex(text, /Data volume\s*:\s*(.*)/)
    },
    instruments,
    trajectoryFiles: trajFiles
  };
}

function parseRequestInfo(text: string) {
  const targetMatch = text.match(/Target body name:\s*(.*?)\s*\((.*?)\)\s*\{(.*?)\}/);
  const centerMatch = text.match(/Center body name:\s*(.*?)\s*\((.*?)\)\s*\{(.*?)\}/);

  return {
    ephemerisType: extractRegex(text, /Ephemeris \/\s*(.*?)\s*\//),
    generatedAt: extractRegex(text, /Ephemeris \/.*?\/\s*(.*?)\s*\//),
    targetBody: {
      name: targetMatch ? targetMatch[1].trim() : '',
      id: targetMatch ? targetMatch[2].trim() : '',
      source: targetMatch ? targetMatch[3].trim() : ''
    },
    centerBody: {
      name: centerMatch ? centerMatch[1].trim() : '',
      id: centerMatch ? centerMatch[2].trim() : '',
      source: centerMatch ? centerMatch[3].trim() : ''
    },
    centerSite: extractRegex(text, /Center-site name:\s*(.*)/),
    startTime: extractRegex(text, /Start time\s*:\s*(.*)/),
    stopTime: extractRegex(text, /Stop  time\s*:\s*(.*)/),
    startTimeUtc: parseTimestamp(extractRegex(text, /Start time\s*:\s*(.*)/)),
    stopTimeUtc: parseTimestamp(extractRegex(text, /Stop  time\s*:\s*(.*)/)),
    stepSize: extractRegex(text, /Step-size\s*:\s*(.*)/),
    centerGeodetic: extractRegex(text, /Center geodetic :\s*(.*?)\s*\{/),
    centerCylindric: extractRegex(text, /Center cylindric:\s*(.*?)\s*\{/),
    centerRadiiKm: extractRegex(text, /Center radii\s*:\s*(.*?)\s*km/),
    outputUnits: extractRegex(text, /Output units\s*:\s*(.*)/),
    calendarMode: extractRegex(text, /Calendar mode\s*:\s*(.*)/),
    outputType: extractRegex(text, /Output type\s*:\s*(.*)/),
    outputFormat: extractRegex(text, /Output format\s*:\s*(.*)/),
    referenceFrame: extractRegex(text, /Reference frame\s*:\s*(.*)/)
  };
}

/**
 * Convert a Horizons calendar timestamp — e.g. "A.D. 2026-Aug-30 11:59:09.1830
 * TDB" — into an ISO-8601 string that `new Date()` can parse. Tolerates the
 * "A.D. " prefix and " TDB" suffix (matches the date/time anywhere in the
 * string) and preserves the fractional second, which the wire format gives as a
 * decimal fraction (".1830" → 183 ms).
 *
 * Horizons reports these instants in TDB (Barycentric Dynamical Time); we label
 * the result UTC. TDB−UTC is a slowly varying ~69 s offset — negligible for a
 * solar-system visualization. Apply that offset here if precise ephemeris
 * timing is ever needed.
 */
export function parseTimestamp(line: string): string {
  const match = line.match(
    /(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/
  );
  if (!match) return new Date().toISOString();

  const [, year, mon, day, hh, mm, ss, frac] = match;
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  // The fraction is a decimal fraction of a second, so pad/truncate to 3
  // digits of milliseconds (".1830" → "183", ".18" → "180").
  const millis = frac ? `.${(frac + '000').slice(0, 3)}` : '';
  return `${year}-${months[mon] || '01'}-${day}T${hh}:${mm}:${ss}${millis}Z`;
}

function parseTrajectory(block: string): TrajectoryPoint[] {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const results: TrajectoryPoint[] = [];

  for (let i = 0; i < lines.length; i += 4) {
    if (!lines[i + 3]) break;

    const [jdStr, dateRaw] = lines[i].split('=').map(s => s.trim());
    const pos = parseVectorLine(lines[i + 1]);
    const vel = parseVectorLine(lines[i + 2]);
    const meta = parseVectorLine(lines[i + 3]);

    results.push({
      jdtdb: parseFloat(jdStr),
      utcDate: parseTimestamp(dateRaw),
      positionKm: { x: pos.X, y: pos.Y, z: pos.Z },
      velocityKmSec: { vx: vel.VX, vy: vel.VY, vz: vel.VZ },
      lightTimeSec: meta.LT,
      rangeKm: meta.RG,
      rangeRateKmSec: meta.RR
    });
  }

  return results;
}

function parseFooter(text: string) {
  const symbols: Record<string, string> = {};
  const symbolMatches = text.matchAll(/^\s*([A-Z]{1,5})\s+(.*?)$/gm);
  for (const m of symbolMatches) {
    symbols[m[1]] = m[2].trim();
  }

  return {
    timeSystemNotes: extractBlock(text, 'TIME', 'CALENDAR SYSTEM'),
    calendarSystemNotes: extractBlock(text, 'CALENDAR SYSTEM', 'REFERENCE FRAME AND COORDINATES'),
    referenceFrameNotes: extractBlock(text, 'REFERENCE FRAME AND COORDINATES', 'ABERRATIONS AND CORRECTIONS'),
    aberrationsNotes: extractBlock(text, 'ABERRATIONS AND CORRECTIONS', 'Computations by ...'),
    symbols,
    contactInfo: {
      group: 'Solar System Dynamics Group, Horizons On-Line Ephemeris System',
      address: '4800 Oak Grove Drive, Jet Propulsion Laboratory, Pasadena, CA 91109 USA',
      generalSite: extractRegex(text, /General site:\s*(.*)/),
      userGuide: extractRegex(text, /User Guide\s*:\s*(.*)/),
      inquiries: extractRegex(text, /Inquiries\s*:\s*(.*)/)
    }
  };
}

function parseVectorLine(line: string): Record<string, number> {
  const result: Record<string, number> = {};
  const regex = /([A-Z]+)\s*=\s*([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    result[match[1]] = parseFloat(match[2]);
  }
  return result;
}

function extractRegex(text: string, regex: RegExp): string {
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function extractBlock(text: string, startHeader: string, endHeader: string): string {
  const start = text.indexOf(startHeader);
  const end = text.indexOf(endHeader);
  if (start === -1 || end === -1) return '';
  return text.slice(start + startHeader.length, end).trim();
}