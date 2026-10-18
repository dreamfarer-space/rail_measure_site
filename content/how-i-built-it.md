---
title: How I built it
nav: How I built it
kicker: Engineering notes
lede: An engineering log on building an offline inspection instrument, debugging synthetic edge cases, and catching aliased vibrations before field deployment.
meta: Issues #20 & #25 · Synthetic probes · Static site
---

## Starting point {#starting-point}

When I started building rail_measure, the goal was to replace manual plumb lines and handwritten inspection sheets with an offline, edge-computed instrument. The physical architecture split sensing across two hardware nodes: Cart A carrying a Raspberry Pi, an OAK-D Pro W camera, and a laser rangefinder to measure rail verticality, while Cart B carried an RK3588 board to handle stereo depth clearances and defect recognition.

The first synthetic tests were deceptively encouraging. On clean frames with a stationary Gaussian spot and no reflections, subpixel centroid tracking looked trivial: 20 unsaturated frames gave 0.046 px RMS, and 20 frames with a saturated core gave 0.016 px RMS. On ideal images, finding the centre of a laser beam looked like a solved problem.

## First probes {#first-probes}

I knew that testing an experimental instrument inside an active elevator hoistway is slow, expensive, and unforgiving. If a vision algorithm locks up or misinterprets an optical reflection halfway down a forty-story shaft, you cannot easily attach a debugger or replay optical conditions.

Before bringing the hardware to a job site, I built a suite of synthetic software probes in Python to systematically assault the vision pipeline. These probes modeled physical imperfections: saturated specular reflections from polished rail steel, beam clipping along image boundaries, diffuse secondary halos from paper fiber scattering, and continuous cart velocity.

The results of those synthetic probes dismantled my initial confidence. The textbook algorithms that performed impeccably on symmetrical test spots failed abruptly when confronted with real-world hoistway optics. Instead of small random errors, the system exhibited large, systematic measurement biases that could easily misclassify a warped guide rail as straight, or an aligned rail as out of tolerance.

::: note 1
synthetic probes exposed that simple centroid algorithms interpret border clipping and metallic reflections as legitimate guide rail deviations
:::

## What broke {#what-broke}

The failures uncovered by the synthetic test harness culminated in Issue #20, exposing five distinct vulnerabilities:

- Saturated white reflection: a 20×20 px pure white, fully saturated block was accepted as a valid laser spot at (309.5, 209.5) because saturation logic previously skipped the green test. The detector now requires at least `min_halo_px` unsaturated green pixels, rejecting halo-free metallic reflections.
- Asymmetric secondary halo: simulating paper scattering with a secondary half-intensity halo positioned 8 px to the right shifted the intensity centroid to x = 322.4277 instead of 320 (2.43 px error). Ambiguous candidates exceeding `max_competing_ratio` (default 0.5) are now rejected.
- Boundary clipping: at x = 2 px, the centroid returned x = 3.9208 (1.92 px inward bias); at x = 5 px, the bias was 0.74 px. Candidates touching the frame or ROI border are marked `clipped` and discarded.
- Tracking loss: after tracking loss, a white reflection at (479.5, 329.5) was picked up as the target. Tracking now restricts reacquisition to `track_gate_px`.
- Moving window: 15 frames over 0.42 s moving from x = 100 to 114 passed all filters (mean 107, std 4.47 px), lagging 7 px (approximately 1.80 mm at default scale) behind the newest position. Linear drift and jitter checks now reject moving windows.

| Failure condition | Observed synthetic error | Root algorithmic cause | Quality gate countermeasure |
|---|---|---|---|
| Saturated white block | Accepted at (309.5, 209.5) | Saturation bypassed green excess check | Require `min_halo_px` unsaturated green pixels |
| Asymmetric halo (+8 px) | Centroid biased by +2.43 px | Intensity weighting dragged by the attached halo | Not caught: elongation stays below threshold, bias remains |
| Boundary truncation (x=2) | Centroid biased inward by +1.92 px | Missing pixels shift intensity center | Mark as `clipped` and discard from averaging |
| Tracking reacquisition | Locked onto glare at (479.5, 329.5) | Global search without spatial context | Restrict reacquisition to `track_gate_px` |
| Continuous window motion | Lagged 7 px (1.80 mm) behind true position | Outlier filter cannot detect linear trend | Linear fit drift check (`average_max_drift_px`) |

