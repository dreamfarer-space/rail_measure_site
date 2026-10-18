---
title: Verticality
nav: Verticality
kicker: Measurement 01
lede: Optical plumb-line tracking measures elevator guide rail verticality by projecting a stationary laser beam onto a traveling target paper observed by an onboard camera.
meta: 0.5 s window · 0.256557 mm/px · ±3 mm
---

## Principle {#principle}

A laser emitter is rigidly mounted at the top of the elevator hoistway, directing a plumb beam downward through the shaft. Cart A clamps onto the guide rail and descends along it. Mounted on the front of Cart A is a target paper diffuser that intercepts the plumb beam, while an OAK-D Pro W camera sits behind the paper, imaging the transmitted laser spot. A downward-facing USB laser rangefinder mounted on the cart continuously measures vertical height.

Because the downward beam is aligned to plumb and stays fixed, any physical bend or misalignment in the guide rail translates the cart and target paper relative to the stationary beam. As Cart A travels down the hoistway, the optical spot traverses the target paper. Measuring the position of the transmitted spot relative to paper coordinates directly quantifies horizontal guide rail displacement.

The inspection sequence begins by setting a reference point at a chosen datum; the worked example in the figure uses 20 m. As Cart A descends, the operator records a point at each stop; the example uses 2 m spacing. The system calculates horizontal displacement vectors (dX and dY) relative to the baseline reference. Any point whose displacement exceeds the configurable ±3 mm tolerance boundary is immediately flagged as out of tolerance.

[[figure:principle]]

## What the camera sees {#what-the-camera-sees}

The OAK-D Pro W camera observes the rear surface of the white target paper under locked exposure. When the green laser strikes the paper, it produces a bright core, which is often saturated, surrounded by a green scattering halo caused by paper diffusion. Candidates are identified as pixels that are brighter than the background and greener than the background.

Subpixel centroid localization uses an intensity-weighted average after background subtraction, rather than a binary contour centroid. Conventional binary thresholding fails because masking out the saturated core creates an empty ring, discarding the highest-energy physical center of the laser beam. By subtracting local background intensity and weighting the remaining pixel energies, the subpixel centroid remains stable across overexposed cores.

::: note 1
intensity weighting preserves subpixel accuracy across saturated cores where binary contour masking hollows out the beam center
:::

[[figure:spotlab]]

The figure above links a synthetic Gaussian spot to a replica of the operator panel. Adjust beam radius, green amplitude, and sensor noise; as the spot moves, the panel follows and shows a simplified detector's segmentation, halo count, and coordinates. It is a teaching replica, not the production pipeline.

## Quality gates {#quality-gates}

Candidate spot regions must satisfy strict geometric and radiometric gates configured under `verticality.detection.*`: area, aspect ratio, fill ratio, and green ratio. Under ideal synthetic testing, 20 frames of an unsaturated spot yielded 0.046 px RMS error, while 20 frames of a saturated spot gave 0.016 px RMS.

However, comprehensive synthetic probe benchmarks conducted in Issue #20 revealed severe failure modes in non-ideal conditions:

- A 20×20 px pure white, fully saturated block was accepted at (309.5, 209.5) with 100% saturation because saturation logic previously skipped the green test. The detector now requires at least `min_halo_px` unsaturated green pixels. A white metallic reflection has no halo and is rejected.
- A secondary half-intensity halo 8 px to the right biased the centroid to x = 322.4277 instead of 320 (2.43 px). This is a connected halo, not a second candidate: it stays below the elongation gate and is still accepted. The bias is documented under Limits rather than hidden.
- A spot with true center at x = 2 px returned x = 3.9208 (1.92 px inward bias); at x = 5 px the bias was 0.74 px. Any candidate touching the frame or ROI edge is marked `clipped` and excluded from averaging.
- After tracking loss, a white reflection at (479.5, 329.5) was picked up. Tracking now prefers candidates within `track_gate_px` of the previous position.
- A 0.42 s window of 15 frames moving from x = 100 to 114 passed all filters (mean 107, std 4.47 px), lagging 7 px (about 1.80 mm at default scale) behind the newest position. Linear drift and jitter checks now reject moving windows.

