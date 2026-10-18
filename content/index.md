---
title: rail_measure
nav: rail_measure
subtitle: offline rail inspection
kicker: System overview
lede: An offline elevator guide rail inspection system combining laser verticality, spatial depth, and defect classification across two edge nodes.
meta: Dual edge nodes · Standalone site LAN
---

Elevator guide rail verification traditionally depends on a mechanical plumb wire, a handheld tape, and a flashlight. An inspection crew stops the car to evaluate rail verticality, check car-top overhead clearances, and search for surface wear or damaged wire ropes. Each assessment requires an isolated manual judgment under harsh lighting, where air drafts deflect the wire and handwritten inspection logs leave no verifiable sensor trail.

## What it is {#what-it-is}

The rail_measure system is an offline field screening instrument for guide rail inspection. Mounted on two motorized carts that travel the shaft, the equipment captures geometric deviations and structural condition without physical contact through optical tracking, active stereo depth, and onboard neural inference.

Processing executes locally across two edge nodes on an isolated site LAN, with no internet access or cloud infrastructure. Measurements accumulate in one active session; the node writes evidence files as they are produced, the session itself is saved to node 2 when the operator saves it, and an onboard rule engine turns it into a Markdown screening report.

::: note 1
all computations and evidence records remain within local edge nodes without outbound network telemetry
:::

## Three measurements {#three-measurements}

The inspection workflow groups physical hoistway evaluation into three specialized measurement pipelines.

| Measurement | Hardware | Primary output |
|---|---|---|
| Verticality | Node 1 (Raspberry Pi, OAK-D Pro W color camera, USB rangefinder) | Height-indexed dX/dY displacement and ±3 mm tolerance check |
| Spatial dimensions | Node 2 (Lubancat RK3588, OAK-D Pro W stereo depth, IMU) | Fused 3D point distances, car-top clearance grid, shaft profile |
| Defect recognition | Node 2 (Fine-tuned DINOv2 ViT-S/14, RKNN/ONNX/OpenCV) | Anomaly probability, 8-class defect label, undetermined flag |

## Two nodes {#two-nodes}

Physical sensing is divided across two edge nodes on the site LAN. Node 1 rides on Cart A to track the plumb line and vertical travel height. Node 2 rides on Cart B, serving the web UI on port 8080 and executing spatial depth calculations alongside visual defect classification while polling Node 1 for health.

[[figure:robots]]

| Node | Hardware platform | Network ports | Functional role |
|---|---|---|---|
| Node 1 | Raspberry Pi 4B/5, OAK-D Pro W (IMX378), USB rangefinder | WebSocket 8765, HTTP 8081 | Plumb laser spot tracking and vertical travel height |
| Node 2 | Lubancat RK3588 (or 8 GB Pi), OAK-D Pro W (stereo, IR, IMU) | HTTP 8080 (Web UI, REST API) | Stereo depth, defect inference, session storage |

Node 1 exposes a WebSocket on port 8765 for spot telemetry and a status endpoint on port 8081. Node 2 polls Node 1 for health and frame status.

## One session {#one-session}

Every measurement belongs to one session. The active session lives in the browser; confirming a clearance writes evidence files to node 2 immediately, while the session record is persisted on node 2 only when the operator saves it. Save before switching devices.

At the conclusion of a hoistway run, the onboard rule engine evaluates all logged readings against screening thresholds and compiles a comprehensive Markdown report. The edge stack is Python 3.9–3.12 with DepthAI 2.29; the browser UI, the Electron desktop client, and the Android WebView client are separate operator terminals on the same LAN. The report is generated on node 2 without cloud calls.

::: note 2
the onboard rule engine generates the complete inspection summary without calling any external or hosted services
:::

## What it is not {#what-it-is-not}

The rail_measure system is engineered strictly as an objective field screening tool rather than an automatic acceptance authority. It does not replace the national-standard tolerance decision for a specific guide rail model and measurement method, which remains the sole legal responsibility of a certified human inspector.

The onboard screening report flags out-of-tolerance displacements, occluded clearance zones, and suspicious surface patterns to guide inspector scrutiny. All flagged anomalies require direct visual confirmation, and no automated alarm constitutes a formal declaration of hoistway compliance.

> A field screening tool organizes physical hoistway geometry into verifiable sensor records so that inspectors can make decisions based on repeatable data rather than manual guesswork.
