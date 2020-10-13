const express = require('express')
require('./db/mongoose.connect') // Connect to DB

const demoRouter = require('./routers/demo.router');
let CoinMarketCapController = require('./controllers/Coinmarketcap.controller');

const app = express();

// TO DO DELETE
var cors = require('cors')
app.use(cors());


app.use(express.json())
app.use(demoRouter)

app.use("/*", (req, res, next) => {
    res.error = (err) => {
      return res.status(500).json({
        status: 500,
        data: null,
        message: err,
        token: "",
      });
    };
  
    res.success = (data, msg = "") => {
      return res.status(200).json({
        status: 200,
        data: data,
        token: "",
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
        token: token,
      });
    };
  
    next();
  });

CoinMarketCapController(app);

module.exports = app