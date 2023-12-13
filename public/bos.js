const SPRITE_BYTES = 4 * 16 * 6;
const SPRITE_FLOATS = 16 * 6;
const MAX_BUFFER_SIZE_INCREMENT = 256;

const vertexShaderSource = (a, v, u) => `
    attribute mat4 a_all;
    varying vec2 v_uv;
    varying float v_alpha;
    ${v || ""}
    ${u || ""}
    
    uniform highp float u_time;
    uniform vec2 u_aspect;

    void main() {
        vec2 c = a_all[0].xy;
        vec2 scale = a_all[0].ba;
        float rot = a_all[1][0];
        float alpha = a_all[1][1];
        vec2 uv = a_all[1].ba;
        vec2 pos = a_all[2].xy;

        float custom0 = a_all[2][2];
        float custom1 = a_all[2][3];
        float custom2 = a_all[3][0];
        float custom3 = a_all[3][1];
        float custom4 = a_all[3][2];
        float custom5 = a_all[3][3];

        ${a || ""}

        // rotate
        float _sin = sin(rot);
        float _cos = cos(rot);
        mat2 rotationMatrix = mat2(_cos, _sin, -_sin, _cos);
        pos = rotationMatrix * pos;

        // scale and translate
        pos = pos * scale + c;

        // apply aspect ratio
        pos *= u_aspect;

        v_uv = uv;
        v_alpha = alpha;
        gl_Position = vec4(pos, 0.0, 1.0);
    }

`;

const fragmentShaderSource = custom =>
  custom ||
  `
    precision mediump float;
    uniform sampler2D u_texture;

    varying vec2 v_uv;
    varying float v_alpha;

    void main() {
        vec2 st = v_uv;
        vec4 col = texture2D(u_texture, st);
        gl_FragColor = vec4(col.xyz, col.a * v_alpha);
    }
`;

