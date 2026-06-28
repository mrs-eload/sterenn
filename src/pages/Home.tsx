import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { fontFamily } from '@app/theme/typography';
import { Logo5 as Logo } from '@app/theme/icons/Logo5';
import paths from '@app/routes/paths';
import { LocationSearch } from '@app/features/conditions/components/LocationSearch';
import { useRecentLocations } from '@app/features/conditions/recentLocations';
import type { ObservingLocation } from '@app/features/conditions/hooks/useTonight';

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number; // 0..1, counts down
}

// Tints sampled from the palette so the field reads as "our" night sky, not a
// generic black canvas: cool white, a cyan, and the brand purple.
const STAR_TINTS = ['255,255,255', '128,223,255', '203,140,255'];

/**
 * The hero's living night sky. A single <canvas> drawing a few hundred twinkling
 * stars plus the occasional shooting star — cheap, asset-free, and crisp at any
 * size (no video file to ship or buffer). Honours prefers-reduced-motion: when
 * the user asks for less motion we paint one static frame and stop.
 *
 * Kept at module scope (not redefined per render) so its identity is stable, and
 * self-contained so the page above stays declarative.
 */
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let shooting: ShootingStar[] = [];
    let raf = 0;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const tint = (i: number) => STAR_TINTS[i % STAR_TINTS.length];

    function build() {
      width = parent!.clientWidth;
      height = parent!.clientHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with area so the field looks the same on a phone and a
      // wide monitor, capped so we never draw an absurd number.
      const count = Math.min(420, Math.round((width * height) / 5500));
      stars = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: rand(0.4, 1.6),
        baseAlpha: rand(0.15, 0.9),
        twinkleSpeed: rand(0.6, 2.4),
        // Reuse the index as a colour pick and a phase offset so twinkles desync.
        phase: i * 1.7,
      }));
    }

    function drawStar(s: Star, alpha: number, i: number) {
      const c = tint(i);
      ctx!.beginPath();
      ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${c},${alpha})`;
      ctx!.fill();
      // A faint halo on the brighter stars for a touch of bloom.
      if (s.r > 1.1) {
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${c},${alpha * 0.12})`;
        ctx!.fill();
      }
    }

    function spawnShooting() {
      // Enter from the top edge, streak down and across to the right.
      const angle = rand(Math.PI * 0.12, Math.PI * 0.28);
      const speed = rand(6, 10);
      shooting.push({
        x: rand(0, width * 0.7),
        y: rand(-20, height * 0.3),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: rand(80, 160),
        life: 1,
      });
    }

    function drawShooting(s: ShootingStar) {
      const tailX = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.len;
      const tailY = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.len;
      const grad = ctx!.createLinearGradient(s.x, s.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255,255,255,${0.9 * s.life})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = 2;
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      ctx!.moveTo(s.x, s.y);
      ctx!.lineTo(tailX, tailY);
      ctx!.stroke();
    }

    function frame(t: number) {
      ctx!.clearRect(0, 0, width, height);
      const time = t / 1000;

      stars.forEach((s, i) => {
        const tw = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.phase);
        drawStar(s, s.baseAlpha * (0.35 + 0.65 * tw), i);
      });

      // Roughly one shooting star every few seconds, never more than two at once.
      if (shooting.length < 2 && Math.random() < 0.004) spawnShooting();
      shooting = shooting.filter((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0 || s.x > width + s.len || s.y > height + s.len) return false;
        drawShooting(s);
        return true;
      });

      raf = requestAnimationFrame(frame);
    }

    function paintStatic() {
      ctx!.clearRect(0, 0, width, height);
      stars.forEach((s, i) => drawStar(s, s.baseAlpha, i));
    }

    build();
    if (reduceMotion) {
      paintStatic();
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      build();
      if (reduceMotion) paintStatic();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      aria-hidden
      sx={{ position: 'absolute', inset: 0, width: 1, height: 1, display: 'block' }}
    />
  );
}

