const minimatch = require('minimatch');




module.exports = (path, rule) => {

  // if no rule is provided, process all files
  if (!rule) return true;

  // treat the rule as a glob expression
  return minimatch(path, rule, {dot: true})

}
