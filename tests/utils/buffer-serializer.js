module.exports = {
  test: Buffer.isBuffer,
  print(val) {
    return `"Buffer of length ${Buffer.byteLength(val)}"`;
  }
}
