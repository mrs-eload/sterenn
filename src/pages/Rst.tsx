import { MissionDashboard } from "@app/features/rst/components/MissionDashboard.tsx";

// Temporary subject — Nancy Grace Roman Space Telescope (RST) tracking.
// The whole subject lives under features/rst and is deletable as a unit; this
// page is just the route entry point.
const Rst = () => {
  return <MissionDashboard />;
};

export default Rst;
