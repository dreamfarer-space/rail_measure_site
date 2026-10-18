const AZIMUTH = 45;
const ELEVATION = 30;
const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
function cameraOf({ scale, azimuth = AZIMUTH, elevation = ELEVATION }) {
    const a = azimuth * RADIANS;
    const e = elevation * RADIANS;
    return { sinA: Math.sin(a), cosA: Math.cos(a), sinE: Math.sin(e), cosE: Math.cos(e), k: scale * UNIT };
}
function iso([x, y, z], projection) {
    const { origin } = projection;
    const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
    return [origin[0] + (x * sinA - y * cosA) * k, origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k];
}
function towardViewer(projection) {
    const { sinA, cosA } = cameraOf(projection);
    return [cosA, sinA];
}
function depthOf([x, y, z], projection) {
    const { sinA, cosA, sinE, cosE } = cameraOf(projection);
    return (x * cosA + y * sinA) * cosE + z * sinE;
}
const tenth = (value) => {
    const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return text === "-0" ? "0" : text;
};
function pathOf(points, closed = false) {
    if (!points.length)
        return "";
    return points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") + (closed ? "Z" : "");
}
const joinPaths = (paths) => paths.filter(Boolean).join("");
function roundedPlan({ x, y, w, d, r }, steps = 8) {
    const radius = Math.max(0, Math.min(r, w / 2, d / 2));
    const corners = [
        [x + w - radius, y + radius, -90],
        [x + w - radius, y + d - radius, 0],
        [x + radius, y + d - radius, 90],
        [x + radius, y + radius, 180],
    ];
    const out = [];
    for (const [cx, cy, start] of corners) {
        const count = radius > 0 ? steps : 0;
        for (let step = 0; step <= count; step++) {
            const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
            out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
    }
    return out;
}
function signedArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index++) {
        const [ax, ay] = points[index];
        const [bx, by] = points[(index + 1) % points.length];
        area += ax * by - bx * ay;
    }
    return area / 2;
}
const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);
function convexHull(points) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3)
        return sorted;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const point of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
            lower.pop();
        lower.push(point);
    }
    const upper = [];
    for (let index = sorted.length - 1; index >= 0; index--) {
        const point = sorted[index];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
            upper.pop();
        upper.push(point);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function runsOf(flags, want) {
    const count = flags.length;
    const runs = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0)
        return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    let run = null;
    for (let step = 0; step < count; step++) {
        const index = (start + step) % count;
        if (flags[index] === want) {
            if (!run)
                run = [index];
            run.push((index + 1) % count);
        }
        else if (run) {
            runs.push(run);
            run = null;
        }
    }
    if (run)
        runs.push(run);
    return runs;
}
function extrude(ring, z, height, projection, options = {}) {
    const convex = options.convex ?? true;
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const { sinA, cosA } = cameraOf(projection);
    const normals = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        return (counter ? [dy / length, -dx / length] : [-dy / length, dx / length]);
    });
    const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
    const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
    const outline = [];
    const crease = [];
    for (const run of runsOf(facing, false))
        outline.push(pathOf(run.map((index) => top[index])));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((index) => top[index])));
        if (height > 0)
            outline.push(pathOf(run.map((index) => bottom[index])));
    }
    if (height > 0) {
        for (let index = 0; index < count; index++) {
            if (facing[(index + count - 1) % count] !== facing[index])
                outline.push(pathOf([top[index], bottom[index]]));
        }
    }
    let fill;
    if (convex) {
        fill = pathOf(convexHull([...top, ...bottom]), true);
    }
    else {
        const parts = [pathOf(oriented(top), true), pathOf(oriented(bottom), true)];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const next = (index + 1) % count;
            parts.push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
        fill = parts.join("");
    }
    const buckets = Array.from({ length: SHADES }, () => []);
    if (height > 0) {
        const [lx, ly] = [-sinA, cosA];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const [nx, ny] = normals[index];
            const lit = (nx * lx + ny * ly + 1) / 2;
            const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
            const next = (index + 1) % count;
            buckets[shade].push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
    }
    let bevel;
    if (options.bevel && options.bevel > 0) {
        const by = options.bevel;
        const inset = ring.map(([x, y], index) => {
            const [ax, ay] = normals[(index + count - 1) % count];
            const [bx, by2] = normals[index];
            const mx = ax + bx;
            const my = ay + by2;
            const length = Math.hypot(mx, my) || 1;
            return [x - (mx / length) * by, y - (my / length) * by];
        });
        const insetTop = inset.map(([x, y]) => iso([x, y, z + height], projection));
        bevel = runsOf(facing, true)
            .map((run) => pathOf([top[run[0]], ...run.slice(1, -1).map((index) => insetTop[index]), top[run[run.length - 1]]]))
            .join("");
    }
    return {
        fill,
        outline: outline.join(""),
        crease: crease.join(""),
        top: pathOf(oriented(top), true),
        shades: buckets.map((paths) => paths.join("")),
        bevel,
    };
}
const ringOf = (plan, steps = 8) => roundedPlan(plan, steps);
function slabOf(plan, z, height, projection, steps = 8, bevel = 0) {
    return extrude(ringOf(plan, steps), z, height, projection, { convex: true, bevel });
}
function circleRing(cx, cy, radius, steps = 40) {
    return Array.from({ length: steps }, (_, step) => {
        const angle = (step / steps) * Math.PI * 2;
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
}
function cylinder(cx, cy, radius, z, height, projection, steps = 32, bevel = 0) {
    return extrude(circleRing(cx, cy, radius, steps), z, height, projection, { convex: true, bevel });
}
const insetPlan = ({ x, y, w, d, r }, by) => ({ x: x + by, y: y + by, w: w - by * 2, d: d - by * 2, r: Math.max(0, r - by) });
function onTop(points, z, projection, closed = false) {
    return pathOf(points.map(([x, y]) => iso([x, y, z], projection)), closed);
}
const planOutline = (plan, z, projection, steps = 8) => onTop(ringOf(plan, steps), z, projection, true);
const lineOnTop = (from, to, z, projection) => onTop([from, to], z, projection);
const segment = (from, to, projection) => pathOf([iso(from, projection), iso(to, projection)]);
const rise = (at, from, to, projection) => segment([at[0], at[1], from], [at[0], at[1], to], projection);
const ring = (cx, cy, radius, z, projection, steps = 40) => onTop(circleRing(cx, cy, radius, steps), z, projection, true);
const pointsAt = (points, projection) => points.map((point) => iso(point, projection));
function dotGrid(x, y, columns, rows, gap, z, projection) {
    const dots = [];
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++)
            dots.push(iso([x + column * gap, y + row * gap, z], projection));
    }
    return dots;
}
function corners({ x, y, w, d }, inset = 0) {
    return [
        [x + inset, y + inset],
        [x + w - inset, y + inset],
        [x + inset, y + d - inset],
        [x + w - inset, y + d - inset],
    ];
}
function boxCorners({ x, y, w, d }, z0, z1) {
    const out = [];
    for (const px of [x, x + w])
        for (const py of [y, y + d])
            for (const z of [z0, z1])
                out.push([px, py, z]);
    return out;
}
function knurl(cx, cy, radius, z0, z1, count, projection, inset = 0.4) {
    const [vx, vy] = towardViewer(projection);
    const lines = [];
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        if (nx * vx + ny * vy < 0.15)
            continue;
        lines.push(segment([cx + radius * nx, cy + radius * ny, z0 + inset], [cx + radius * nx, cy + radius * ny, z1 - inset], projection));
    }
    return lines.join("");
}
function sideArc(cx, cy, radius, z, projection, steps = 24) {
    const [vx, vy] = towardViewer(projection);
    const facing = Math.atan2(vy, vx);
    const points = [];
    for (let step = 0; step <= steps; step++) {
        const angle = facing - Math.PI / 2 + (step / steps) * Math.PI;
        points.push(iso([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z], projection));
    }
    return pathOf(points);
}
function ringSeam(ring, z, projection) {
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const facing = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const [nx, ny] = counter ? [dy, -dx] : [-dy, dx];
        return nx * vx + ny * vy > 1e-9;
    });
    return runsOf(facing, true).map((run) => pathOf(run.map((index) => iso([ring[index][0], ring[index][1], z], projection)))).join("");
}
const sideSeam = (plan, z, projection, steps = 8) => ringSeam(ringOf(plan, steps), z, projection);
function sideRing(center, radius, axis, projection, steps = 20) {
    const [px, py, pz] = center;
    const points = [];
    for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        points.push(iso(axis === "x" ? [px, py + u, pz + v] : [px + u, py, pz + v], projection));
    }
    return pathOf(points, true);
}
function coil(from, to, center, radius, turns, axis, projection, perTurn = 16) {
    const count = Math.max(1, Math.round(turns * perTurn));
    const back = [];
    const front = [];
    let run = [];
    let near = null;
    for (let index = 0; index <= count; index++) {
        const share = index / count;
        const angle = share * turns * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        const along = from + (to - from) * share;
        const point = axis === "x" ? [along, center[0] + u, center[1] + v] : [center[0] + u, along, center[1] + v];
        const normal = axis === "x" ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)];
        const facing = depthOf(normal, projection) > 0;
        const flat = iso(point, projection);
        if (near === null)
            near = facing;
        if (facing !== near) {
            run.push(flat);
            (near ? front : back).push(pathOf(run));
            run = [flat];
            near = facing;
            continue;
        }
        run.push(flat);
    }
    if (run.length > 1)
        (near ? front : back).push(pathOf(run));
    return { back: back.join(""), front: front.join("") };
}
function topTicks(from, to, step, every, edge, z, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, edge] : [edge, at];
        const b = axis === "x" ? [at, edge + length] : [edge + length, at];
        (big ? major : minor).push(lineOnTop(a, b, z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function sideTicks(from, to, step, every, face, top, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, face, top] : [face, at, top];
        const b = axis === "x" ? [at, face, top - length] : [face, at, top - length];
        (big ? major : minor).push(segment(a, b, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function radialTicks(cx, cy, radius, count, every, z, lengths, projection, from = 0, span = Math.PI * 2) {
    const minor = [];
    const major = [];
    const closed = Math.abs(span - Math.PI * 2) < 1e-9;
    const steps = closed ? count : count + 1;
    for (let index = 0; index < steps; index++) {
        const angle = from + (index / count) * span;
        const big = index % every === 0;
        const inner = radius - (big ? lengths[1] : lengths[0]);
        const sx = Math.sin(angle);
        const sy = -Math.cos(angle);
        (big ? major : minor).push(lineOnTop([cx + sx * inner, cy + sy * inner], [cx + sx * radius, cy + sy * radius], z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
const haloOf = (plan, z, height, projection) => slabOf(plan, z, height, projection).fill;
function axisVector(projection, [dx, dy, dz]) {
    const origin = iso([0, 0, 0], projection);
    const moved = iso([dx, dy, dz], projection);
    return [moved[0] - origin[0], moved[1] - origin[1]];
}
const fine = (value) => Math.round(value * 100) / 100;
function translateAlong(projection, by) {
    const [x, y] = axisVector(projection, by);
    return `translate(${fine(x)} ${fine(y)})`;
}
const thousandth = (value) => Math.round(value * 1000) / 1000;
function axesAt(at, z, projection) {
    const origin = iso([at[0], at[1], z], projection);
    const along = (point) => {
        const [px, py] = iso(point, projection);
        return [px - origin[0], py - origin[1]];
    };
    return { origin, x: along([at[0] + 1, at[1], z]), y: along([at[0], at[1] + 1, z]), z: along([at[0], at[1], z + 1]) };
}
const matrixOf = (u, v, origin) => `matrix(${thousandth(u[0])} ${thousandth(u[1])} ${thousandth(v[0])} ${thousandth(v[1])} ${thousandth(origin[0])} ${thousandth(origin[1])})`;
function holdStill(element, [dx, dy]) {
    const text = dx || dy ? `translate(${-dx} ${-dy})` : "";
    element.querySelectorAll("[data-hold]").forEach((node) => (text ? node.setAttribute("transform", text) : node.removeAttribute("transform")));
}
function topMatrix(at, z, projection, along = "x") {
    const { origin, x, y } = axesAt(at, z, projection);
    return along === "x" ? matrixOf(x, y, origin) : matrixOf([-y[0], -y[1]], x, origin);
}
function sideMatrix(at, z, projection, face) {
    const { origin, x, y, z: up } = axesAt(at, z, projection);
    const down = [-up[0], -up[1]];
    return face === "left" ? matrixOf(x, down, origin) : matrixOf([-y[0], -y[1]], down, origin);
}
function screenRise(height, projection) {
    const { cosE, k } = cameraOf(projection);
    return height * cosE * k;
}
function fitProjection(points, width, height, { pad = 24, headroom = 0, azimuth = AZIMUTH, elevation = ELEVATION } = {}) {
    const unit = { origin: [0, 0], scale: 1, azimuth, elevation };
    const flat = points.map((point) => iso(point, unit));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const up = Math.min(...ys);
    const down = Math.max(...ys);
    const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2 - headroom) / (down - up));
    return {
        origin: [width / 2 - ((left + right) / 2) * scale, headroom + (height - headroom) / 2 - ((up + down) / 2) * scale],
        scale,
        azimuth,
        elevation,
    };
}
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (pairs) => Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
    .join("");
function solidSvg(paths, { tone = "hi", crease = "faint", halo = false, lit = false, flat = false, className, inner = "" } = {}) {
    const parts = [];
    if (halo)
        parts.push(`<path class="iso-halo" d="${paths.fill}"/>`);
    parts.push(`<path class="iso-fill" d="${paths.fill}"/>`);
    if (!flat) {
        paths.shades.forEach((d, shade) => {
            if (d)
                parts.push(`<path class="iso-shade" data-shade="${shade}" d="${d}"/>`);
        });
        parts.push(`<path class="iso-top" d="${paths.top}"/>`);
    }
    if (crease !== "none" && paths.crease)
        parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/>`);
    if (crease !== "none" && paths.bevel)
        parts.push(`<path class="iso-line iso-bevel" data-tone="${crease}" d="${paths.bevel}"/>`);
    if (inner)
        parts.push(inner);
    parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`);
    return `<g${attrs({ class: className ? `iso-solid ${className}` : "iso-solid", "data-lit": lit ? "" : undefined, "data-seamless": paths.seamless ? "" : undefined })}>${parts.join("")}</g>`;
}
function lineSvg(d, { tone = "lo", dotted = false, dashed = false, flow = false, className, free } = {}) {
    if (!d)
        return "";
    return `<path${attrs({
        class: className ? `iso-line ${className}` : "iso-line",
        "data-tone": tone,
        "data-free": free === true ? "" : free || undefined,
        "data-dotted": dotted ? "" : undefined,
        "data-dashed": dashed ? "" : undefined,
        "data-flow": flow ? "" : undefined,
        d,
    })}/>`;
}
function dotsSvg(points, { size = 0.5, tone = "mid", pulse = false } = {}) {
    const dots = points
        .map(([x, y, alpha], index) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${alpha !== undefined && alpha < 1 ? ` fill-opacity="${Math.max(0, alpha).toFixed(2)}"` : ""}${pulse ? ` data-pulse="" style="--pulse-at:${(index * 137) % 1600}ms"` : ""}/>`)
        .join("");
    return `<g class="iso-dots" data-tone="${tone}">${dots}</g>`;
}
function fadedSvg(list, style = {}) {
    const groups = new Map();
    for (const entry of list) {
        const [d, alpha] = Array.isArray(entry) ? entry : [entry.d, entry.alpha];
        if (!d || !(alpha > 0.02))
            continue;
        const level = Math.min(1, Math.round(alpha * 20) / 20);
        groups.set(level, (groups.get(level) ?? "") + d);
    }
    return [...groups].map(([alpha, d]) => (alpha >= 1 ? lineSvg(d, style) : `<g opacity="${alpha.toFixed(2)}">${lineSvg(d, style)}</g>`)).join("");
}
function fadeLineSvg(points, { fade = [0, 0], tone = "lo", className, stops = 6 } = {}) {
    if (points.length < 2)
        return "";
    const ease = (t) => t * t * (3 - 2 * t);
    const hashOf = (text) => {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++)
            hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(36);
    };
    const lengths = [0];
    for (let index = 1; index < points.length; index++)
        lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
    const at = (length) => {
        let index = 1;
        while (index < points.length - 1 && lengths[index] < length)
            index++;
        const span = lengths[index] - lengths[index - 1] || 1;
        const t = Math.max(0, Math.min(1, (length - lengths[index - 1]) / span));
        return [points[index - 1][0] + (points[index][0] - points[index - 1][0]) * t, points[index - 1][1] + (points[index][1] - points[index - 1][1]) * t];
    };
    const pieceOf = (from, to) => [at(from), ...points.filter((_, index) => lengths[index] > from + 1e-6 && lengths[index] < to - 1e-6), at(to)];
    const total = lengths[lengths.length - 1];
    if (total < 1e-6)
        return "";
    let [start, end] = Array.isArray(fade) ? fade : [fade, fade];
    if (start + end > total) {
        const share = total / (start + end);
        start *= share;
        end *= share;
    }
    const paint = `var(--anatomy-${tone})`;
    const ramp = (piece, rising) => {
        const d = pathOf(piece);
        const [x1, y1] = piece[0];
        const [x2, y2] = piece[piece.length - 1];
        const id = `iso-fade-${hashOf(`${d}|${tone}|${rising}`)}`;
        const marks = Array.from({ length: stops + 1 }, (_, index) => {
            const t = index / stops;
            const alpha = ease(rising ? t : 1 - t);
            return `<stop offset="${t.toFixed(3)}" stop-opacity="${alpha.toFixed(3)}" style="stop-color:${paint}"/>`;
        }).join("");
        const gradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${tenth(x1)}" y1="${tenth(y1)}" x2="${tenth(x2)}" y2="${tenth(y2)}">${marks}</linearGradient>`;
        return `<defs>${gradient}</defs><path${attrs({ class: className ? `iso-line ${className}` : "iso-line", "data-tone": tone, "data-free": rising ? "start" : "end", d, style: `stroke:url(#${id})` })}/>`;
    };
    const parts = [];
    if (start > 0.05)
        parts.push(ramp(pieceOf(0, start), true));
    if (total - end - start > 0.05)
        parts.push(lineSvg(pathOf(pieceOf(start, total - end)), { tone, className }));
    if (end > 0.05)
        parts.push(ramp(pieceOf(total - end, total), false));
    return `<g class="iso-fade">${parts.join("")}</g>`;
}
function wireSvg(from, to, { via = [], tone = "lo", dotted = false, dashed = false, flow = false, ends = "both", size = 1.2 } = {}) {
    const d = pathOf([from, ...via, to]);
    const end = ([x, y]) => `<circle class="iso-wire-end" cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"/>`;
    return `<g class="iso-wire" data-tone="${tone}">${lineSvg(d, { tone, dotted, dashed, flow })}${ends === "both" || ends === "from" ? end(from) : ""}${ends === "both" || ends === "to" ? end(to) : ""}</g>`;
}
function faceTextSvg(transform, text, { size = 3, tone = "mid", anchor = "start" } = {}) {
    return `<text class="iso-face-text" data-tone="${tone}" transform="${transform}" font-size="${size}" text-anchor="${anchor}">${escape(text)}</text>`;
}
function groupSvg(children, extra = {}) {
    return `<g${attrs(extra)}>${Array.isArray(children) ? children.join("") : children}</g>`;
}
function figureSvg({ width, height, label, body, standalone = false, className }) {
    const style = standalone ? `<style>${ISO_CSS}</style>` : "";
    return `<svg${attrs({
        xmlns: "http://www.w3.org/2000/svg",
        class: `iso-svg${standalone ? " iso" : ""}${className ? ` ${className}` : ""}`,
        "data-theme": standalone || undefined,
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": label,
    })}>${style}${Array.isArray(body) ? body.join("") : body}</svg>`;
}
function swatchSvg(mark) {
    if (mark === "raised" || mark === "flat" || mark === "lit") {
        const body = mark === "flat" ? "M2 6.5 8 3.5 14 6.5 8 9.5Z" : "M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z";
        const crease = mark === "flat" ? "" : `<path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/>`;
        return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="${body}"/>${crease}</svg>`;
    }
    return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
}
function plateHtml({ fig, title, hint, readout = "", keys = [], caption, body }) {
    const corner = (name, text, extra = "") => `<span class="iso-plate-corner" data-corner="${name}"${extra}>${escape(text)}</span>`;
    const legend = keys.length || caption
        ? `<figcaption class="iso-legend">${keys.length ? `<span class="iso-keys">${keys.map((key) => `<span class="iso-key">${swatchSvg(key.mark)}${escape(key.label)}</span>`).join("")}</span>` : ""}${caption ? `<span class="iso-caption">${escape(caption)}</span>` : ""}</figcaption>`
        : "";
    return `<figure class="iso-figure"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true">${corner("fig", fig)}${title ? corner("title", title) : ""}${hint ? corner("hint", hint) : ""}${corner("readout", readout, " data-readout")}</div>${body}</div>${legend}</figure>`;
}
function pageHtml({ title, theme = "dark", body, script = "", width = 650 }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${ISO_CSS}${PAGE_CSS.replace("__WIDTH__", String(width))}</style></head><body class="iso" data-theme="${theme}"><main class="iso-page">${body}</main>${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script>` : ""}</body></html>`;
}
const PAGE_CSS = `
*{box-sizing:border-box}
html{color-scheme:dark}
body[data-theme="light"]{color-scheme:light}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.iso-page{width:min(__WIDTH__px,100% - 32px);margin:64px auto 96px}
`;
const ISO_CSS = `
.iso{
  --anatomy-page:#0b0b0b;--anatomy-card:#131313;--anatomy-text:#a3a3a3;--anatomy-strong:#e6e6e6;--anatomy-muted:#6e6e6e;
  --anatomy-paper:#131313;--anatomy-face:#1b1b1b;--anatomy-top:#1c1c1c;
  --anatomy-shade-0:#0f0f0f;--anatomy-shade-1:#121212;--anatomy-shade-2:#151515;--anatomy-shade-3:#181818;
  --anatomy-lit-top:#262626;--anatomy-lit-shade:#1d1d1d;
  --anatomy-hi:#d4d4d4;--anatomy-mid:#6a6a6a;--anatomy-lo:#3e3e3e;--anatomy-faint:#2a2a2a;--anatomy-lit:#ffffff;
  --anatomy-halo:#050505;--anatomy-halo-opacity:.9;--anatomy-dot:#e6e6e6;
  --anatomy-red:#ff6b6b;--anatomy-green:#6be0a0;--anatomy-blue:#6b9bff;
  --anatomy-weight:.6px;--anatomy-ease:cubic-bezier(.32,.72,0,1);
  --anatomy-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --anatomy-lift:inset 0 1px 0 0 #ffffff0a,inset 0 0 0 1px #ffffff06,0 0 0 1px #00000026,0 1px 1px -.5px #00000014,0 3px 3px -1.5px #00000014,0 6px 6px -3px #00000014,0 12px 12px -6px #00000014;
}
.iso[data-theme="light"]{
  --anatomy-page:#f2f2ef;--anatomy-card:#fbfbfa;--anatomy-text:#57575a;--anatomy-strong:#18181a;--anatomy-muted:#8c8c90;
  --anatomy-paper:#fbfbfa;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#eeeeeb;
  --anatomy-hi:#26262a;--anatomy-mid:#8a8a8f;--anatomy-lo:#b4b4b8;--anatomy-faint:#d4d4d6;--anatomy-lit:#000000;
  --anatomy-halo:#8a8a80;--anatomy-halo-opacity:.32;--anatomy-dot:#3a3a3e;
  --anatomy-red:#e5484d;--anatomy-green:#30a46c;--anatomy-blue:#3e63dd;
  --anatomy-lift:inset 0 1px 0 0 #ffffff,0 0 0 1px #0000000f,0 1px 1px -.5px #0000000a,0 3px 3px -1.5px #0000000a,0 6px 6px -3px #0000000a,0 12px 12px -6px #0000000a;
}
.iso-svg{display:block;width:100%;height:auto;overflow:visible}
.iso-svg path,.iso-svg circle{vector-effect:non-scaling-stroke}
.iso-fill{fill:var(--anatomy-paper);stroke:none}
.iso-solid[data-lit]>.iso-fill{fill:var(--anatomy-face)}
.iso-shade,.iso-top{stroke:none}
.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}
.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}
.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}
.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}
.iso-top{fill:var(--anatomy-top)}
.iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-lit-shade)}
.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:.4;stroke-linejoin:round}
.iso-solid[data-seamless]>.iso-shade[data-shade="0"]{stroke:var(--anatomy-shade-0)}
.iso-solid[data-seamless]>.iso-shade[data-shade="1"]{stroke:var(--anatomy-shade-1)}
.iso-solid[data-seamless]>.iso-shade[data-shade="2"]{stroke:var(--anatomy-shade-2)}
.iso-solid[data-seamless]>.iso-shade[data-shade="3"]{stroke:var(--anatomy-shade-3)}
.iso-solid[data-seamless]>.iso-top{stroke:var(--anatomy-top)}
.iso-solid[data-seamless][data-lit]>.iso-top{stroke:var(--anatomy-lit-top)}
.iso-solid[data-seamless][data-lit]>.iso-shade{stroke:var(--anatomy-lit-shade)}
.iso-solid[data-lit]>.iso-edge{stroke:var(--anatomy-lit)}
.iso-halo{fill:var(--anatomy-halo);stroke:none;filter:blur(9px);opacity:var(--anatomy-halo-opacity);transform:translateY(3px)}
.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}
.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}
.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}
.iso-line[data-tone="lo"]{stroke:var(--anatomy-lo)}
.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}
.iso-line[data-tone="lit"]{stroke:var(--anatomy-lit)}
.iso-line[data-tone="red"]{stroke:var(--anatomy-red)}
.iso-line[data-tone="green"]{stroke:var(--anatomy-green)}
.iso-line[data-tone="blue"]{stroke:var(--anatomy-blue)}
.iso-line[data-dotted]{stroke-dasharray:.01 3.5;stroke-width:1}
.iso-line[data-dashed]{stroke-dasharray:3 3}
.iso-line[data-flow]{stroke-dasharray:2 6}
.iso-wire-end{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso-wire[data-tone="hi"] .iso-wire-end{stroke:var(--anatomy-hi)}
.iso-wire[data-tone="mid"] .iso-wire-end{stroke:var(--anatomy-mid)}
.iso-wire[data-tone="faint"] .iso-wire-end{stroke:var(--anatomy-faint)}
.iso-wire[data-tone="lit"] .iso-wire-end{stroke:var(--anatomy-lit)}
.iso-dots circle{fill:var(--anatomy-dot);stroke:none;opacity:.32}
.iso-dots[data-tone="hi"] circle{opacity:.85}
.iso-dots[data-tone="mid"] circle{opacity:.45}
.iso-dots[data-tone="lo"] circle{opacity:.22}
.iso-dots[data-tone="faint"] circle{opacity:.12}
.iso-face-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);letter-spacing:.04em}
.iso-face-text[data-tone="hi"]{fill:var(--anatomy-hi)}
.iso-face-text[data-tone="lo"]{fill:var(--anatomy-lo)}
.iso-face-text[data-tone="faint"]{fill:var(--anatomy-faint)}
.tb-body{fill:var(--anatomy-shade-2);stroke:none}
.tb-shine{fill:var(--anatomy-top);stroke:none}
.tb-shade{fill:var(--anatomy-shade-0);stroke:none}
.tb-ring{fill:none;stroke:var(--anatomy-lo);stroke-width:.45;stroke-linecap:butt;stroke-linejoin:round}
.tb-ring[data-tone="mid"]{stroke:var(--anatomy-mid)}
.tb-ring[data-tone="faint"]{stroke:var(--anatomy-faint)}
.tb-ring[data-tone="hi"]{stroke:var(--anatomy-hi)}
@keyframes iso-flow{to{stroke-dashoffset:-32}}
@keyframes iso-pulse{0%,100%{opacity:.18}12%{opacity:1}40%{opacity:.18}}
.iso-line[data-flow]{animation:iso-flow 1600ms linear infinite}
.iso-dots circle[data-pulse]{animation:iso-pulse 1600ms steps(1,end) infinite;animation-delay:var(--pulse-at,0ms)}
.iso-figure{margin:32px 0 36px}
.iso-plate{position:relative;padding:52px 24px;border-radius:0;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-mid);--anatomy-paper:var(--anatomy-card)}
.iso-plate-corners{position:absolute;inset:18px 20px;pointer-events:none}
.iso-plate-corner{position:absolute;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.iso-plate-corner[data-corner="fig"]{top:0;left:0;color:var(--anatomy-text)}
.iso-plate-corner[data-corner="title"]{top:0;right:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="hint"]{bottom:0;left:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="readout"]{right:0;bottom:0;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.iso-plate .iso-svg{margin:0 auto}
.iso-legend{display:grid;gap:8px;margin-top:12px;color:var(--anatomy-muted);font-size:13px;line-height:1.55}
.iso-keys{display:flex;flex-wrap:wrap;gap:6px 18px}
.iso-key{display:inline-flex;align-items:center;gap:7px}
.iso-swatch{width:16px;height:10px;flex:none;overflow:visible}
.iso-swatch path{fill:none;stroke:var(--anatomy-hi);stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.iso-swatch[data-mark="raised"] path,.iso-swatch[data-mark="flat"] path{stroke:var(--anatomy-mid)}
.iso-swatch[data-mark="lit"] path{stroke:var(--anatomy-lit)}
.iso-swatch[data-mark="dim"] path{stroke:var(--anatomy-lo)}
.iso-swatch[data-mark="dotted"] path{stroke-dasharray:.01 3;stroke-width:1.4}
.iso-swatch[data-mark="dashed"] path{stroke-dasharray:3 2.5}
.iso-swatch[data-mark="red"] path{stroke:var(--anatomy-red)}
.iso-swatch[data-mark="green"] path{stroke:var(--anatomy-green)}
.iso-swatch[data-mark="blue"] path{stroke:var(--anatomy-blue)}
.iso-swatch-crease{stroke:var(--anatomy-lo)!important}
@media (max-width:560px){.iso-plate{padding:48px 12px 70px}.iso-plate-corner[data-corner="hint"]{bottom:18px}}
@media (prefers-reduced-motion:reduce){.iso-line[data-flow],.iso-dots circle[data-pulse]{animation:none}}
`;

const P = {"origin":[284.78258001226635,477.91365501702944],"scale":1.0674113704855135,"azimuth":50,"elevation":30};
const JOINTS = [0,55,110,165,220,275,330], DEV = [[0,-1],[0.6,-1.5],[1.5,0.2],[2.6,1],[1.8,2.2],[0.4,2.9],[-0.6,2.1]];
const LAT = 3, PER_M = 10, CONTACT = 40, TOL = 3;
const BEAM = [3.872727272727273,25.363636363636363], LASER_Z = 304, TARGET_TOP = 77.2;
const REF = [1.290909090909091,2.4545454545454546];
const STOPS = [20,18,16,14,12,10,8,6,4], H_REF = 20, H_MIN = 4;
const devAt = (z) => {
  const i = Math.max(0, Math.min(JOINTS.length - 2, JOINTS.findIndex((_, j) => z < JOINTS[j + 1])));
  const t = Math.max(0, Math.min(1, (z - JOINTS[i]) / (JOINTS[i + 1] - JOINTS[i])));
  return [DEV[i][0] + (DEV[i + 1][0] - DEV[i][0]) * t, DEV[i][1] + (DEV[i + 1][1] - DEV[i][1]) * t];
};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const back = svg.querySelector('[data-part="carriage-back"]');
const front = svg.querySelector('[data-part="carriage"]');
const beam = svg.querySelector('[data-part="beam"]');
const spot = svg.querySelector('[data-part="spot"]');
const tol = svg.querySelector('[data-part="tol"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
let H = H_REF, target = H_REF, touring = !still.matches, clock = 0, last = 0, frame = 0, visible = false, idle = 0;
const DWELL = 1.8;
const tourAt = (t) => {
  const n = STOPS.length;
  const i = Math.floor(t / DWELL) % (n + 1);
  return i < n ? STOPS[i] : H_REF;
};
function draw() {
  const cz = H * PER_M;
  const dev = devAt(cz + CONTACT);
  const t = translateAlong(P, [dev[0] * LAT, dev[1] * LAT, cz]);
  back.setAttribute("transform", t);
  front.setAttribute("transform", t);
  const s = [BEAM[0], BEAM[1], cz + TARGET_TOP];
  beam.setAttribute("d", segment([BEAM[0], BEAM[1], LASER_Z], s, P));
  spot.setAttribute("transform", "translate(" + iso(s, P).join(" ") + ")");
  const dx = REF[0] - dev[0], dy = REF[1] - dev[1];
  const over = Math.abs(dx) > TOL || Math.abs(dy) > TOL;
  tol.setAttribute("data-tone", over ? "red" : "mid");
  const text = "H " + H.toFixed(2) + " m · dX " + fmt(dx) + " · dY " + fmt(dy) + " mm · " + (over ? "out of tolerance" : "within tolerance");
  if (readout.dataset.text !== text) { readout.dataset.text = text; readout.innerHTML = "<dt>Height</dt><dd>" + H.toFixed(2) + " m</dd><dt>dX</dt><dd>" + fmt(dx) + " mm</dd><dt>dY</dt><dd>" + fmt(dy) + " mm</dd><dt>Status</dt><dd class=\"" + (over ? "bad" : "ok") + "\">" + (over ? "out of tolerance" : "within tolerance") + "</dd>"; }
  stage.setAttribute("aria-valuenow", H.toFixed(1));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  H = still.matches ? target : H + (target - H) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(target - H) < 0.002) H = target;
  draw();
  frame = visible && (touring || H !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (h) => {
  touring = false;
  target = clamp(h, H_MIN - 1, H_REF);
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const r = svg.getBoundingClientRect();
  const f = clamp(((event.clientY - r.top) / r.height - 0.18) / 0.6, 0, 1);
  steer(H_REF - f * (H_REF - H_MIN + 1));
});
stage.addEventListener("keydown", (event) => {
  let h = null;
  if (event.key === "ArrowUp" || event.key === "ArrowRight") h = target + 1;
  if (event.key === "ArrowDown" || event.key === "ArrowLeft") h = target - 1;
  if (event.key === "Home") h = H_REF;
  if (event.key === "End") h = H_MIN;
  if (h === null) return;
  event.preventDefault();
  steer(Math.round(h));
});
draw();


const RS = (() => {
const DETECTION = {"min_contrast":25,"noise_k":6,"min_area":4,"max_area":6000,"max_aspect":3,"min_fill":0.3,"min_green_excess":10,"saturation_level":250,"max_saturated_frac":0.2,"min_halo_px":8,"track_gate_px":40,"max_competing_ratio":0.5};
const AVERAGING = {"window_sec":0.5,"min_samples":5,"mad_k":3.5,"mad_floor_px":0.5,"max_outlier_fraction":0.15,"max_std_px":2.5,"max_drift_px":2,"drift_t":3};
const BEFORE_20 = {"detect":{"legacy":true},"average":{"mad_floor_px":0.1,"max_outlier_fraction":-1,"max_std_px":0,"max_drift_px":0}};
const BEFORE_25 = {"detect":{},"average":{"mad_floor_px":0.1,"max_outlier_fraction":-1}};
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function paperFrame(w = 640, h = 480, seed = 0, bgr = [170, 178, 172], noise = 2) {
  const rand = mulberry32(seed + 1);
  const ch = bgr.map(() => new Float32Array(w * h));
  for (let c = 0; c < 3; c++) {
    const a = ch[c];
    for (let i = 0; i < a.length; i += 2) {
      const u = Math.max(rand(), 1e-12), v = rand();
      const m = Math.sqrt(-2 * Math.log(u)) * noise;
      a[i] = bgr[c] + m * Math.cos(2 * Math.PI * v);
      if (i + 1 < a.length) a[i + 1] = bgr[c] + m * Math.sin(2 * Math.PI * v);
    }
  }
  return { w, h, ch };
}
function addSpot(f, cx, cy, sigma = 6, amp = [60, 400, 90]) {
  const r = Math.ceil(sigma * 5);
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(f.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(f.h - 1, Math.ceil(cy + r));
  const k = 1 / (2 * sigma * sigma);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const g = Math.exp(-((x - cx) * (x - cx) + (y - cy) * (y - cy)) * k);
      const i = y * f.w + x;
      for (let c = 0; c < 3; c++) f.ch[c][i] += amp[c] * g;
    }
  }
  return f;
}
function fillRect(f, x0, y0, x1, y1, value = 255) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) f.ch[c][y * f.w + x] = value;
  return f;
}
function toU8(f) {
  const ch = f.ch.map((a) => {
    const o = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) { const v = a[i]; o[i] = v <= 0 ? 0 : v >= 255 ? 255 : v | 0; }
    return o;
  });
  return { w: f.w, h: f.h, b: ch[0], g: ch[1], r: ch[2] };
}
function median(values) {
  const s = Float64Array.from(values).sort();
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function detectSpot(img, prev = null, params = {}) {
  const p = { ...DETECTION, ...params };
  const { w, h, g, r, b } = img;
  const sample = [];
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) sample.push(g[y * w + x]);
  const background = median(sample);
  const noise = median(sample.map((v) => Math.abs(v - background))) * 1.4826;
  const threshold = Math.max(p.min_contrast, p.noise_k * noise);

  const labels = new Int32Array(w * h);
  const comps = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (labels[i] || g[i] - background <= threshold) continue;
    const id = comps.length + 1;
    let top = 0, area = 0, minx = w, miny = h, maxx = 0, maxy = 0;
    stack[top++] = i;
    labels[i] = id;
    while (top) {
      const j = stack[--top];
      const x = j % w, y = (j - x) / w;
      area++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const k = yy * w + xx;
          if (!labels[k] && g[k] - background > threshold) { labels[k] = id; stack[top++] = k; }
        }
      }
    }
    comps.push({ label: id, bbox: [minx, miny, maxx - minx + 1, maxy - miny + 1], area });
  }
  if (!comps.length) return null;
  comps.sort((a, c) => c.area - a.area);

  const considered = [];
  const candidates = [];
  for (const c of comps.slice(0, 50)) {
    const [x, y, bw, bh] = c.bbox;
    const reject = (why) => considered.push({ bbox: c.bbox, why });
    if (c.area < p.min_area || c.area > p.max_area) { reject("size"); continue; }
    if (Math.max(bw, bh) / Math.max(1, Math.min(bw, bh)) > p.max_aspect) { reject("aspect"); continue; }
    if (c.area / (bw * bh) < p.min_fill) { reject("fill"); continue; }
    let sat = 0, unsat = 0, ge = 0, peak = 0, energy = 0;
    for (let yy = y; yy < y + bh; yy++) {
      for (let xx = x; xx < x + bw; xx++) {
        const k = yy * w + xx;
        if (labels[k] !== c.label) continue;
        const gg = g[k];
        if (gg > peak) peak = gg;
        energy += gg - background;
        if (gg >= p.saturation_level) sat++;
        else { unsat++; ge += gg - Math.max(r[k], b[k]); }
      }
    }
    const greenExcess = unsat ? ge / unsat : NaN;
    if (p.legacy) {
      if (unsat && greenExcess < p.min_green_excess) { reject("colour"); continue; }
    } else {
      if (unsat < p.min_halo_px) { reject("halo"); continue; }
      if (greenExcess < p.min_green_excess) { reject("colour"); continue; }
    }
    const cand = { label: c.label, bbox: c.bbox, area: c.area, peak, energy, halo: unsat, saturated_frac: sat / c.area, green_excess: greenExcess };
    candidates.push(cand);
    considered.push({ bbox: c.bbox, why: null, cand });
  }
  if (!candidates.length) return { none: true, considered, background, threshold };

  let best = null;
  let tracked = false;
  if (prev && !p.legacy) {
    const near = candidates.filter((c) => {
      const [x, y, bw, bh] = c.bbox;
      return Math.hypot(x + bw / 2 - prev[0], y + bh / 2 - prev[1]) <= p.track_gate_px;
    });
    if (near.length) { best = near.reduce((a, c) => (c.energy > a.energy ? c : a)); tracked = true; }
  }
  if (!best) best = candidates.reduce((a, c) => (c.energy > a.energy ? c : a));
  const others = candidates.filter((c) => c !== best).map((c) => c.energy);
  const competing = others.length && best.energy > 0 ? Math.max(...others) / best.energy : 0;

  const [x, y, bw, bh] = best.bbox;
  const pad = Math.max(2, Math.floor(0.25 * Math.max(bw, bh)));
  const xa = Math.max(0, x - pad), ya = Math.max(0, y - pad);
  const xb = Math.min(w, x + bw + pad), yb = Math.min(h, y + bh + pad);
  let total = 0, sx = 0, sy = 0, edge = false;
  for (let yy = ya; yy < yb; yy++) {
    for (let xx = xa; xx < xb; xx++) {
      const k = yy * w + xx;
      const lab = labels[k];
      let wt = g[k] - background - 0.5 * threshold;
      if (wt < 0 || (lab !== 0 && lab !== best.label)) wt = 0;
      if (!wt) continue;
      total += wt; sx += wt * xx; sy += wt * yy;
      if ((xa === 0 && xx === 0) || (ya === 0 && yy === 0) || (xb === w && xx === w - 1) || (yb === h && yy === h - 1)) edge = true;
    }
  }
  if (total <= 0) return { none: true, considered, background, threshold };
  const clipped = !p.legacy && edge;

  let reject_reason = null;
  if (clipped) reject_reason = "clipped";
  else if (!p.legacy && !tracked && competing > p.max_competing_ratio) reject_reason = "ambiguous";

  return {
    x: sx / total, y: sy / total, bbox: best.bbox, area: best.area, peak: best.peak,
    halo: best.halo, saturated_frac: best.saturated_frac, saturated: best.saturated_frac > p.max_saturated_frac,
    background, threshold, clipped, candidates: candidates.length, competing, tracked,
    usable: reject_reason === null, reject_reason, considered,
  };
}
function linearDrift(ts, vs) {
  const n = ts.length;
  const tm = ts.reduce((a, v) => a + v, 0) / n, vm = vs.reduce((a, v) => a + v, 0) / n;
  let stt = 0;
  for (const t of ts) stt += (t - tm) * (t - tm);
  if (n < 3 || stt <= 0) return [0, 0];
  let s = 0;
  for (let i = 0; i < n; i++) s += (ts[i] - tm) * (vs[i] - vm);
  const slope = s / stt;
  let resid = 0;
  for (let i = 0; i < n; i++) resid += (vs[i] - vm - slope * (ts[i] - tm)) ** 2;
  const se = Math.sqrt(resid / (n - 2) / stt);
  const drift = slope * (Math.max(...ts) - Math.min(...ts));
  if (se <= 1e-12) return [drift, slope ? Infinity : 0];
  return [drift, Math.abs(slope) / se];
}
function stdev(v) {
  if (v.length < 2) return 0;
  const m = v.reduce((a, x) => a + x, 0) / v.length;
  return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1));
}
function averageSpot(samples, now, opts = {}) {
  const o = { ...AVERAGING, ...opts };
  let points = samples.filter(([t, s]) => s && now - t >= 0 && now - t <= o.window_sec + 1e-9)
    .map(([t, s]) => ({ t, x: s[0], y: s[1], kept: true }));
  const total = points.length;
  let band = null;
  if (total >= 3 && o.mad_k > 0) {
    const mx = median(points.map((q) => q.x)), my = median(points.map((q) => q.y));
    const sx = Math.max(o.mad_floor_px, 1.4826 * median(points.map((q) => Math.abs(q.x - mx))));
    const sy = Math.max(o.mad_floor_px, 1.4826 * median(points.map((q) => Math.abs(q.y - my))));
    band = { mx, my, hx: o.mad_k * sx, hy: o.mad_k * sy };
    for (const q of points) q.kept = Math.abs(q.x - mx) <= band.hx && Math.abs(q.y - my) <= band.hy;
  }
  const kept = points.filter((q) => q.kept);
  if (kept.length < Math.max(1, o.min_samples)) return { mean: null, points, band, total, rejected: total - kept.length, stable: false, reason: "samples" };
  const xs = kept.map((q) => q.x), ys = kept.map((q) => q.y), ts = kept.map((q) => q.t);
  const std = [stdev(xs), stdev(ys)];
  const dx = linearDrift(ts, xs), dy = linearDrift(ts, ys);
  const rejected = total - kept.length;
  let reason = null;
  if (o.max_outlier_fraction >= 0 && rejected > Math.max(1, Math.floor(o.max_outlier_fraction * total))) reason = "outliers";
  else if (o.max_drift_px > 0 && ((Math.abs(dx[0]) > o.max_drift_px && dx[1] > o.drift_t) || (Math.abs(dy[0]) > o.max_drift_px && dy[1] > o.drift_t))) reason = "drift";
  else if (o.max_std_px > 0 && Math.max(...std) > o.max_std_px) reason = "jitter";
  return {
    mean: [xs.reduce((a, v) => a + v, 0) / xs.length, ys.reduce((a, v) => a + v, 0) / ys.length],
    std, drift: [dx[0], dy[0]], samples: kept.length, rejected, total, stable: reason === null, reason, points, band,
  };
}
function fitGaussian(xs, vs, background, lo, hi) {
  let n = 0;
  const S = new Float64Array(7), T = new Float64Array(3);
  const x0 = xs.reduce((a, v) => a + v, 0) / xs.length;
  for (let i = 0; i < xs.length; i++) {
    const e = vs[i] - background;
    if (e <= lo || vs[i] >= hi) continue;
    const x = xs[i] - x0, l = Math.log(e), wt = e * e;
    n++;
    for (let k = 0; k <= 4; k++) S[k] += wt * x ** k;
    T[0] += wt * l; T[1] += wt * x * l; T[2] += wt * x * x * l;
  }
  if (n < 4) return null;
  const A = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (!D) return null;
  const col = (j) => A.map((row, i) => row.map((v, k) => (k === j ? T[i] : v)));
  const [a, b, c] = [0, 1, 2].map((j) => det(col(j)) / D);
  if (c >= 0) return null;
  const sigma = Math.sqrt(-1 / (2 * c));
  const mu = -b / (2 * c);
  return { mu: mu + x0, sigma, peak: Math.exp(a - (b * b) / (4 * c)), used: n };
}
return { DETECTION, AVERAGING, BEFORE_20, BEFORE_25, paperFrame, addSpot, fillRect, toU8, detectSpot, averageSpot, fitGaussian };
})();


