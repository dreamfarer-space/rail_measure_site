(() => {
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

const G = (() => {


const TAU = Math.PI * 2;
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a) => {
  const length = len3(a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function viewOf(P) {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  return [cosA * cosE, sinA * cosE, sinE];
}

function lightOf(P) {
  const { sinA, cosA } = cameraOf(P);
  return unit3([-sinA, cosA, LIGHT_UP]);
}

const scaleOf = (P) => cameraOf(P).k;

function bandOf(score) {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]) tone++;
  return tone;
}

const toneOf = (normal, P) => bandOf(dot3(unit3(normal), lightOf(P)));

function frameAlong(o, a) {
  const axis = unit3(a);
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3(cross3(helper, axis));
  const v = cross3(axis, u);
  return { o, a: axis, u, v };
}

const frameOf = (o, a, u, v) => ({ o, a, u, v });

function pointOf(F, s, r, angle) {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [
    F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]),
    F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]),
    F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]),
  ];
}

const radialOf = (F, angle) => {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [c * F.u[0] + n * F.v[0], c * F.u[1] + n * F.v[1], c * F.u[2] + n * F.v[2]];
};

const tangentOf = (F, angle) => {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [-n * F.u[0] + c * F.v[0], -n * F.u[1] + c * F.v[1], -n * F.u[2] + c * F.v[2]];
};

const angleToward = (F, direction) => Math.atan2(dot3(direction, F.v), dot3(direction, F.u));

function hullTagged(points) {
  const sorted = [...points].sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a.p[0] - o.p[0]) * (b.p[1] - o.p[1]) - (a.p[1] - o.p[1]) * (b.p[0] - o.p[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-9) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-9) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const hullOf = (points) => hullTagged(points.map((p) => ({ p }))).map(({ p }) => p);

function runsOf(flags) {
  const count = flags.length;
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
  if (start < 0) return flags[0] ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
  const runs = [];
  let run = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (flags[index]) {
      if (!run) run = [index];
      run.push((index + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

function groupsOf(keys) {
  const count = keys.length;
  const out = [];
  const start = keys.findIndex((key, index) => key !== keys[(index + count - 1) % count]);
  if (start < 0) {
    if (keys[0] !== null) out.push({ key: keys[0], run: Array.from({ length: count + 1 }, (_, index) => index % count) });
    return out;
  }
  let current = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    const key = keys[index];
    if (current && current.key === key) {
      current.run.push((index + 1) % count);
      continue;
    }
    if (current && current.key !== null) out.push(current);
    current = { key, run: [index, (index + 1) % count] };
  }
  if (current && current.key !== null) out.push(current);
  return out;
}

const stepsFor = (radius, least = 16, most = 112, scale = 0) => Math.max(least, Math.min(most, scale ? Math.ceil((TAU * radius * scale) / 3) : Math.round((radius * 1.3) / 4) * 4));

function chains(edges) {
  const out = [];
  let current = null;
  for (const [a, b, keep] of edges) {
    if (!keep) {
      if (current) out.push(current);
      current = null;
      continue;
    }
    if (!current) current = [a];
    current.push(b);
  }
  if (current) out.push(current);
  if (out.length > 1 && edges[0][2] && edges[edges.length - 1][2]) {
    const last = out.pop();
    out[0] = [...last, ...out[0].slice(1)];
  }
  return out;
}

function labelledArcs(nr, na, view, light, gr = nr, ga = na) {
  const cuts = [];
  if (Math.abs(gr) > 1e-9) {
    const visibleCut = -(ga * view.a) / (gr * view.flat);
    if (visibleCut > -1 && visibleCut < 1) {
      const d = Math.acos(visibleCut);
      cuts.push(view.phi - d, view.phi + d);
    }
  }
  if (Math.abs(nr) > 1e-9) {
    for (const threshold of BANDS) {
      const c = (threshold - na * light.a) / (nr * light.flat);
      if (c > -1 && c < 1) {
        const d = Math.acos(c);
        cuts.push(light.phi - d, light.phi + d);
      }
    }
  }
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const sorted = [...new Set(cuts.map((angle) => Math.round(wrap(angle) * 1e9) / 1e9))].sort((a, b) => a - b);
  const label = (angle) => {
    const facing = gr * view.flat * Math.cos(angle - view.phi) + ga * view.a;
    if (facing <= 1e-9) return -1;
    return bandOf(nr * light.flat * Math.cos(angle - light.phi) + na * light.a);
  };
  if (!sorted.length) {
    const tone = label(0);
    return tone < 0 ? [] : [{ tone, from: 0, to: TAU, full: true }];
  }
  const arcs = sorted.map((from, index) => {
    const to = index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + TAU;
    return { tone: label((from + to) / 2), from, to };
  });
  const merged = [];
  for (const arc of arcs) {
    const last = merged[merged.length - 1];
    if (last && last.tone === arc.tone && Math.abs(last.to - arc.from) < 1e-9) last.to = arc.to;
    else merged.push({ ...arc });
  }
  if (merged.length > 1 && merged[0].tone === merged[merged.length - 1].tone && Math.abs(merged[merged.length - 1].to - TAU - merged[0].from) < 1e-9) {
    const last = merged.pop();
    merged[0].from = last.from - TAU;
  }
  return merged.filter((arc) => arc.tone >= 0);
}

function hermiteSlopes(run) {
  const n = run.length - 1;
  const h = Array.from({ length: n }, (_, j) => run[j + 1][0] - run[j][0]);
  const delta = h.map((value, j) => (run[j + 1][1] - run[j][1]) / value);
  const d = new Array(n + 1).fill(0);
  const end = (h0, h1, d0, d1) => {
    let value = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(value) !== Math.sign(d0)) value = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(value) > Math.abs(3 * d0)) value = 3 * d0;
    return value;
  };
  if (n === 1) d[0] = d[1] = delta[0];
  else {
    d[0] = end(h[0], h[1], delta[0], delta[1]);
    d[n] = end(h[n - 1], h[n - 2], delta[n - 1], delta[n - 2]);
  }
  for (let k = 1; k < n; k++) {
    if (delta[k - 1] * delta[k] <= 0) continue;
    const w1 = 2 * h[k] + h[k - 1];
    const w2 = h[k] + 2 * h[k - 1];
    d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
  }
  return d;
}

function curveRuns(meridian) {
  const m = meridian.length;
  const segments = new Array(m - 1).fill(null);
  let start = 0;
  while (start < m - 1) {
    let end = start + 1;
    while (end < m - 1 && meridian[end][2] && Math.abs(meridian[end + 1][0] - meridian[end][0]) > 1e-9 && Math.abs(meridian[end][0] - meridian[end - 1][0]) > 1e-9) end++;
    const run = meridian.slice(start, end + 1);
    const n = run.length - 1;
    if (n >= 2 && run.every((point, j) => j === 0 || Math.abs(point[0] - run[j - 1][0]) > 1e-9)) {
      const d = hermiteSlopes(run);
      for (let j = 0; j < n; j++) {
        const [s0, r0] = run[j];
        const [s1, r1] = run[j + 1];
        const hj = s1 - s0;
        const d0 = d[j];
        const d1 = d[j + 1];
        const radius = (s) => {
          const t = (s - s0) / hj;
          return (2 * t ** 3 - 3 * t ** 2 + 1) * r0 + (t ** 3 - 2 * t ** 2 + t) * hj * d0 + (-2 * t ** 3 + 3 * t ** 2) * r1 + (t ** 3 - t ** 2) * hj * d1;
        };
        const slope = (s) => {
          const t = (s - s0) / hj;
          return ((6 * t ** 2 - 6 * t) * r0 + (6 * t - 6 * t ** 2) * r1) / hj + (3 * t ** 2 - 4 * t + 1) * d0 + (3 * t ** 2 - 2 * t) * d1;
        };
        segments[start + j] = { radius, slope };
      }
    }
    start = end;
  }
  return segments;
}

function curved(meridian, P, segments, { error = 0.2, depth = 6 } = {}) {
  const k = scaleOf(P);
  const out = [meridian[0]];
  for (let i = 0; i < meridian.length - 1; i++) {
    const curve = segments[i];
    const [s0] = meridian[i];
    const [s1] = meridian[i + 1];
    if (curve) {
      const split = (a, b, level) => {
        const mid = (a + b) / 2;
        const chord = (curve.radius(a) + curve.radius(b)) / 2;
        if (level < depth && Math.abs(curve.radius(mid) - chord) * k > error) {
          split(a, mid, level + 1);
          out.push([mid, curve.radius(mid), 1]);
          split(mid, b, level + 1);
        }
      };
      split(s0, s1, 0);
    }
    out.push(meridian[i + 1]);
  }
  return out;
}

function smoothRows(meridian, F, P, { rows = 6, slope = null, radius = null, steps = 48, error = 0.35, depth: deepest = 8, fineness = 0.1 } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const view = { a: dot3(F.a, V), flat: Math.hypot(dot3(F.u, V), dot3(F.v, V)), phi: Math.atan2(dot3(F.v, V), dot3(F.u, V)) };
  const light = { a: dot3(F.a, L), flat: Math.hypot(dot3(F.u, L), dot3(F.v, L)), phi: Math.atan2(dot3(F.v, L), dot3(F.u, L)) };
  const m = meridian.length;
  const faces = [];
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    const length = Math.hypot(ds, dr) || 1;
    faces.push([ds / length, -dr / length]);
  }
  const splines = slope ? null : curveRuns(meridian);
  const vertexNormal = (k, own) => {
    if (k <= 0 || k >= m - 1 || !meridian[k][2]) return own;
    const a = faces[k - 1];
    const b = faces[k];
    const x = a[0] + b[0];
    const y = a[1] + b[1];
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const normalAt = (i, u) => {
    const [s0] = meridian[i];
    const [s1] = meridian[i + 1];
    const s = s0 + (s1 - s0) * u;
    const sign = Math.sign(s1 - s0) || 1;
    const g = slope ? slope(s) : splines[i] ? splines[i].slope(s) : null;
    if (g !== null) {
      const length = Math.hypot(1, g);
      return [sign / length, (-sign * g) / length];
    }
    const a = vertexNormal(i, faces[i]);
    const b = vertexNormal(i + 1, faces[i]);
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const pointAt = (i, u, angle) => {
    const [s0, r0] = meridian[i];
    const [s1, r1] = meridian[i + 1];
    const s = s0 + (s1 - s0) * u;
    return iso(pointOf(F, s, radius ? radius(s) : splines && splines[i] ? splines[i].radius(s) : r0 + (r1 - r0) * u, angle), P);
  };
  const buckets = [[], [], [], [], []];
  const fine = TAU / Math.max(24, Math.min(192, steps * 1.5));
  const arcPoints = (i, u, from, to) => {
    const count = Math.max(1, Math.ceil((to - from) / fine));
    return Array.from({ length: count + 1 }, (_, index) => pointAt(i, u, from + ((to - from) * index) / count));
  };
  const centreOf = (arc, reference) => {
    let mid = (arc.from + arc.to) / 2 - reference;
    mid = ((mid % TAU) + TAU) % TAU;
    return mid;
  };
  const levelOf = (i, u) => {
    const [nr, na] = normalAt(i, u);
    const groups = new Map();
    for (const arc of labelledArcs(nr, na, view, light, faces[i][0], faces[i][1])) {
      if (!groups.has(arc.tone)) groups.set(arc.tone, []);
      groups.get(arc.tone).push(arc);
    }
    for (const list of groups.values()) list.sort((x, y) => centreOf(x, light.phi) - centreOf(y, light.phi));
    return { i, u, groups };
  };
  const same = (x, y) => {
    if (x.groups.size !== y.groups.size) return false;
    for (const [tone, list] of x.groups) if ((y.groups.get(tone) ?? []).length !== list.length) return false;
    return true;
  };
  const align = (reference, arc) => {
    const out = { ...arc };
    const centre = (reference.from + reference.to) / 2;
    while ((out.from + out.to) / 2 - centre > Math.PI) {
      out.from -= TAU;
      out.to -= TAU;
    }
    while (centre - (out.from + out.to) / 2 > Math.PI) {
      out.from += TAU;
      out.to += TAU;
    }
    return out;
  };
  const strayOf = (i, a, mid, b) => {
    let worst = 0;
    for (const [tone, list] of mid.groups) {
      list.forEach((arc, index) => {
        const lo = align(arc, a.groups.get(tone)[index]);
        const hi = align(arc, b.groups.get(tone)[index]);
        for (const key of ["from", "to"]) {
          const p = pointAt(i, mid.u, arc[key]);
          const p0 = pointAt(i, a.u, lo[key]);
          const p1 = pointAt(i, b.u, hi[key]);
          worst = Math.max(worst, Math.hypot(p[0] - (p0[0] + p1[0]) / 2, p[1] - (p0[1] + p1[1]) / 2));
        }
      });
    }
    return worst;
  };
  const sheet = (tone, levels) => {
    levels[0].groups.get(tone).forEach((arc, index) => {
      const chain = [arc];
      for (let k = 1; k < levels.length; k++) chain.push(align(chain[k - 1], levels[k].groups.get(tone)[index]));
      const last = levels.length - 1;
      const points = [...arcPoints(levels[0].i, levels[0].u, chain[0].from, chain[0].to)];
      for (let k = 1; k < last; k++) points.push(pointAt(levels[k].i, levels[k].u, chain[k].to));
      points.push(...arcPoints(levels[last].i, levels[last].u, chain[last].from, chain[last].to).reverse());
      for (let k = last - 1; k >= 1; k--) points.push(pointAt(levels[k].i, levels[k].u, chain[k].from));
      buckets[tone].push(pathOf(oriented(points), true));
    });
  };
  const overlap = (x, y) => Math.min(x.to, y.to) - Math.max(x.from, y.from);
  const strip = (tone, a, b) => {
    const below = a.groups.get(tone) ?? [];
    const above = (b.groups.get(tone) ?? []).map((arc) => ({ arc, used: false }));
    const quad = (lo, hi) => {
      const points = [...arcPoints(a.i, a.u, lo.from, lo.to), ...arcPoints(b.i, b.u, hi.from, hi.to).reverse()];
      buckets[tone].push(pathOf(oriented(points), true));
    };
    for (const arc of below) {
      let best = null;
      let score = -Infinity;
      for (const entry of above) {
        if (entry.used) continue;
        const aligned = align(arc, entry.arc);
        const value = overlap(arc, aligned);
        if (value > score) (score = value), (best = entry);
      }
      if (best && score > -0.05) {
        best.used = true;
        quad(arc, align(arc, best.arc));
      } else {
        const centre = (arc.from + arc.to) / 2;
        quad(arc, { from: centre, to: centre });
      }
    }
    for (const entry of above) {
      if (entry.used) continue;
      const centre = (entry.arc.from + entry.arc.to) / 2;
      quad({ from: centre, to: centre }, entry.arc);
    }
  };
  const k = scaleOf(P);
  let run = [];
  const flush = () => {
    const tones = [...new Set(run.flatMap((level) => [...level.groups.keys()]))].sort((x, y) => x - y);
    for (const tone of tones) {
      const countOf = (level) => (level.groups.get(tone) ?? []).length;
      let start = 0;
      for (let at = 1; at <= run.length; at++) {
        if (at < run.length && countOf(run[at - 1]) === countOf(run[at])) continue;
        if (at - 1 > start && countOf(run[start])) sheet(tone, run.slice(start, at));
        if (at < run.length) strip(tone, run[at - 1], run[at]);
        start = at;
      }
    }
    run = [];
  };
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    if (Math.abs(ds) < 1e-9) {
      flush();
      continue;
    }
    const count = Math.max(1, rows);
    const reach = (Math.hypot(ds, meridian[i + 1][1] - meridian[i][1]) * k) / count;
    const limit = Math.max(1, Math.min(deepest, Math.ceil(Math.log2(Math.max(2, reach / fineness)))));
    const coarse = Array.from({ length: count + 1 }, (_, index) => levelOf(i, index / count));
    run.push(coarse[0]);
    const refine = (a, b, depth) => {
      const mid = levelOf(i, (a.u + b.u) / 2);
      const split = depth < limit && (!same(a, b) || !same(a, mid) || (depth < 6 && strayOf(i, a, mid, b) > error));
      if (!split) {
        run.push(b);
        return;
      }
      refine(a, mid, depth + 1);
      refine(mid, b, depth + 1);
    };
    for (let index = 1; index <= count; index++) refine(coarse[index - 1], coarse[index], 0);
  }
  flush();
  return buckets;
}

function sideOf(meridian) {
  const m = meridian.length;
  let first = 0;
  let last = m - 1;
  if (meridian[0][1] <= 1e-9) first = 1;
  if (meridian[m - 1][1] <= 1e-9) last = m - 2;
  const side = meridian.slice(first, last + 1);
  for (let index = 1; index < side.length; index++) if (side[index][0] - side[index - 1][0] <= 1e-9) return null;
  return side.length >= 3 ? side : null;
}

function surfaceOf(side, F, P, rims, { samples = 96, slope = null } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const facing = Math.atan2(dot3(F.v, V), dot3(F.u, V));
  const [left, right] = silhouettePoints(side, F, P, { samples, slope });
  if (left.length <= samples || right.length <= samples) return null;
  const s0 = side[0][0];
  const s1 = side[side.length - 1][0];
  const angleOf = (point) => angleToward(F, sub3(point, add3(F.o, mul3(F.a, dot3(sub3(point, F.o), F.a)))));
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const arc = (s, r, from, to, through) => {
    let sweep = wrap(to - from);
    if (wrap(through - from) > sweep) sweep -= TAU;
    const count = Math.max(4, Math.ceil(Math.abs(sweep) / (TAU / 96)), Math.ceil((Math.abs(sweep) * r * scaleOf(P)) / 1.5));
    return Array.from({ length: count + 1 }, (_, index) => iso(pointOf(F, s, r, from + (sweep * index) / count), P));
  };
  const r0 = side[0][1];
  const r1 = side[side.length - 1][1];
  const bottom = -aV > 0 ? facing + Math.PI : facing;
  const top = aV > 0 ? facing + Math.PI : facing;
  const L = left.map((point) => iso(point, P));
  const R = right.map((point) => iso(point, P));
  const topArc = arc(s1, r1, angleOf(left[left.length - 1]), angleOf(right[right.length - 1]), top);
  const bottomArc = arc(s0, r0, angleOf(right[0]), angleOf(left[0]), bottom);
  const keepFirst = rims === "all" || rims === "first" || rims === "ends";
  const keepLast = rims === "all" || rims === "last" || rims === "ends";
  const fill = pathOf([...L, ...topArc, ...[...R].reverse(), ...bottomArc], true);
  const outline = [pathOf(L), pathOf(R), keepLast ? pathOf(topArc) : "", keepFirst ? pathOf(bottomArc) : ""].join("");
  const hull = hullOf([...arc(s0, r0, 0, TAU - 1e-6, Math.PI), ...arc(s1, r1, 0, TAU - 1e-6, Math.PI), ...L, ...R]);
  let gap = 0;
  for (const p of [...L, ...R]) {
    let best = Infinity;
    for (let index = 0; index < hull.length; index++) {
      const a = hull[index];
      const b = hull[(index + 1) % hull.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t));
    }
    gap = Math.max(gap, best);
  }
  return { fill, outline, gap };
}

