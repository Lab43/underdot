const chalk = require('chalk');



exports.log = (...messages) => {
  console.log(chalk.green(...messages));
}

exports.error = (err, ...messages) => {
  if (messages) console.log(chalk.red(...messages));
  console.error(err);
  process.exit();
}
