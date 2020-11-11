var jwt = require("jsonwebtoken");
var config = require("../../config");

module.exports.VerifyToken = (req, res, next) => {
  var accessToken = req.headers["x-access-token"];

  if (!accessToken) {
    return res.status(403).send({
      auth: false,
      message: "No token provided.",
      status: 403,
      data: null,
      accessToken: accessToken,
    });
  }

  module.exports.decodeToken(accessToken).then(
    (decoded) => {
      req.userId = decoded.id;
      return next();
    },
    (err) => {
      return res.status(401).send({
        auth: false,
        message: "You are not authorized for this action.",
        status: 401,
        data: null,
        accessToken: accessToken,
      });
    }
  );
};

module.exports.decodeToken = (accessToken) => {
  return new Promise((resolve, reject) => {
    jwt.verify(accessToken, config.secret, (err, decoded) => {
      if (err || !decoded.id) {
        reject();
      } else {
        resolve(decoded);
      }
    });
  });
};