const softOf = (meridian) => meridian.some((point) => Boolean(point[2]));

function lathe(meridian, F, P, { steps = stepsFor(Math.max(...meridian.map(([, r]) => r)), 32, 160, scaleOf(P)), fill = "auto", hole = null, bevel = 0, rims = "all", smooth: asked = "auto", waist = 0.5 } = {}) {
  const smooth = asked === "auto" ? softOf(meridian) : asked;
  const V = viewOf(P);
  const L = lightOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const aL = dot3(F.a, L);
  const uL = dot3(F.u, L);
  const vL = dot3(F.v, L);
  const n = steps;
  const m = meridian.length;
  const rings = meridian.map(([s, r]) => Array.from({ length: n }, (_, j) => iso(pointOf(F, s, r, (j / n) * TAU), P)));
  const midC = [];
  const midS = [];
  for (let j = 0; j < n; j++) {
    const t = ((j + 0.5) / n) * TAU;
    midC.push(Math.cos(t));
    midS.push(Math.sin(t));
  }
  const seen = [];
  const tones = [];
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    const length = Math.hypot(ds, dr);
    const row = [];
    const toneRow = [];
    for (let j = 0; j < n; j++) {
      if (length < 1e-9) {
        row.push(false);
        toneRow.push(0);
        continue;
      }
      const facing = ds * (midC[j] * uV + midS[j] * vV) - dr * aV;
      const lit = (ds * (midC[j] * uL + midS[j] * vL) - dr * aL) / length;
      row.push(facing > 1e-6 * length);
      toneRow.push(bandOf(lit));
    }
    seen.push(row);
    tones.push(toneRow);
  }
  const buckets = [[], [], [], [], []];
  const all = [];
  const smoothed = smooth ? smoothRows(meridian, F, P, { steps, ...(smooth === true ? {} : smooth) }) : null;
  if (smoothed) smoothed.forEach((list, tone) => list.forEach((d) => (buckets[tone].push(d), all.push(d))));
  for (let i = 0; i < m - 1; i++) {
    if (smoothed && Math.abs(meridian[i + 1][0] - meridian[i][0]) > 1e-9) continue;
    const keys = seen[i].map((visible, j) => (visible ? tones[i][j] : null));
    for (const { key, run } of groupsOf(keys)) {
      const a = run.map((j) => rings[i][j]);
      const b = run.map((j) => rings[i + 1][j]).reverse();
      const d = pathOf(oriented([...a, ...b]), true);
      buckets[key].push(d);
      all.push(d);
    }
  }
  const phi = Math.atan2(vV, uV);
  const flatV = Math.hypot(uV, vV);
  const rangeOf = (i) => {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    if (Math.hypot(ds, dr) < 1e-9) return null;
    if (Math.abs(ds) < 1e-9 || flatV < 1e-9) return -dr * aV > 1e-9 ? [-1, 1] : null;
    const c = (dr * aV) / (ds * flatV);
    return ds > 0 ? [Math.max(-1, c), 1] : [-1, Math.min(1, c)];
  };
  const arcsOf = (ranges) => {
    if (ranges.some((range) => !range)) return [];
    const lo = Math.max(...ranges.map(([x]) => x));
    const hi = Math.min(...ranges.map(([, x]) => x));
    if (lo >= hi - 1e-9) return [];
    const near = Math.acos(Math.min(1, hi));
    const far = Math.acos(Math.max(-1, lo));
    if (hi >= 1 && lo <= -1) return [[phi, phi + TAU]];
    if (hi >= 1) return [[phi - far, phi + far]];
    if (lo <= -1) return [[phi + near, phi + TAU - near]];
    return [[phi + near, phi + far], [phi - far, phi - near]];
  };
  const along = (s, r, [from, to]) => {
    const count = Math.max(2, Math.ceil(((to - from) * Math.max(r, 1e-6) * scaleOf(P)) / 1.5));
    return Array.from({ length: count + 1 }, (_, j) => iso(pointOf(F, s, r, from + ((to - from) * j) / count), P));
  };
  const creases = [];
  for (let i = 1; i < m - 1; i++) {
    if (meridian[i][2] || meridian[i][1] <= 1e-9) continue;
    for (const arc of arcsOf([rangeOf(i - 1), rangeOf(i)])) creases.push(pathOf(along(meridian[i][0], meridian[i][1], arc)));
  }
  let bevelPath = "";
  if (bevel > 0 && m > 2) {
    const ends = [];
    if (meridian[0][1] <= 1e-9) ends.push([0, 1, 1]);
    if (meridian[m - 1][1] <= 1e-9) ends.push([m - 2, m - 2, m - 3]);
    for (const [cap, rim, side] of ends) {
      const [s, r] = meridian[rim];
      for (const arc of arcsOf([rangeOf(cap), rangeOf(side)])) {
        const inset = along(s, Math.max(0, r - bevel), arc);
        const edge = along(s, r, arc);
        bevelPath += pathOf([edge[0], ...inset.slice(1, -1), edge[edge.length - 1]]);
      }
    }
  }
  const { fill: fillPath, outline } = outlineOf(meridian, F, P, { steps: n, fill, hole, rims, smooth, waist, all });
  return {
    fill: fillPath,
    outline,
    crease: creases.join(""),
    top: buckets[4].join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
    bevel: bevelPath || undefined,
    seamless: Boolean(smoothed),
  };
}

function shapeOf(meridian, P, smooth) {
  if (smooth && smooth.radius) {
    const segments = meridian.slice(0, -1).map(([s0], index) => (Math.abs(meridian[index + 1][0] - s0) > 1e-9 ? { radius: smooth.radius, slope: smooth.slope } : null));
    return curved(meridian, P, segments);
  }
  const curves = smooth && !smooth.slope ? curveRuns(meridian) : null;
  return curves && curves.some(Boolean) ? curved(meridian, P, curves) : meridian;
}

function outlineOf(meridian, F, P, { steps = stepsFor(Math.max(...meridian.map(([, r]) => r)), 32, 160, scaleOf(P)), fill = "auto", hole = null, rims = "all", smooth: asked = "auto", waist = 0.5, all = null } = {}) {
  const smooth = asked === "auto" ? softOf(meridian) : asked;
  const n = steps;
  let fillPath;
  let outline;
  const shape = shapeOf(meridian, P, smooth);
  const side = fill === "auto" || fill === "surface" ? sideOf(shape) : null;
  const surface = side && !hole ? surfaceOf(side, F, P, rims, { slope: smooth && smooth.slope ? smooth.slope : null }) : null;
  if (surface && (fill === "surface" || surface.gap > waist)) {
    fillPath = surface.fill;
    outline = surface.outline;
  } else if (fill === "hull" || fill === "auto" || fill === "surface") {
    const most = Math.max(...shape.map(([, r]) => r));
    const around = Math.min(320, Math.max(n, Math.ceil((TAU * most * scaleOf(P)) / 1.5)));
    const tagged = [];
    shape.forEach(([s, r], index) => {
      for (let j = 0; j < around; j++) tagged.push({ p: iso(pointOf(F, s, r, (j / around) * TAU), P), ring: index });
    });
    const hull = hullTagged(tagged);
    const holePath = hole ? pathOf(Array.from({ length: around }, (_, j) => iso(pointOf(F, hole[0], hole[1], (j / around) * TAU), P)), true) : "";
    fillPath = pathOf(hull.map(({ p }) => p), true) + holePath;
    if (rims === "all") {
      outline = pathOf(hull.map(({ p }) => p), true) + holePath;
    } else {
      const keepFirst = rims === "first" || rims === "ends";
      const keepLast = rims === "last" || rims === "ends";
      const edges = hull.map((a, index) => {
        const b = hull[(index + 1) % hull.length];
        const same = a.ring === b.ring;
        const keep = !same || (a.ring !== 0 && a.ring !== shape.length - 1) || (keepFirst && a.ring === 0) || (keepLast && a.ring === shape.length - 1);
        return [a.p, b.p, keep];
      });
      outline = chains(edges).map((points) => pathOf(points)).join("") + holePath;
    }
  } else {
    fillPath = all ? all.join("") : (({ shades, top }) => [...shades, top].join(""))(lathe(meridian, F, P, { steps: n, fill: "auto", hole, rims, smooth, waist }));
    outline = "";
  }
  return { fill: fillPath, outline };
}

