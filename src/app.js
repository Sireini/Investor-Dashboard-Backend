const express = require('express')
require('./db/mongoose.connect') // Connect to DB

const VerifyToken = require('./auth/VerifyToken').VerifyToken;
const demoRouter = require('./routers/demo.router');

let userController = require('./controllers/User.controller');
let CoinMarketCapController = require('./controllers/Coinmarketcap.controller');
let AlphavantageController = require('./controllers/Alphavantage.controller');
let YahooFinanceController = require('./controllers/YahooFinance.controller');
let TransactionController = require('./controllers/Transaction.controller');
let PortfolioController = require('./controllers/Portfolio.controller.');

const app = express();


// TO DO DELETE
var cors = require('cors');
app.use(cors());


app.use(express.json())
app.use(demoRouter)

app.use("/*", (req, res, next) => {
    res.error = (err) => {
      return res.status(500).json({
        status: 500,
        data: null,
        message: err,
        accessToken: "",
      });
    };
  
    res.success = (data, accessToken = "", msg = "") => {
      return res.status(200).json({
        status: 200,
        data: data,
        accessToken: accessToken,
        message: msg,
      });
    };
  
    res.unauthorized = () => {
      return res.status(401).send({
        auth: false,
        message:
          "Je sessie is verlopen en bent automatisch uitgelogd. Log opnieuw in.",
        status: 401,
        data: null,
        accessToken: accessToken,
      });
    };
  
    next();
});

userController(app, VerifyToken);
CoinMarketCapController(app, VerifyToken);
AlphavantageController(app, VerifyToken);
YahooFinanceController(app, VerifyToken);
TransactionController(app, VerifyToken);
PortfolioController(app, VerifyToken);

module.exports = app