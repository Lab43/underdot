const files = [];

exports.add = (source, file) => {
  files.push(file);
}

exports.processAll = () => {
  console.log('process all these files:', files);
}
