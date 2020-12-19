
const fmp = require('financialmodelingprep')('03a2b4a07b8cb16ff29484f6822a6820')

module.exports = function (app, VerifyToken) {
  let apiKey = '03a2b4a07b8cb16ff29484f6822a6820';

    /**
   * @Get list of cryptocurrencies
   */
  app.get(
    "/api/fmp/search/:searchTerm",
    VerifyToken,
    async (req, res, next) => {
      try {
        const searchTerm = req.params.searchTerm;

        // let searchResult = await fmp.search(searchTerm, limit = 10);
        
        let options = {
            method: "GET",
            url:`https://financialmodelingprep.com/api/v3/search?query=${searchTerm}&limit=10&exchange=COMMODITY&apikey=${apiKey}`,
            headers: {
                "Content-Type": "application/json",
            },
        };

        let searchResult = await makeRequest(options);

        if(!searchResult) {
            return res.error('Unable to get cryptocurrency list');
        }
        console.log(searchResult)
        return res.success(searchResult);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );
};
 
module.exports.getLatestCommodityPrice = async (ticker) => {
  if (!ticker) {
    return null;
  }

  return await fmp.commodities.quote(ticker)
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

  return await fmp.commodities.history(ticker, {startDate, endDate})
    .then((res) => res)
    .catch((err) => {
        // Handle the error
        console.log(err);
        return res.error(e);
    });
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