
const url = require('url');
const yahooFinance = require('yahoo-finance');

module.exports = function (app, VerifyToken) {
    let apiKey = 'c29aa17f-9dec-4a8f-90a3-f28e6d38d765';
    let testKey = 'b54bcf4d-1bca-4e8e-9a24-22ff2c3d462c';

    /**
   * @Get list of cryptocurrencies
   */
  app.get(
    "/api/yahoofinance/search/:searchTerm",
    VerifyToken,
    async (req, res, next) => {
      try {
        const searchTerm = req.params.searchTerm
        let options = {
            method: "GET",
            url:
            "https://finance.yahoo.com/_finance_doubledown/api/resource/searchassist;searchTerm=" + searchTerm,
            headers: {
                "Content-Type": "application/json",
            },
        };

        let searchResult = await makeRequest(options);

        if(!searchResult) {
            return res.error('Unable to get cryptocurrency list');
        }

        return res.success(searchResult);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );
};
 
module.exports.getLatestStockPrice = async (ticker) => {
  if (!ticker) {
    return null;
  }

  return await yahooFinance.quote({symbol: ticker, modules: ['price']})
    .then((res) => res)
    .catch((err) => {
        // Handle the error
        console.log(err);
        return res.error(e);
    });
};

module.exports.getHistoricalData = async (ticker, startDate, endDate) => {
  if (!ticker || !startDate || !endDate) {
    return null;
  }

  return await yahooFinance.historical({symbol: ticker, from: startDate, to: endDate})
    .then((res) => res)
    .catch((err) => {
        // Handle the error
        console.log(err);
        return res.error(e);
    });
}

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