/**
 * The landing page (index route '/'). A page-wide animated night sky, with the
 * brand and the one action that actually starts the app: pick where you're
 * observing. Choosing a place (or a recent) routes straight to the weather view
 * for that site — the homepage is the funnel, not a wall of placeholder cards.
 *
 * No data or astronomy here: it only turns a location pick into a URL. All the
 * forecasting still happens in features/conditions behind /weather.
 */
const Home = () => {
  const navigate = useNavigate();
  const { recents, remember } = useRecentLocations();

  // A pick is the whole point of this page: remember it (so it's a recent chip
  // next time) and hand off to the weather view via the URL it already reads —
  // ?lat&lon is ConditionsView's source of truth for which site to forecast.
  const handlePick = useCallback(
    (loc: ObservingLocation) => {
      remember(loc);
      navigate(`${paths.weather}?lat=${loc.lat}&lon=${loc.lon}`);
    },
    [remember, navigate],
  );

  return (
    <Stack direction="column" sx={{ flexGrow: 1 }}>
      {/* Full-page night sky — a fixed layer behind everything on this page, so
          the stars fill the whole viewport. It sits at zIndex 0 (under the page
          content) and below the sticky top bar, which keeps its own zIndex. */}
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          // Deep twilight base with two drifting nebula glows on top. The glows
          // breathe via @keyframes; the canvas starfield sits above this.
          background: (theme) =>
            `radial-gradient(80% 55% at 80% 0%, ${theme.palette.primary.dark}55 0%, transparent 55%),` +
            `radial-gradient(80% 60% at 10% 100%, ${theme.palette.info.dark}77 0%, transparent 55%),` +
            `linear-gradient(160deg, ${theme.palette.info.darker} 0%, #050a1c 100%)`,
        }}
      >
        <Starfield />

        {/* Slow aurora wash — a soft moving glow above the stars.
            Animated only when the user hasn't asked for reduced motion. */}
        <Box
          sx={{
            position: 'absolute',
            inset: '-30%',
            pointerEvents: 'none',
            background: (theme) =>
              `radial-gradient(40% 40% at 50% 50%, ${theme.palette.primary.main}22 0%, transparent 70%)`,
            '@media (prefers-reduced-motion: no-preference)': {
              animation: 'aurora 18s ease-in-out infinite alternate',
            },
            '@keyframes aurora': {
              '0%': { transform: 'translate(-8%, -6%) scale(1)' },
              '100%': { transform: 'translate(10%, 8%) scale(1.25)' },
            },
          }}
        />
      </Box>

      {/* Hero — brand, tagline, and the location picker, floating over the sky. */}
      <Stack
        direction="column"
        spacing={3.5}
        sx={{
          position: 'relative',
          zIndex: 1,
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          py: { xs: 5, md: 7 },
          px: 3,
        }}
      >
        <Box
          sx={{
            '@media (prefers-reduced-motion: no-preference)': {
              animation: 'logoFloat 6s ease-in-out infinite',
            },
            '@keyframes logoFloat': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-10px)' },
            },
          }}
        >
          <Logo
            sx={{
              fontSize: { xs: 72, md: 96 },
              color: 'text.primary',
              // A purple glow so the mark feels lit from within the sky.
              filter: (theme) => `drop-shadow(0 0 18px ${theme.palette.primary.main}88)`,
            }}
            letterColor="currentColor"
            ringColor="currentColor"
          />
        </Box>

        <Stack direction="column" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Typography
            variant="h1"
            sx={{
              fontFamily: fontFamily.workSans,
              letterSpacing: 2,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
            }}
          >
            Sterenn
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 540, fontSize: '1.125rem' }}>
            Plan your night under the stars. Pick where you're observing and Sterenn
            reads tonight's sky — when it's dark, and whether it's clear long enough to
            actually integrate.
          </Typography>
        </Stack>

        {/* The primary action. On pick, handlePick routes to /weather for the
            chosen site. value is null here — this page never holds an active
            location, it just hands one off. */}
        <Box sx={{ width: 1, maxWidth: 460, textAlign: 'left' }}>
          <LocationSearch recents={recents} value={null} onChange={handlePick} />
        </Box>
      </Stack>
    </Stack>
  );
};

export default Home;
