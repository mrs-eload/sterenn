import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Paper, Slider, Tooltip } from '@mui/material';
import { Icon } from '@iconify/react';
import type { FullHorizonsPayload } from '@app/features/rst/data/horizon-parser.ts';
import { SolarSystemEngine, kmToAu } from '@app/features/rst/engine';
import type { TrajectoryPoint } from '@app/features/rst/engine';
import { DateTimeSpinner } from './DateTimeSpinner';
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

// Trajectory files, one geocentric Horizons vector table per craft. Both are
// Sun–Earth L2 halos, so their points are offsets from Earth and the engine
// parents each under Earth. Exported so MissionDashboard fetches the same URLs.
export const RST_TRAJECTORY_URL = 'horizons/rst/RST_EPH_PRED_2026243_2026271_02_GEO.txt';
export const JWST_TRAJECTORY_URL = 'horizons/jwst/jwst_geo.txt';

interface SolarSystemMapProps {
  /** Parsed trajectory per craft, keyed by the SPACECRAFT descriptor id. */
  trajectories: Record<string, FullHorizonsPayload>;
}

/** Everything static about one craft: which body it orbits, its model, its look. */
interface SpacecraftSource {
  /** Matches the key in the `trajectories` prop. */
  id: string;
  /** Body whose L2 the craft orbits — its Horizons center, so its parent here. */
  parentBody: string;
  modelUrl: string;
  /**
   * Native model units → AU. Both models are drawn far larger than life so the
   * craft are visible against their orbits; the two scales are tuned to read at
   * a consistent apparent size (RST_v4 is ~344 units, JWST ~21 metric units).
   */
  modelScale: number;
  /**
   * Nose-trim: euler angles bringing the model's forward axis onto +Z, so the
   * engine's tangent orientation (orientToTrajectory) composes on top correctly.
   */
  calibration: [number, number, number];
  /** Marker + default path colour (0xRRGGBB). */
  color: number;
  /** Pick/label marker radius in AU. */
  radius: number;
  label: string;
  /** Dashing of the predicted path — scale `pairs` with path length (see engine). */
  dash?: { pairs?: number; gapRatio?: number };
}

const SPACECRAFT: SpacecraftSource[] = [
  {
    id: 'rst',
    parentBody: 'Earth',
    modelUrl: '/sterenn/horizons/rst/model/RST_v4.glb',
    modelScale: 1e-7,
    calibration: [0, -1.6 + Math.PI, 0],
    color: 0xffffff,
    radius: 0.03,
    label: 'RST',
  },
  {
    id: 'jwst',
    parentBody: 'Earth',
    modelUrl: '/sterenn/horizons/jwst/model/JWST.glb',
    // JWST.glb is modelled in metres (~21 m sunshield); 1.6e-6 brings its drawn
    // size onto RST's so the two read at a consistent (exaggerated) scale. The
    // scale and calibration are eyeball starting values — retune in the app.
    modelScale: 1.6e-6,
    calibration: [0, 0, 0],
    color: 0xffd27f, // warm gold, to tell it apart from RST's white
    radius: 0.03,
    label: 'JWST',
    // JWST's path is ~66× RST's arc length (a decade of L2 loops vs a month), so it
    // needs ~66× the dash pairs to keep the same absolute dash size — otherwise the
    // dashes stretch into long solid strokes.
    dash: { pairs: 6600 },
  },
];

// The speed slider is a signed, continuous "shuttle": position 0 is the centre
// (real time), the right half accelerates forward, the left half runs backward,
// and both halves speed up exponentially toward the edges. `rate` throughout is
// simulated seconds per real second; play/pause is separate (pause = rate 0).
const DAY = 86_400;
const YEAR = 365.25 * DAY;

// Slider position runs -1..+1. The magnitude at |pos| grows exponentially from
// 1× at the centre to MAX_RATE at the edge, so every decade of speed gets equal
// travel — the natural feel for a time shuttle spanning seconds to years.
const MAX_RATE = 10 * YEAR; // 10 years per second at full deflection
const LN_MAX = Math.log(MAX_RATE);

// A small dead zone around the centre snaps back to exactly real time, so the
// user can flick the thumb to the middle to "go back to real time" without
// having to land on a single pixel.
const CENTRE_DEADZONE = 0.02;

/** Signed clock rate (sim s / real s) for a slider position in -1..+1. */
function rateFromPos(pos: number): number {
  if (Math.abs(pos) < CENTRE_DEADZONE) return 1; // centre = real time, forward
  const magnitude = Math.exp(Math.abs(pos) * LN_MAX);
  return pos < 0 ? -magnitude : magnitude;
}

/** Slider position for a given speed magnitude (used to place the indicators). */
function posForRate(magnitude: number): number {
  return Math.log(magnitude) / LN_MAX;
}