const signedArea = (points) => points.reduce((sum, [x, y], index) => {
  const [nx, ny] = points[(index + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0);

const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);

const saddleStart = (R, a, angle) => Math.sqrt(Math.max(0, R * R - a * a * Math.cos(angle) ** 2));

function saddleOf(F, a, start, s1, P, { steps = stepsFor(a, 24) } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const n = steps;
  const angle = (j) => (j / n) * TAU;
  const from = typeof start === "function" ? start : (t) => saddleStart(start, a, t);
  const low = Array.from({ length: n }, (_, j) => iso(pointOf(F, from(angle(j)), a, angle(j)), P));
  const high = Array.from({ length: n }, (_, j) => iso(pointOf(F, s1, a, angle(j)), P));
  const seen = [];
  const tones = [];
  for (let j = 0; j < n; j++) {
    const normal = radialOf(F, angle(j + 0.5));
    seen.push(dot3(normal, V) > 1e-6);
    tones.push(bandOf(dot3(normal, L)));
  }
  const buckets = [[], [], [], [], []];
  const fills = [];
  const keys = seen.map((visible, j) => (visible ? tones[j] : null));
  for (const { key, run } of groupsOf(keys)) {
    const d = pathOf(oriented([...run.map((j) => low[j]), ...run.map((j) => high[j]).reverse()]), true);
    buckets[key].push(d);
    fills.push(d);
  }
  const capSeen = dot3(F.a, V) > 1e-6;
  if (capSeen) {
    const d = pathOf(oriented(high), true);
    buckets[bandOf(dot3(F.a, L))].push(d);
    fills.push(d);
  }
  const front = runsOf(seen);
  const back = runsOf(seen.map((visible) => !visible));
  const edges = [];
  for (const run of front) {
    edges.push(pathOf(run.map((j) => low[j])));
    edges.push(pathOf([low[run[0]], high[run[0]]]), pathOf([low[run[run.length - 1]], high[run[run.length - 1]]]));
  }
  for (const run of capSeen ? back : front) edges.push(pathOf(run.map((j) => high[j])));
  return {
    fill: fills.join(""),
    outline: edges.join(""),
    crease: capSeen ? front.map((run) => pathOf(run.map((j) => high[j]))).join("") : "",
    top: buckets[4].join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
    seamless: true,
  };
}

function prismOf(F, polygon, s0, s1, P) {
  const V = viewOf(P);
  const L = lightOf(P);
  const ring = oriented(polygon.map(([x, y]) => [x, y]));
  const n = ring.length;
  const at = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
  const low = ring.map((point) => iso(at(s0, point), P));
  const high = ring.map((point) => iso(at(s1, point), P));
  const buckets = [[], [], [], [], []];
  const seen = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[(j + 1) % n];
    const normal = unit3(add3(mul3(F.u, y1 - y0), mul3(F.v, -(x1 - x0))));
    const visible = dot3(normal, V) > 1e-6;
    seen.push(visible);
    if (visible) buckets[bandOf(dot3(normal, L))].push(pathOf([low[j], low[(j + 1) % n], high[(j + 1) % n], high[j]], true));
  }
  const ends = [[s0, low, mul3(F.a, -1)], [s1, high, F.a]];
  const capSeen = ends.map(([, , normal]) => dot3(normal, V) > 1e-6);
  ends.forEach(([, points, normal], index) => capSeen[index] && buckets[bandOf(dot3(normal, L))].push(pathOf(points, true)));
  const hull = hullOf([...low, ...high]);
  const creases = [];
  for (let j = 0; j < n; j++) {
    const prev = (j - 1 + n) % n;
    const a = [ring[j][0] - ring[prev][0], ring[j][1] - ring[prev][1]];
    const b = [ring[(j + 1) % n][0] - ring[j][0], ring[(j + 1) % n][1] - ring[j][1]];
    const sharp = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1) < Math.cos(0.35);
    if (sharp && seen[j] && seen[prev]) creases.push(pathOf([low[j], high[j]]));
    ends.forEach(([, points], index) => capSeen[index] && seen[j] && creases.push(pathOf([points[j], points[(j + 1) % n]])));
  }
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: creases.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

function stadium(r0, r1, offset, steps = 32) {
  const circle = (cx, r) => Array.from({ length: steps }, (_, index) => [cx + r * Math.cos((index / steps) * TAU), r * Math.sin((index / steps) * TAU)]);
  return hullOf([...circle(0, r0), ...circle(offset, r1)]);
}

function sphereOf(centre, r, P, { steps = 48 } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const F = frameAlong(centre, V);
  const flat = (p) => iso(p, P);
  const rim = Array.from({ length: steps }, (_, index) => pointOf(F, 0, r, (index / steps) * TAU));
  const outline = pathOf(rim.map(flat), true);
  const capOf = (threshold) => {
    const points = rim.filter((p) => dot3(sub3(p, centre), L) / r >= threshold).map(flat);
    const c = dot3(L, V);
    const LF = frameAlong(add3(centre, mul3(L, r * threshold)), L);
    const radius = r * Math.sqrt(Math.max(0, 1 - threshold * threshold));
    for (let index = 0; index < steps; index++) {
      const p = pointOf(LF, 0, radius, (index / steps) * TAU);
      if (dot3(sub3(p, centre), V) >= -1e-9) points.push(flat(p));
    }
    if (c > threshold) points.push(flat(add3(centre, mul3(V, r))));
    return points.length > 2 ? pathOf(hullOf(points), true) : "";
  };
  const shades = [outline, capOf(BANDS[1]), capOf(BANDS[2]), capOf(BANDS[3])];
  return { fill: outline, outline, crease: "", top: "", shades, seamless: true };
}

const disc = (s0, s1, r, F, P, options = {}) =>
  lathe(
    [
      [s0, 0],
      [s0, r],
      [s1, r],
      [s1, 0],
    ],
    F,
    P,
    { steps: stepsFor(r, 32, 160, scaleOf(P)), ...options },
  );

const ringBand = (s0, s1, rIn, rOut, F, P, options = {}) =>
  lathe(
    [
      [s0, rIn],
      [s0, rOut],
      [s1, rOut],
      [s1, rIn],
    ],
    F,
    P,
    { steps: stepsFor(rOut, 32, 160, scaleOf(P)), hole: null, ...options },
  );

function solidOf(profile, F, P, options = {}) {
  const first = profile[0];
  const last = profile[profile.length - 1];
  const meridian = [[first[0], 0], ...profile, [last[0], 0]];
  const most = Math.max(...profile.map(([, r]) => r));
  return lathe(meridian, F, P, { steps: stepsFor(most, 32, 160, scaleOf(P)), ...options });
}

function bandOfProfile(profile, F, P, options = {}) {
  const most = Math.max(...profile.map(([, r]) => r));
  return lathe(profile, F, P, { steps: stepsFor(most, 32, 160, scaleOf(P)), ...options });
}

function silhouettePoints(profile, F, P, { samples = 72, slope: given = null, radius = null } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const facing = Math.atan2(vV, uV);
  const flat = Math.hypot(uV, vV) || 1e-9;
  const s0 = profile[0][0];
  const s1 = profile[profile.length - 1][0];
  const radiusAt = radius ?? ((s) => {
    let index = 1;
    while (index < profile.length - 1 && profile[index][0] < s) index++;
    const [sa, ra] = profile[index - 1];
    const [sb, rb] = profile[index];
    return ra + ((rb - ra) * (s - sa)) / (sb - sa || 1);
  });
  const side = (sign) => {
    const points = [];
    for (let step = 0; step <= samples; step++) {
      const s = s0 + ((s1 - s0) * step) / samples;
      const h = (s1 - s0) / samples / 2 || 0.01;
      const slope = given ? given(s) : (radiusAt(Math.min(s1, s + h)) - radiusAt(Math.max(s0, s - h))) / (Math.min(s1, s + h) - Math.max(s0, s - h) || 1);
      const c = (slope * aV) / flat;
      if (Math.abs(c) > 1) continue;
      points.push(pointOf(F, s, radiusAt(s), facing + sign * Math.acos(c)));
    }
    return points;
  };
  return [side(1), side(-1)];
}

const silhouetteOf = (profile, F, P, options = {}) =>
  silhouettePoints(profile, F, P, options)
    .map((points) => pathOf(points.map((point) => iso(point, P))))
    .join("");

function profileCurve(profile, { slope = null, radius = null } = {}) {
  for (let index = 1; index < profile.length; index++) if (profile[index][0] - profile[index - 1][0] <= 1e-9) throw new Error(`profileCurve: s must rise along the profile (point ${index} at s = ${profile[index][0]})`);
  const segments = curveRuns(profile);
  const s0 = profile[0][0];
  const s1 = profile[profile.length - 1][0];
  const find = (s) => {
    let lo = 0;
    let hi = profile.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (profile[mid][0] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const linear = (index, s) => {
    const [sa, ra] = profile[index];
    const [sb, rb] = profile[index + 1];
    return [ra + ((rb - ra) * (s - sa)) / (sb - sa), (rb - ra) / (sb - sa)];
  };
  const radiusAt = radius ?? ((s) => {
    const at = Math.max(s0, Math.min(s1, s));
    const index = find(at);
    return segments[index] ? segments[index].radius(at) : linear(index, at)[0];
  });
  const slopeAt = slope ?? ((s) => {
    const at = Math.max(s0, Math.min(s1, s));
    const index = find(at);
    return segments[index] ? segments[index].slope(at) : linear(index, at)[1];
  });
  return { s0, s1, radius: radiusAt, slope: slopeAt, analytic: Boolean(slope && radius) };
}

function bandsOf(profile, cuts, F, P, { slope = null, radius = null, steps, rows = 6, rims = "none", fill = "auto", samples = 72 } = {}) {
  const curve = profileCurve(profile, { slope, radius });
  const { s0, s1 } = curve;
  const stops = [s0, ...[...new Set(cuts)].filter((s) => s > s0 + 1e-6 && s < s1 - 1e-6).sort((a, b) => a - b), s1];
  const most = Math.max(...profile.map(([, r]) => r), ...stops.map((s) => curve.radius(s)));
  const n = steps ?? stepsFor(most, 32, 160, scaleOf(P));
  const knot = (s, soft) => (soft ? [s, curve.radius(s), 1] : [s, curve.radius(s)]);
  const meridianOf = (a, b) => [knot(a), ...profile.filter(([s]) => s > a + 1e-9 && s < b - 1e-9).map(([s, , soft]) => knot(s, soft)), knot(b)];
  const shading = { slope: curve.slope, radius: curve.radius, rows };
  const bands = stops.slice(0, -1).map((a, index) => {
    const b = stops[index + 1];
    const meridian = meridianOf(a, b);
    const paths = lathe(meridian, F, P, { steps: n, rims, fill, smooth: shading });
    const seam = index < stops.length - 2 ? arcOf(F, b, curve.radius(b), P, { slope: curve.slope(b) }) : "";
    return { s0: a, s1: b, profile: meridian, paths: { ...paths, outline: "" }, outline: paths.outline, seam };
  });
  const sidesOf = (from = s0, to = s1, { ends = false, count = samples } = {}) => {
    const span = [Math.max(s0, from), Math.min(s1, to)];
    const dense = Array.from({ length: count + 1 }, (_, index) => knot(span[0] + ((span[1] - span[0]) * index) / count, true));
    const points = silhouettePoints(dense, F, P, { samples: count, slope: curve.slope, radius: curve.radius });
    const rim = (s) => arcOf(F, s, curve.radius(s), P, { slope: curve.slope(s) });
    const rimsAt = ends === true ? span : ends === "first" ? [span[0]] : ends === "last" ? [span[1]] : [];
    return { d: points.map((list) => pathOf(list.map((point) => iso(point, P)))).join("") + rimsAt.map(rim).join(""), points };
  };
  return { bands, sidesOf, radius: curve.radius, slope: curve.slope, steps: n, s0, s1 };
}

function arcOf(F, s, r, P, { slope = 0, steps = 0, least = 0.02, inward = false, from = 0, to = TAU, trim = 0.3 } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const flat = Math.hypot(uV, vV);
  const phi = Math.atan2(vV, uV);
  const norm = Math.hypot(1, slope);
  const full = Math.abs(to - from - TAU) < 1e-9;
  let visible;
  if (flat < 1e-9) visible = (inward ? slope * aV / norm > least : -slope * aV / norm > least) ? [[phi, phi + TAU]] : [];
  else if (inward) {
    const c = (slope * aV - least * norm) / flat;
    visible = c <= -1 ? [] : c >= 1 ? [[phi, phi + TAU]] : [[phi + Math.acos(c), phi + TAU - Math.acos(c)]];
  } else {
    const c = (least * norm + slope * aV) / flat;
    visible = c >= 1 ? [] : c <= -1 ? [[phi, phi + TAU]] : [[phi - Math.acos(c), phi + Math.acos(c)]];
  }
  const at = (t) => iso(pointOf(F, s, r, t), P);
  const speed = (t) => {
    const a = at(t - 1e-3);
    const b = at(t + 1e-3);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 2e-3;
  };
  const count = (span) => Math.max(2, Math.ceil(((steps || stepsFor(r, 24, 112)) * span) / TAU), Math.ceil((span * r * scaleOf(P)) / 1.5));
  const out = [];
  for (const [a, b] of visible) {
    if (b - a >= TAU - 1e-9 && full) {
      const n = count(TAU);
      out.push(pathOf(Array.from({ length: n }, (_, j) => at(from + (j / n) * TAU)), true));
      continue;
    }
    const pieces = full ? [[a, b, true, true]] : [];
    if (!full)
      for (let turn = -2; turn <= 2; turn++) {
        const lo = Math.max(a + turn * TAU, from);
        const hi = Math.min(b + turn * TAU, to);
        if (hi - lo > 1e-6) pieces.push([lo, hi, lo > from + 1e-9, hi < to - 1e-9]);
      }
    for (const [lo, hi, limb0, limb1] of pieces) {
      const span = hi - lo;
      const cut0 = limb0 && trim > 0 ? Math.min(span * 0.25, trim / (speed(lo) || 1)) : 0;
      const cut1 = limb1 && trim > 0 ? Math.min(span * 0.25, trim / (speed(hi) || 1)) : 0;
      const t0 = lo + cut0;
      const t1 = hi - cut1;
      const n = count(t1 - t0);
      out.push(pathOf(Array.from({ length: n + 1 }, (_, j) => at(t0 + ((t1 - t0) * j) / n))));
    }
  }
  return out.join("");
}

function circleOf(F, s, r, P, steps = 0) {
  const count = steps || stepsFor(r, 24, 112);
  return pathOf(
    Array.from({ length: count }, (_, j) => iso(pointOf(F, s, r, (j / count) * TAU), P)),
    true,
  );
}

function spokesOf(F, s, r0, r1, count, P, { phase = 0, sweep = 0, from = 0, to = TAU } = {}) {
  const lines = [];
  for (let index = 0; index < count; index++) {
    const t = phase + from + (index / count) * (to - from);
    lines.push(pathOf([iso(pointOf(F, s, r0, t), P), iso(pointOf(F, s, r1, t + sweep), P)]));
  }
  return lines.join("");
}

const fadeOf = (value, [lo, hi]) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1e-9)));
  return t * t * (3 - 2 * t);
};

function ribsOf(F, s0, s1, r, count, P, { phase = 0, twist = 0, least = 0.12, r1 = r, fade = null, seams = false } = {}) {
  const V = viewOf(P);
  const lines = [];
  const slope = (r1 - r) / (s1 - s0 || 1);
  for (let index = 0; index < count; index++) {
    const t = phase + (index / count) * TAU;
    const radial = radialOf(F, t + twist / 2);
    const normal = unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]);
    const facing = dot3(normal, V);
    const d = pathOf([iso(pointOf(F, s0, r, t), P), iso(pointOf(F, s1, r1, t + twist), P)]);
    if (fade) {
      const alpha = fadeOf(facing, fade);
      if (alpha > 0.02) lines.push({ d, alpha });
      continue;
    }
    if (facing < least) continue;
    lines.push(d);
  }
  const ends = seams ? [seams === "last" ? "" : arcOf(F, s0, r, P, { slope }), seams === "first" ? "" : arcOf(F, s1, r1, P, { slope })].filter(Boolean) : [];
  if (fade) return [...lines, ...ends.map((d) => ({ d, alpha: 1 }))];
  return [...lines, ...ends].join("");
}

function rodOut(F, from, to, r, P, { stroke = 0, ...options } = {}) {
  const pad = 0.35 / scaleOf(P);
  const ring = (s) => Array.from({ length: 48 }, (_, index) => iso(pointOf(F, s, r + pad, (index / 48) * TAU), P));
  return {
    paths: disc(from - stroke, to, r, F, P, options),
    clip: pathOf(hullOf([...ring(from), ...ring(to + stroke)]), true),
    from,
    to,
    stroke,
    reach: to + stroke,
  };
}

function dotsOf(F, s, r, count, P, { phase = 0, slope = 0, least = 0.08, all = false, fade = null } = {}) {
  const V = viewOf(P);
  const out = [];
  for (let index = 0; index < count; index++) {
    const t = phase + (index / count) * TAU;
    let alpha = 1;
    if (!all) {
      const radial = radialOf(F, t);
      const normal = unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]);
      const facing = dot3(normal, V);
      if (fade) alpha = fadeOf(facing, fade);
      else if (facing < least) continue;
      if (alpha <= 0.02) continue;
    }
    const [x, y] = iso(pointOf(F, s, r, t), P);
    out.push(alpha < 1 ? [x, y, alpha] : [x, y]);
  }
  return out;
}

function facingOf(F, angle, P, slope = 0) {
  const radial = radialOf(F, angle);
  return dot3(unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]), viewOf(P));
}

