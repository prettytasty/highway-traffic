// Shared world constants for the single-player highway.
// Forward on the highway is -Z. One world unit is one metre.

export const ROAD = {
  laneCount: 4,
  laneWidth: 3.7,
  width: 14.8,
  // Long enough for a full 150 second run at the supercar's top speed.
  length: 16000,
  startMargin: 200,
  endZ: -15700,
};

export const LANE_CENTERS = Array.from(
  { length: ROAD.laneCount },
  (_, i) => (i - (ROAD.laneCount - 1) / 2) * ROAD.laneWidth
);

export const RUN_SECONDS = 150;
export const COUNTDOWN_SECONDS = 3;

export const NEAR_MISS = {
  gap: 1.15, // metres of clear air between bodywork
  baseCredits: 12,
  minSpeed: 15,
};

export const START_CREDITS = 300;
export const CREDITS_PER_METRE = 0.09;
export const OVERTAKE_CREDITS = 2;
export const COMPLETION_BONUS = 120;
export const METRES_PER_MILE = 1609.344;

export const COLORS = {
  ink: 0xf4f1e8,
  cyan: 0x22e6ff,
  amber: 0xffad4d,
  pink: 0xff3d9a,
  fog: 0x2a1438,
};