The detector now enforces the `verticality.detection.*` gate suite to validate candidates before they enter window averaging.

## The second bug {#the-second-bug}

Even with quality gates in place, a far more deceptive flaw emerged during vibration testing, documented in Issue #25.

Guide rails vibrate as carts travel. Simulating a 10 Hz vibration with 4 px amplitude sampled at 30 fps over 0.5 s (15 frames) created a harmonic lock: every frame landed on one of three phases: 5 frames at 324 px and 10 frames at 318 px (true center 320 px).

The median of the 15 frames was 318 px. Because 10 frames sat on the median, MAD evaluated to zero, clamping the threshold to ±0.35 px. The algorithm deleted the 5 peak frames at 324 px as outliers. The surviving 10 frames had zero variance and zero slope. Because stability was checked after outlier removal, the system declared the reading stable: it output dx = −0.513 mm with std = 0.0000 mm—a fabricated perfect measurement with a half-millimeter bias. Across 500 randomized trials, this passed 130 times (26%) with 1.99 px RMS error from true center.

The shipped fix caps outlier rejection at 15% (`outlier_max_fraction`), which catches the 33% cull here. The raw-spread pre-check and the one-sided rejection test suggested in #25 are not implemented.

Residual risks remain documented: asymmetric attached halos still induce up to 2.44 px single-frame bias at an 8 px offset; ChArUco calibration outside the covered area reaches 22.95 px error even though the covered area fell from 1.27 px to 0.54 px.

::: note 2
harmonic aliasing between frame rate and hoistway vibration caused MAD filtering to discard true physical oscillations and report fabricated zero-variance measurements
:::

## The site {#the-site}

I structured this documentation site to reflect the same engineering principles that govern the instrument itself. There is no modern web framework, no npm dependency tree, and no runtime telemetry. The site is generated as static HTML using a minimal JavaScript builder that compiles Markdown source files into clean, readable layouts.

Every interactive diagram on these pages—from the linked laser spot simulator to the spatial clearance viewer and the quality gate visualizer—is built directly using hand-crafted SVG elements and native HTML5 canvas scripts. Nothing is imported from external charting libraries.

Every threshold and failure metric on this site is traced to repository code, configuration, or the two issue logs. Numbers that come from a synthetic probe are labelled as such; numbers that only illustrate a mechanism, such as the 3.2 mm per unit in the spatial figure, are labelled illustrative and are not presented as measurements.

## What I learned {#what-i-learned}

Building an offline industrial inspection tool taught me that field robustness is an exercise in disciplined paranoia. In an elevator shaft, every assumption an engineer makes about uniform lighting, clean surfaces, or random noise will eventually be violated by real hardware. If an algorithm contains a blind spot where harmonic vibration mimics static stability, the physical structure will inevitably find that frequency and produce flawed numbers.

I learned that synthetic software probes are vastly more effective for algorithm validation than early field trials. Had I taken the initial verticality code directly into a customer hoistway, the subtle half-millimeter bias caused by harmonic aliasing would have blended unnoticed into background mechanical tolerances. Creating rigorous, adversarial probes in Python allowed me to isolate, reproduce, and eliminate edge-case failures before cutting metal or mounting sensors.

Finally, I came to appreciate that the integrity of a measurement instrument rests entirely on naming its operational boundaries. When an edge node cannot guarantee subpixel certainty due to uncalibrated lens regions, attached halos, or occluded clearance grids, the software must refuse to guess. True utility comes not from projecting an illusion of infallibility, but from delivering dependable, verifiable screening data that empowers human inspectors to make safe, defensible decisions.

> An engineering instrument proves its reliability by explicitly naming its boundaries rather than concealing failure modes behind artificial stability.
