// The emission lines a narrowband passband is built around.
export enum EmissionLine {
  H_ALPHA = 'Ha',
  H_BETA = 'Hb',
  OIII = 'OIII',
  SII = 'SII',
  NII = 'NII',
}

// Rest wavelengths in air, nm. SII is a doublet (671.6 / 673.1 nm); filters
// are centred between the two, so its entry is the usual 672.
export const EMISSION_LINE_NM: Record<EmissionLine, number> = {
  [EmissionLine.H_ALPHA]: 656.3,
  [EmissionLine.H_BETA]: 486.1,
  [EmissionLine.OIII]: 500.7,
  [EmissionLine.SII]: 672,
  [EmissionLine.NII]: 658.4,
};
