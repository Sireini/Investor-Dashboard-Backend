const express = require('express')
require('./db/mongoose.connect') // Connect to DB

const bodyParser = require("body-parser");

const portfolioRouter = require('./routers/portfolio.router');
const VerifyToken = require('./auth/VerifyToken').VerifyToken;

const UserController = require('./controllers/User.controller');
const CoinMarketCapController = require('./controllers/Coinmarketcap.controller');
const AlphavantageController = require('./controllers/Alphavantage.controller');
const YahooFinanceController = require('./controllers/YahooFinance.controller');
const FinancialModelingPrep = require('./controllers/FinancialModelingPrep.controller');
const TransactionController = require('./controllers/Transaction.controller');
const PortfolioController = require('./controllers/Portfolio.controller');
const WatchlistController = require('./controllers/Watchlist.controller');
const MollieController = require('./controllers/Mollie.controller');

const app = express();

const cors = require('cors');
app.use(cors());


// create application/json parser
var jsonParser = bodyParser.json({ limit: "50mb", extended: true });

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ limit: "50mb", extended: true });

app.use(jsonParser);
app.use(urlencodedParser);

app.use(express.json())
app.use(portfolioRouter)

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

UserController(app, VerifyToken);
CoinMarketCapController(app, VerifyToken);
AlphavantageController(app, VerifyToken);
YahooFinanceController(app, VerifyToken);
FinancialModelingPrep(app, VerifyToken);
TransactionController(app, VerifyToken);
PortfolioController(app, VerifyToken);
WatchlistController(app, VerifyToken);
MollieController(app, VerifyToken);

module.exports = app