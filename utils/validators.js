exports.validateReqBodyFields = function (fields = []) {
  return function (req, res, next) {
    for (const field of fields) {
      if (!(field in req.body) || typeof req.body[field] === 'undefined')
        return next('Missing required fields in request body');
    }

    next();
  };
};