// Reference speeds, shown as (non-snapping) tick marks either side of centre so
// the user can gauge how fast they're scrubbing. They are indicators only — the
// thumb moves freely between them.
const SPEED_INDICATORS = [
  { magnitude: DAY, label: '1 d/s' },
  { magnitude: 30 * DAY, label: '30 d/s' },
  { magnitude: YEAR, label: '1 y/s' },
  { magnitude: MAX_RATE, label: '10 y/s' },
];
const SPEED_MARKS = [
  { value: 0, label: 'Real time' },
  ...SPEED_INDICATORS.flatMap(({ magnitude, label }) => {
    const pos = posForRate(magnitude);
    return [
      { value: pos, label },
      { value: -pos, label: `−${label}` },
    ];
  }),
];

/** Human-readable current speed, e.g. "12 d/s", "−1.4 y/s", "Real time". */
function formatSpeed(pos: number, playing: boolean): string {
  if (!playing) return 'Paused';
  if (Math.abs(pos) < CENTRE_DEADZONE) return 'Real time';
  const rate = rateFromPos(pos);
  const mag = Math.abs(rate);
  const sign = rate < 0 ? '−' : '';
  const [value, unit] =
    mag < DAY ? [mag / 3600, 'h/s'] : mag < YEAR ? [mag / DAY, 'd/s'] : [mag / YEAR, 'y/s'];
  const decimals = value < 10 ? 1 : 0;
  return `${sign}${value.toFixed(decimals)} ${unit}`;
}

/**
 * Turn a Horizons vector table into engine trajectory points. The RST and JWST
 * files are all ecliptic-of-J2000, in km — the engine's native frame — so we only
 * convert km→AU and parse the (already ISO) timestamp to epoch ms. Whether those km
 * are relative to the Sun or to Earth is the file's center; they convert identically.
 */
function toTrajectoryPoints(data: FullHorizonsPayload): TrajectoryPoint[] {
  return data.trajectory.map((pt) => ({
    timeMs: Date.parse(pt.utcDate),
    position: kmToAu(pt.positionKm),
  }));
}

