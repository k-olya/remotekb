// helper functions for webgl

// create and compile a shader
function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// create and link a program
function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

// create and configure a texture
function createTexture(gl, glTexture, width, height, options = null) {
  const opts = {
    framebuffer: null,
    pixels: null,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
    flip: false,
    premultiply: false,
    ...options,
  };
  var texture = gl.createTexture();
  gl.activeTexture(glTexture);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (opts.flip) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  }
  if (opts.premultiply) {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  }
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    opts.pixels || null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT);

  if (opts.framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, opts.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
  }

  return texture;
}

// full-screen triangle strip
const defaultVertices = [
  -1.0,
  -1.0, // Bottom left corner
  1.0,
  -1.0, // Bottom right corner
  -1.0,
  1.0, // Top left corner
  1.0,
  1.0, // Top right corner
];

// create a vertex buffer
function createVertexBuffer(gl, vertices = defaultVertices) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  return buffer;
}

// pass current ARRAY_BUFFER to the vertex shader
function enableVertexBuffer(gl, attribLocation, options = null) {
  const opts = {
    buffer: null,
    size: 2,
    ...options,
  };
  if (opts.buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, opts.buffer);
  }
  gl.enableVertexAttribArray(attribLocation);
  gl.vertexAttribPointer(attribLocation, opts.size, gl.FLOAT, false, 0, 0);
}

// fill entire screen
function fillFramebuffer(gl, width, height, framebuffer = null) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.viewport(0, 0, width, height);
  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// get all attribute and uniform locations at once in a nice little object
function getAttribLocations(gl, program, ...args) {
  return args.reduce(
    (a, v) => ({ ...a, [v]: gl.getAttribLocation(program, v) }),
    {}
  );
}
function getUniformLocations(gl, program, ...args) {
  return args.reduce(
    (a, v) => ({ ...a, [v]: gl.getUniformLocation(program, v) }),
    {}
  );
}
