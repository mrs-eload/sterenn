import React, { useState, useEffect } from 'react';
import { parseHorizonsCompletely, FullHorizonsPayload } from '../data/horizon-parser.ts';
import { SolarSystemMap } from './SolarSystemMap';

export const MissionDashboard: React.FC = () => {
  const [trajectoryData, setTrajectoryData] = useState<FullHorizonsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Abort on cleanup so React StrictMode's double-invoked mount doesn't leave
    // two in-flight fetches, each resolving to a distinct parsed object. A
    // second object identity would re-run the SolarSystemMap effect and rebuild
    // the whole 3D scene a third time.
    const controller = new AbortController();

    // Fetch the raw text file from your public folder
    fetch('horizons/rst/RST_EPH_PRED_LONG_2026243_2027058_02.txt', {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        return response.text();
      })
      .then((rawText) => {
        // Run the parser you've already got
        const parsed = parseHorizonsCompletely(rawText);
        setTrajectoryData(parsed);
      })
      .catch((err) => {
        // The abort is expected on unmount/re-run, not a real failure.
        if (err.name === 'AbortError') return;
        console.error('Error loading trajectory:', err);
        setError(err.message);
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return <div style={{ color: 'red' }}>Failed to load trajectory: {error}</div>;
  }

  if (!trajectoryData) {
    return <div>Loading spacecraft data...</div>;
  }

  // Pass the parsed data down to the Three.js solar-system renderer
  return <SolarSystemMap horizonsData={trajectoryData} />;
};