function Bos(gl, width, height, options = {}) {
  const opts = {
    aspect: true,
    ...options,
  };
  this.gl = gl;
  this.width = width;
  this.height = height;
  this.aspect = opts.aspect === true ? height / width : opts.aspect;
  this.layers = [];
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

Bos.prototype.addLayer = function (opts) {
  this.layers.push(new Layer(this, opts));
};

Bos.prototype.render = function (time) {
  const gl = this.gl;
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  this.gl.viewport(0, 0, this.width, this.height);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  for (let layer of this.layers) {
    layer.render(time);
  }
};

Bos.prototype.resize = function (width, height) {
  this.width = width;
  this.height = height;
  this.aspect = this.aspect && height / width;
};

Bos.prototype.canvasXtoGl = function (x) {
  return ((x / this.width) * 2 - 1) / (this.aspect || 1);
};

Bos.prototype.canvasYtoGl = function (y) {
  return 1 - (y / this.height) * 2;
};

function Layer(bos, options) {
  const gl = bos.gl;
  this.bos = bos;
  const opts = {
    image: null,
    textureFilter: gl.LINEAR,
    vertexAnimationCode: "",
    customFragmentShader: "",
    customVarying: "",
    customUniforms: {},
    ...options,
  };
  this.gl = gl;
  this.size = 1;
  this.length = 0;
  // this.ab = new ArrayBuffer(this.size * SPRITE_BYTES);
  // this.data = new Float32Array(this.ab);
  this.data = new Float32Array(this.size * SPRITE_FLOATS);

  this.textureFilter = opts.textureFilter;
  this.image = opts.image;
  this.textureWidth = opts.image.naturalWidth;
  this.textureHeight = opts.image.naturalHeight;
  this.vertexAnimationCode = opts.vertexAnimationCode;
  this.customFragmentShader = opts.customFragmentShader;
  this.customVarying = opts.customVarying;
  this.customUniforms = opts.customUniforms;
  this.uniformValues = {};
  this.customUniformsList = Object.keys(opts.customUniforms);

  this.dirty = { compile: true, texture: true, vbo: true };
}

const vertices = [
  // bottom left corner
  [-0.5, -0.5, "uvleft", "uvbottom"],
  // bottom right corner
  [0.5, -0.5, "uvright", "uvbottom"],
  // top left corner
  [-0.5, 0.5, "uvleft", "uvtop"],

  // top left corner
  [-0.5, 0.5, "uvleft", "uvtop"],
  // bottom right corner
  [0.5, -0.5, "uvright", "uvbottom"],
  // top right corner
  [0.5, 0.5, "uvright", "uvtop"],
];

Layer.prototype.addSprites = function (a) {
  this.modSprites(a, this.length);
};

const defIfUndef = (v, d) => (v === undefined ? d : v);

Layer.prototype.modSprites = function (a, start = 0) {
  const len = a.length + start;
  let mod = true;
  // resize the underlying array buffer to fit new content
  if (len > this.size) {
    while (len > this.size) {
      this.size += Math.max(
        len,
        Math.min(this.size, MAX_BUFFER_SIZE_INCREMENT)
      );
    }
    let data = new Float32Array(this.size * SPRITE_FLOATS);
    data.set(this.data, 0);
    this.data = data;
    mod = false;
  }
  // set vertex attributes
  for (let i = 0; i < a.length; i++) {
    let index = (start + i) * SPRITE_FLOATS;
    let c = a[i];
    let custom = c.custom || [];
    let chunk = vertices.flatMap(vx => {
      // calculate uv coordinates based on options and vertex data
      let u = c.u + (vx[2] === "uvright" ? c.w : 0) || 0;
      let v = c.v + (vx[3] === "uvbottom" ? c.h : 0) || 0;
      let scaley = defIfUndef(c.scaley, 1);
      let scalex = defIfUndef(c.scalex, (c.w / c.h) * scaley || scaley);
      return [
        c.x || 0,
        c.y || 0,
        scalex,
        scaley,

        c.rot || 0,
        defIfUndef(c.alpha, 1),
        u / this.textureWidth, // uv.x
        1 - v / this.textureHeight, // uv.y

        vx[0] || 0, // pos.x
        vx[1] || 0, // pos.y
        custom[0] || 0,
        custom[1] || 0,

        custom[2] || 0,
        custom[3] || 0,
        custom[4] || 0,
        custom[5] || 0,
      ];
    });
    this.data.set(chunk, index);
  }
  // mark vbo data as modified
  if (mod) {
    // either partially
    this.dirty.vboStart =
      typeof this.dirty.vboStart === "number"
        ? Math.min(this.dirty.vboStart, start)
        : start;
    this.dirty.vboEnd =
      typeof this.dirty.vboEnd === "number"
        ? Math.max(this.dirty.vboEnd, len)
        : len;
  } else {
    // or completely
    this.dirty.vbo = true;
  }
  this.length = len;
};

Layer.prototype.addSprite = function (sprite) {
  return this.addSprites([sprite]);
};

const attrOrder = ["x", "y", "scalex", "scaley", "rot", "alpha", "u", "v"];

Layer.prototype.patchSprite = function (c, i = 0) {
  let custom = c.custom || [];

  for (let j = 0; j < 6; j++) {
    const index = i * SPRITE_FLOATS + j * 16;
    for (let k = 0; k < 6; k++) {
      if (c[attrOrder[k]] !== undefined) {
        this.data[index + k] = c[attrOrder[k]];
      }
    }
    if (c.u !== undefined) {
      let u = c.u + (vertices[j][2] === "uvright" ? c.w : 0) || 0;
      this.data[index + 6] = u / this.textureWidth;
    }
    if (c.v !== undefined) {
      let v = c.v + (vertices[j][3] === "uvbottom" ? c.h : 0) || 0;
      this.data[index + 7] = 1 - v / this.textureHeight;
    }
    for (let k = 0; k < 6; k++) {
      if (custom[k] !== undefined) {
        this.data[index + 10 + k] = custom[k];
      }
    }
  }

  this.dirty.vboStart =
    typeof this.dirty.vboStart === "number"
      ? Math.min(this.dirty.vboStart, i)
      : i;
  this.dirty.vboEnd =
    typeof this.dirty.vboEnd === "number"
      ? Math.max(this.dirty.vboEnd, i + 1)
      : i + 1;
};

Layer.prototype.compile = function () {
  const gl = this.gl;
  this.vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    vertexShaderSource(
      this.vertexAnimationCode,
      this.customVarying,
      this.customUniformsList
        .map(u => `uniform ${this.customUniforms[u]} ${u};`)
        .join("")
    )
  );
  this.fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource(this.customFragmentShader)
  );
  this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
  this.attribute = gl.getAttribLocation(this.program, "a_all");
  this.uniforms = getUniformLocations(
    gl,
    this.program,
    "u_time",
    "u_texture",
    "u_aspect",
    ...this.customUniformsList
  );

  // mark compilation work as done
  this.dirty.compile = false;
};

