// client.js
const socket = io(window.location.origin);

// document.getElementById("keyButton").addEventListener("touchstart", () => {
//   const key = "A"; // Replace with the desired key or implement a key selection mechanism
//   socket.emit("keydown", key);
// });

// document.getElementById("keyButton").addEventListener("touchend", () => {
//   const key = "A"; // Replace with the desired key or implement a key selection mechanism
//   socket.emit("keyup", key);
// });

const objects = [];

window.onload = function () {
  // resize canvas to full screen
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // get gl context
  var gl = canvas.getContext("webgl2");

  // initialize bos
  var bos = new Bos(gl, canvas.width, canvas.height);

  // create layer config
  const config = {
    image: spritesheet,
    textureFilter: gl.NEAREST,
    vertexAnimationCode: ``,
    customVarying: ``,
    customUniforms: {},
    customFragmentShader: ``,
  };

  // setup layer
  bos.addLayer(config);

  Promise.all([
    fetch("spritesheet.json").then(res => res.json()),
    fetch("keyboard.json").then(res => res.json()),
  ]).then(data => {
    const sprites = data[0].frames;
    const keys = data[1];
    const s = 0.28;
    const _s = 0.2725;
    const top = 0.7;
    const addRow = (row, x, y, prefix = "") =>
      row.split("").forEach((k, i) => {
        keys.push({
          x: x + i * _s,
          y,
          scale: s,
          key: `${prefix}${k}`,
          sprite: `${k}.png`,
        });
      });
    addRow("1234567890", -1.3, top, "F");
    addRow("1234567890", -1.4, top - s, "Num");
    addRow("QWERTYUIOP", -1.3, top - s * 2);
    addRow("ASDFGHJKL", -1.2, top - s * 3);
    addRow("ZXCVBNM", -1.1, top - s * 4);

    for (let k of keys) {
      console.log(keys, k, sprites[k.sprite]);
      // add a sprite
      const u = sprites[k.sprite].frame.x;
      const v = sprites[k.sprite].frame.y;
      const w = sprites[k.sprite].frame.w / 3;
      const h = sprites[k.sprite].frame.h;

      objects.push({
        x: k.x,
        y: k.y,
        scaley: k.scale,
        scalex: (k.scale * w) / h,
        key: k.key,
        sprite: bos.layers[0].length,
        u,
        v,
        w,
        h,
      });
      bos.layers[0].addSprite(objects.at(-1));
    }
    // console.log(sprites, keys);
  });

  // render loop
  function render(time) {
    window.requestAnimationFrame(render);

    bos.render(time / 1000);
  }
  render();

  // update width and height on resize
  window.addEventListener("resize", function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    bos.resize(canvas.width, canvas.height);
  });
  let prevTouches = [];
  const update = touches => {
    for (let o of objects) {
      // console.log(y, o.y - o.scaley / 2, o.y + o.scaley / 2);
      for (let point of touches) {
        const x = bos.canvasXtoGl(point.clientX);
        const y = bos.canvasYtoGl(point.clientY);

        if (
          x >= o.x - o.scalex / 2 &&
          x <= o.x + o.scalex / 2 &&
          y >= o.y - o.scaley / 2 &&
          y <= o.y + o.scaley / 2
        ) {
          if (!o.down) {
            o.down = true;
            o.u += o.w;
            bos.layers[0].patchSprite(o, o.sprite);
            if (o.key === "fullscreen") {
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
              }
            } else {
              socket.emit("keydown", o.key);
            }
          }
        }
      }
      for (let point of prevTouches) {
        if (![].find.call(touches, f => point.identifier === f.identifier)) {
          if (o.down) {
            o.down = false;
            o.u -= o.w;
            bos.layers[0].patchSprite(o, o.sprite);
            socket.emit("keyup", o.key);
          }
        }
      }
    }
    prevTouches = [...touches];
  };
  window.addEventListener("touchstart", e => {
    update(e.touches);
  });
  window.addEventListener("touchstart", e => {
    update(e.touches);
  });
  window.addEventListener("touchend", e => {
    update(e.touches);
  });
};
