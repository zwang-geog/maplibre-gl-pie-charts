// One instanced quad per chart. The fragment shader picks the slice.
// Shares are cumulative in 0..1, eight wide, matching MAX_SLICES in pie-table.js.
//
// u_matrix places only the pie center. a_extrude is a corner of the quad, a
// square from -1 to 1 on both axes, shared by every pie. Those four corners
// are stored as six vertices because WebGL draws triangles: two triangles,
// with two corners repeated (the QUAD in program.js). Leaving gl_Position at
// the projected center would stack every corner on that one point.
//
// The radius is CSS pixels and stays that size while the map zooms, so the
// corner is offset in clip space rather than in mercator units. clip_offset
// changes units twice. u_pixel_ratio turns CSS pixels into device pixels,
// because the drawing buffer is the CSS size times that ratio. u_pixel_scale
// turns one device pixel into clip units: (2/drawingBufferWidth,
// -2/drawingBufferHeight). NDC x runs from -1 to 1 across the buffer. NDC y
// runs from -1 at the bottom to +1 at the top, while canvas y points down, so
// the y term is negative and positive extrude y moves toward the bottom of
// the screen. The fragment shader therefore measures the angle from extrude
// -y, so slice 0 starts at the top of the screen and slices run clockwise.
//
// gl_Position is clip space, not NDC. w is the fourth component of that vec4,
// and the GPU displays (x/w, y/w, z/w). Multiplying clip_offset by center.w
// cancels the division, so the radius is not shrunk by w. On a 1000 by 800
// CSS map at ratio 2 the buffer is 2000 by 1600, the pixel scale is
// (0.001, -0.00125), and a radius of 16 becomes 32 device pixels. The corner
// (1, 0) then moves 0.032 in normalized x, which is 16 CSS pixels.
//
// A chart that fails the filter puts all six vertices on one point outside
// clip space, so its triangles have no area and no fragment runs.

export const vertexSource = `#version 300 es
precision highp float;

uniform mat4 u_matrix;       // MapLibre mercator-to-clip matrix
uniform vec2 u_pixel_scale;  // device pixels to clip units: (2/width, -2/height)
uniform float u_pixel_ratio; // device pixels per CSS pixel
uniform float u_step_sizes[16]; // radius in CSS pixels for each step index

// Filter conditions, matching MAX_FILTER_CONDITIONS in pie-layer.js.
// Operand 0..7 is a slice share; 8 is the radius step index.
// Op: 1 ==, 2 >, 3 >=, 4 <, 5 <=.
uniform int u_filter_count;     // 0 draws every chart
uniform int u_filter_any;       // 1 passes when any condition holds; 0 needs all
uniform int u_filter_operand[18];
uniform int u_filter_op[18];
uniform float u_filter_value[18];

in vec2 a_extrude;  // quad corner in -1..1, shared by every pie. +y is down on screen
in vec2 a_mercator; // pie center in mercator 0..1
in float a_step;    // radius step index, a whole number
in vec4 a_shares0;  // cumulative slice shares 0..3, each in 0..1
in vec4 a_shares1;  // cumulative slice shares 4..7, each in 0..1

out vec2 v_extrude; // quad corner for the fragment wedge and hole tests
out vec4 v_shares0; // a_shares0, unchanged
out vec4 v_shares1; // a_shares1, unchanged

const int STEP_OPERAND = 8;

float sliceShare(int slice) {
    float cumulative[8] = float[8](
        a_shares0.x, a_shares0.y, a_shares0.z, a_shares0.w,
        a_shares1.x, a_shares1.y, a_shares1.z, a_shares1.w
    );
    float before = slice > 0 ? cumulative[slice - 1] : 0.0;
    return cumulative[slice] - before;
}

bool compare(int op, float left, float right) {
    if (op == 1) return left == right;
    if (op == 2) return left > right;
    if (op == 3) return left >= right;
    if (op == 4) return left < right;
    return left <= right;
}

bool passesFilter(int stepIndex) {
    if (u_filter_count == 0) return true;
    bool matchAny = u_filter_any == 1;
    for (int i = 0; i < 18; i++) {
        if (i >= u_filter_count) break;
        int operand = u_filter_operand[i];
        float left = operand == STEP_OPERAND ? float(stepIndex) : sliceShare(operand);
        bool holds = compare(u_filter_op[i], left, u_filter_value[i]);
        if (matchAny && holds) return true;
        if (!matchAny && !holds) return false;
    }
    return !matchAny;
}

void main() {
    int stepIndex = clamp(int(a_step + 0.5), 0, 15);
    if (!passesFilter(stepIndex)) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        v_extrude = vec2(0.0);
        v_shares0 = vec4(0.0);
        v_shares1 = vec4(0.0);
        return;
    }

    vec4 center = u_matrix * vec4(a_mercator, 0.0, 1.0); // clip-space pie center
    float radius = u_step_sizes[stepIndex] * u_pixel_ratio; // CSS pixels to device pixels
    vec2 clip_offset = a_extrude * radius * u_pixel_scale; // quad corner in clip units
    // Scale by center.w so the pie stays a fixed screen size after the perspective divide.
    gl_Position = center + vec4(clip_offset * center.w, 0.0, 0.0);
    v_extrude = a_extrude;
    v_shares0 = a_shares0;
    v_shares1 = a_shares1;
}
`;

export const fragmentSource = `#version 300 es
precision highp float;

in vec2 v_extrude; // quad corner in -1..1. Length 1 is the pie edge
in vec4 v_shares0; // cumulative slice shares 0..3
in vec4 v_shares1; // cumulative slice shares 4..7

uniform vec4 u_colors[8];    // one RGBA color per slice, in 0..1
uniform int u_slice_count; // how many of the eight shares are used
uniform float u_hole;        // inner radius as a fraction of the outer radius
uniform float u_opacity;     // multiplies the pie alpha

out vec4 fragColor; // premultiplied RGBA

const float TAU = 6.283185307179586;

vec4 sliceColor(int slice) {
    if (slice == 1) return u_colors[1];
    if (slice == 2) return u_colors[2];
    if (slice == 3) return u_colors[3];
    if (slice == 4) return u_colors[4];
    if (slice == 5) return u_colors[5];
    if (slice == 6) return u_colors[6];
    if (slice == 7) return u_colors[7];
    return u_colors[0];
}

void main() {
    float dist = length(v_extrude);
    // fwidth is how much dist changes across one screen pixel. Fragments past
    // the outer edge by that amount are already fully transparent, so drop them.
    float aa = fwidth(dist);
    if (dist > 1.0 + aa) discard;

    float shares[8];
    shares[0] = v_shares0.x;
    shares[1] = v_shares0.y;
    shares[2] = v_shares0.z;
    shares[3] = v_shares0.w;
    shares[4] = v_shares1.x;
    shares[5] = v_shares1.y;
    shares[6] = v_shares1.z;
    shares[7] = v_shares1.w;

    // 0 at the top of the screen, increasing clockwise.
    float angle = atan(v_extrude.x, -v_extrude.y);
    if (angle < 0.0) angle += TAU;
    float t = angle / TAU;

    int slice = 0;
    for (int i = 0; i < 8; i++) {
        if (i >= u_slice_count) break;
        slice = i;
        if (t <= shares[i]) break;
    }

    vec4 color = sliceColor(slice);

    float outer_mask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, dist);
    float inner_mask = u_hole > 0.0 ? smoothstep(u_hole - aa, u_hole + aa, dist) : 1.0;
    color.a *= outer_mask * inner_mask * u_opacity;
    fragColor = vec4(color.rgb * color.a, color.a);
}
`;
