
const url = require('url');

module.exports = function (app) {
    let apiKey = 'c29aa17f-9dec-4a8f-90a3-f28e6d38d765';
    let testKey = 'b54bcf4d-1bca-4e8e-9a24-22ff2c3d462c';

    /**
   * Get list of cryptocurrencies
   */
  app.get(
    "/api/coinmarketcap/cryptocurrency/listings",
    async (req, res, next) => {
      try {
        const queryParams = url.parse(req.url,true).query;
        let options = {
            method: "GET",
            url:
            // "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
            "https://sandbox-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
            headers: {
                "X-CMC_PRO_API_KEY": testKey,
                "Content-Type": "application/json",
            },
            qs: queryParams
        };

        let cryptoList = await makeRequest(options);

        if(!cryptoList) {
            return res.error('Unable to get cryptocurrency list');
        }

        return res.success(cryptoList);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );
};

var makeRequest = (options) => {
    let request = require("request");
    return new Promise((resolve, reject) => {
      request(options, function (error, response, body) {
        if (!error && body) {
          let bodyRes = JSON.parse(body);
          if (response.statusCode >= 200 && response.statusCode <= 299) {
            resolve(bodyRes);
          } else {
            reject(bodyRes.error || bodyRes.detail);
          }
        } else {
          reject(error);
        }
      });
    });
  };