{
const paper = document.querySelector("#lab-paper");
if (paper) {
  const W = 640, H = 480, SCALE = 0.256557, TOL = 3;
  const BG = [170, 178, 172];
  const $ = (s) => document.querySelector(s);
  const panel = $("#lab-panel"), prof = $("#lab-profile");
  const pctx = paper.getContext("2d"), fctx = prof.getContext("2d"), hctx = panel.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const st = { x: 331.4, y: 233.2, sigma: 6, amp: 400, noise: 2, ref: [320, 240], prev: null, det: null };
  let base = null, baseNoise = -1;
  const css = (el, n) => getComputedStyle(el).getPropertyValue(n).trim();

  const frame = () => {
    if (baseNoise !== st.noise) { base = RS.paperFrame(W, H, 3, BG, st.noise); baseNoise = st.noise; }
    const f = { w: W, h: H, ch: base.ch.map((a) => Float32Array.from(a)) };
    RS.addSpot(f, st.x, st.y, st.sigma, [st.amp * 0.15, st.amp, st.amp * 0.225]);
    return RS.toU8(f);
  };

  const drawFrame = (img, det) => {
    const id = pctx.createImageData(W, H);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) { id.data[j] = img.r[i]; id.data[j + 1] = img.g[i]; id.data[j + 2] = img.b[i]; id.data[j + 3] = 255; }
    pctx.putImageData(id, 0, 0);
    if (!det || det.none) return;
    // magnified core: 48 × 48 px around the centroid, ×3, in the corner away from the spot
    const R = 24, Z = 3, S = R * 2 * Z;
    const ix = det.x < W / 2 ? W - S - 14 : 14, iy = det.y < H / 2 ? H - S - 14 : 14;
    const sx = Math.round(det.x) - R, sy = Math.round(det.y) - R;
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(paper, sx, sy, R * 2, R * 2, ix, iy, S, S);
    pctx.strokeStyle = "rgba(255,255,255,.9)"; pctx.lineWidth = 2;
    pctx.strokeRect(ix, iy, S, S);
    pctx.strokeRect(sx, sy, R * 2, R * 2);
    const cx = ix + (det.x - sx + 0.5) * Z, cy = iy + (det.y - sy + 0.5) * Z;
    pctx.strokeStyle = det.usable ? "#111" : "#c0392b"; pctx.lineWidth = 1.5;
    pctx.beginPath(); pctx.moveTo(cx - 12, cy); pctx.lineTo(cx + 12, cy); pctx.moveTo(cx, cy - 12); pctx.lineTo(cx, cy + 12); pctx.stroke();
    pctx.fillStyle = "rgba(0,0,0,.6)"; pctx.fillRect(ix, iy + S - 30, S, 30);
    pctx.fillStyle = "#fff"; pctx.font = "20px ui-monospace,monospace";
    pctx.fillText("×3", ix + 8, iy + S - 9);
  };

  const drawProfile = (img, det) => {
    const w = prof.width, h = prof.height, L = 10, Rm = 10, T = 14, B = 40;
    fctx.clearRect(0, 0, w, h);
    const ink = css(document.body, "--muted") || "#8f8f8f", rule = css(document.body, "--rule") || "#ebebeb";
    const acc = css(document.body, "--accent") || "#2f8a57", text = css(document.body, "--text-2") || "#525252";
    fctx.font = "25px ui-monospace,monospace";
    if (!det || det.none) { fctx.fillStyle = ink; fctx.fillText("no candidate", L, h / 2); return null; }
    const row = Math.round(det.y), half = 34, x0 = Math.round(det.x) - half;
    const xs = [], vs = [];
    for (let x = x0; x <= x0 + half * 2; x++) if (x >= 0 && x < W) { xs.push(x); vs.push(img.g[row * W + x]); }
    const fit = RS.fitGaussian(xs, vs, det.background, det.threshold, 250);
    const top = Math.max(270, fit ? Math.min(det.background + fit.peak, 900) + 15 : 0);
    const lo = det.background - 20;
    const X = (x) => L + ((x - x0) / (half * 2)) * (w - L - Rm);
    const Y = (v) => T + (1 - (v - lo) / (top - lo)) * (h - T - B);
    fctx.lineWidth = 1.5;
    fctx.strokeStyle = rule;
    fctx.beginPath(); fctx.moveTo(L, Y(det.background)); fctx.lineTo(w - Rm, Y(det.background)); fctx.stroke();
    fctx.setLineDash([6, 6]);
    fctx.beginPath(); fctx.moveTo(L, Y(250)); fctx.lineTo(w - Rm, Y(250)); fctx.stroke();
    fctx.setLineDash([]);
    fctx.fillStyle = ink;
    fctx.textAlign = "right"; fctx.fillText("paper " + det.background.toFixed(0), w - Rm, Y(det.background) - 16); fctx.textAlign = "left";
    fctx.fillText("saturation 250", L, Y(250) - 8);
    if (fit) {
      fctx.strokeStyle = acc; fctx.lineWidth = 3;
      fctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = x0 + (i / 200) * half * 2;
        const v = det.background + fit.peak * Math.exp(-((x - fit.mu) ** 2) / (2 * fit.sigma * fit.sigma));
        i ? fctx.lineTo(X(x), Y(Math.min(v, top))) : fctx.moveTo(X(x), Y(v));
      }
      fctx.stroke();
    }
    for (let i = 0; i < xs.length; i++) {
      const sat = vs[i] >= 250;
      fctx.beginPath(); fctx.arc(X(xs[i]), Y(vs[i]), 4.5, 0, Math.PI * 2);
      if (sat) { fctx.strokeStyle = text; fctx.lineWidth = 1.5; fctx.stroke(); }
      else { fctx.fillStyle = text; fctx.fill(); }
    }
    fctx.strokeStyle = acc; fctx.lineWidth = 1.5; fctx.setLineDash([3, 5]);
    fctx.beginPath(); fctx.moveTo(X(det.x), T); fctx.lineTo(X(det.x), h - B); fctx.stroke(); fctx.setLineDash([]);
    fctx.fillStyle = ink;
    fctx.fillText("x " + x0, L, h - 8);
    fctx.textAlign = "right"; fctx.fillText("x " + (x0 + half * 2), w - Rm, h - 8);
    fctx.textAlign = "center"; fctx.fillStyle = acc; fctx.fillText("centroid " + det.x.toFixed(2), X(det.x), h - 8);
    fctx.textAlign = "left";
    return fit;
  };

  // ---- target view: same drawing as VerticalityPanel.tsx, labels translated ----
  let cssW = 1, cssH = 1, viewMm = 10, hudFrame = 0, anim = 0, visible = true;
  const resize = () => {
    const r = panel.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (panel.width !== pw || panel.height !== ph) { panel.width = pw; panel.height = ph; }
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const colors = () => ({
    bg: css(panel, "--hud-bg"), grid: css(panel, "--hud-grid"), ring: css(panel, "--hud-ring"), label: css(panel, "--hud-label"),
    ref: css(panel, "--hud-ref"), spot: css(panel, "--hud-spot"), line: css(panel, "--a-accent"), alert: css(panel, "--a-bad"),
  });
  let col = null;
  const hud = () => {
    const w = cssW, h = cssH, ctx = hctx;
    hudFrame++;
    if (!col || hudFrame % 30 === 0) col = colors();
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = col.bg; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = cx % 24; x < w; x += 24) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (let y = cy % 24; y < h; y += 24) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
    const d = st.det, spot = d && !d.none ? [d.x, d.y] : null, ref = st.ref;
    const center = ref ?? spot ?? [W / 2, H / 2];
    let target = TOL * 2.2;
    if (ref && spot) target = Math.max(target, Math.hypot(spot[0] - ref[0], spot[1] - ref[1]) * SCALE * 1.4);
    else if (!ref) target = Math.max(target, 30);
    viewMm += (target - viewMm) * (hudFrame === 1 || reduce ? 1 : 0.15);
    const k = ((Math.min(w, h) / 2) * 0.92) / viewMm;
    const mx = (px) => cx + (px - center[0]) * SCALE * k, my = (py) => cy + (py - center[1]) * SCALE * k;
    ctx.font = '10px ui-monospace, "Cascadia Mono", Consolas, monospace';
    ctx.lineJoin = "round";
    const text = (s, x, y, c) => { ctx.lineWidth = 3; ctx.strokeStyle = col.bg; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y); };
    const marks = [spot && [mx(spot[0]), my(spot[1])], ref && [mx(ref[0]), my(ref[1])]].filter(Boolean);
    const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => viewMm / s <= 4) ?? 50;
    const rings = [];
    for (let rmm = step; rmm <= viewMm * 1.25; rmm += step) {
      const rp = rmm * k;
      ctx.beginPath(); ctx.arc(cx, cy, rp, 0, Math.PI * 2);
      ctx.strokeStyle = col.ring; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
      // label on the ring's free side: top-left when the spot sits top-right, and so on
      const sx = marks[0] && marks[0][0] > cx ? -1 : 1, sy = marks[0] && marks[0][1] < cy ? 1 : -1;
      const lx = cx + sx * rp * 0.707 + (sx > 0 ? 4 : -4), ly = cy + sy * rp * 0.707 + (sy > 0 ? 12 : -4);
      if (!marks.some(([px, py]) => Math.abs(px - lx) < 34 && Math.abs(py - ly) < 16)) rings.push([rmm + " mm", lx, ly, sx]);
    }
    ctx.strokeStyle = col.ring;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
    const over = ref && spot && (Math.abs(spot[0] - ref[0]) * SCALE > TOL || Math.abs(spot[1] - ref[1]) * SCALE > TOL);
    if (ref) {
      const rx = mx(ref[0]), ry = my(ref[1]), t = TOL * k;
      ctx.globalAlpha = 0.12; ctx.fillStyle = col.ref; ctx.fillRect(rx - t, ry - t, t * 2, t * 2); ctx.globalAlpha = 1;
      ctx.strokeStyle = col.ref; ctx.setLineDash([4, 4]); ctx.strokeRect(rx - t, ry - t, t * 2, t * 2); ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI * 2); ctx.moveTo(rx - 10, ry); ctx.lineTo(rx + 10, ry); ctx.moveTo(rx, ry - 10); ctx.lineTo(rx, ry + 10); ctx.stroke();
      ctx.textAlign = "left"; text("Ref", rx + 10, ry + 14, col.ref);
    }
    if (spot) {
      const sx = mx(spot[0]), sy = my(spot[1]);
      if (ref) { ctx.strokeStyle = over ? col.alert : col.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx(ref[0]), my(ref[1])); ctx.lineTo(sx, sy); ctx.stroke(); }
      const pulse = reduce ? 0.35 : (Date.now() % 1600) / 1600;
      ctx.globalAlpha = 0.7 * (1 - pulse); ctx.strokeStyle = col.spot; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, 6 + pulse * 12, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fillStyle = col.spot; ctx.fill();
      text("Spot", sx + 10, sy - 7, col.spot);
    }
    for (const [s, x, y, side] of rings) { ctx.textAlign = side > 0 ? "left" : "right"; text(s, x, y, col.label); }
    ctx.textAlign = "left";
    if (visible && !reduce) anim = requestAnimationFrame(hud);
  };
  const kick = () => { cancelAnimationFrame(anim); hud(); };

  const signed = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
  const REJECT = { clipped: "Spot clipped by the edge", ambiguous: "Several candidate spots" };
  const ui = () => {
    const fit = st.fit;
    const d = st.det, spot = d && !d.none ? d : null, ref = st.ref;
    const badges = [[spot ? "ok" : "warn", spot ? "Spot locked" : "No spot"], [ref ? "info" : "", ref ? "Reference set" : "No reference"]];
    if (spot && spot.saturated) badges.push(["bad", "Over-exposed"]);
    if (spot && !spot.usable) badges.push(["bad", REJECT[spot.reject_reason] || "Spot unusable"]);
    $("#lab-badges").innerHTML = badges.map(([t, s]) => '<span class="badge ' + t + '">' + s + "</span>").join("");
    $("#lab-empty").hidden = !!spot;
    const dx = spot && ref ? (spot.x - ref[0]) * SCALE : null, dy = spot && ref ? (spot.y - ref[1]) * SCALE : null;
    const dist = $("#lab-dist");
    dist.hidden = dx == null;
    if (dx != null) { dist.textContent = "Offset " + Math.hypot(dx, dy).toFixed(2) + " mm"; dist.classList.toggle("alert", Math.abs(dx) > TOL || Math.abs(dy) > TOL); }
    for (const [id, tid, v] of [["#lab-dx", "#lab-tx", dx], ["#lab-dy", "#lab-ty", dy]]) {
      $(id).innerHTML = v == null ? "—" : signed(v) + "<small>mm</small>";
      $(tid).className = "tile" + (v == null ? "" : Math.abs(v) > TOL ? " alert" : " ok");
    }
    $("#lab-set").disabled = !(spot && spot.usable);
    $("#lab-clear").disabled = !ref;
    const rows = spot
      ? [["Centroid", spot.x.toFixed(1) + ", " + spot.y.toFixed(1)], ["Error", Math.hypot(spot.x - st.x, spot.y - st.y).toFixed(3) + " px"],
         ["Fit σ", fit ? fit.sigma.toFixed(2) + " px" : "—"], ["Saturated", Math.round(spot.saturated_frac * 100) + "%"], ["Halo", spot.halo + " px"]]
      : [["Spot", "none"]];
    $("#lab-read").innerHTML = rows.map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>").join("");
  };

  const paint = () => {
    const img = frame();
    const det = RS.detectSpot(img, st.prev);
    st.det = det;
    st.prev = det && !det.none ? [det.x, det.y] : null;
    drawFrame(img, det);
    st.fit = drawProfile(img, det);
    ui();
    kick();
  };
  let queued = false;
  const render = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  };

  const move = (ev) => {
    const r = paper.getBoundingClientRect();
    st.x = Math.max(0, Math.min(W - 1, ((ev.clientX - r.left) * W) / r.width));
    st.y = Math.max(0, Math.min(H - 1, ((ev.clientY - r.top) * H) / r.height));
    render();
  };
  let down = false;
  paper.addEventListener("pointerdown", (ev) => { down = true; paper.setPointerCapture(ev.pointerId); move(ev); });
  paper.addEventListener("pointermove", (ev) => { if (down) move(ev); });
  paper.addEventListener("pointerup", () => { down = false; });
  paper.addEventListener("pointercancel", () => { down = false; });
  const setRef = () => { if (st.det && !st.det.none && st.det.usable) { st.ref = [st.det.x, st.det.y]; ui(); kick(); } };
  const clearRef = () => { st.ref = null; ui(); kick(); };
  paper.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    if (k === "s") { setRef(); return; }
    if (k === "r") { clearRef(); return; }
    const s = ev.shiftKey ? 10 : 1;
    const dx = ev.key === "ArrowLeft" ? -s : ev.key === "ArrowRight" ? s : 0;
    const dy = ev.key === "ArrowUp" ? -s : ev.key === "ArrowDown" ? s : 0;
    if (!dx && !dy) return;
    ev.preventDefault();
    st.x = Math.max(0, Math.min(W - 1, st.x + dx));
    st.y = Math.max(0, Math.min(H - 1, st.y + dy));
    render();
  });
  $("#lab-set").addEventListener("click", setRef);
  $("#lab-clear").addEventListener("click", clearRef);
  const bind = (id, key, fmt) => {
    const el = $(id), out = $(id + "-v");
    el.addEventListener("input", () => { st[key] = +el.value; out.textContent = fmt(st[key]); render(); });
  };
  bind("#lab-sigma", "sigma", (v) => v.toFixed(1));
  bind("#lab-amp", "amp", (v) => String(v));
  bind("#lab-noise", "noise", (v) => v.toFixed(1));

  if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); kick(); }).observe(panel);
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); else cancelAnimationFrame(anim); }).observe(panel);
  resize();
  paint();
  // layout can still move after the script runs (web fonts, images): size the target view again
  const settle = () => { resize(); kick(); };
  addEventListener("load", settle);
  if (document.fonts) document.fonts.ready.then(settle);
}
}


