const log = require("../logger");

const validateRequest = (schema) => async (req, res, next) => {
  try {
    await schema.validate({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    return next();
  } catch (error) {
    log.error(error.message);
    res.json({ type: error.name, message: error.message });
  }
};

module.exports = validateRequest;