Layer.prototype.createvbo = function () {
  this.vertexBuffer = createVertexBuffer(this.gl, this.data);
  this.dirty.vbo = false;
  this.dirty.vboStart = false;
  this.dirty.vboEnd = false;
};

Layer.prototype.createTexture = function () {
  this.texture = createTexture(
    this.gl,
    this.gl.TEXTURE0,
    this.textureWidth,
    this.textureHeight,
    {
      pixels: this.image,
      minFilter: this.textureFilter,
      magFilter: this.textureFilter,
      flip: true,
      premultiply: true,
    }
  );
  this.dirty.texture = false;
};

const uniformTypes = {
  "mediump float": "uniform1f",
  float: "uniform1f",
  vec2: "uniform2f",
};

Layer.prototype.setUniforms = function (uniforms) {
  this.uniformValues = { ...this.uniformValues, ...uniforms };
};

Layer.prototype.setUniformsGL = function (uniforms) {
  for (u in uniforms) {
    // if uniform is not used by the shader
    // skip iteration
    if (!this.uniforms[u]) continue;
    if (!this.customUniformsList.includes(u)) {
      throw new Error(`'${u}' not found in layer's uniforms list`);
    }
    const t = uniformTypes[this.customUniforms[u]];
    if (!this.gl[t]) {
      throw new Error(
        `'${u}' has unrecognized type '${this.customUniforms[u]}'`
      );
    }
    if (Array.isArray(uniforms[u])) {
      this.gl[t](this.uniforms[u], ...uniforms[u]);
    } else {
      this.gl[t](this.uniforms[u], uniforms[u]);
    }
  }
};

Layer.prototype.render = function (time) {
  // send modified properties to gpu
  if (this.dirty.compile) {
    this.compile();
  }
  if (this.dirty.vbo || this.dirty.vboStart || this.dirty.vboEnd) {
    this.createvbo();
  }
  if (this.dirty.texture) {
    this.createTexture();
  }
  const gl = this.gl;
  // bind canvas framebuffer
  // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // select render shader
  gl.useProgram(this.program);
  // pass attriputes
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
  for (let i = 0; i < 4; i++) {
    gl.enableVertexAttribArray(this.attribute + i);
    gl.vertexAttribPointer(this.attribute + i, 4, gl.FLOAT, false, 64, i * 16);
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.uniform1i(this.uniforms.u_texture, 0);
  gl.uniform1f(this.uniforms.u_time, time);

  // pass user uniforms to the shader
  if (this.uniformValues) {
    this.setUniformsGL(this.uniformValues);
  }

  // pass aspect ratio
  if (this.bos && this.bos.aspect) {
    gl.uniform2f(this.uniforms.u_aspect, this.bos.aspect, 1);
  } else {
    gl.uniform2f(this.uniforms.u_aspect, 1, 1);
  }

  // draw the layer on the screen
  gl.drawArrays(gl.TRIANGLES, 0, 6 * this.length);
};