function fillet(points, radius, perArc = 7, { P = null, tube = 0, margin = 1.3 } = {}) {
  if (points.length < 3) return points.map((p) => [...p]);
  const V = P && tube ? viewOf(P) : null;
  const out = [[...points[0]]];
  for (let index = 1; index < points.length - 1; index++) {
    const prev = points[index - 1];
    const here = points[index];
    const next = points[index + 1];
    const into = unit3(sub3(here, prev));
    const outOf = unit3(sub3(next, here));
    const cosTurn = Math.max(-1, Math.min(1, dot3(into, outOf)));
    const turn = Math.acos(cosTurn);
    if (turn < 1e-3) {
      out.push([...here]);
      continue;
    }
    const room = Math.min(len3(sub3(here, prev)), len3(sub3(next, here))) * 0.48;
    const facing = V ? Math.abs(dot3(unit3(cross3(into, outOf)), V)) : 1;
    const bend = V ? Math.max(radius, (margin * tube) / (0.7 * Math.max(0.05, facing) ** 2)) : radius;
    const cut = Math.min(bend * Math.tan(turn / 2), room);
    const a = sub3(here, mul3(into, cut));
    const b = add3(here, mul3(outOf, cut));
    const count = Math.max(2, Math.ceil((perArc * turn) / (Math.PI / 2)));
    for (let step = 0; step <= count; step++) {
      const t = step / count;
      const p0 = lerp3(a, here, t);
      const p1 = lerp3(here, b, t);
      out.push(lerp3(p0, p1, t));
    }
  }
  out.push([...points[points.length - 1]]);
  return out;
}

function resample(points, spacing) {
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + len3(sub3(points[index], points[index - 1])));
  const total = lengths[lengths.length - 1];
  const count = Math.max(1, Math.round(total / spacing));
  const out = [];
  let segment = 1;
  for (let step = 0; step <= count; step++) {
    const at = (total * step) / count;
    while (segment < points.length - 1 && lengths[segment] < at) segment++;
    const a = points[segment - 1];
    const b = points[segment];
    const span = lengths[segment] - lengths[segment - 1] || 1;
    out.push(lerp3(a, b, Math.min(1, Math.max(0, (at - lengths[segment - 1]) / span))));
  }
  return out;
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) total += len3(sub3(points[index], points[index - 1]));
  return total;
}

function cut(points, from, to) {
  const out = [];
  let walked = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const length = len3(sub3(b, a));
    const start = walked;
    const end = walked + length;
    if (end >= from && start <= to) {
      const t0 = Math.max(0, (from - start) / (length || 1));
      const t1 = Math.min(1, (to - start) / (length || 1));
      if (!out.length) out.push(lerp3(a, b, t0));
      out.push(lerp3(a, b, t1));
    }
    walked = end;
  }
  return out;
}

const pointAlong = (points, at) => {
  const piece = cut(points, at, at + 0.01);
  return piece[0] ?? points[points.length - 1];
};

function tangentAlong(points, at) {
  const total = pathLength(points);
  const a = pointAlong(points, Math.max(0, at - 0.6));
  const b = pointAlong(points, Math.min(total, at + 0.6));
  return unit3(sub3(b, a));
}

function spiral(F, s, r0, r1, a0, a1, steps = 28) {
  const out = [];
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    out.push(pointOf(F, s, r0 + (r1 - r0) * t, a0 + (a1 - a0) * t));
  }
  return out;
}

function arcPoints(F, s, r, a0, a1, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, index) => pointOf(F, s, r, a0 + ((a1 - a0) * index) / steps));
}

return { frameOf, frameAlong, prismOf, disc, viewOf, dot3, circleOf };
})();

