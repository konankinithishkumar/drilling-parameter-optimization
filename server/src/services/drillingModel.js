const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

const K_ROP = 8.0;          // calibrated model constant for the demonstration dataset
const WOB_REF = 20;         // kN
const RPM_REF = 120;        // rev/min
const STRENGTH_REF = 40;    // MPa
const DIAMETER_REF = 8.5;   // in

function calculateHydrostaticPressure(mudWeight, tvd) {
  // P(bar) = 0.0981 * MW(g/cc) * TVD(m)
  return 0.0981 * mudWeight * tvd;
}

function calculateECD(mudWeight, annularPressureLoss, tvd) {
  // ECD(g/cc) = MW + APPL / (0.0981*TVD)
  return mudWeight + annularPressureLoss / (0.0981 * tvd);
}

function calculateBitArea(bitDiameterIn) {
  const d = bitDiameterIn * 0.0254;
  return Math.PI * d * d / 4;
}

function calculateROP({ wob, rpm, bitDiameter, formationStrength, bitWear }) {
  // Simplified empirical power-law ROP model.
  // It is intended for sensitivity/comparative analysis and must be calibrated with field/offset data for prediction.
  const bitEfficiency = clamp(1 - bitWear / 100, 0.35, 1);
  const rop = K_ROP *
    Math.pow(wob / WOB_REF, 0.65) *
    Math.pow(rpm / RPM_REF, 0.35) *
    Math.pow(STRENGTH_REF / formationStrength, 0.80) *
    Math.pow(DIAMETER_REF / bitDiameter, 0.20) *
    bitEfficiency;
  return rop;
}

function calculateMSE({ wob, torque, rpm, bitDiameter, rop }) {
  // SI form: MSE = WOB/A + (T*omega)/(A*v)
  // Units: Pa -> converted to MPa.
  const area = calculateBitArea(bitDiameter);
  const wobN = wob * 1000;
  const torqueNm = torque * 1000;
  const omega = 2 * Math.PI * rpm / 60;
  const ropMs = rop / 3600;
  if (area <= 0 || ropMs <= 0) return Infinity;
  const msePa = wobN / area + (torqueNm * omega) / (area * ropMs);
  return msePa / 1e6;
}

function analyzeDrilling(input) {
  const tvd = Number(input.tvd);
  const wob = Number(input.wob);
  const rpm = Number(input.rpm);
  const bitDiameter = Number(input.bitDiameter);
  const formationStrength = Number(input.formationStrength);
  const mudWeight = Number(input.mudWeight);
  const annularPressureLoss = Number(input.annularPressureLoss);
  const torque = Number(input.torque);
  const bitWear = Number(input.bitWear);

  if ([tvd,wob,rpm,bitDiameter,formationStrength,mudWeight,annularPressureLoss,torque,bitWear].some(v => !Number.isFinite(v) || v <= 0)) {
    throw new Error('All drilling inputs must be positive numbers.');
  }

  const hydrostaticPressureBar = calculateHydrostaticPressure(mudWeight, tvd);
  const ecd = calculateECD(mudWeight, annularPressureLoss, tvd);
  const rop = calculateROP({ wob, rpm, bitDiameter, formationStrength, bitWear });
  const mseMpa = calculateMSE({ wob, torque, rpm, bitDiameter, rop });
  const bitEfficiencyPercent = clamp((1 - bitWear / 100) * 100, 35, 100);

  // A transparent comparative index, not a universal field efficiency definition.
  const drillingEfficiencyPercent = clamp((formationStrength / mseMpa) * 100, 0, 100);

  const interpretation = [];
  if (rop > 0) interpretation.push(`Modeled ROP is ${rop.toFixed(2)} m/hr under the selected WOB, RPM, formation strength and bit-wear conditions.`);
  if (ecd > 1.45) interpretation.push('ECD is relatively high for the selected limits; review the assumed annular pressure loss and mud-weight window.');
  else interpretation.push('ECD is below the default modeled limit; the result should still be checked against the actual pore-pressure and fracture-pressure window.');
  if (mseMpa > formationStrength * 2) interpretation.push('MSE is substantially above formation strength; this can indicate inefficient energy transfer in the simplified model.');
  else interpretation.push('MSE is within a moderate range relative to the formation-strength input in this simplified comparison.');
  if (bitWear > 20) interpretation.push('Bit wear is reducing the modeled bit-efficiency factor; actual dull grading and bit condition should be used for field decisions.');

  return {
    rop: Number(rop.toFixed(2)),
    hydrostaticPressureBar: Number(hydrostaticPressureBar.toFixed(2)),
    ecd: Number(ecd.toFixed(3)),
    mseMpa: Number(mseMpa.toFixed(2)),
    bitEfficiencyPercent: Number(bitEfficiencyPercent.toFixed(1)),
    drillingEfficiencyPercent: Number(drillingEfficiencyPercent.toFixed(1)),
    bitAreaIn2: Number((Math.PI * bitDiameter * bitDiameter / 4).toFixed(3)),
    interpretation
  };
}

function sensitivity(input) {
  const wobValues = [10, 15, 20, 25, 30];
  const rpmValues = [80, 100, 120, 140, 160];
  const torqueValues = [4, 6, 8, 10, 12];

  return {
    wob: wobValues.map(wob => {
      const rop = calculateROP({ ...input, wob });
      return { parameter: wob, rop: Number(rop.toFixed(2)) };
    }),
    rpm: rpmValues.map(rpm => {
      const rop = calculateROP({ ...input, rpm });
      return { parameter: rpm, rop: Number(rop.toFixed(2)) };
    }),
    torque: torqueValues.map(torque => {
      const rop = calculateROP(input);
      const mse = calculateMSE({ ...input, torque, rop });
      return { parameter: torque, mse: Number(mse.toFixed(2)) };
    }),
    wobMse: wobValues.map(wob => {
      const rop = calculateROP({ ...input, wob });
      const mse = calculateMSE({ ...input, wob, rop });
      return { parameter: wob, mse: Number(mse.toFixed(2)) };
    })
  };
}

function optimize(input, ranges = {}) {
  const wobMin = Number(ranges.wobMin ?? 10);
  const wobMax = Number(ranges.wobMax ?? 30);
  const wobStep = Number(ranges.wobStep ?? 2);
  const rpmMin = Number(ranges.rpmMin ?? 80);
  const rpmMax = Number(ranges.rpmMax ?? 160);
  const rpmStep = Number(ranges.rpmStep ?? 10);
  const maxEcd = Number(input.maxEcd ?? 1.50);
  const maxMse = Number(input.maxMse ?? 2000);

  const feasible = [];
  for (let wob = wobMin; wob <= wobMax + 1e-9; wob += wobStep) {
    for (let rpm = rpmMin; rpm <= rpmMax + 1e-9; rpm += rpmStep) {
      const test = { ...input, wob, rpm };
      const result = analyzeDrilling(test);
      const ok = result.ecd <= maxEcd && result.mseMpa <= maxMse;
      if (ok) feasible.push({ wob, rpm, rop: result.rop, mse: result.mseMpa, ecd: result.ecd });
    }
  }

  feasible.sort((a, b) => b.rop - a.rop);
  const best = feasible[0] || null;
  return { best, feasiblePoints: feasible, constraints: { maxEcd, maxMse } };
}

export { analyzeDrilling, sensitivity, optimize };
