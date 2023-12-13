//const robot = require("robotjs");
const { keyboard, Key } = require("@nut-tree/nut-js");

module.exports = {
  press: key => keyboard.pressKey(Key[key]),
  release: key => keyboard.releaseKey(Key[key]),
};