const P = {"origin":[376.36256961155306,422.07228188898887],"scale":1.3044293125919977,"azimuth":50,"elevation":30};
const k = { iso, depthOf, solidSvg, lineSvg, dotsSvg, pathOf, wireSvg };
const HEAD = {"r":13,"half":16,"depth":4.6,"height":5.6,"armX":[11.2,12.6],"body":[-10,0.5,-5,5]}, AXIS_W = [0,30.5,87], PORT = [[19,21.5,102],[16.6,13.7,113.9]];
const CAR = {"x":-72,"y":2,"w":144,"d":140,"r":2}, MM = 3.5, HFOV = 127, VFOV = 79.5, RANGE = [200,12000];
const PAN = [0,180], TILT = [45,135], POSE0 = [90,60];
const SPECKLE = [[-68,127.5],[-28.7,33.8],[31.2,76.3],[-23.2,105.3],[34.7,77.7],[25.1,89.9],[43.1,37.9],[-17.1,99.4],[26.9,13.1],[25,67.8],[57.4,112.6],[-51.3,73.7],[57.6,96.9],[19.6,82.2],[56,125.9],[-17.4,50.3],[45.9,49.9],[-47.3,45.3],[-9.7,44.9],[59.5,79.6],[31.2,121.9],[-60,42.1],[8.2,73.2],[-10.7,31.5],[55.6,13.2],[-18.3,51.4],[22.4,128],[2,27.9],[-12.8,43.4],[-18.4,62],[-22.8,76.2],[15.5,36.8],[55.3,66.4],[49.4,89.8],[18.3,74.1],[0.7,96.9],[59.8,58.4],[28.3,39.1],[11.8,52.3],[-23,57.7],[40.1,121.8],[-52.9,114.1],[-57.4,59.7],[-47.1,16.3],[67.5,35],[18,25],[-5.8,84.3],[-49.3,127.7],[52.3,123.6],[52.4,125.8],[35.5,42.4],[-66.6,38.8],[-57.7,6.2],[15.9,36.5],[32.8,70.6],[25.5,37.4],[52,37],[-17.1,124],[-51.9,70.6],[-67.6,126.5],[18.6,127.7],[-65.1,124.8],[-42.4,133.9],[8.9,95.7],[-31.8,35.4],[-39.6,80.5],[-60.9,107.6],[27.3,100.3],[-0.2,10.3],[-53,127.3],[-50.2,96.8],[53.5,10.9],[52.1,119.7],[67,132],[36,61.4],[-34.2,102.1],[52,58.6],[-36.1,59.4],[52.6,79.8],[-20.2,88],[31.9,50.2],[30.6,61.8],[-41,47.1],[66,137.2],[18,121.1],[56.9,32.3],[19.7,23.9],[-0.3,79.6],[36.9,130.8],[-2.4,30.7],[-7.3,27.9],[22.1,74.9],[8.4,72.9],[35,53.8],[34.1,9.4],[-27.4,77.5],[-40.4,101.4],[-28.4,37.1],[21.7,62.7],[-57.8,108],[43.9,126.8],[55.8,95.9],[62.4,9.3],[35.6,85.3],[30.5,124.6],[-63,23.9],[-57.1,20.3],[-56.5,7.3],[14.3,130.8],[-41.9,23.6],[-40.5,95.1],[-34.9,66.2],[67.2,61.8],[23.6,108.2],[-14,61],[-59.7,36.4],[41.8,134.6],[-47.3,128.2],[1.2,22.1],[-39.4,85.5],[-44.8,16.3],[-30.9,91.3],[7.6,69.4],[67.2,15.9],[-11.8,47.5],[-67.4,6.8],[-11.8,18.1],[-36.1,128],[37.7,106.8],[-8.6,118.9],[62.9,111.7],[22,81.5],[-20.7,59.7],[-0.4,71.3],[9.2,101.3],[22.5,89.5],[31.1,122.8],[46.9,136.4],[-8.4,70.3],[62.2,134.7],[-19.3,16.5],[-21.4,122.5],[28.3,103.4],[61.9,109.9],[-39.8,37.4],[40.6,19.7],[56.5,111.6],[18.4,99.9],[4.9,64.5],[50.6,80.4],[50.8,41.7],[25.4,63.3],[-14.3,30.8],[12.1,36.6],[54.2,114.5],[-22,96.1],[51.3,21.3],[-26.2,127.6],[-67.8,23.4],[-14,8.8],[26.2,124.5],[-44.5,34],[60.8,98.4],[-44.2,21.4],[17.2,8.1],[42.4,84.1],[34.2,22.9],[-22.9,100.4],[61.9,78.3],[12,108.6],[27.5,102.8],[13.3,19.2],[-61.8,87],[-37.4,82.7],[-33.9,35.4],[16.3,89.1],[42.5,37.6],[55.2,13],[25.9,59.7],[39.7,93.1],[41.4,19.8],[57,72.1],[43.9,62.1],[49.8,110.4],[30.9,125.8],[48.7,31.1],[29.9,26.4],[-51,131.2],[61.9,13.5],[-57.5,40.6],[59.9,120.8],[62.1,42.6],[-41,9.9],[-4.1,79.8],[-48.7,48.7],[-2.6,35.9],[-60.5,11.9],[-55.3,89.1],[-4.4,112.7],[31,73.4],[27.3,57.2],[15.4,133.4],[36.8,133],[28.8,85.6],[41.2,28.6],[-59.1,101.9],[20,62.9],[6.1,57.1],[-0.8,22.1],[-59,16.4],[-19.8,51.5],[-40.8,90.5],[-50.9,12.9],[-67.8,116.3],[50.2,11.9],[36.5,48],[-13.3,125.9],[40.4,7.5],[67.1,33.1],[19.4,62.4],[-63.5,28.8],[34.7,105.5],[-34.1,119.2],[42.6,48],[-5.5,45.5],[-33.6,122.4],[50.3,95.5],[-0.2,120.4],[43.5,113.3],[35.5,134.1],[26,43.7],[28.8,48.8],[49.5,27.5],[47,92.9],[43,67.6],[40.2,115.4],[-62.2,36.6],[-41.4,9.1],[10.5,113.2],[17.3,118.7],[49.7,113.4],[-39.8,80.2],[-5.5,57],[5.2,105.1],[2.4,56.7],[0,38.3],[27.7,107.9],[-27.6,39.6],[15.5,78.8],[59.6,81],[-25,85.2],[10,89.9],[9.7,27.3],[-39.6,21.6],[-22.6,89.7],[50.9,91],[-15.1,51.8],[-13.8,22.6],[-46.9,13],[-3.3,55.6],[-55.6,89.7],[-13.1,66.4],[-54.5,116.9],[-30.7,46],[-51.5,32.8],[-8.5,32.4],[14.6,82.3],[34.5,109.6],[-1,120.4],[25.1,21.9],[16.9,103.2],[53.2,82.6],[63.5,44.4],[67.3,10.9],[-54,46.6],[48.4,124.6],[30.4,78.2],[-35.5,76.6],[37.6,30.5],[42.4,96.2],[11.1,131.5],[-26.3,9.7],[31.9,73.9],[15.5,97.4],[24.7,12],[28.1,135.5],[47,95.7],[9.1,34.8],[17.7,80.9],[-8.2,9],[49.3,92.2],[64.8,46.6],[33.2,129.9],[9.7,88.1],[-41.1,37.9],[-7.3,63.1],[-61.6,80.9],[38.2,116.9],[-56.4,46.4],[15.6,61.7],[-24.8,44.3],[-58,54.8],[-9.2,89.8],[0.6,77.8],[-9.3,88.2],[54.1,130.8],[-5.1,115.9],[65.4,91.6],[-13,88.9],[-60.8,43.8],[-64.1,117],[-52.8,37.6],[22.6,35.2],[-31,24.6],[35.4,46.5],[16.9,105.8],[-66.1,114.9],[55.9,107.4],[61.7,15.6],[-43.4,11.1],[65.7,68.9],[-30.4,75.1],[45.6,99.4],[39.5,7.3],[-52.4,87.4],[33.9,17.6],[-28.9,59.5],[36.7,95.2],[17.9,26.7],[58.5,137.8],[16.1,101.3],[-46.2,123.4],[-46.3,51.4],[26.8,61.6],[-4.9,136],[-7.1,78.8],[21.9,19.5],[-44.7,30.3],[46,50.4],[67.4,77.4],[-50.5,69.2],[1.1,7.7],[5.7,114.1],[-8.9,33.9],[-58.9,89.9],[-8.7,23.2],[45.3,8.7],[56.1,101],[53,94.4],[24.8,117],[-30.6,95.2],[-4.6,6.1],[-51.4,17.8],[-60,74.1],[-51.7,35.3],[-18.9,92.4],[-34.7,38.4],[29.4,105],[24.6,119.9],[-43.5,42.7],[6.4,59.4],[12.5,59.7],[6.9,122],[48,59.8],[-19.2,134.5],[32.6,129.6],[-35.5,132.8],[57.6,100.2],[9.2,91.5],[53.6,30.1],[-2.6,64.3],[36.8,104.8],[26.1,86.8],[-67.2,45.2],[35.4,80],[-63.4,78.8],[58.1,7.5],[61.5,94],[6.5,119.6],[56.5,127.1],[-60.5,105.6],[-18.6,98.3],[-55.9,60.4],[-57.2,46],[-17.7,47.6],[-15.1,7.6],[-14,61.1],[41,114.3],[-60.9,64.5],[9.8,89.7],[-49.6,21.5],[-13,11.9],[-30.4,93.7],[-42.7,133.9],[52.5,79.8],[-46.5,61.6],[27.3,43.4],[-8.6,46.7],[-14.9,31.8],[-67,35],[16.7,92.5],[-63.7,130.1],[-56.2,20.3],[30.5,96.2],[24.4,82.4],[59.9,13.8],[-34.8,27.8],[-18.1,49.1],[-40.5,10.3],[-47,73.3],[64,26.3],[2.1,89],[-50.7,127.1],[23.8,101.4],[59.6,97.3],[-48,56.9],[-7.3,42.4],[-47.8,59.5],[39.6,90.8],[24.3,113.3],[47.9,77],[-67.6,51.3],[62.6,93.9],[32.2,115.7],[-13.4,107.4],[-18.9,76.9],[-66,79.9],[-67.7,73.9],[-1.3,57.1],[-46.9,71.7],[-42.8,75.9],[-54.3,9.1],[36.7,80.2],[41.8,119.2],[23,104],[45.5,57],[55.3,55.4],[-17.2,9.9],[-56.9,19.2],[-63.9,82.2],[24,32.5],[-67.1,11.5],[26,133.8],[52.6,114.1],[60.5,103.2],[7.3,87.8],[-58.9,53.3],[-3.6,75.4],[1.9,84.3],[19.3,72.5],[30.8,50.9],[48.3,7.9],[-62.5,94.2],[65.4,32.8],[-66.8,34.5],[-62.7,64.8],[23.6,87.3],[-12.1,118.1],[-63,116.3],[50.4,64.4],[-21.6,33.2],[18.7,18],[-28.4,93.4],[-57,80.5],[58,8.7],[55.6,38.2],[13.9,10.5],[53.6,88.3],[-33.3,87],[-20.4,74.2],[-11.3,133.2],[43.6,132.4],[51.3,12.8],[-31.5,72.4],[5.3,22.6],[11.3,37.9],[-14.3,86.7],[46.3,52.6],[-52.5,28.6],[-35.6,12.5],[56.7,102.6],[21.4,116],[-58.6,86.5],[50.9,23.5],[-6.8,53.9],[37.3,93.3],[61.4,11.1],[-49.9,119.5],[46.6,87.7],[-52.6,72.2],[-7.2,104.2],[20.3,40.8],[-56.5,18.8],[-10.1,129.6],[22.1,114.3],[56,118.8],[32.3,49.6],[24.9,105.2],[30.8,73.2],[19.1,98.7],[12.2,29.4],[52,102.2],[-39.8,55.3],[-48.9,118.5],[-38.5,53.9],[50.4,98.6],[32.8,19.1],[23.3,112.8],[-68,102.7],[-13.4,30],[-65.2,35.8],[-5.5,136.1],[13,89.2],[-63.2,61.4],[-39.3,132.3],[-54.6,37],[19.4,43.1],[60.8,27],[-36.6,116.4],[-12.2,136.1],[-31.3,11.5],[43.5,61.7],[-17.4,125.7],[17.7,99.7],[23.5,50.7],[53,102.4],[-68,74.9],[-61.3,69],[-20,101.1],[-1.4,7.8],[62.5,125.2],[37,73.7],[12.4,76.7],[25.2,115.4],[-24.3,96.1],[60.3,99.3],[32.7,113.9],[27.3,120.1],[-54.7,76.8],[-12.4,130.2],[-46.5,103.5],[-25,75.5],[-5.8,10.5],[22.4,14.8],[-5.7,19.2],[-61.9,30.3],[9,98.3],[45.3,33.1],[-60.4,57.9],[-59.7,124.5],[46.2,77.8],[60.3,134.8],[48,31],[31.9,73.6],[66.8,39.2],[48.4,26.1],[64.7,60.4],[-0.7,10.9],[-36.5,72.7],[33,120],[-17.1,78.5],[41.2,71.7],[64.9,93.7],[-5.9,72],[-20.6,47.7],[-63.8,71.3],[-19.7,56.9],[40.6,77],[52.7,22.9],[-35.9,111.8],[-32,82.9],[-10.7,95.3],[0.7,48.1],[-51.1,58.9],[-0.2,105.5],[-53.1,114.4],[-48.3,125.8],[-13.1,84.5],[4.8,67.3],[8.8,6.4],[-8.9,126],[-6.4,101.2],[-0.1,12.3],[-4.6,64.6],[64,63.3],[-15.9,34],[-54,63.4],[35.9,43.5],[65.6,32.7],[-32.8,122.4],[15.7,129.2],[45.3,122.5],[-10.9,39.5],[-0.5,34],[33,90.8],[-16,110],[9.4,135.3],[-58.8,117],[22.3,86.4],[-24.7,61.7],[41.9,136.4],[14.7,84.2],[40.1,31.7],[11.8,55.6],[55,96.6],[53.7,35.4],[34.9,114.4],[-58.5,98.1],[46.3,94.1],[-65.5,22.9],[7.9,84.5],[-66.5,23.8],[50.1,76.1],[-46.6,84.5],[18.4,8.2],[7.8,41.1],[-24.1,54.6],[10.5,73.4],[42.7,30],[55.7,66],[-0.5,127.7],[18.8,117.5],[-48.5,133.2],[-54.3,111.4],[-15.6,33.2],[9.7,77],[28,18.5],[53.3,57.6],[40.2,110.6],[26.2,83.2],[51.5,24.6],[-0.7,119.2],[28.6,42.6],[-19.7,113],[2,41.7],[20.3,88.3],[12.8,44.9],[54.5,132.6],[-39.5,114.8],[61.6,120.2],[-43.6,34.9],[-50.7,52],[26.2,128],[-64.7,119.6],[-0.6,13.4],[-62.6,62.8],[12.3,6.3],[-14.3,62.1],[-26.8,64.8],[28.2,36.3],[-67.3,133.5],[40,99.5],[57.8,57.9],[-41.1,53.4],[-61.5,102.8],[68,137.2],[-42,65.2],[10.3,57.9],[-40.1,111.6],[35.6,60.3],[-64,84.7],[-36.2,39.8],[58.1,83.8],[52.1,9.5],[33.9,94],[30.5,6.2],[-21.7,105.1],[-2,126.4],[-49.8,48.8],[-65.6,33.5],[18.1,114.2],[-55.1,123.2],[-5.6,45.8],[-3.6,45.3],[40.1,42.6],[-21.1,59.4],[-45,32.4],[-30.6,133.6],[65.2,20.9],[16,79.9],[18.2,86],[-56.9,128.4],[37.5,42.5],[40.3,131.1],[-54,101.4],[43.8,61.7],[-23.5,107.8],[60.6,117.8],[53.2,123.6],[-23.8,60.8],[-52.3,62.2],[-57.6,7.3],[65.3,117.6],[50.3,128],[-22.9,91.9],[12.8,113.2],[-40.3,21.2],[64.5,135.8],[42.3,30.5],[63.3,64.1],[-2.8,91.2],[-31.7,134.8],[-37.8,8.1],[-59.4,57.5],[26.3,47.5],[27.1,99.6],[-61.1,109.4],[-41.1,29.7],[43,64.9],[-46.2,9.5],[-36.2,38.6],[-15.5,95.5],[30.1,88.2],[-32.1,41.5],[-34.6,92.5],[-55.3,21.3],[-63.3,80.5],[12.8,29.3],[17.2,62.4],[-41.8,20.9],[-46.5,106.8],[3.9,128.5],[33.6,100.8],[-45.3,33.8],[-40.4,33],[-14.6,115.8],[-39.7,60],[27.3,79.4],[-56.9,117.2],[-26.9,42.1],[-23.6,33.4],[12.3,93.5],[40.4,107.5],[-63.5,20.5],[-43.3,36.8],[55,105.3],[-49.3,121.8],[62.7,132.6],[46.4,96.3],[24.3,90.6],[44.3,68.7],[48.1,26.5],[-27.9,45.1],[-21.1,74.3],[-28.4,16.5],[-28.5,30.6],[31.6,24.1],[-2.7,120],[-38.3,28.6],[61.9,124.5],[65.5,50.2],[-45.7,69.4],[-48.9,39.7],[21.4,70.6],[-38.6,40.8],[-21,78.3],[41.9,63.8],[-65.9,107.5],[-57.8,86.6],[-30,7.5],[42,99.2],[-36.9,96.9],[-7.5,26.8],[54.2,113.6],[-28.1,101.9],[-0.4,77.6],[28.6,109.2],[-59.5,98.5],[65,117.5],[-44,132.9],[26.3,125.2],[-26.5,47.4],[64.4,48],[18.7,136.4],[44.7,88.5],[-54.9,34.9],[60.2,54.1],[-68,70.9],[-34.5,100.7],[-30.8,11.7],[3.2,74.2],[-29.1,11],[-13.1,115.3],[41.9,113.5],[-15.8,49.2],[44.5,53.1],[-55.9,35.9],[17.6,88.9],[39.1,52.5],[13.6,29.6],[-30.5,117.7],[12.7,63.9],[-13.9,132.6],[-18.6,30.4],[0.2,133.1],[53,71.8],[42.3,37.6],[15.3,115.3],[-16,32.2],[28.2,135.3],[-17.3,55.6],[57.4,111],[-43.6,47.9],[-4,116.7],[14.9,117.2],[20,91.9],[15.3,52.1],[21.1,28.5],[-34.3,94.4],[-47.3,102.9],[19.2,110.6],[39.2,35.6],[7.2,47],[-44.5,117.8],[28.5,126.9],[-0.4,88.9],[47.5,129.4],[-13.3,20.6],[43.4,95.8],[-7.2,47.7],[-47.4,114.2],[-16.8,120.8],[-48.3,81.5],[-57,34.3],[-6.8,107.6],[42.9,73.5],[53.8,96.2],[-17.7,103.2],[49.1,126.6],[11.9,123.9],[-50.7,16.3],[65.2,99.9],[-38,132.7],[51.7,122.2],[43.5,23.3],[-2.7,92.9],[49,51.1],[54.6,76.9],[28.2,73.3],[-28.6,92.2],[26.1,65.8],[58.4,73.8],[-58.7,68.3],[62.1,38.3],[-6.9,15.8],[15.2,121.5],[-53.2,10.8],[49.4,6.4],[6.2,71.8],[-53.4,82.3],[2.6,33.8],[26.7,88.2],[47.7,26.2],[67.4,100.8],[-33.5,77],[33.9,105.7],[66.4,118],[-63.6,86.1],[-12.9,67.1],[-66.7,122.9],[-48.6,60.1],[29.5,135.4],[66,112.1],[-52.5,91.1],[48.6,46.1],[43.3,126.2],[-64.9,109.6],[36.6,65.5],[60.8,113.6],[-61.2,24.8],[47,124.1],[-56.3,49.6],[20.5,82.1],[21,107.9],[-45.8,62.6],[-13.2,25.5],[63.3,56.5],[7,19.6],[3.3,89.8],[-51.7,102.3],[-23.1,87.8],[33,16],[-23.3,29.4],[-5.2,125.7],[24.5,106.3],[-8.3,112.3],[53.5,58.3],[-16.5,108.5],[-54.8,130.1],[15.1,51.4],[45.6,97.8],[48.5,14.4],[-53.2,48.3],[-28.5,6.6],[43.4,38.8],[-68,86.1],[19.4,129.6],[34.4,94.9],[-38.5,80.9],[50.9,132.4]];
const roundRect = (a0, a1, b0, b1, r, n = 6) => {
  const pts = [];
  const arc = (ca, cb, from) => {
    for (let i = 0; i <= n; i++) {
      const t = from + (i / n) * (Math.PI / 2);
      pts.push([ca + r * Math.cos(t), cb + r * Math.sin(t)]);
    }
  };
  arc(a1 - r, b1 - r, 0);
  arc(a0 + r, b1 - r, Math.PI / 2);
  arc(a0 + r, b0 + r, Math.PI);
  arc(a1 - r, b0 + r, (3 * Math.PI) / 2);
  return pts;
};
const headParts = function headParts(pan, tilt, PP, world, port) {
  const ps = Math.sin(((pan - 90) * Math.PI) / 180), pc = Math.cos(((pan - 90) * Math.PI) / 180);
  const th = (tilt * Math.PI) / 180;
  const ax = [pc, 0, -ps];
  const az = [ps, 0, pc];
  const u = [-Math.cos(th) * ps, Math.sin(th), -Math.cos(th) * pc];
  const v = [Math.sin(th) * ps, Math.cos(th), Math.sin(th) * pc];
  const o = world;
  const F = { o, a: ax, u, v };
  const Fs = { o, a: ax, u: [0, 1, 0], v: az };
  const V = G.viewOf(PP);
  const rr = HEAD.r;
  const parts = [];
  const add = (svg, centre) => parts.push({ svg, d: k.depthOf(centre, PP) });
  const p3 = (s, a, b, f = F) => [o[0] + f.a[0] * s + f.u[0] * a + f.v[0] * b, o[1] + f.a[1] * s + f.u[1] * a + f.v[1] * b, o[2] + f.a[2] * s + f.u[2] * a + f.v[2] * b];
  // tilt servo lying on the disc: body, mounting ears with screws, horn hub
  {
    const [y0, y1, z0, z1] = HEAD.body;
    const body = [[y0, z0], [y1, z0], [y1, z1], [y0, z1]];
    const ears = [[-3, z0 + 0.6], [-2, z0 + 0.6], [-2, z1 - 0.6], [-3, z1 - 0.6]];
    const svg = k.solidSvg(G.prismOf(Fs, body, -10, 10, PP), { tone: "lo" }) + k.solidSvg(G.prismOf(Fs, ears, -13, 13, PP), { tone: "lo" }) +
      k.dotsSvg([[-12, -3], [-12, 3], [12, -3], [12, 3]].map(([s, b]) => k.iso(p3(s, -2, b, Fs), PP)), { size: 0.4 });
    add(svg, p3(0, -6, 0, Fs));
    const hub = { o: p3(10, 0, 0), a: ax, u: [0, 1, 0], v: az };
    add(k.solidSvg(G.disc(0, 1.2, 3.2, G.frameAlong(hub.o, ax), PP), { tone: "mid" }), p3(10.6, 0, 0));
  }
  // bracket arms: from the horn axis to the camera back, one each side
  for (const [x0, x1] of [[-HEAD.armX[1], -HEAD.armX[0]], [HEAD.armX[0], HEAD.armX[1]]]) {
    const arm = roundRect(-2.6, rr - HEAD.depth, -3, 3, 2.6, 5);
    const end = x1 > 0 ? x1 : x0;
    const svg = k.solidSvg(G.prismOf(F, arm, x0, x1, PP), { tone: "mid" }) + k.dotsSvg([k.iso(p3(end, 0, 0), PP), k.iso(p3(end, rr - HEAD.depth - 2.2, 0), PP)], { size: 0.45 });
    add(svg, p3((x0 + x1) / 2, rr / 2, 0));
  }
  // servo horn on the +x arm
  add(k.solidSvg(G.disc(0, 0.8, 2.2, G.frameAlong(p3(HEAD.armX[1], 0, 0), ax), PP), { tone: "hi", crease: "lo" }), p3(HEAD.armX[1] + 1, 0, 0));
  // camera: body, heatsink fins on the back, stereo pair, colour lens and IR projector on the front
  {
    const out = [];
    const facing = G.dot3(u, V) > 0;
    const fins = [];
    for (let b = -4.2; b <= 4.21; b += 1.4) {
      const fin = [[rr - HEAD.depth - 2, b - 0.32], [rr - HEAD.depth, b - 0.32], [rr - HEAD.depth, b + 0.32], [rr - HEAD.depth - 2, b + 0.32]];
      fins.push(k.solidSvg(G.prismOf(F, fin, -10, 10, PP), { tone: "mid", crease: "none" }));
    }
    const lensAt = (s, r1, r2) => {
      const Fl = G.frameAlong(p3(s, rr + HEAD.depth, 0.6), u);
      return k.solidSvg(G.disc(0, 0.5, r1, Fl, PP), { tone: "mid" }) + k.solidSvg(G.disc(0.5, 0.9, r2, Fl, PP), { tone: "lo" });
    };
    const front = [lensAt(-11.6, 2.3, 1.4), lensAt(11.6, 2.3, 1.4), lensAt(-3.2, 2, 1.2),
      k.solidSvg(G.prismOf(F, [[rr + HEAD.depth, -0.6], [rr + HEAD.depth + 0.3, -0.6], [rr + HEAD.depth + 0.3, 1.8], [rr + HEAD.depth, 1.8]], 3.2, 7.6, PP), { tone: "lo", crease: "none" })];
    if (facing) out.push(...fins);
    else out.push(...front);
    const body = roundRect(rr - HEAD.depth, rr + HEAD.depth, -HEAD.height, HEAD.height, 1.6, 4);
    const seam = k.lineSvg(k.pathOf([k.iso(p3(-HEAD.half, rr + HEAD.depth, -HEAD.height + 1.2), PP), k.iso(p3(HEAD.half, rr + HEAD.depth, -HEAD.height + 1.2), PP)]), { tone: "faint" });
    out.push(k.solidSvg(G.prismOf(F, body, -HEAD.half, HEAD.half, PP), { tone: "hi", crease: "lo", inner: facing ? seam : "" }));
    out.push(...(facing ? front : fins));
    // USB-C lead from the camera's +x end to the Lubancat
    if (port) out.push(k.wireSvg(k.iso(p3(HEAD.half, rr - 1.5, -1), PP), k.iso(port[1], PP), { via: [k.iso(port[0], PP)], tone: "lo", size: 0.6 }));
    add(out.join(""), p3(0, rr, 0));
  }
  parts.sort((a, b) => a.d - b.d);
  const lens = p3(-3.2, rr + HEAD.depth + 0.9, 0.6);
  return { svg: parts.map((q) => q.svg).join(""), lens, dir: u, up: v, side: ax };
};
const stage = document.querySelector(".sp-stage");
const svgEl = stage.querySelector("svg");
const headG = svgEl.querySelector('[data-part="head"]');
const footG = svgEl.querySelector('[data-part="foot"]');
const raysG = svgEl.querySelector('[data-part="rays"]');
const readout = document.querySelector("[data-sp-readout]") || document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const tanH = Math.tan((HFOV / 2) * Math.PI / 180), tanV = Math.tan((VFOV / 2) * Math.PI / 180);
const crossv = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotv = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scr = (p) => iso(p, P);
const pt = (p) => scr(p).map((v) => v.toFixed(2)).join(" ");
// keep the part of a plan polygon (on z = 0) where f(p) >= 0
const clip = (poly, f) => {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
};
function footprint(h) {
  const { lens, dir, up, side } = h;
  const corner = (sx, sy) => [0, 1, 2].map((i) => dir[i] + side[i] * sx * tanH + up[i] * sy * tanV);
  const cs = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  let poly = [[CAR.x, CAR.y], [CAR.x + CAR.w, CAR.y], [CAR.x + CAR.w, CAR.y + CAR.d], [CAR.x, CAR.y + CAR.d]];
  for (let i = 0; i < 4 && poly.length; i++) {
    let n = crossv(cs[i], cs[(i + 1) % 4]);
    if (dotv(n, dir) < 0) n = n.map((v) => -v);
    poly = clip(poly, ([x, y]) => dotv(n, [x - lens[0], y - lens[1], -lens[2]]));
  }
  // nothing nearer than the depth envelope's near limit
  if (poly.length) poly = clip(poly, ([x, y]) => dotv(dir, [x - lens[0], y - lens[1], -lens[2]]) - RANGE[0] / MM);
  return poly;
}
const area = (poly) => Math.abs(poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function draw(pan, tilt) {
  const h = headParts(pan, tilt, P, AXIS_W, PORT);
  headG.innerHTML = h.svg;
  const poly = footprint(h);
  const { lens, dir } = h;
  let foot = "", rays = "";
  const hit = dir[2] < -1e-3 ? lens[2] / -dir[2] : Infinity;
  const centre = [lens[0] + dir[0] * hit, lens[1] + dir[1] * hit, 0];
  const onCar = isFinite(hit) && centre[0] >= CAR.x && centre[0] <= CAR.x + CAR.w && centre[1] >= CAR.y && centre[1] <= CAR.y + CAR.d;
  const lp = pt(lens);
  if (poly.length >= 3) {
    foot += '<path class="sp-foot" d="M' + poly.map(([x, y]) => pt([x, y, 0])).join("L") + 'Z"/>';
    const sign = poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) > 0 ? 1 : -1;
    const inside = (x, y) => poly.every((a, i) => { const b = poly[(i + 1) % poly.length]; return sign * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) >= 0; });
    let dots = "";
    for (const [x, y] of SPECKLE) if (inside(x, y)) { const [sx, sy] = scr([x, y, 0]); dots += "M" + (sx - 0.45).toFixed(2) + " " + sy.toFixed(2) + "a.45 .45 0 1 0 .9 0a.45 .45 0 1 0 -.9 0"; }
    foot += '<path class="sp-speckle" d="' + dots + '"/>';
    const ring = poly.map(([x, y]) => [x, y, 0]);
    rays += '<path class="sp-vol" d="' + ring.map((p, i) => "M" + lp + "L" + pt(p) + "L" + pt(ring[(i + 1) % ring.length]) + "Z").join("") + '"/>';
    rays += '<path class="sp-ray" d="' + ring.map((p) => "M" + lp + "L" + pt(p)).join("") + '"/>';
  }
  if (onCar) {
    const c = scr(centre);
    rays += '<path class="sp-axis" d="M' + lp + "L" + pt(centre) + '"/><circle class="sp-hit" r="1.6" cx="' + c[0].toFixed(2) + '" cy="' + c[1].toFixed(2) + '"/>';
  } else {
    const a = scr(lens), b = scr([lens[0] + dir[0] * 70, lens[1] + dir[1] * 70, lens[2] + dir[2] * 70]);
    rays += '<linearGradient id="sp-fade" gradientUnits="userSpaceOnUse" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"><stop offset="0" stop-color="var(--anatomy-blue)" stop-opacity=".9"/><stop offset="1" stop-color="var(--anatomy-blue)" stop-opacity="0"/></linearGradient>';
    rays += '<path class="sp-axis" style="stroke:url(#sp-fade);stroke-dasharray:none" d="M' + lp + "L" + b.map((v) => v.toFixed(2)).join(" ") + '"/>';
  }
  const l = scr(lens);
  rays += '<circle class="sp-lens" r="1.1" cx="' + l[0].toFixed(2) + '" cy="' + l[1].toFixed(2) + '"/>';
  footG.innerHTML = foot;
  raysG.innerHTML = rays;
  const cover = poly.length >= 3 ? Math.round((100 * area(poly)) / (CAR.w * CAR.d)) : 0;
  const looking = dir[2] < -0.45 ? "car top" : dir[2] > 0.45 ? "up the rail" : "across";
  const range = onCar ? Math.round(Math.hypot(centre[0] - lens[0], centre[1] - lens[1], centre[2] - lens[2]) * MM) : null;
  const rows = [["Pan · servo 5", Math.round(pan) + "°"], ["Tilt · servo 6", Math.round(tilt) + "°"], ["Looking", looking], ["Axis range", range ? range + " mm" : "no return"], ["Car top in view", cover + "%"]];
  if (readout && readout.tagName === "DL") readout.innerHTML = rows.map(([a, b], i) => "<dt>" + a + "</dt><dd" + (i === 3 && !range ? ' class="bad"' : "") + ">" + b + "</dd>").join("");
  else if (readout) readout.textContent = rows.slice(2).map((r) => r.join(" ")).join(" · ");
  stage.setAttribute("aria-valuetext", rows.map((r) => r.join(" ")).join(", "));
}
let pose = POSE0.slice(), target = POSE0.slice(), touring = !still.matches, clock = 0, last = 0, frame = 0, visible = false, idle = 0;
// idle tour: look down at the car top, lean to each side, then out across the shaft and up the rail
const TOUR = [[90, 60], [90, 45], [40, 50], [140, 50], [90, 90], [90, 135], [90, 60]];
const DWELL = 2.4;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = TOUR[Math.floor(clock / DWELL) % TOUR.length].slice(); }
  const f = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
  for (const i of [0, 1]) { pose[i] += (target[i] - pose[i]) * f; if (Math.abs(target[i] - pose[i]) < 0.05) pose[i] = target[i]; }
  draw(pose[0], pose[1]);
  frame = visible && (touring || pose[0] !== target[0] || pose[1] !== target[1]) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (pan, tilt) => {
  touring = false;
  target = [clamp(pan, PAN[0], PAN[1]), clamp(tilt, TILT[0], TILT[1])];
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const r = svgEl.getBoundingClientRect();
  const fx = clamp((event.clientX - r.left) / r.width, 0, 1);
  const fy = clamp(((event.clientY - r.top) / r.height - 0.1) / 0.75, 0, 1);
  steer(PAN[1] - fx * (PAN[1] - PAN[0]), TILT[1] - fy * (TILT[1] - TILT[0]));
});
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 5 : 15;
  let [pan, tilt] = target;
  if (event.key === "ArrowLeft") pan += step;
  else if (event.key === "ArrowRight") pan -= step;
  else if (event.key === "ArrowUp") tilt += step;
  else if (event.key === "ArrowDown") tilt -= step;
  else if (event.key === "Home") [pan, tilt] = [90, 90];
  else return;
  event.preventDefault();
  steer(pan, tilt);
});
draw(pose[0], pose[1]);

})();

