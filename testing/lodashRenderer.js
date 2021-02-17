const _ = require('lodash');



module.exports = (template, metadata, templateHelpers) => {
  return _.template(template)({...metadata, ...templateHelpers});
}
