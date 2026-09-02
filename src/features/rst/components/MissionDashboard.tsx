import React from 'react';
import { useRstTrajectory } from '../hooks/useRstTrajectory.ts';
import { SolarSystemMap } from './SolarSystemMap';

export const MissionDashboard: React.FC = () => {
  const { trajectory, error } = useRstTrajectory();

  if (error) {
    return <div style={{ color: 'red' }}>Failed to load trajectory: {error}</div>;
  }

  if (!trajectory) {
    return <div>Loading spacecraft data...</div>;
  }

  return <SolarSystemMap trajectory={trajectory} />;
};