const SC = (() => {
const CAR_TOP_Y = -1050, CLEAR_CFG = {"ransac_threshold_mm":15,"min_reference_points":150,"min_reference_inlier_ratio":0.6,"max_reference_rms_mm":12,"max_reference_tilt_deg":10,"grid_rows":6,"grid_cols":8,"min_cell_valid_ratio":0.3,"cell_percentile":5,"surface_margin_mm":30,"min_known_ratio":0.5,"min_range_mm":200,"max_range_mm":12000}, IMG = {"w":640,"h":400,"f":268.5}, POSE = {"pitch":5,"yaw":0,"at":[0,0,0]};
function sceneOf({ beamBottom = 700, glare = false } = {}) {
  const Y = CAR_TOP_Y;
  const items = [
    { id: "wall", b: [-1700, 1700, -1700, 1600, 2300, 2400], layer: 0, tone: 0.42 },
    { id: "flange", b: [-75, 75, -1700, 1600, 2290, 2300], layer: 0.5, tone: 0.55 },
    { id: "blade", b: [-8, 8, -1700, 1600, 2200, 2290], layer: 0.6, tone: 0.7 },
    { id: "car", b: [-1100, 1100, Y - 60, Y, 250, 2150], layer: 1, tone: 0.5 },
    { id: "crosshead", b: [-1100, 1100, Y, Y + 120, 2080, 2150], layer: 2, tone: 0.6 },
    { id: "station", b: [350, 650, Y, Y + 220, 1000, 1250], layer: 2, tone: 0.72 },
    { id: "beam", b: [-1700, 1700, beamBottom, beamBottom + 260, 1250, 1450], layer: 2, tone: 0.62, glare },
  ];
  for (const [i, y] of [[0, -530], [1, 610]]) {
    for (const s of [-1, 1]) items.push({ id: `clip${i}${s > 0 ? "r" : "l"}`, b: s < 0 ? [-118, -62, y - 28, y + 28, 2272, 2290] : [62, 118, y - 28, y + 28, 2272, 2290], layer: 0.7, tone: 0.8 });
  }
  for (const z of [400, 1250, 2050]) items.push({ id: `post${z}`, b: [-1080, -1040, Y, Y + 1100, z - 20, z + 20], layer: 2, tone: 0.66 });
  items.push({ id: "rail-top", b: [-1084, -1036, Y + 1080, Y + 1120, 380, 2070], layer: 2, tone: 0.7 });
  items.push({ id: "rail-knee", b: [-1080, -1040, Y + 520, Y + 550, 380, 2070], layer: 2, tone: 0.66 });
  for (const x of [-330, -280, -230]) items.push({ id: `rope${x}`, b: [x - 7, x + 7, Y + 120, 1600, 2110, 2124], layer: 2, tone: 0.85, thin: true });
  return items;
}
function cameraOf({ pitch = POSE.pitch, yaw = POSE.yaw, at = POSE.at } = {}) {
  const p = (pitch * Math.PI) / 180, q = (yaw * Math.PI) / 180;
  const fwd = [Math.sin(q) * Math.cos(p), Math.sin(p), Math.cos(q) * Math.cos(p)];
  const right = [Math.cos(q), 0, -Math.sin(q)];
  const down = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  return { at, fwd, right, down };
}
function project(cam, p) {
  const d = [p[0] - cam.at[0], p[1] - cam.at[1], p[2] - cam.at[2]];
  const z = d[0] * cam.fwd[0] + d[1] * cam.fwd[1] + d[2] * cam.fwd[2];
  const x = d[0] * cam.right[0] + d[1] * cam.right[1] + d[2] * cam.right[2];
  const y = d[0] * cam.down[0] + d[1] * cam.down[1] + d[2] * cam.down[2];
  return [IMG.w / 2 + (IMG.f * x) / z, IMG.h / 2 + (IMG.f * y) / z, z];
}
function rayOf(cam, u, v) {
  const x = (u - IMG.w / 2) / IMG.f, y = (v - IMG.h / 2) / IMG.f;
  const d = [0, 1, 2].map((i) => cam.fwd[i] + cam.right[i] * x + cam.down[i] * y);
  const n = Math.hypot(d[0], d[1], d[2]);
  return d.map((c) => c / n);
}
function hitBox(o, d, b) {
  let t0 = 0, t1 = Infinity, axis = -1, sign = 0;
  for (let i = 0; i < 3; i++) {
    const lo = b[i * 2], hi = b[i * 2 + 1];
    if (Math.abs(d[i]) < 1e-12) { if (o[i] < lo || o[i] > hi) return null; continue; }
    let ta = (lo - o[i]) / d[i], tb = (hi - o[i]) / d[i];
    let s = -1;
    if (ta > tb) { [ta, tb] = [tb, ta]; s = 1; }
    if (ta > t0) { t0 = ta; axis = i; sign = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return axis < 0 ? null : { t: t0, axis, sign };
}
function depthAt(scene, cam, u, v, { noise = true } = {}) {
  const d = rayOf(cam, u, v);
  let best = null;
  for (const it of scene) {
    const h = hitBox(cam.at, d, it.b);
    if (h && (!best || h.t < best.t)) best = { ...h, it };
  }
  if (!best) return { valid: false, reason: "nothing" };
  const n = [0, 0, 0];
  n[best.axis] = best.sign;
  if (best.it.thin) return { valid: false, reason: "thin", item: best.it.id };
  if (best.it.glare && best.axis === 1 && best.sign < 0) return { valid: false, reason: "glare", item: best.it.id };
  const zc = best.t * (d[0] * cam.fwd[0] + d[1] * cam.fwd[1] + d[2] * cam.fwd[2]);
  if (best.t < CLEAR_CFG.min_range_mm || best.t > CLEAR_CFG.max_range_mm) return { valid: false, reason: "range" };
  const sigma = noise ? 1.2e-6 * zc * zc : 0; // stereo error grows with the square of depth
  const t = best.t + sigma * hash(u, v) * best.t / zc;
  return { valid: true, p: [cam.at[0] + d[0] * t, cam.at[1] + d[1] * t, cam.at[2] + d[2] * t], t, zc, item: best.it.id, n };
}
function twoPoint(scene, cam, a, b) {
  const p = depthAt(scene, cam, a[0], a[1]);
  const q = depthAt(scene, cam, b[0], b[1]);
  if (!p.valid || !q.valid) return { ok: false, p, q };
  const dx = q.p[0] - p.p[0], dy = q.p[1] - p.p[1], dz = q.p[2] - p.p[2];
  const D = Math.hypot(dx, dy, dz);
  return { ok: true, p, q, D, dv: dy, dh: Math.hypot(dx, dz) };
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ransacPlane(pts, thr, iters = 200, seed = 0) {
  if (pts.length < 3) return null;
  const rnd = mulberry(seed + 11);
  let best = null;
  for (let k = 0; k < iters; k++) {
    const [a, b, c] = [0, 1, 2].map(() => pts[Math.floor(rnd() * pts.length)]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) continue;
    n = n.map((x) => x / len);
    const cc = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    let count = 0;
    for (const p of pts) if (Math.abs(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - cc) <= thr) count++;
    if (!best || count > best.count) best = { n, c: cc, count };
  }
  if (!best) return null;
  const inl = pts.filter((p) => Math.abs(best.n[0] * p[0] + best.n[1] * p[1] + best.n[2] * p[2] - best.c) <= thr);
  const rms = Math.sqrt(inl.reduce((s, p) => s + (best.n[0] * p[0] + best.n[1] * p[1] + best.n[2] * p[2] - best.c) ** 2, 0) / inl.length);
  return { n: best.n, c: best.c, inliers: inl.length, rms };
}
function percentile(values, pct) {
  const s = [...values].sort((a, b) => a - b);
  const i = (pct / 100) * (s.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function clearance(scene, cam, base, over, cfg = CLEAR_CFG, stride = 4) {
  const up = [0, 1, 0];
  const pts = [];
  for (let v = base[1]; v < base[3]; v += stride) for (let u = base[0]; u < base[2]; u += stride) {
    const d = depthAt(scene, cam, u, v);
    if (d.valid) pts.push(d.p);
  }
  if (pts.length < cfg.min_reference_points) return { ok: false, code: "base_sparse", reason: "Too little valid depth in the reference box", points: pts.length };
  const fit = ransacPlane(pts, cfg.ransac_threshold_mm);
  if (!fit) return { ok: false, code: "base_not_planar", reason: "Reference box is not a plane" };
  const ratio = fit.inliers / pts.length;
  let n = fit.n, c = fit.c;
  if (n[1] < 0) { n = n.map((x) => -x); c = -c; }
  const tilt = (Math.acos(Math.min(1, n[1])) * 180) / Math.PI;
  const reference = { points: pts.length, inliers: fit.inliers, ratio, rms: fit.rms, tilt };
  if (ratio < cfg.min_reference_inlier_ratio) return { ok: false, code: "base_not_planar", reason: "Reference box is not flat or holds equipment", reference };
  if (fit.rms > cfg.max_reference_rms_mm) return { ok: false, code: "base_rms", reason: `Reference fit RMS ${fit.rms.toFixed(0)} mm is too high`, reference };
  if (tilt > cfg.max_reference_tilt_deg) return { ok: false, code: "base_tilt", reason: `Reference plane tilts ${tilt.toFixed(1)}°`, reference };

  const rows = cfg.grid_rows, cols = cfg.grid_cols;
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ total: 0, valid: 0, d: [], at: [] })));
  for (let v = over[1]; v < over[3]; v += stride) for (let u = over[0]; u < over[2]; u += stride) {
    const r = Math.min(rows - 1, Math.floor(((v - over[1]) * rows) / (over[3] - over[1])));
    const k = Math.min(cols - 1, Math.floor(((u - over[0]) * cols) / (over[2] - over[0])));
    const cell = cells[r][k];
    cell.total++;
    const d = depthAt(scene, cam, u, v);
    if (!d.valid) continue;
    cell.valid++;
    const h = (n[0] * d.p[0] + n[1] * d.p[1] + n[2] * d.p[2] - c) / n[1];
    if (h >= cfg.surface_margin_mm) { cell.d.push(h); cell.at.push(d.p); }
  }
  const values = [], states = [], locs = [];
  for (let r = 0; r < rows; r++) {
    values.push([]); states.push([]); locs.push([]);
    for (let k = 0; k < cols; k++) {
      const cell = cells[r][k];
      if (!cell.total || cell.valid / cell.total < cfg.min_cell_valid_ratio) { values[r].push(null); states[r].push("unknown"); locs[r].push(null); continue; }
      if (!cell.d.length) { values[r].push(null); states[r].push("excluded"); locs[r].push(null); continue; }
      const val = percentile(cell.d, cfg.cell_percentile);
      let pick = 0;
      cell.d.forEach((h, i) => { if (Math.abs(h - val) < Math.abs(cell.d[pick] - val)) pick = i; });
      values[r].push(val); states[r].push("measured"); locs[r].push(cell.at[pick]);
    }
  }
  const flat = states.flat();
  const measured = flat.filter((s) => s === "measured").length, unknown = flat.filter((s) => s === "unknown").length;
  const unknownRatio = measured + unknown ? unknown / (measured + unknown) : 0;
  if (measured + unknown === 0) return { ok: false, code: "over_none", reason: "Nothing above the reference plane in the upper box", reference };
  if (1 - unknownRatio < cfg.min_known_ratio) return { ok: false, code: "over_sparse", reason: "Too little valid depth above; unknown space is not clearance", reference, grid: { rows, cols, values, states } };
  let low = null;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) if (states[r][k] === "measured" && (!low || values[r][k] < values[low[0]][low[1]])) low = [r, k];
  if (!low) return { ok: false, code: "over_none", reason: "Nothing above the reference plane in the upper box", reference };
  const warnings = [];
  if (unknown) {
    warnings.push(`Unknown area ${Math.round(unknownRatio * 100)}%: the lowest limit may lie in an unmeasured part; check on site`);
    const near = [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr || dc) && states[low[0] + dr]?.[low[1] + dc] === "unknown"));
    if (near) warnings.push("The lowest cell borders unmeasured cells; the true minimum may be smaller");
  }
  return { ok: true, min: values[low[0]][low[1]], lowest: low, at: locs[low[0]][low[1]], grid: { rows, cols, values, states, locs }, reference, unknownRatio, plane: { n, c }, warnings };
}
const hash = (u, v) => {
  const s = Math.sin(u * 127.1 + v * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};
return { CAR_TOP_Y, CLEAR_CFG, IMG, POSE, sceneOf, cameraOf, project, rayOf, depthAt, twoPoint, clearance, hash };
})();


