---
title: Spatial measurement
nav: Spatial measurement
kicker: Measurement 02
lede: Stereo depth sensing and inertial gravity vectors quantify hoistway clearances, component separations, and shaft cross-sections without contact.
meta: 200–12000 mm range · RANSAC reference plane · Four evidence files
---

## Depth {#depth}

Spatial measurement is executed by Node 2 utilizing an OAK-D Pro W stereo camera equipped with an infrared speckle dot projector and an integrated inertial measurement unit (IMU). The active IR pattern projects textured speckles onto featureless hoistway surfaces, enabling stereo disparity matching across dark, untextured concrete walls, metal brackets, and elevator car tops.

Cart B carries the camera on a two-servo head. Servo 5 turns a disc on four standoffs through 0–180°; servo 6, lying on that disc, tilts a U-bracket through 45–135°, and the camera hangs at the bracket's end with its heatsink to the back. At 90° and 90° it looks straight out of the cart into the shaft; tilting toward 45° brings the car top below into view.

[[figure:cart-b]]

The camera is configured for a 200–12000 mm depth range; that is a working envelope, not a guarantee of accuracy across the whole span. To prevent operators from taking measurements against stale image frames during intermittent network latency or hardware stalls, the system enforces strict timestamp freshness. If camera frame data is older than 2 s, snapshot and calculation endpoints immediately return HTTP 503 Service Unavailable, preventing operators from confirming measurements against outdated scene states.

## Two points {#two-points}

To measure mechanical clearances between isolated elevator components—such as rail bracket gaps, sill separations, or cable clearances—the operator stops Cart B at the inspection height and selects two points (P1 and P2) on textured surfaces in the live video stream.

The system retrieves fused stereo depth at both pixel coordinates and projects them into 3D camera coordinates to compute the Euclidean distance. When the onboard IMU is active, the system extracts the true gravity vector, resolving the 3D vector into a gravity-aligned vertical height difference (where P2 higher than P1 is reported as positive) and a horizontal projection.

For precise sub-centimeter alignment, the operator can drag the points directly on the touchscreen or adjust them via endpoint nudge controls. Tapping the nudge buttons shifts an endpoint by 1 px, while holding Shift shifts it by 5 px. A magnified inspection loupe renders in the corner of the preview to ensure points do not slip off narrow bracket edges.

[[figure:spatial-two]]

| Coordinate mode | Geometric basis | Coordinate reference | Operator adjustment |
|---|---|---|---|
| 3D distance | Fused stereo depth at P1 and P2 | Camera optical frame | Direct drag or 1 px / 5 px nudge |
| Vertical difference | Projection along IMU gravity vector | True vertical (gravity aligned) | Dependent on stable IMU orientation |
| Horizontal projection | Vector component orthogonal to gravity | Horizontal plane | Insensitive to camera mounting tilt |

## Clearance {#clearance}

Verifying overhead clearance above the elevator car top is a safety-critical procedure required to ensure maintenance personnel are protected from crushing hazards beneath overhead beams and shaft ceilings.

The operator initiates the clearance procedure by dragging a bounding box over the flat, unobstructed standing surface of the car top to define the reference plane. The system executes RANSAC plane fitting over hundreds of sampled depth points inside the box rather than relying on an arbitrary center pixel. The reference plane is rejected if fitting residuals are excessive, inlier ratios fall below threshold, or plane tilt exceeds `max_reference_tilt_deg`.

Next, the operator drags a second bounding box over the overhead structure, encompassing the shaft ceiling, horizontal beams, car-top equipment, or guard rails. The system divides this upper region into a regular inspection grid (`grid_rows × grid_cols`). For each grid cell, depth points are projected along the gravity vector onto the reference plane, and the system computes a low percentile of vertical distances (`cell_percentile`) to isolate the lowest protruding obstacle.

A fundamental safety rule governs grid processing: unknown cells—areas lacking valid depth due to specular reflections, glass, thin wire ropes, or occlusion—are explicitly marked as unknown and are never treated as empty space.

::: note 1
grid cells lacking depth returns are classified as unknown obstacles rather than open clearance to prevent false negative safety clearances
:::

[[figure:spatial-clear]]

## Evidence {#evidence}

When the operator confirms a clearance measurement, Node 2 freezes the calculation window and compiles four evidence files into the local archive (retained subject to the configured retention period):

1. Top view (`car_top_*_plan.png`): an orthographic projection looking downward along the gravity vector. The car-top standing surface is rendered in blue, overhead obstacles are color-coded from red (minimum clearance) to green (maximum clearance), and a prominent crosshair marks the critical lowest point.
2. Clearance profile (`*_section.png`): a cross-sectional elevation plot showing the lowest overhead profile across the width of the car top, with unobserved or occluded regions marked by diagonal hatching.
3. Colored point cloud (`.ply`): a full 3D point cloud capturing the spatial relationship between the reference plane and upper structures, suitable for external CAD or mesh review.
4. Quality JSON record: a detailed metadata file recording per-frame window depth measurements, RANSAC plane parameters, IMU gravity vectors, and sensor quality flags.

| Evidence file | File format | Primary visual and numerical content |
|---|---|---|
| Top view | PNG image | Plan view with blue reference plane and red-to-green obstruction contours |
| Clearance profile | PNG image | Elevation cross-section showing lowest structure with hatched unknown zones |
| Point cloud | PLY file | Fused 3D geometric mesh preserving true physical distances |
| Quality log | JSON file | Per-frame depth statistics, RANSAC fit residuals, and IMU gravity vectors |

These artifacts provide verifiable documentation that can be audited long after the physical inspection cart has been removed from the hoistway.

## Shaft station {#shaft-station}

To assess entire shaft dimensions, Node 2 operates in coordination with a dual-axis pan-tilt gimbal mounted on Cart B. The operator positions Cart B at a designated station height and commands the gimbal to sweep through a complete 360° horizontal revolution.

The capture routine spans 20 s by default. During the initial 1.0 s, the gimbal remains completely stationary to allow the system to estimate gyroscope zero-bias drift. As the camera pans, an onboard motion filter monitors rotational velocity; any frames where angular velocity exceeds `max_gyro_dps` are dropped to prevent motion blur from distorting depth.

From the accumulated point cloud slice, the system fits vertical wall planes to resolve clear shaft width, clear shaft depth, two diagonal spans, four interior corner angles, and wall tilt relative to the gimbal pivot. Multiple station sweeps at varying heights are aggregated to build a full-height clearance envelope.

## Limits {#limits}

A clear distinction must be maintained between hoistway envelope dimensions and usable car-top safety space: a shaft cross-section is not the usable car-top area, and total top-floor height is not car-top clearance.

Stereo depth resolution degrades quadratically with increasing distance, meaning measurements taken at 8 m possess significantly greater uncertainty than measurements taken at 1 m. Furthermore, car-top clearance evaluations represent static geometry at the current stationary cart position; they do not simulate dynamic buffer compression or counterweight overtravel conditions.

Finally, spatial measurements serve as a screening tool to highlight potential spatial non-conformances. Certified elevator sign-off requires independent verification using calibrated steel tape or laser distance meters.

::: note 2
stereo depth uncertainty scales quadratically with distance requiring critical long-range dimensions to be verified with physical tape measures
:::

> A static clearance measurement records geometry at rest and does not model dynamic counterweight overtravel or car buffer compression.
