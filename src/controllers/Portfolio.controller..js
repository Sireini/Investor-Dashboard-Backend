const CoinmarketcapController = require('./Coinmarketcap.controller');

module.exports = function (
    app,
    VerifyToken
  ) {    
    const mongoose = require("mongoose");
    const Transaction = require("../models/Transaction.model");
    const AlphavantageController = require("./Alphavantage.controller");

    app.get("/api/portfolio/asset-allocation", VerifyToken, async (req, res) => {
        try {
            let userId = req.userId;
            let userOrders = await Transaction.find({user_id: userId})
                .lean()
                .exec();

            if(!userOrders) {
                return res.error('Unable to find user.')
            }

            // Check if this is the correct way to set static categories..
            let response = [
                { name: 'Stocks', type: 'stocks', icon_url_path: 'Shopping/Chart-line1.svg', total_assets: 0, change_percentage: 0, total_avg_value: 0, current_total_avg_value: 0, assets: [] },
                { name: 'Crypto', type: 'crypto', icon_url_path: 'Shopping/Bitcoin.svg', total_assets: 0, change_percentage: 0, total_avg_value: 0, current_total_avg_value: 0, assets: [] },
                { name: 'Commodities', type: 'commodities', icon_url_path: 'Design/Sketch.svg', total_assets: 0, change_percentage: 0, total_avg_value: 0, current_total_avg_value: 0, assets: [] },
                { name: 'Real Estate', type: 'real-estate', icon_url_path: 'Home/Building.svg', total_assets: 0, change_percentage: 0, total_avg_value: 0, current_total_avg_value: 0, assets: [] }
            ]

            //@TO DO Create dynamic categories only combine ETF & Equity
            
            for (const order of userOrders) {
                if(order.asset_category === 'ETF' || order.asset_category === 'Equity') {
                    let stock = response[0];

                    // let latestStockPrice = await AlphavantageController.getLatestStockPrice(order.symbol);
                    // let changePercentage = latestStockPrice['Global Quote']['10. change percent'];
                    // changePercentage = changePercentage.replace('%', '');

                    // stock.total_avg_value += order.price * order.amount;
                    // stock.current_total_avg_value += Number(latestStockPrice['Global Quote']['05. price']) * order.amount;
                    // stock.total_assets += 1;
                    // stock.change_percentage = (stock.current_total_avg_value - stock.total_avg_value) / stock.total_avg_value * 100

                    // // stock.current_total_avg_value.toFixed(2);
                    // // order.change_percentage = changePercentage;

                    // stock.assets.push(order);
                }

                if(order.asset_category === 'Crypto') {
                    let crypto = response[1]
                    let latestCryptoPrice = await CoinmarketcapController.getLatestCryptoPrice({ symbol: order.symbol });
                    let quote = latestCryptoPrice.data[order.symbol].quote['USD'];

                    crypto.total_avg_value += order.price * order.amount;                    
                    crypto.current_total_avg_value += Number(quote.price) * order.amount;
                    crypto.total_assets += 1;
                    crypto.change_percentage = (crypto.current_total_avg_value - crypto.total_avg_value) / crypto.total_avg_value * 100
                    crypto.assets.push(order);
                }

                if(order.asset_category === 'Commodity') {             

                    // @TO DO Search for good api for commodities
                    // 1. https://www.goldapi.io/api/XAU/USD/20201021
                    // 2. http://www.quandl.com/api/v3/datasets/LBMA/GOLD/data.json?start_date=2020-10-20&end_date=2020-10-21&api_key=yVQuad2-hSXdEpfrxXz4
                    // 3. 
                    // let latestStockPrice = await AlphavantageController.getLatestStockPrice(order.symbol);

                    response[2].total_avg_value += order.price * order.amount;
                    // response[2].current_total_avg_value += Number(latestStockPrice['Global Quote']['05. price']) * order.amount;

                    if(response[2].assets.length < 4) {
                        response[2].assets.push(order);
                    }
                }

                if(order.asset_category === 'real-estate') {
                    response[3].total_avg_value += order.price * order.amount;
                    response[3].assets.push(order);
                }
            }

            // for (const assetCategory of response) {
            //     assetCategory.change_percentage = await calculateWeightedAverage(assetCategory.assets);
            // }

            response.sort((a, b) => b.current_total_avg_value - a.current_total_avg_value);

            return res.success(response);
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");        
        }
    });

  
    app.get("/api/portfolio/balance/:period", VerifyToken, async (req, res) => {
        try {
            const period = req.params.period;
            let userId = req.userId;
            let userOrders = await Transaction.find({user_id: userId})
                .lean()
                .exec();

            if(!userOrders) {
                return res.error('Unable to find user.')
            }

            let response = [];

            let asset = {
                total_avg_value: 0,
                current_total_avg_value: 0,
                change_percentage: 0
            };

            let monthlyLabes = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];

            for (const order of userOrders) {
                //@TO DO Handle all other assets.

                if(order.asset_category === 'Equity' || order.asset_category === 'ETF') {
                    //@TO DO get current price of the stock user has bought.
                    //@TO DO do not get double stock data.
                    let monthlyPrices = await AlphavantageController.getMonthlyPrices(order.symbol);
                    
                    asset.total_avg_value += order.price * order.amount;

                    const filtered = Object.keys(monthlyPrices['Monthly Time Series'])
                        .filter(key => key.startsWith('2020'))
                        .reduce((obj, key) => {
                            obj[key] = monthlyPrices['Monthly Time Series'][key];
                            obj[key].current_total_avg_value = 0;
                            obj[key].change_percentage = 0;
                            obj[key].change_value = 0;
                            obj[key].price = 0;

                            obj[key].total_avg_value = asset.total_avg_value;
                            obj[key].current_total_avg_value += Number(obj[key]['4. close']) * order.amount;
                            obj[key].change_percentage = (obj[key].current_total_avg_value - asset.total_avg_value) / asset.total_avg_value * 100;

                            obj[key].change_value = obj[key].current_total_avg_value - asset.total_avg_value;
                            obj[key].price = Number(obj[key]['4. close']);
                            
                            return obj;
                        }, {});


                    // asset.current_total_avg_value += Number(monthlyPrices['Monthly Time Series']['2020-09-30']['4. close']) * order.amount;
                    // asset.change_percentage = (asset.current_total_avg_value - asset.total_avg_value) / asset.total_avg_value * 100;

                    // console.log(monthlyPrices);
                    response.push({ [order.symbol]: filtered});

                    response.forEach(asset => {
                        console.log('Order symbol', order.symbol,  asset[order.symbol])
                    })
                    // console.log('asset', order, asset)

                    // TO DO 
                    // 1. Compare buy price with current market price.
                    // 2. Add filters: Daily, Weekly, Monthly

                    // Portfolio balance = All transactions plus or minus differentiation current price.

                    // Monthly labels: [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sept, Oct, Nov, Dec]
                    // Monthly data: [0, 0, 1000, 1100, etc..]

                    // How do we get monthly data?
                    // For each transaction/asset we have to get monthly average prices
                    // Than we compare our buy price with the monthly averages
                    // We add up the amount and divide it by the number of stocks


                }
            };


            // console.log(userOrders);

            return res.success(response);
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");        
        }
    });

    var calculateWeightedAverage = (assets) => {
        console.log('assets', assets);
        let totalWeightedDecimals = 0;
        let totalAmounts = 0;

        assets.forEach(asset => {
            if(!asset.change_percentage) {
                return;
            }

            let decimal = asset.change_percentage / 100;
            let weightedDecimal = decimal * asset.amount;
            console.log('weightedDecimal', decimal, asset.amount, weightedDecimal);

            totalWeightedDecimals += weightedDecimal;
            console.log('totalWeightedDecimals', totalWeightedDecimals);

            totalAmounts += asset.amount;
        });

        console.log(totalWeightedDecimals, totalAmounts);
        return totalWeightedDecimals / totalAmounts * 100;
        // 1) GLD amount: 2 - (0.0505%)
        // 2) MSFT amount: 11 - (-2.4766%)
        // 3) AAPL amount: 11 - (-2.5542%)

        // 2. 0.000505 * 2 = 0.00101
        //    -0.024766 * 11 = -0.272426
        //    -0.025542 * 11 = -0.280962

        // 3. 0.00101 + -0.272426 + -0.280962 = -0.552378
        // 4. 2 + 11 + 11 = 24
        // 5. -0.552378 / 24 = -0.02301575 * 100 = -2.301575 %

    }

}