{
const qg = document.querySelector("#qg");
if (qg) {
  const SCALE = 0.256557;
  const NO_SPOT = "Usable green spot not detected in at least 5 frames within 0.5s (camera stale, spot lost, clipped by the frame edge or ambiguous), cannot record!";
  const frameCase = (o) => ({ kind: "frame", ...o });
  const CASES = {
    reflection: frameCase({
      label: "20 × 20 px white block, no laser", view: [230, 173, 160, 75], prev: null, truth: null,
      build: () => RS.fillRect(RS.paperFrame(640, 480, 0, [170, 178, 172], 0), 300, 200, 320, 220),
      story: "A 20 × 20 px fully saturated white block, with no laser in the frame. The old detector skipped the colour test for saturated candidates and returned it as the spot.",
      issue: "#20", fix: "A candidate needs at least min_halo_px = 8 unsaturated green pixels. A saturated white block has none, so it never becomes a candidate.",
    }),
    track: frameCase({
      label: "spot at (150, 150), white block at (479.5, 329.5)", view: [0, 90, 640, 300], prev: [250, 250], truth: [150, 150],
      build: () => RS.fillRect(RS.addSpot(RS.paperFrame(640, 480, 2), 150, 150, 6, [5, 60, 10]), 470, 320, 490, 340),
      story: "Tracking was lost (last position 250, 250). A white reflection carried more energy than the real, unsaturated spot, so the old detector jumped to it.",
      issue: "#20", fix: "The halo gate removes the white block; tracking prefers a candidate within track_gate_px = 40 px of the last spot; with no tracking context, two near-equal candidates are ambiguous.",
    }),
    edge: frameCase({
      label: "true centre x = 2 px", view: [0, 210, 128, 60], prev: null, truth: [2, 240],
      build: () => RS.addSpot(RS.paperFrame(640, 480, 0), 2, 240, 6, [5, 60, 10]),
      story: "Half the spot lies outside the frame. The intensity centroid of what remains moves inward: x = 3.92 px in the issue, 0.74 px bias at x = 5.",
      issue: "#20", fix: "Any weighted pixel touching the frame or ROI edge marks the spot clipped. It still shows in the target view but is excluded from averaging.",
    }),
    halo: frameCase({
      label: "spot at 320 + half-strength halo at 328", view: [288, 225, 64, 30], prev: null, truth: [320, 240],
      build: () => RS.addSpot(RS.addSpot(RS.paperFrame(640, 480, 7), 320, 240, 6, [5, 60, 10]), 328, 240, 6, [2, 30, 5]),
      story: "A half-strength halo 8 px to the right merges with the spot. In one frame the blend looks like a single, slightly wide spot, and the centroid moves 2.4 px.",
      issue: "#20", fix: "Not fixed. max_elongation exists but is off by default, because a real laser spot can be elliptical. The bias is repeatable and averaging cannot remove it; it is documented under Limits.",
    }),
    moving: {
      kind: "window", label: "15 frames, x from 100 to 114 in 0.42 s", truth: 114, now: 100.42, range: [97, 117],
      samples: () => Array.from({ length: 15 }, (_, i) => [100 + i * 0.03, [100 + i, 200]]),
      story: "The cart was still moving. Every frame is a clean spot and none is an outlier, so the old window averaged them: mean 107, 7 px (1.80 mm) behind the newest position.",
      issue: "#20", fix: "A least-squares slope across the window; drift above average_max_drift_px = 2 px with a significant slope, or std above 2.5 px, rejects the window.",
    },
    vibration: {
      kind: "window", label: "10 Hz at 30 fps: 5 frames at 324, 10 at 318", truth: 320, now: 100 + 14 / 30, range: [315, 327],
      samples: () => Array.from({ length: 15 }, (_, i) => [100 + i / 30, [i % 3 === 0 ? 324 : 318, 240]]),
      story: "Vibration aliased with the frame rate. Ten frames sat on the median, so MAD was zero and the 0.1 px floor cut the five peaks. The survivors had zero spread and passed the stillness check: dx = −0.513 mm, std 0.0000.",
      issue: "#25", fix: "The MAD floor is now 0.5 px and at most 15% of the window may be rejected. Here 5 of 15 (33%) are, so the window is refused as vibrating.",
    },
  };

  const view = qg.querySelector("#qg-view"), vctx = view.getContext("2d");
  const off = document.createElement("canvas"); off.width = 640; off.height = 480;
  const octx = off.getContext("2d");
  const pipe = qg.querySelector("#qg-pipe");
  let picked = -1;
  const $ = (s) => qg.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n, f) => getComputedStyle(document.body).getPropertyValue(n).trim() || f;
  const fmt = (v, d = 2) => (v >= 0 ? "+" : "") + v.toFixed(d);
  const cache = {};
  let cur = "reflection", mode = "before", timer = 0;

  const run = (key) => {
    if (cache[key]) return cache[key];
    const c = CASES[key];
    const out = {};
    if (c.kind === "frame") {
      const img = RS.toU8(c.build());
      out.img = img;
      out.before = RS.detectSpot(img, c.prev, RS.BEFORE_20.detect);
      out.after = RS.detectSpot(img, c.prev);
    } else {
      const s = c.samples();
      out.before = RS.averageSpot(s, c.now, (key === "vibration" ? RS.BEFORE_25 : RS.BEFORE_20).average);
      out.after = RS.averageSpot(s, c.now);
    }
    return (cache[key] = out);
  };

  // stage rows: [mark class, name, rule, outcome, tag]
  const stagesFor = (key, m) => {
    const c = CASES[key], r = run(key), d = r[m], before = m === "before";
    const tag20 = before ? "added in #20" : "#20", tag25 = before ? "added in #25" : "#25";
    const rows = [];
    if (c.kind === "frame") {
      const comps = d ? d.considered.length : 0;
      rows.push(["pass", "Bright region", "green > paper + max(25, 6σ)", comps + " component" + (comps === 1 ? "" : "s")]);
      const block = d && d.considered.find((q) => q.why === "halo");
      if (before) rows.push(["absent", "Halo and colour", "≥ 8 unsaturated green px", "saturated candidates skipped the colour test", tag20]);
      else rows.push([block ? "stop" : "pass", "Halo and colour", "≥ 8 unsaturated green px", block ? "white block: 0 halo px → dropped" : "halo " + (d && !d.none ? d.halo : 0) + " px", "#20"]);
      if (d && d.none) {
        rows.push(["skip", "Tracking", "within 40 px of the last spot", "no candidate left"]);
        rows.push(["skip", "Frame edge", "weighted pixels off the edge", "—"]);
      } else {
        if (before) rows.push(["absent", "Tracking", "within 40 px of the last spot", "strongest candidate wins", tag20]);
        else rows.push(["pass", "Tracking", "within 40 px of the last spot", c.prev ? (d.tracked ? "tracked" : "nothing within 40 px of (" + c.prev.join(", ") + "); " + d.candidates + " candidate" + (d.candidates === 1 ? "" : "s") + ", not ambiguous") : "no previous position", "#20"]);
        if (before) rows.push(["absent", "Frame edge", "weighted pixels off the edge", "not checked", tag20]);
        else rows.push([d.clipped ? "stop" : "pass", "Frame edge", "weighted pixels off the edge", d.clipped ? "touches x = 0 → clipped, not usable" : "inside the frame", "#20"]);
      }
      const usable = d && !d.none && d.usable;
      const w = usable ? "pass" : "skip";
      rows.push([w, "Window outliers", "median ± 3.5·MAD", usable ? "15 identical frames" : "frames never enter the window"]);
      rows.push([before ? "absent" : w, "Rejection cap", "≤ 15% of the window", before ? "no cap" : usable ? "0 of 15" : "—", tag25]);
      rows.push([before ? "absent" : w, "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", before ? "not checked" : usable ? "still" : "—", tag20]);
    } else {
      rows.push(["pass", "Bright region", "green > paper + max(25, 6σ)", "one clean spot per frame"]);
      rows.push([before && key === "moving" ? "absent" : "pass", "Halo and colour", "≥ 8 unsaturated green px", "halo present", tag20]);
      rows.push([before && key === "moving" ? "absent" : "pass", "Tracking", "within 40 px of the last spot", "tracked every frame", tag20]);
      rows.push([before && key === "moving" ? "absent" : "pass", "Frame edge", "weighted pixels off the edge", "inside the frame", tag20]);
      const floor = before ? 0.1 : 0.5;
      rows.push(["pass", "Window outliers", "median ± 3.5·max(MAD, " + floor + " px)", d.rejected + " of " + d.total + " outside " + d.band.mx.toFixed(1) + " ± " + d.band.hx.toFixed(2) + " px"]);
      if (before) rows.push(["absent", "Rejection cap", "≤ 15% of the window", "no cap: " + d.rejected + " dropped silently", tag25]);
      else rows.push([d.reason === "outliers" ? "stop" : "pass", "Rejection cap", "≤ 15% of the window", d.rejected + " of " + d.total + " = " + Math.round((100 * d.rejected) / d.total) + "%" + (d.reason === "outliers" ? " > 15% → vibrating" : ""), "#25"]);
      const stillMsg = "drift " + d.drift[0].toFixed(2) + " px · std " + d.std[0].toFixed(2) + " px";
      if (before && key === "moving") rows.push(["absent", "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", "not checked", tag20]);
      else if (d.reason === "outliers") rows.push(["skip", "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", "not reached"]);
      else rows.push([d.reason === "drift" || d.reason === "jitter" ? "stop" : "pass", "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", stillMsg + (d.reason ? " → " + d.reason : ""), "#20"]);
    }
    return rows;
  };

  const verdictFor = (key, m) => {
    const c = CASES[key], d = run(key)[m];
    if (c.kind === "frame") {
      if (!d || d.none) return ["ok", "Rejected", "no candidate survives, so there is no spot to measure", [["", "No spot"]], NO_SPOT];
      const err = c.truth ? Math.hypot(d.x - c.truth[0], d.y - c.truth[1]) : null;
      const pos = "(" + d.x.toFixed(2) + ", " + d.y.toFixed(2) + ")";
      if (!d.usable) return ["ok", "Rejected", pos + " shown but excluded from averaging", [["bad", "Spot clipped by the edge"]], NO_SPOT];
      if (c.truth === null) return ["no", "Accepted, wrong", pos + " reported, but the frame has no laser at all", [["ok", "Spot locked"]], "Measurement recorded."];
      if (err > 1) return [key === "halo" ? "warn" : "no", key === "halo" ? "Accepted, biased" : "Accepted, wrong", pos + " · " + err.toFixed(2) + " px (" + (err * SCALE).toFixed(2) + " mm) from the true centre", [["ok", "Spot locked"]], key === "halo" ? "Measurement recorded with a fixed bias; see Limits." : "Measurement recorded."];
      return ["ok", "Accepted", pos + " · " + err.toFixed(2) + " px from the true centre", [["ok", "Spot locked"]], "Ready to record."];
    }
    const mean = d.mean ? d.mean[0] : null;
    const bias = mean - c.truth;
    if (d.stable) return ["no", "Accepted, wrong", "mean x = " + mean.toFixed(2) + " px · " + fmt(bias) + " px (" + fmt(bias * SCALE, 3) + " mm) from " + (key === "moving" ? "the newest position" : "the true centre") + ", std " + d.std[0].toFixed(2) + " px", [["ok", "Spot locked"]], "Measurement recorded."];
    const msg = d.reason === "outliers"
      ? "Green spot is vibrating (" + d.rejected + "/" + d.total + " frames rejected as outliers within 0.5s, the average would be biased); wait for the vibration to settle, cannot record!"
      : "Green spot is not still (" + d.reason + ": std=(" + d.std[0].toFixed(2) + ", " + d.std[1].toFixed(2) + ") px, drift=(" + d.drift[0].toFixed(2) + ", " + d.drift[1].toFixed(2) + ") px within 0.5s); wait for the target to settle, cannot record!";
    return ["ok", "Rejected", "the window is refused: " + d.reason, [["ok", "Spot locked"]], msg];
  };

  const drawFrame = (key, m) => {
    const c = CASES[key], r = run(key), d = r[m];
    const img = r.img, id = octx.createImageData(640, 480);
    for (let i = 0, j = 0; i < 640 * 480; i++, j += 4) { id.data[j] = img.r[i]; id.data[j + 1] = img.g[i]; id.data[j + 2] = img.b[i]; id.data[j + 3] = 255; }
    octx.putImageData(id, 0, 0);
    const [vx, vy, vw, vh] = c.view, W = view.width, H = view.height, k = W / vw;
    vctx.imageSmoothingEnabled = vw < 300 ? false : true;
    vctx.drawImage(off, vx, vy, vw, vh, 0, 0, W, H);
    const X = (x) => (x - vx + 0.5) * k, Y = (y) => (y - vy + 0.5) * k;
    vctx.font = "20px ui-monospace,monospace";
    vctx.lineWidth = 1.5;
    if (d) for (const q of d.considered) {
      const [bx, by, bw, bh] = q.bbox;
      vctx.setLineDash(q.why ? [4, 4] : []);
      vctx.strokeStyle = q.why ? "rgba(192,57,43,.9)" : "rgba(17,17,17,.55)";
      vctx.strokeRect(X(bx - 0.5) - 3, Y(by - 0.5) - 3, bw * k + 6, bh * k + 6);
      if (q.why) { vctx.fillStyle = "rgba(192,57,43,.95)"; vctx.fillText("no halo", X(bx - 0.5) - 3, Y(by - 0.5) - 8); }
    }
    vctx.setLineDash([]);
    if (c.truth) {
      vctx.strokeStyle = "rgba(255,255,255,.95)"; vctx.lineWidth = 1.5;
      vctx.setLineDash([3, 3]); vctx.beginPath(); vctx.arc(X(c.truth[0]), Y(c.truth[1]), Math.max(14, 6 * k), 0, Math.PI * 2); vctx.stroke(); vctx.setLineDash([]);
    }
    if (d && !d.none) {
      const bad = verdictFor(key, m)[0] !== "ok";
      const px = X(d.x), py = Y(d.y), s = 18;
      vctx.strokeStyle = bad ? "#c0392b" : d.usable ? "#1f6f45" : "#b7791f"; vctx.lineWidth = 2.5;
      vctx.beginPath(); vctx.moveTo(px - s, py); vctx.lineTo(px + s, py); vctx.moveTo(px, py - s); vctx.lineTo(px, py + s); vctx.stroke();
    }
    vctx.fillStyle = "rgba(0,0,0,.5)"; vctx.fillRect(0, H - 34, W, 34);
    vctx.fillStyle = "#fff";
    vctx.fillText((c.truth ? "○ true centre   " : "") + "+ detector output   ▭ candidate", 10, H - 11);
    $("#qg-vlabel").textContent = "Probe frame";
    $("#qg-vmeta").textContent = c.label + " · " + (vw === 640 ? "rows 90–390" : vw + " × " + vh + " px crop");
  };

  const drawWindow = (key, m) => {
    const c = CASES[key], d = run(key)[m];
    const W = view.width, H = view.height, L = 46, R = 14, T = 16, B = 36;
    const ink = css("--muted", "#8f8f8f"), rule = css("--rule", "#ebebeb"), acc = css("--accent", "#2f8a57"), text = css("--text-2", "#525252");
    vctx.fillStyle = css("--card", "#fff"); vctx.fillRect(0, 0, W, H);
    const [lo, hi] = c.range;
    const X = (i) => L + (i / 14) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    vctx.font = "18px ui-monospace,monospace"; vctx.lineWidth = 1;
    vctx.strokeStyle = rule; vctx.fillStyle = ink;
    for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) { vctx.beginPath(); vctx.moveTo(L, Y(v)); vctx.lineTo(W - R, Y(v)); vctx.stroke(); vctx.fillText(String(v), 6, Y(v) + 4); }
    if (d.band) {
      vctx.fillStyle = "rgba(47,138,87,.10)";
      vctx.fillRect(L, Y(d.band.mx + d.band.hx), W - L - R, Y(d.band.mx - d.band.hx) - Y(d.band.mx + d.band.hx));
    }
    vctx.setLineDash([5, 5]); vctx.strokeStyle = text; vctx.lineWidth = 1.5;
    vctx.beginPath(); vctx.moveTo(L, Y(c.truth)); vctx.lineTo(W - R, Y(c.truth)); vctx.stroke(); vctx.setLineDash([]);
    vctx.fillStyle = text; vctx.textAlign = "right"; vctx.fillText(key === "moving" ? "newest " + c.truth : "true " + c.truth, W - R, Y(c.truth) - 6); vctx.textAlign = "left";
    d.points.forEach((q, i) => {
      const x = X(i), y = Y(q.x);
      vctx.beginPath(); vctx.arc(x, y, 5, 0, Math.PI * 2);
      if (q.kept) { vctx.fillStyle = acc; vctx.fill(); }
      else { vctx.strokeStyle = "#c0392b"; vctx.lineWidth = 2; vctx.beginPath(); vctx.moveTo(x - 5, y - 5); vctx.lineTo(x + 5, y + 5); vctx.moveTo(x + 5, y - 5); vctx.lineTo(x - 5, y + 5); vctx.stroke(); }
    });
    if (d.mean) {
      const y = Y(d.mean[0]);
      vctx.strokeStyle = d.stable ? "#c0392b" : ink; vctx.lineWidth = 2; if (!d.stable) vctx.setLineDash([2, 4]);
      vctx.beginPath(); vctx.moveTo(L, y); vctx.lineTo(W - R, y); vctx.stroke(); vctx.setLineDash([]);
      vctx.fillStyle = d.stable ? "#c0392b" : ink;
      vctx.fillText((d.stable ? "output " : "not output ") + d.mean[0].toFixed(1), L + 6, y - 6);
    }
    vctx.fillStyle = ink;
    vctx.fillText("frame 1", L, H - 10); vctx.textAlign = "right"; vctx.fillText("frame 15", W - R, H - 10);
    vctx.textAlign = "center"; vctx.fillText("● kept   ✕ rejected   ▬ MAD band", (L + W - R) / 2, H - 10); vctx.textAlign = "left";
    $("#qg-vlabel").textContent = "Sample window";
    $("#qg-vmeta").textContent = c.label;
  };

  const draw = (animate) => {
    const c = CASES[cur];
    (c.kind === "frame" ? drawFrame : drawWindow)(cur, mode);
    const rows = stagesFor(cur, mode);
    const MARK = { pass: "✓", stop: "✕", absent: "–", skip: "·" };
    const SHORT = { "Bright region": "Bright", "Halo and colour": "Halo", "Tracking": "Track", "Frame edge": "Edge", "Window outliers": "Outliers", "Rejection cap": "Cap", "Stillness": "Still" };
    if (picked < 0 || picked >= rows.length) {
      const stop = rows.findIndex((r) => r[0] === "stop"), absent = rows.findIndex((r) => r[0] === "absent");
      picked = stop >= 0 ? stop : absent >= 0 ? absent : rows.length - 1;
    }
    const cell = ([st, name, , , tag], i) =>
      '<button type="button" class="cell ' + st + '" data-i="' + i + '" aria-pressed="' + (i === picked) + '"><span class="m">' + MARK[st] + '</span><span class="n">' +
      SHORT[name] + '</span><span class="t">' + (tag ? tag.replace("added in ", "+") : "") + "</span></button>";
    pipe.innerHTML = '<div class="grp"><span>Per frame</span><div class="cells">' + rows.slice(0, 4).map(cell).join("") +
      '</div></div><div class="grp"><span>Per 0.5 s window</span><div class="cells">' + rows.slice(4).map((r, i) => cell(r, i + 4)).join("") + "</div></div>";
    const [pst, pname, prule, pout, ptag] = rows[picked];
    const det = $("#qg-detail");
    det.className = "detail " + pst;
    det.innerHTML = "<b>" + pname + '</b><span class="rule">' + prule + (ptag ? " · " + ptag : "") + '</span><span class="out">' +
      (pst === "absent" ? "this gate did not exist yet: " : "") + pout + "</span>";
    const [tone, chip, text, badges, msg] = verdictFor(cur, mode);
    $("#qg-chip").textContent = chip;
    $("#qg-chip").className = "chip " + tone;
    $("#qg-verdict").textContent = text;
    $("#qg-sees").innerHTML = '<span>Operator sees</span><span class="app">' + badges.map(([t, s]) => '<span class="badge ' + t + '">' + s + "</span>").join(" ") + "</span><code>" + msg + "</code>";
    $("#qg-story-h").textContent = "What " + c.issue + " found";
    $("#qg-story").textContent = c.story;
    $("#qg-fix").textContent = c.fix;
    clearTimeout(timer);
    if (animate && !reduce) {
      const items = [...pipe.querySelectorAll(".cell")];
      const stop = items.findIndex((li) => li.classList.contains("stop"));
      items.forEach((li) => li.classList.add("hidden"));
      let i = 0;
      const step = () => { if (i < items.length) { items[i++].classList.remove("hidden"); timer = setTimeout(step, i - 1 === stop ? 260 : 90); } };
      step();
    }
  };

  const tabs = [...qg.querySelectorAll('[role="tab"]')];
  const select = (b, focus) => {
    for (const t of tabs) { const on = t === b; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; }
    if (focus) b.focus();
    cur = b.dataset.case;
    picked = -1;
    draw(true);
  };
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => select(b, false));
    b.addEventListener("keydown", (ev) => {
      const s = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
      if (s) { ev.preventDefault(); select(tabs[(i + s + tabs.length) % tabs.length], true); }
      else if (ev.key.toLowerCase() === "f") setMode(mode === "before" ? "after" : "before");
    });
  });
  const modes = [...qg.querySelectorAll("[data-mode]")];
  const setMode = (m) => {
    mode = m;
    picked = -1;
    for (const b of modes) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    draw(true);
  };
  for (const b of modes) b.addEventListener("click", () => setMode(b.dataset.mode));
  pipe.addEventListener("click", (ev) => {
    const b = ev.target.closest(".cell");
    if (!b) return;
    picked = +b.dataset.i;
    draw(false);
  });
  draw(false);
}
}
