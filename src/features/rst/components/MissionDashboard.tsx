import React, { useMemo } from 'react';
import { useTrajectory } from '../hooks/useTrajectory.ts';
import { SolarSystemMap, RST_TRAJECTORY_URL, JWST_TRAJECTORY_URL } from './SolarSystemMap';

export const MissionDashboard: React.FC = () => {
  // One geocentric Horizons file per craft; both are L2 halos parented under Earth.
  const rst = useTrajectory(RST_TRAJECTORY_URL);
  const jwst = useTrajectory(JWST_TRAJECTORY_URL);

  // Keep the map keyed by craft id and stable across renders, so the engine (built
  // in a [trajectories]-keyed effect) isn't torn down and rebuilt every render.
  const trajectories = useMemo(
    () =>
      rst.trajectory && jwst.trajectory
        ? { rst: rst.trajectory, jwst: jwst.trajectory }
        : null,
    [rst.trajectory, jwst.trajectory],
  );

  const error = rst.error ?? jwst.error;
  if (error) {
    return <div style={{ color: 'red' }}>Failed to load trajectory: {error}</div>;
  }

  if (!trajectories) {
    return <div>Loading spacecraft data...</div>;
  }

  return <SolarSystemMap trajectories={trajectories} />;
};
