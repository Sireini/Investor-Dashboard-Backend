
let Alpha = require('alpha_vantage_api_wrapper').Alpha
let alpha = new Alpha('XO4GDQ81IPZZIG4Y');

module.exports = function (app, VerifyToken) {
    /**
   * @Get result of stocks according to keyword(name, ticker)
   */
  app.get(
    "/api/alphavantage/stock-market/search/:keyword",
    VerifyToken,
    async (req, res, next) => {
      try {
        const keyword = req.params.keyword;
        let searchResult = await alpha.stocks.search(keyword, {"datatype" : 'json'})
            .then((res) => { return res})
            .catch((err) => {
                // Handle the error
                console.log(err);
                return res.error(e);
            });
        return res.success(searchResult);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );

  
  /**
   * @Get Daily prices of stock according to keyword(name, ticker)
   */
  app.get(
    "/api/alphavantage/stock-market/daily-prices/:ticker",
    VerifyToken,
    async (req, res, next) => {
      try {
        const ticker = req.params.ticker;
        let getStockInfo = await alpha.stocks.daily(ticker, {"datatype" : 'json'})
          .then((res) => res)
          .catch((err) => {
              // Handle the error
              console.log(err);
              return res.error(e);
          });
        return res.success(getStockInfo);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );

  
  /**
   * @Get Weekly prices of stock according to keyword(name, ticker)
   */
  app.get(
    "/api/alphavantage/stock-market/weekly-prices/:ticker",
    VerifyToken,
    async (req, res, next) => {
      try {
        const ticker = req.params.ticker;
        let getStockInfo = await alpha.stocks.weekly(ticker, {"datatype" : 'json'})
          .then((res) => res)
          .catch((err) => {
              // Handle the error
              console.log(err);
              return res.error(e);
          });
        return res.success(getStockInfo);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );
  
  /**
   * @Get Monthly prices of stock according to keyword(name, ticker)
   */
  app.get(
    "/api/alphavantage/stock-market/monthly-prices/:ticker",
    VerifyToken,
    async (req, res, next) => {
      try {
        const ticker = req.params.ticker;
        let getStockInfo = await alpha.stocks.monthly(ticker, {"datatype" : 'json'})
          .then((res) => res)
          .catch((err) => {
              // Handle the error
              console.log(err);
              return res.error(e);
          });
        return res.success(getStockInfo);
      } catch (e) {
        console.error(e);
        return res.error(e);
      }
    }
  );

  
  module.exports.getMonthlyPrices = async (ticker) => {
    if (!ticker) {
      return null;
    }

    return await alpha.stocks.monthly(ticker, {"datatype" : 'json'})
      .then((res) => res)
      .catch((err) => {
          // Handle the error
          console.log(err);
          return res.error(e);
      });
  };

  
  module.exports.getLatestStockPrice = async (ticker) => {
    if (!ticker) {
      return null;
    }

    return await alpha.stocks.quote(ticker, {"datatype" : 'json'})
      .then((res) => res)
      .catch((err) => {
          // Handle the error
          console.log(err);
          return res.error(e);
      });
  };

};