export const SolarSystemMap: React.FC<SolarSystemMapProps> = ({ trajectories }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarSystemEngine | null>(null);
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Freeze the live clock readout while the user edits the date. A counter, so
  // overlapping sources (hovering the spinner, an open calendar) stay balanced.
  const editingDepth = useRef(0);

  const [playing, setPlaying] = useState(true);
  // Signed slider position in -1..+1: 0 is real time, right is forward, left is
  // backward. This alone encodes speed *and* direction now.
  const [speedPos, setSpeedPos] = useState(0);
  const [simDate, setSimDate] = useState<Date | null>(null);

  useEffect( () => {
    const container = containerRef.current;
    if (!container) return;

    // Build the engine once and reuse it across React StrictMode's synchronous
    // unmount/remount (dev), deferring teardown so the remount reclaims it.
    if (!engineRef.current) {
      const engine = new SolarSystemEngine(container, {
        // Start at real "now" so the clock reads true UTC and the spacecraft
        // sits at its present position along the trajectory.
        startDate: new Date(),
        timeScale: rateFromPos(0),
        // Centre on the Sun: it's the heliocentric anchor, so rotating from the
        // default view is a turntable around the Sun rather than around an
        // invisible near-Earth point (which read as "orbiting empty space").
        focus: { x: 0, y: 0, z: 0 },
        viewDistance: 2.5,
        // True physical sizes, kept visible by a screen-space floor: from afar
        // every body holds a few pixels (never the sub-pixel dots true scale
        // would otherwise give); fly in and it relaxes to honest proportions.
        // This also fixes L2 for free — L2 sits ~0.01003 AU from Earth, and
        // Earth's true radius is ~4.3e-5 AU, so the marker is far outside the
        // globe at any zoom where you can actually resolve it.
        trueScale: true,
        minPixelRadius: 3.5,
        skyboxUrl: '/sterenn/textures/skybox/skybox.jpg',
      });

      // Sun–Earth Lagrange points. L2 is where RST sits; L3 is on the far side
      // of the Sun. They track Earth each frame, so they stay correct as you
      // scrub the clock.
      // Marker radius 0.002 AU (not 0.005): the dot is ~0.01 AU off Earth, so a
      // fat marker would still overlap the globe. This keeps its near edge
      // (~0.008 AU) clear of Earth's ~0.0065 AU surface.
      engine.addLagrangePoints({ names: ['L2', 'L3'], radius: 0.002, labels: true });

      // Load each craft's model and add it as a trajectory object. The loads are
      // async and independent; setSpacecraft keys by id, so RST and JWST coexist
      // and either can arrive first — see SolarSystemEngine.setSpacecraft.
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      loader.setDRACOLoader(dracoLoader);
      for (const craft of SPACECRAFT) {
        const data = trajectories[craft.id];
        if (!data) continue; // no trajectory for this craft; skip it
        loader.load(craft.modelUrl, (glb: GLTF) => {
          const model = glb.scene.clone();
          model.scale.setScalar(craft.modelScale);
          // Nose-trim base; the engine aims the nose down the trajectory on top of it.
          model.rotation.set(...craft.calibration);
          // Points are offsets from Earth, so the craft is parented under Earth and
          // its L2 halo rides along — see SolarSystemEngine.setSpacecraft.
          engine.setSpacecraft({
            id: craft.id,
            parentBody: craft.parentBody,
            color: craft.color,
            radius: craft.radius,
            points: toTrajectoryPoints(data),
            object: model,
            orientToTrajectory: true,
            label: craft.label,
            dash: craft.dash,
          });
        });
      }
      engine.start();
      // Show the clock immediately, regardless of when the models finish loading.
      setSimDate(engine.getDate());
      engineRef.current = engine;
    }
    if (teardownTimer.current) {
      clearTimeout(teardownTimer.current);
      teardownTimer.current = null;
    }

    // Poll the simulation clock for the readout (~5 Hz shows seconds ticking).
    const clock = window.setInterval(() => {
      const engine = engineRef.current;
      if (engine && editingDepth.current === 0) setSimDate(engine.getDate());
    }, 200);

    return () => {
      window.clearInterval(clock);
      teardownTimer.current = setTimeout(() => {
        engineRef.current?.dispose();
        engineRef.current = null;
        teardownTimer.current = null;
      }, 0);
    };
  }, [trajectories]);

  const applyRate = (nextPlaying: boolean, nextPos: number): void => {
    engineRef.current?.setTimeScale(nextPlaying ? rateFromPos(nextPos) : 0);
  };

  const handlePlayPause = (): void => {
    const next = !playing;
    setPlaying(next);
    applyRate(next, speedPos);
  };

  const handleSpeed = (_event: Event, value: number | number[]): void => {
    const raw = Array.isArray(value) ? value[0] : value;
    // Snap the centre dead zone to exactly 0 so real time is easy to land on.
    const pos = Math.abs(raw) < CENTRE_DEADZONE ? 0 : raw;
    setSpeedPos(pos);
    // Grabbing the shuttle implies you want it running.
    setPlaying(true);
    applyRate(true, pos);
  };

  const handleDateChange = (date: Date): void => {
    engineRef.current?.setDate(date);
    setSimDate(date);
  };

  const handleNow = (): void => handleDateChange(new Date());
  const handleRecenter = (): void => engineRef.current?.recenter();

  const startEditing = (): void => {
    editingDepth.current += 1;
  };
  const stopEditing = (): void => {
    editingDepth.current = Math.max(0, editingDepth.current - 1);
  };

  const buttonSx = { color: '#e6edf3', borderColor: 'rgba(255, 255, 255, 0.25)' };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '1040px' }}>
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, backgroundColor: '#05070d' }}
      />

      {/* Top-left: the date/time HUD. */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 2 }}>
        {simDate && (
          <DateTimeSpinner
            value={simDate}
            onChange={handleDateChange}
            onInteractStart={startEditing}
            onInteractEnd={stopEditing}
          />
        )}
      </Box>

      {/* Bottom: time transport. */}
      <Paper
        elevation={6}
        sx={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          bgcolor: 'rgba(10, 14, 22, 0.82)',
          color: '#e6edf3',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Tooltip title={playing ? 'Pause' : 'Play'}>
          <IconButton onClick={handlePlayPause} sx={{ color: '#00ffcc' }}>
            <Icon icon={playing ? 'mdi:pause' : 'mdi:play'} width={28} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Back to real time">
          <span>
            <IconButton
              onClick={() => handleSpeed(new Event('reset'), 0)}
              disabled={speedPos === 0 && playing}
              sx={{ color: speedPos === 0 ? '#9fb0c3' : '#00ffcc' }}
            >
              <Icon icon="mdi:target" />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 320, px: 2 }}>
          <Slider
            size="small"
            min={-1}
            max={1}
            step={0.001}
            marks={SPEED_MARKS}
            track={false}
            value={speedPos}
            onChange={handleSpeed}
            aria-label="Time speed"
            sx={{
              color: '#00ffcc',
              // Emphasise the centre tick — it's the "real time" home position.
              '& .MuiSlider-markLabel': { color: '#9fb0c3', fontSize: 11 },
              '& .MuiSlider-mark': { backgroundColor: 'rgba(255,255,255,0.35)' },
              '& .MuiSlider-mark[data-index="0"]': {
                height: 12,
                width: 2,
                backgroundColor: 'rgba(255,255,255,0.7)',
              },
            }}
          />
        </Box>

        <Box
          sx={{
            minWidth: 84,
            textAlign: 'center',
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: playing ? '#00ffcc' : '#9fb0c3',
          }}
        >
          {formatSpeed(speedPos, playing)}
        </Box>

        <Button variant="outlined" size="small" onClick={handleNow} sx={buttonSx}>
          Now
        </Button>
        <Button variant="outlined" size="small" onClick={handleRecenter} sx={buttonSx}>
          Recenter
        </Button>
      </Paper>
    </Box>
  );
};
