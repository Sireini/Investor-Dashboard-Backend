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

                    let latestStockPrice = await AlphavantageController.getLatestStockPrice(order.symbol);
                    let changePercentage = latestStockPrice['Global Quote']['10. change percent'];
                    changePercentage = changePercentage.replace('%', '');

                    stock.total_avg_value += order.price * order.amount;
                    stock.current_total_avg_value += Number(latestStockPrice['Global Quote']['05. price']) * order.amount;
                    stock.total_assets += 1;
                    stock.change_percentage = (stock.current_total_avg_value - stock.total_avg_value) / stock.total_avg_value * 100

                    // stock.current_total_avg_value.toFixed(2);
                    // order.change_percentage = changePercentage;

                    stock.assets.push(order);
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
            let assetData = [];
            let dates = [];

            let userOrders = await Transaction.find({user_id: userId})
                .lean()
                .exec();

            if(!userOrders) {
                return res.error('Unable to find user.')
            }


            for (const order of userOrders) {
                //@TO DO Handle all other assets.

                if(order.asset_category === 'Equity' || order.asset_category === 'ETF') {
                    //@TO DO get current price of the stock user has bought.
                    //@TO DO do not get double stock data.
                    let monthlyPrices = await AlphavantageController.getMonthlyPrices(order.symbol);
                    
                    let total_avg_value = 0;
                    total_avg_value += order.price * order.amount;

                    const filtered = Object.keys(monthlyPrices['Monthly Time Series'])
                        .filter(key => key.startsWith('2020'))
                        .reduce((obj, key) => {
                            obj[key] = monthlyPrices['Monthly Time Series'][key];
                            
                            if(!dates.includes(key)){
                                dates.push(key)
                            }
                            
                            obj[key].current_total_avg_value = 0;
                            obj[key].change_percentage = 0;
                            obj[key].change_value = 0;
                            obj[key].price = 0;
                            obj[key].amount = 0;

                            obj[key].total_avg_value = total_avg_value;
                            obj[key].price = Number(obj[key]['4. close']);
                            obj[key].current_total_avg_value += obj[key].price * order.amount;
                            obj[key].change_percentage = (obj[key].current_total_avg_value - total_avg_value) / total_avg_value * 100;

                            obj[key].change_value = obj[key].current_total_avg_value - total_avg_value;
                            obj[key].amount = order.amount;
                            
                            return obj;
                        }, {});

                    assetData.push({ [order.symbol]: filtered });
                }
            };
    
            let response = [];

            for (let date of dates){
                // Monthly for everything
                let total_avg_value = 0;
                let total_change_value = 0;

                // For all dates
                for (let data of assetData){
                    let companyTicker = (Object.keys(data)[0]);

                    // For all companies
                    if(data[companyTicker] !== undefined){
                        let month = data[companyTicker][date];

                        total_avg_value += parseFloat(month.total_avg_value);
                        total_change_value += parseFloat(month.change_value);
                    }
                }
                
                response.push({
                    month: new Date(date).toLocaleString("en-us", { month  : "long" }), 
                    total_avg_value: total_avg_value, 
                    total_change_value: total_change_value,                    
                    total_change_percentage: (total_change_value / total_avg_value) * 100,
                    total_portfolio_balance: total_avg_value + total_change_value
                });
            }

            return res.success({labels: dates.map(d => new Date(d).toLocaleString("en-us", { month : "long" })).reverse(), value: response.reverse() });
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");        
        }
    });

    
  
    app.get("/api/portfolio/assets/:number", VerifyToken, async (req, res) => {
        try {
            let userId = req.userId;
            let numberOfAssets = Number(req.params.number);

            if(numberOfAssets > 5) {
                return res.error();
            }

            let biggestHoldings = await Transaction.find({user_id: userId})
                .sort({transaction_value: -1})
                .limit(numberOfAssets)
                .lean()
                .exec();

            if(!biggestHoldings) {
                return res.error('Unable to find user.')
            }

            return res.success(biggestHoldings);
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");        
        }
    });

    var calculateWeightedAverage = (data) => {
        let totalWeightedDecimals = 0;
        let totalAmounts = 0;

        data.forEach(asset => {
            if(!asset.change_percentage) {
                return;
            }

            let decimal = asset.change_percentage / 100;
            let weightedDecimal = decimal * asset.amount;

            totalWeightedDecimals += weightedDecimal;
            totalAmounts += asset.amount;
        });

        return totalWeightedDecimals / totalAmounts * 100;
    }

}