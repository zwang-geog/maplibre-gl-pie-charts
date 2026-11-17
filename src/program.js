import {INSTANCE_FLOATS} from './pie-table.js';
import {fragmentSource, vertexSource} from './shaders.js';

// Four corners of the -1..1 square, written as two triangles. WebGL has no
// quad primitive, and this buffer is not indexed, so two corners are repeated
// and drawArrays reads 6 vertices.
const QUAD = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
]);

export function createPieProgram(gl) {
    const program = gl.createProgram();
    const vertexShader = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.bindAttribLocation(program, 0, 'a_extrude');
    gl.bindAttribLocation(program, 1, 'a_mercator');
    gl.bindAttribLocation(program, 2, 'a_step');
    gl.bindAttribLocation(program, 3, 'a_shares0');
    gl.bindAttribLocation(program, 4, 'a_shares1');
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Pie program failed to link: ${log}`);
    }
    return {
        program,
        quad: createBuffer(gl, QUAD),
        instances: gl.createBuffer(),
        vao: gl.createVertexArray(),
        uniforms: {
            matrix: gl.getUniformLocation(program, 'u_matrix'),
            pixelScale: gl.getUniformLocation(program, 'u_pixel_scale'),
            pixelRatio: gl.getUniformLocation(program, 'u_pixel_ratio'),
            stepSizes: gl.getUniformLocation(program, 'u_step_sizes'),
            filterCount: gl.getUniformLocation(program, 'u_filter_count'),
            filterAny: gl.getUniformLocation(program, 'u_filter_any'),
            filterOperand: gl.getUniformLocation(program, 'u_filter_operand'),
            filterOp: gl.getUniformLocation(program, 'u_filter_op'),
            filterValue: gl.getUniformLocation(program, 'u_filter_value'),
            colors: gl.getUniformLocation(program, 'u_colors'),
            sliceCount: gl.getUniformLocation(program, 'u_slice_count'),
            hole: gl.getUniformLocation(program, 'u_hole'),
            opacity: gl.getUniformLocation(program, 'u_opacity'),
        },
    };
}

// Copies one packed pie array into the instance buffer. writeInstance in
// pie-table.js lays out each pie as INSTANCE_FLOATS floats; buildPieTable,
// buildPieTableFromColumns, and createPieAccumulator call it. bindPieAttributes
// has already attached this same buffer to a_mercator, a_step, a_shares0,
// and a_shares1, so replacing the bytes does not require binding those again.
export function uploadInstances(gl, buffer, instances) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

export function bindPieAttributes(gl, resources) {
    gl.bindVertexArray(resources.vao);

    // Location 0 is a_extrude, from the quad rather than the instance array.
    // Divisor 0 keeps the same corner list for every pie.
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);

    // One pie is INSTANCE_FLOATS floats: mercator.xy, step index, then eight shares.
    // Locations are the bindAttribLocation numbers. Divisor 1 advances once per pie.
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.instances);
    const stride = INSTANCE_FLOATS * 4;
    enableInstance(gl, 1, 2, stride, 0); // a_mercator, floats 0-1
    enableInstance(gl, 2, 1, stride, 2 * 4); // a_step, float 2
    enableInstance(gl, 3, 4, stride, 3 * 4); // a_shares0, floats 3-6
    enableInstance(gl, 4, 4, stride, 7 * 4); // a_shares1, floats 7-10

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

export function deletePieProgram(gl, resources) {
    if (!resources) return;
    gl.deleteProgram(resources.program);
    gl.deleteBuffer(resources.quad);
    gl.deleteBuffer(resources.instances);
    gl.deleteVertexArray(resources.vao);
}

function enableInstance(gl, location, size, stride, offset) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(location, 1);
}

function createBuffer(gl, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
}

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Pie shader failed to compile: ${log}`);
    }
    return shader;
}
