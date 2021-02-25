exports.log = (...messages) => {
  console.log(...messages);
}

exports.error = (err, message) => {
  if (message) {
    console.log(message);
  }
  console.log(err);
  process.exit();
}