{
const CAM = SC.cameraOf();
const W = SC.IMG.w, H = SC.IMG.h;
const CLIP_X = 1250, CLIP_Y = 1250;
// isometric view of the shaft: from behind the camera, up and to the right
const AZ = 34 * Math.PI / 180, EL = 30 * Math.PI / 180;
const VW = [Math.sin(AZ) * Math.cos(EL), Math.sin(EL), -Math.cos(AZ) * Math.cos(EL)];
const VR = (() => { const r = [-VW[2], 0, VW[0]]; const n = Math.hypot(...r); return r.map((v) => v / n); })();
const VS = (() => { const s = [VR[1] * VW[2] - VR[2] * VW[1], VR[2] * VW[0] - VR[0] * VW[2], VR[0] * VW[1] - VR[1] * VW[0]]; const n = Math.hypot(...s); return s.map((v) => v / n); })();
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const isoFit = (() => {
  const pts = [];
  for (const x of [-CLIP_X, CLIP_X]) for (const y of [-1110, CLIP_Y]) for (const z of [-200, 2400]) pts.push([x, y, z]);
  const xs = pts.map((p) => dot(p, VR)), ys = pts.map((p) => -dot(p, VS));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(388 / (x1 - x0), 368 / (y1 - y0));
  return { k, ox: 200 - ((x0 + x1) / 2) * k, oy: 190 - ((y0 + y1) / 2) * k };
})();
const I = (p) => [isoFit.ox + dot(p, VR) * isoFit.k, isoFit.oy - dot(p, VS) * isoFit.k];
const f2 = (v) => v.toFixed(1);
const pathOf = (pts, close = true) => "M" + pts.map((q) => f2(q[0]) + " " + f2(q[1])).join("L") + (close ? "Z" : "");
const FACES = [[[0, 2, 4], [0, 3, 4], [0, 3, 5], [0, 2, 5], [-1, 0, 0]], [[1, 2, 4], [1, 2, 5], [1, 3, 5], [1, 3, 4], [1, 0, 0]],
  [[0, 2, 4], [0, 2, 5], [1, 2, 5], [1, 2, 4], [0, -1, 0]], [[0, 3, 4], [1, 3, 4], [1, 3, 5], [0, 3, 5], [0, 1, 0]],
  [[0, 2, 4], [1, 2, 4], [1, 3, 4], [0, 3, 4], [0, 0, -1]], [[0, 2, 5], [0, 3, 5], [1, 3, 5], [1, 2, 5], [0, 0, 1]]];
const corner = (b, [i, j, l]) => [b[i], b[j], b[l]];
const clipBox = (b) => [Math.max(b[0], -CLIP_X), Math.min(b[1], CLIP_X), b[2], Math.min(b[3], CLIP_Y), b[4], b[5]];
function isoScene(scene) {
  const list = scene.map((it) => ({ it, b: clipBox(it.b) })).filter(({ b }) => b[0] < b[1] && b[2] < b[3]);
  const key = ({ it, b }) => (it.layer < 2 ? -1e9 + it.layer * 1e6 : 0) + dot([(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2], VW);
  list.sort((a, b) => key(a) - key(b));
  let out = "";
  // floor grid under the car top for scale: 500 mm squares on the car-top surface
  for (const { it, b } of list) {
    for (const f of FACES) {
      const n = f[4];
      if (dot(n, VW) <= 0) continue;
      const pts = f.slice(0, 4).map((c) => I(corner(b, c)));
      const tone = it.thin ? "thin" : n[1] > 0 ? "f0" : n[1] < 0 ? "f3" : n[0] !== 0 ? "f2" : "f1";
      out += '<path class="face ' + tone + '" d="' + pathOf(pts) + '"/>';
    }
    if (it.id === "car") {
      let g = "";
      for (let x = -1000; x <= 1000; x += 500) g += pathOf([I([x, b[3], b[4] + 20]), I([x, b[3], b[5] - 20])], false);
      for (let z = 500; z <= 2000; z += 500) g += pathOf([I([b[0] + 20, b[3], z]), I([b[1] - 20, b[3], z])], false);
      out += '<path d="' + g + '" style="stroke:var(--faint);stroke-width:.5;fill:none"/>';
    }
  }
  return out;
}
function isoCamera() {
  // camera body and a short view volume toward the image corners
  const c = CAM.at;
  const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(([u, v]) => { const d = SC.rayOf(CAM, u, v); return [c[0] + d[0] * 520, c[1] + d[1] * 520, c[2] + d[2] * 520]; });
  let s = '<path class="fr" d="' + corners.map((p) => pathOf([I(c), I(p)], false)).join("") + pathOf(corners.map(I)) + '"/>';
  const body = [-55, 55, -20, 20, -40, 0];
  for (const f of FACES) { if (dot(f[4], VW) <= 0) continue; s += '<path class="face ' + (f[4][1] > 0 ? "f0" : f[4][0] ? "f2" : "f1") + '" d="' + pathOf(f.slice(0, 4).map((q) => I(corner(body, q)))) + '"/>'; }
  return s;
}
// live view: IR-lit mono frame, faces shaded by facing and range, speckle where depth is valid
const SPECK = (() => { const out = []; let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 1400; i++) out.push([r() * W, r() * H]); return out; })();
function camScene(scene) {
  const faces = [];
  for (const it of scene) {
    for (const f of FACES) {
      const n = f[4];
      const pts3 = f.slice(0, 4).map((c) => corner(it.b, c));
      const cen = pts3.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
      const toCam = [CAM.at[0] - cen[0], CAM.at[1] - cen[1], CAM.at[2] - cen[2]];
      if (dot(n, toCam) <= 0) continue;
      const dist = Math.hypot(...toCam);
      const lam = Math.abs(dot(n, toCam)) / dist;
      const g = Math.round(255 * Math.min(1, (0.18 + 0.7 * lam) * it.tone * Math.min(1, 1900 / dist)));
      const glare = it.glare && n[1] < 0;
      faces.push({ layer: it.layer < 2 ? it.layer : 2, dist, d: pathOf(pts3.map((p) => SC.project(CAM, p))), fill: glare ? "rgb(250,250,250)" : "rgb(" + g + "," + g + "," + g + ")" });
    }
  }
  faces.sort((a, b) => a.layer - b.layer || b.dist - a.dist);
  let out = '<rect width="' + W + '" height="' + H + '" fill="#0c0c0e"/>' + faces.map((f) => '<path d="' + f.d + '" fill="' + f.fill + '"/>').join("");
  let dots = "";
  for (const [u, v] of SPECK) { const d = SC.depthAt(scene, CAM, u, v, { noise: false }); if (d.valid) dots += "M" + f2(u) + " " + f2(v) + "h1.4"; }
  out += '<path d="' + dots + '" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>';
  return out;
}
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const signed = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
const local = (fig) => (k) => fig.querySelector('[data-k="' + k + '"]');

// ---------------------------------------------------------------- two points
const two = document.querySelector('[data-spx="two"]');
if (two) {
  const $ = local(two);
  const scene = SC.sceneOf();
  const camBg = camScene(scene);
  const isoBg = isoScene(scene) + isoCamera();
  const pts = [SC.project(CAM, [-90, -530, 2272]).slice(0, 2).map(Math.round), SC.project(CAM, [90, 610, 2272]).slice(0, 2).map(Math.round)];
  let sel = 0;
  const camSvg = $("cam"), stage = $("stage");
  const draw = () => {
    const r = SC.twoPoint(scene, CAM, pts[0], pts[1]);
    // live view overlay: line, endpoints, 4× loupe on the selected point
    const [a, b] = pts;
    let ov = '<line class="dline" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
    pts.forEach((p, i) => { ov += '<g class="ep' + (i === sel ? " sel" : "") + '"><circle class="k" cx="' + p[0] + '" cy="' + p[1] + '" r="9"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="9"/><text x="' + (p[0] + 13) + '" y="' + (p[1] - 10) + '">P' + (i + 1) + "</text></g>"; });
    const L = 140, Z = 4, s = pts[sel], lx = s[0] < W / 2 ? W - L - 10 : 10;
    ov += '<g class="loupe"><clipPath id="spx-lc"><rect x="' + lx + '" y="10" width="' + L + '" height="' + L + '"/></clipPath><g clip-path="url(#spx-lc)"><g transform="translate(' + (lx + L / 2 - s[0] * Z) + " " + (10 + L / 2 - s[1] * Z) + ") scale(" + Z + ')">' + camBg + "</g>" +
      '<path d="M' + (lx + L / 2 - 14) + " " + (10 + L / 2) + "h28M" + (lx + L / 2) + " " + (10 + L / 2 - 14) + 'v28" stroke="#ffd60a" stroke-width="2"/></g><rect class="frame" x="' + lx + '" y="10" width="' + L + '" height="' + L + '"/></g>';
    camSvg.innerHTML = camBg + ov;
    $("pos").textContent = "P" + (sel + 1) + " (" + s[0] + ", " + s[1] + ") px";
    // readings
    const st = $("state");
    const bad = (p) => !p.valid ? (p.reason === "thin" ? "no depth on a thin rope" : p.reason === "range" ? "outside 0.2–12 m" : "no depth") : "";
    if (r.ok) {
      st.textContent = "Ready"; st.className = "eyebrow ok";
      $("reading").innerHTML = '<div><div class="pl">3D distance</div><div class="pv">' + fmt(r.D) + '<small>mm</small></div><div class="ps">camera frame, fused stereo depth</div></div><dl><dt>Height difference</dt><dd>' + signed(r.dv) + " mm</dd><dt>Horizontal</dt><dd>" + fmt(r.dh) + " mm</dd><dt>P1 depth</dt><dd>" + fmt(r.p.zc) + " mm</dd><dt>P2 depth</dt><dd>" + fmt(r.q.zc) + " mm</dd></dl>";
    } else {
      st.textContent = "Waiting for depth"; st.className = "eyebrow bad";
      $("reading").innerHTML = '<div><div class="pl">3D distance</div><div class="pv">—</div></div><ul class="warn">' + [r.p, r.q].map((p, i) => bad(p) ? '<li class="bad">P' + (i + 1) + ": " + bad(p) + "</li>" : "").join("") + "</ul>";
    }
    $("hint").textContent = r.ok ? "Drag an endpoint or nudge it; confirm to freeze the reading" : "Move the point onto a textured surface with depth";
    // shaft view
    let iso = isoBg;
    if (r.ok) {
      const A = r.p.p, B = r.q.p, K = [A[0], B[1], A[2]];
      iso += '<path class="ray" d="' + pathOf([I(CAM.at), I(A)], false) + pathOf([I(CAM.at), I(B)], false) + '"/>';
      iso += '<path class="leg" d="' + pathOf([I(A), I(K), I(B)], false) + '"/>';
      iso += '<path class="seg" d="' + pathOf([I(A), I(B)], false) + '"/>';
      for (const p of [A, B]) { const q = I(p); iso += '<circle class="pt" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="3"/>'; }
    } else {
      for (const [i, p] of [r.p, r.q].entries()) if (p.valid) { const q = I(p.p); iso += '<path class="ray" d="' + pathOf([I(CAM.at), q], false) + '"/><circle class="pt" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="3"/>'; }
    }
    $("iso").innerHTML = iso;
    // along gravity: right triangle, hypotenuse D
    const ch = $("chart");
    if (r.ok) {
      const k = Math.min(110 / Math.max(Math.abs(r.dv), 1), 260 / Math.max(r.dh, 1));
      const w = r.dh * k, hgt = Math.abs(r.dv) * k;
      const x0 = 200 - w / 2, x1 = x0 + w, y0 = r.dv >= 0 ? 75 + hgt / 2 : 75 - hgt / 2, y1 = y0 - r.dv * k;
      ch.innerHTML = '<path class="tri" d="M' + f2(x0) + " " + f2(y0) + "L" + f2(x1) + " " + f2(y0) + "L" + f2(x1) + " " + f2(y1) + 'Z"/><path class="hyp" d="M' + f2(x0) + " " + f2(y0) + "L" + f2(x1) + " " + f2(y1) + '"/>' +
        '<text x="' + f2((x0 + x1) / 2) + '" y="' + f2(y0 + (r.dv >= 0 ? 14 : -6)) + '" text-anchor="middle">horizontal ' + fmt(r.dh) + ' mm</text><text x="' + f2(x1 + 8) + '" y="' + f2((y0 + y1) / 2 + 3) + '">' + (r.dv >= 0 ? "up " : "down ") + fmt(Math.abs(r.dv)) + ' mm</text>' +
        '<text class="val" x="' + f2((x0 + x1) / 2 - 8) + '" y="' + f2((y0 + y1) / 2 + 3) + '" text-anchor="end">D ' + fmt(r.D) + " mm</text>";
    } else ch.innerHTML = '<text x="200" y="80" text-anchor="middle">waiting for depth at both points</text>';
    // side rail
    $("side").innerHTML = [r.p, r.q].map((p, i) => "<dt>P" + (i + 1) + "</dt><dd>" + (p.valid ? p.p.map((v) => Math.round(v)).join(", ") : bad(p)) + "</dd>").join("") +
      (r.ok ? "<dt>Noise at P2</dt><dd>±" + (1.2e-6 * r.q.zc * r.q.zc).toFixed(1) + " mm</dd>" : "");
  };
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };
  const toPx = (ev) => { const r = camSvg.getBoundingClientRect(); return [Math.round(((ev.clientX - r.left) * W) / r.width), Math.round(((ev.clientY - r.top) * H) / r.height)]; };
  let drag = -1;
  stage.addEventListener("pointerdown", (ev) => {
    const p = toPx(ev);
    const d = pts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]));
    sel = d[0] <= d[1] ? 0 : 1;
    drag = sel;
    pts[sel] = [Math.max(0, Math.min(W - 1, p[0])), Math.max(0, Math.min(H - 1, p[1]))];
    stage.setPointerCapture(ev.pointerId);
    two.querySelectorAll("[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.p === sel)));
    schedule();
  });
  stage.addEventListener("pointermove", (ev) => { if (drag < 0) return; const p = toPx(ev); pts[drag] = [Math.max(0, Math.min(W - 1, p[0])), Math.max(0, Math.min(H - 1, p[1]))]; schedule(); });
  const end = () => { drag = -1; };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  const nudge = (dx, dy, step) => { pts[sel] = [Math.max(0, Math.min(W - 1, pts[sel][0] + dx * step)), Math.max(0, Math.min(H - 1, pts[sel][1] + dy * step))]; schedule(); };
  stage.addEventListener("keydown", (ev) => {
    const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (ev.key === "Tab" && !ev.shiftKey && sel === 0) { ev.preventDefault(); sel = 1; two.querySelectorAll("[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.p === sel))); schedule(); return; }
    if (!m) return;
    ev.preventDefault();
    nudge(m[0], m[1], ev.shiftKey ? 5 : 1);
  });
  two.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { sel = +b.dataset.p; two.querySelectorAll("[data-p]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); schedule(); }));
  two.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", (ev) => { const [dx, dy] = b.dataset.d.split(",").map(Number); nudge(dx, dy, ev.shiftKey ? 5 : 1); }));
  draw();
}

// ---------------------------------------------------------------- clearance
const clr = document.querySelector('[data-spx="clear"]');
if (clr) {
  const $ = local(clr);
  const BASE0 = [110, 366, 530, 398], OVER0 = [40, 34, 600, 96], WALL = [370, 200, 470, 260];
  const boxes = { base: BASE0.slice(), over: OVER0.slice() };
  let sel = "over", beam = 1750, glare = false, scene = null, camBg = "", isoBg = "";
  const camSvg = $("cam"), stage = $("stage");
  const rebuild = () => {
    scene = SC.sceneOf({ beamBottom: SC.CAR_TOP_Y + beam, glare });
    camBg = camScene(scene);
    isoBg = isoScene(scene) + isoCamera();
  };
  const ramp = (t) => "color-mix(in srgb,#e5484d " + Math.round((1 - t) * 100) + "%,#30a46c)";
  const draw = () => {
    const r = SC.clearance(scene, CAM, boxes.base, boxes.over);
    // live view: boxes with their tags
    let ov = "";
    for (const [k, cls, label] of [["base", "base", "Reference"], ["over", "over", "Upper region"]]) {
      const b = boxes[k];
      ov += '<rect class="box ' + cls + (sel === k ? " sel" : "") + '" data-box="' + k + '" x="' + b[0] + '" y="' + b[1] + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '"/>';
      ov += '<text class="tag" x="' + (b[0] + 4) + '" y="' + (k === "base" ? b[1] - 6 : b[3] + 16) + '" fill="' + (k === "base" ? "#0a84ff" : "#ff9f0a") + '">' + label + "</text>";
    }
    if (r.ok) { const p = SC.project(CAM, r.at); ov += '<path d="M' + f2(p[0] - 12) + " " + f2(p[1]) + "h24M" + f2(p[0]) + " " + f2(p[1] - 12) + 'v24" stroke="#fff" stroke-width="2.5"/>'; }
    camSvg.innerHTML = camBg + ov;
    // readings
    const st = $("state");
    const g = r.grid;
    const vals = g ? g.values.flat().filter((v) => v != null) : [];
    const lo = 800, hi = 2400; // fixed colour scale in mm, the same as the profile axis
    const gridHtml = g ? '<div class="grid" style="grid-template-columns:repeat(' + g.cols + ',1fr)">' + g.states.map((row, i) => row.map((s, j) => {
      const low = r.ok && r.lowest[0] === i && r.lowest[1] === j;
      if (s === "measured") { const t = Math.max(0, Math.min(1, (g.values[i][j] - lo) / (hi - lo))); return '<i class="m' + (low ? " low" : "") + '" style="--t:' + t.toFixed(3) + '" title="' + Math.round(g.values[i][j]) + ' mm"></i>'; }
      return '<i class="' + (s === "unknown" ? "u" : "x") + '" title="' + (s === "unknown" ? "unknown, no valid depth" : "below the margin, excluded") + '"></i>';
    }).join("")).join("") + '</div><div class="legend"><span><i style="background:#e5484d"></i>0.8 m</span><span><i style="background:#30a46c"></i>2.4 m</span><span><i style="background:repeating-linear-gradient(45deg,#999 0 2px,transparent 2px 4px)"></i>unknown</span><span><i style="box-shadow:inset 0 0 0 2px currentColor"></i>lowest</span></div>' : "";
    if (r.ok) {
      st.textContent = "Ready"; st.className = "eyebrow ok";
      $("reading").innerHTML = '<div><div class="pl">Minimum clearance</div><div class="pv">' + fmt(r.min) + '<small>mm</small></div><div class="ps">cell r' + (r.lowest[0] + 1) + " c" + (r.lowest[1] + 1) + ", along gravity to the reference plane</div></div>" + gridHtml +
        (r.warnings.length ? '<ul class="warn">' + r.warnings.map((w) => "<li>" + w + "</li>").join("") + "</ul>" : "");
    } else {
      st.textContent = "Rejected"; st.className = "eyebrow bad";
      $("reading").innerHTML = '<div><div class="pl">Minimum clearance</div><div class="pv">—</div></div><ul class="warn"><li class="bad">' + r.reason + "</li></ul>" + gridHtml;
    }
    $("hint").textContent = r.ok ? "Confirm the reading, then mark the limiting obstruction and save" : r.code.startsWith("base") ? "Box only the flat car top" : "Box the shaft top, beams or other structure above";
    // shaft view: reference patch through the corner rays, drops from the plane to each cell's lowest point
    let iso = isoBg;
    const b = boxes.base;
    const patch = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([u, v]) => SC.depthAt(scene, CAM, u, v, { noise: false }));
    if (patch.every((p) => p.valid)) iso += '<path class="refp" d="' + pathOf(patch.map((p) => I(p.p))) + '"/>';
    if (g && r.plane) {
      for (let i = 0; i < g.rows; i++) for (let j = 0; j < g.cols; j++) {
        const p = g.locs?.[i]?.[j];
        if (!p) continue;
        const foot = [p[0], (r.plane.c - r.plane.n[0] * p[0] - r.plane.n[2] * p[2]) / r.plane.n[1], p[2]];
        const t = Math.max(0, Math.min(1, (g.values[i][j] - lo) / (hi - lo)));
        iso += '<path class="drop" style="stroke:' + ramp(t) + '" d="' + pathOf([I(foot), I(p)], false) + '"/>';
      }
      if (r.ok) { const q = I(r.at), f = I([r.at[0], SC.CAR_TOP_Y, r.at[2]]); iso += '<path class="seg" d="' + pathOf([f, q], false) + '"/><circle class="low" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="3"/><circle class="low" cx="' + f2(f[0]) + '" cy="' + f2(f[1]) + '" r="2"/>'; }
    }
    $("iso").innerHTML = iso;
    // clearance profile: lowest value per grid column across the width, unknown columns hatched
    const ch = $("chart");
    let s = '<defs><pattern id="spx-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v5" stroke="var(--faint)" stroke-width="1.6"/></pattern></defs>';
    const X0 = 40, X1 = 390, Y0 = 128, top = 2400, ky = (Y0 - 12) / top;
    s += '<path class="axis" d="M' + X0 + " 12V" + Y0 + '"/>';
    for (const v of [0, 1000, 2000]) s += '<text x="' + (X0 - 4) + '" y="' + f2(Y0 - v * ky + 3) + '" text-anchor="end">' + v / 1000 + " m</text>";
    if (g) {
      const cw = (X1 - X0) / g.cols;
      let prof = "M" + X0 + " " + Y0;
      for (let j = 0; j < g.cols; j++) {
        const col = g.values.map((row, i) => (g.states[i][j] === "measured" ? row[j] : null)).filter((v) => v != null);
        const unknown = g.states.every((row) => row[j] === "unknown");
        const x = X0 + j * cw;
        if (!col.length) {
          if (unknown) s += '<rect class="unk" x="' + f2(x) + '" y="12" width="' + f2(cw) + '" height="' + (Y0 - 12) + '"/>';
          prof += "L" + f2(x) + " " + Y0 + "L" + f2(x + cw) + " " + Y0;
          continue;
        }
        const y = Y0 - Math.min(...col) * ky;
        prof += "L" + f2(x) + " " + f2(y) + "L" + f2(x + cw) + " " + f2(y);
        if (g.states.some((row) => row[j] === "unknown")) s += '<rect class="unk" x="' + f2(x) + '" y="12" width="' + f2(cw) + '" height="' + f2(y - 12) + '" opacity=".6"/>';
      }
      s += '<path class="prof" d="' + prof + "L" + X1 + " " + Y0 + 'Z"/>';
      if (r.ok) { const x = X0 + (r.lowest[1] + 0.5) * cw, y = Y0 - r.min * ky; s += '<path d="M' + f2(x - 7) + " " + f2(y) + "h14M" + f2(x) + " " + f2(y - 7) + 'v14" stroke="var(--ink)" stroke-width="1.4"/><text class="val" x="' + f2(x + 9) + '" y="' + f2(y + 13) + '">' + fmt(r.min) + " mm</text>"; }
    }
    s += '<path class="base" d="M' + X0 + " " + Y0 + "H" + X1 + '"/>';
    ch.innerHTML = s;
    // side rail
    const flat = g ? g.states.flat() : [];
    const cnt = (k) => flat.filter((x) => x === k).length;
    const ref = r.reference;
    $("side").innerHTML = (g ? "<dt>Measured</dt><dd>" + cnt("measured") + "</dd><dt>Unknown</dt><dd" + (cnt("unknown") ? ' class="bad"' : "") + ">" + cnt("unknown") + "</dd><dt>Excluded</dt><dd>" + cnt("excluded") + "</dd>" : "") +
      (ref ? "<dt>Plane inliers</dt><dd" + (ref.ratio < SC.CLEAR_CFG.min_reference_inlier_ratio ? ' class="bad"' : "") + ">" + Math.round(ref.ratio * 100) + "%</dd><dt>Plane RMS</dt><dd>" + ref.rms.toFixed(1) + " mm</dd><dt>Plane tilt</dt><dd" + (ref.tilt > SC.CLEAR_CFG.max_reference_tilt_deg ? ' class="bad"' : "") + ">" + ref.tilt.toFixed(1) + "°</dd>" : "");
  };
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };
  const toPx = (ev) => { const r = camSvg.getBoundingClientRect(); return [((ev.clientX - r.left) * W) / r.width, ((ev.clientY - r.top) * H) / r.height]; };
  const inside = (b, p) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
  const move = (k, dx, dy) => {
    const b = boxes[k], w = b[2] - b[0], h = b[3] - b[1];
    const x = Math.max(0, Math.min(W - w, b[0] + dx)), y = Math.max(0, Math.min(H - h, b[1] + dy));
    boxes[k] = [Math.round(x), Math.round(y), Math.round(x + w), Math.round(y + h)];
    if (k === "base") $("wall").checked = boxes.base.join() === WALL.join();
    schedule();
  };
  let drag = null;
  stage.addEventListener("pointerdown", (ev) => {
    const p = toPx(ev);
    const k = inside(boxes.base, p) ? "base" : inside(boxes.over, p) ? "over" : null;
    if (!k) return;
    sel = k; drag = { k, p };
    stage.setPointerCapture(ev.pointerId);
    schedule();
  });
  stage.addEventListener("pointermove", (ev) => { if (!drag) return; const p = toPx(ev); move(drag.k, p[0] - drag.p[0], p[1] - drag.p[1]); drag.p = p; });
  const end = () => { drag = null; };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab" && !ev.shiftKey && sel === "over") { ev.preventDefault(); sel = "base"; schedule(); return; }
    const m = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[ev.key];
    if (!m) return;
    ev.preventDefault();
    move(sel, m[0], m[1]);
  });
  const beamIn = $("beam"), beamOut = $("beam-v");
  beamIn.addEventListener("input", () => { beam = +beamIn.value; beamOut.textContent = fmt(beam) + " mm"; rebuild(); schedule(); });
  $("glare").addEventListener("change", (ev) => { glare = ev.target.checked; rebuild(); schedule(); });
  $("wall").addEventListener("change", (ev) => { boxes.base = (ev.target.checked ? WALL : BASE0).slice(); sel = "base"; schedule(); });
  beamOut.textContent = fmt(beam) + " mm";
  rebuild();
  draw();
}
}