The `elongated` gate exists to detect deformed spots but remains disabled by default. Saturation above `max_saturated_frac` warns overexposed, but the measurement remains usable if the halo is preserved.

[[figure:quality]]

## Averaging {#averaging}

When setting a datum or recording a measurement, the system averages spot positions over a 0.5 s window (`average_window_sec`). Outlier rejection uses Median Absolute Deviation (MAD) with a 0.5 px floor (`outlier_mad_floor_px`). A valid reading requires at least 5 samples (`average_min_samples`). If more than 15% of frames are rejected (`outlier_max_fraction`), the measurement is rejected. The sample is also rejected if window drift exceeds 2 px (`average_max_drift_px`) or either axis standard deviation exceeds 2.5 px (`average_max_std_px`). Hoistway vibration above about 5 Hz normally averages out inside the 0.5 s window, except when it aliases with the frame rate (see below).

Issue #25 exposed a harmonic aliasing vulnerability: a 10 Hz vibration with 4 px amplitude sampled at 30 fps over 0.5 s (15 frames) placed every frame on one of three phases: 5 frames at 324 px and 10 frames at 318 px, around a true center of 320 px. The median was 318 px. Because 10 frames sat on the median, MAD evaluated to zero. The resulting ±0.35 px threshold rejected all 5 peak frames at 324 px as outliers.

The remaining 10 frames had zero variance and zero drift. Because the stability check ran after MAD, the system declared the reading stable, outputting dx = −0.513 mm with std = 0.0000 mm—a fabricated perfect measurement with a half-millimeter bias. Across 500 randomized trials, this passed 130 times (26%) with 1.99 px RMS displacement from true center.

The shipped fix caps outlier rejection at 15%, so the 33% cull in this case is rejected as `outliers`. The raw-spread pre-check and the one-sided rejection test proposed in #25 are not implemented; they remain recommendations.

## Calibration {#calibration}

Converting pixel coordinates to target millimeters depends on whether target-plane calibration has been performed.

| Calibration mode | Transformation | Tilt and roll correction |
|---|---|---|
| Target-plane calibration | Undistort + planar homography | Compensates paper tilt and camera roll |
| Uncalibrated default | Undistort + single scale (0.256557 mm/px) | No tilt or roll correction |

With target-plane calibration, spot coordinates are undistorted using calibrated camera intrinsics and transformed via planar homography. This homography transformation mathematically absorbs target paper tilt and camera roll relative to the cart chassis. Without target-plane calibration, the system applies radial lens undistortion and multiplies coordinates by a single scale of 0.256557 mm/px, offering no correction for paper tilt or roll. In both modes, final coordinates are rotated according to `verticality.target.axis_rotation_deg` to match the hoistway axis orientation.

Lens distortion calibration on the wide-angle OAK-D Pro W camera requires multi-angle views of a ChArUco target. In the simulated wide-angle grid from #25, the maximum undistortion error inside the covered area fell from 1.27 px to 0.54 px, while points extrapolated outside the covered area still reached 22.95 px. Reprojection RMS stayed near 0.355 px in both runs and is not a measure of edge extrapolation. Keep the spot inside the region the board actually covered.

## Limits {#limits}

The ±3 mm screening box provides an operational guide for field personnel, but it does not represent a certified national-standard tolerance decision for a specific elevator rail installation. Official compliance requires a licensed inspector to evaluate installation specifications and formal measurement protocols.

Furthermore, the standard deviation computed across the 0.5 s window reflects short-term mechanical stillness and image consistency, not absolute measurement accuracy. Systematic optical biases—such as an asymmetric attached halo (which causes a 2.44 px bias at 8 px offset) or uncorrected lens distortion—are repeatable and cannot be eliminated by temporal averaging.

::: note 2
temporal window stability confirms that the inspection cart is motionless but cannot detect fixed optical biases from asymmetric halos or uncalibrated lens regions
:::

> A stable window means the filtered samples agree. It does not prove the cart is still, and it cannot detect a fixed optical bias.
