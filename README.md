# Drilling Parameter Optimization

A browser-based drilling analysis application for comparative evaluation of WOB, RPM, ROP, MSE and ECD.

## Engineering model

- Hydrostatic pressure: `P_h = 0.0981 × MW × TVD` bar, with MW in g/cc and TVD in m.
- ECD: `ECD = MW + ΔP_annular / (0.0981 × TVD)` g/cc.
- ROP: simplified empirical power-law relationship using WOB, RPM, bit diameter, formation strength and bit wear.
- MSE: SI energy-per-volume form `MSE = WOB/A + (T×ω)/(A×v)`, converted from Pa to MPa.
- Bit efficiency: a transparent wear-based factor used by the simplified ROP model.
- Optimization: grid search over WOB and RPM to maximize modeled ROP subject to entered MSE and ECD limits.

## Important interpretation

This is a simplified comparative model. The ROP constants should be calibrated using offset-well or laboratory data before being used for predictive field work. Real drilling optimization also considers hydraulics/flow rate, pressure window, hole cleaning, bit/BHA dynamics, stick-slip, vibration, torque/drag, trajectory, bit type, formation variability and operational limits.

The application deliberately does not plot Depth vs ROP because TVD is not an explicit variable in the current ROP correlation. ECD is calculated from the supplied mud weight, TVD and annular pressure loss; therefore it does not directly vary with WOB or RPM in this model.

## Run

Backend:

```text
cd server
npm install
npm run dev
```

Frontend in a second terminal:

```text
cd client
npm install
npm run dev
```

Open the Vite localhost address shown in the terminal.
