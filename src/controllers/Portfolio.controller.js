const { Console } = require('console');


module.exports = function (
    app,
    VerifyToken
) {
    const moment = require('moment');
    const Transaction = require("../models/Transaction.model");
    const CoinmarketcapController = require('./Coinmarketcap.controller');
    const AlphavantageController = require("./Alphavantage.controller");
    const YahooFinanceController = require("./YahooFinance.controller");
    const FMPController = require("./FinancialModelingPrep.controller");

    app.get("/api/portfolio/asset-allocation", VerifyToken, async (req, res) => {
        try {
            let userId = req.userId;
            let userOrders = await Transaction.find({ user_id: userId })
                .lean()
                .exec();

            if (!userOrders) {
                return res.error('Unable to find user.')
            }

            let assets = [];

            for (const order of userOrders) {
                const index = assets.findIndex(item => item.name === order.asset_category);
                if (index < 0) {
                    assets.push({
                        name: order.asset_category,
                        type: order.asset_category.toLowerCase(),
                        total_assets: 0,
                        change_percentage: 0,
                        total_avg_value: 0,
                        current_total_avg_value: 0,
                        assets: []
                    });
                };

                const indexNew = assets.findIndex(item => item.name === order.asset_category);

                if (indexNew < 0) {
                    console.log('INDEX NEW < 0', indexNew, order.symbol);
                    return
                }

                if (order.asset_category === 'Crypto') {
                    let crypto = assets[indexNew];
                    let latestCryptoPrice = await CoinmarketcapController.getLatestCryptoPrice({ symbol: order.symbol });
                    let quote = latestCryptoPrice.data[order.symbol].quote['USD'];

                    crypto.total_avg_value += order.price * order.amount;
                    crypto.current_total_avg_value += Number(quote.price) * order.amount;
                    crypto.total_assets += 1;
                    crypto.change_percentage = (crypto.current_total_avg_value - crypto.total_avg_value) / crypto.total_avg_value * 100;
                    
                    crypto.icon_url_path = 'Shopping/Bitcoin.svg';
                    crypto.icon_color = 'svg-icon-warning';
                    crypto.symbol_background = 'symbol-light-warning';

                    crypto.assets.push(order);
                } else if (order.asset_category === 'Commodity') {

                    let latestCommodityPrice = await FMPController.getLatestCommodityPrice(order.symbol);
                    let category = assets[indexNew];

                    category.total_avg_value += order.price * order.amount;
                    category.total_avg_value.toFixed(2);

                    category.current_total_avg_value += latestCommodityPrice[0].price * order.amount;
                    category.total_assets += 1;
                    category.change_percentage = (category.current_total_avg_value - category.total_avg_value) / category.total_avg_value * 100

                    category.icon_url_path = 'Design/Sketch.svg';
                    category.icon_color = 'svg-icon-primary';
                    category.symbol_background = 'symbol-light-primary';

                    category.assets.push(order);
                } else {
                    let latestStockPrice = await YahooFinanceController.getLatestStockPrice(order.symbol);
                    let category = assets[indexNew];

                    if (latestStockPrice.Information) {
                        console.log('Exceeding limit', latestStockPrice);
                        // @TO DO res.success or res.error
                        // return;
                    }

                    category.total_avg_value += order.price * order.amount;
                    category.total_avg_value.toFixed(2);

                    category.current_total_avg_value += latestStockPrice.price.regularMarketPrice * order.amount;
                    category.total_assets += 1;
                    category.change_percentage = (category.current_total_avg_value - category.total_avg_value) / category.total_avg_value * 100

                    
                    if(category.name === 'ETF' || category.name === 'Equity') {
                        category.icon_url_path = 'Shopping/Chart-line1.svg';
                        category.icon_color = 'svg-icon-danger';
                        category.symbol_background = 'symbol-light-danger';
                    }

                    if(category.name === 'Currency') {
                        category.icon_url_path = 'Shopping/Dollar.svg';
                        category.icon_color = 'svg-icon-success';
                        category.symbol_background = 'symbol-light-success';
                    }

                    category.assets.push(order);
                }

                // if(order.asset_category === 'real-estate') {
                //     response[3].total_avg_value += order.price * order.amount;
                //     response[3].assets.push(order);
                // }
            }

            assets.sort((a, b) => b.current_total_avg_value - a.current_total_avg_value);

            return res.success(assets);
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

            // if(period === 'year' || period === 'ytd') {
            //     query.transaction_date = await determinePortfolioBalanceQuery(period);
            // }

            let userOrders = await Transaction.find({ user_id: userId })
                .lean()
                .exec();

            if (!userOrders) {
                return res.error('Unable to find user.')
            }
                                        
            const today = moment().startOf('day');
            const $gte = period !== 'ytd' ? moment(today).subtract(1, period + 's') : moment().startOf('year');
            
            for (const order of userOrders) {
                if (order.asset_category === 'Crypto') {
                    const dailyHistoricalPrices = await YahooFinanceController.getHistoricalData(order.symbol + '-USD', $gte.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
                    const dailyPriceObj = await calculateAssetChange(order, dailyHistoricalPrices);
                    //@TO DO Delete duplicate dates = dailyPriceObj.dates;
                    
                    if(!dates.length) {
                        dates = dailyPriceObj.dates
                    }

                    assetData.push({ [order.symbol]: dailyPriceObj.result });
                } else if (order.asset_category === 'Commodity') {
                    const dailyHistoricalPrices = await FMPController.getHistoricalData(order.symbol, $gte.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
                    const dailyPriceObj = await calculateAssetChange(order, dailyHistoricalPrices.historical);
                    //@TO DO Delete duplicate dates = dailyPriceObj.dates;
                    // dates = dailyPriceObj.dates;
                    if(!dates.length) {
                        dates = dailyPriceObj.dates
                    }
                    assetData.push({ [order.symbol]: dailyPriceObj.result });
                } else {
                    const dailyHistoricalPrices = await YahooFinanceController.getHistoricalData(order.symbol, $gte.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
                    const dailyPriceObj = await calculateAssetChange(order, dailyHistoricalPrices);
                    //@TO DO Delete duplicate dates = dailyPriceObj.dates;
                    // dates = dailyPriceObj.dates;
                    if(!dates.length) {
                        dates = dailyPriceObj.dates
                    }
                    assetData.push({ [order.symbol]: dailyPriceObj.result });

                    if(order.asset_category === 'Equity') {
                        // const outputSize = { outputsize: period === 'ytd' ? 'full' : 'compact' };
                        // const dailyPrices = await AlphavantageController.getDailyStockPrices(order.symbol, outputSize);
                        // console.log('dailyPrices', dailyPrices)
                    }
                }
            };

            // console.log('assetData: ', assetData)

            let response = [];

            console.log(assetData['GLD'])

            // console.log('dates',dates)

            for (let date of dates) {
                // Monthly for everything
                let total_avg_value = 0;
                let total_change_value = 0;

                // For all dates
                for (let data of assetData) {
                    let companyTicker = (Object.keys(data)[0]);
                    // console.log('companyTicker', data[companyTicker][date], date);

                    // For all companies
                    if (data[companyTicker] !== undefined) {
                        let date = data[companyTicker][date];
                        if(date) {
                            // console.log('date', date);
                            total_avg_value += parseFloat(date.total_avg_value);
                            total_change_value += parseFloat(date.change_value);
                        }
                    }
                }

                response.push({
                    date: new Date(date).toLocaleString("en-us", { year: 'numeric', month: 'short', day: "2-digit" }),
                    total_avg_value: total_avg_value,
                    total_change_value: total_change_value,
                    total_change_percentage: (total_change_value / total_avg_value) * 100,
                    total_portfolio_balance: total_avg_value + total_change_value
                });
            }

            return res.success({ labels: dates.map(d => new Date(d).toLocaleString("en-us", { year: 'numeric', month: 'short', day: "2-digit" })).reverse(), value: response.reverse() });
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");
        }
    });

    app.get("/api/portfolio/assets/:number", VerifyToken, async (req, res) => {
        try {
            let userId = req.userId;
            let numberOfAssets = Number(req.params.number);

            if (numberOfAssets > 5) {
                return res.error();
            }

            let biggestHoldings = await Transaction.find({ user_id: userId })
                .sort({ transaction_value: -1 })
                .limit(numberOfAssets)
                .lean()
                .exec();

            if (!biggestHoldings) {
                return res.error('Unable to find user.')
            }

            return res.success(biggestHoldings);
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");
        }
    });

    var calculateAssetChange = async (order, asset) => {
        let dates = [];
        let result = {};
        let total_avg_value = 0;
        total_avg_value += order.price * order.amount;

        asset.forEach(dayPrice => {
            dayPrice.current_total_avg_value = 0;
            dayPrice.change_percentage = 0;
            dayPrice.change_value = 0;

            dayPrice.total_avg_value = total_avg_value;
            dayPrice.price = Number(dayPrice['adjClose']);
            
            dayPrice.current_total_avg_value += dayPrice.price * order.amount;
            dayPrice.change_percentage = (dayPrice.current_total_avg_value - total_avg_value) / total_avg_value * 100;

            dayPrice.change_value = dayPrice.current_total_avg_value - total_avg_value;
            dayPrice.amount = order.amount;

            let date = new Date(dayPrice.date);
            let year = date.getFullYear();
            let month = date.getMonth() + 1 ;
            let dt = date.getDate();

            if (dt < 10) {
                dt = '0' + dt;
            }
            
            if (month < 10) {
                month = '0' + month;
            }

            date = year + '-' + month + '-' + dt;
            if(!dates.includes(date)) {
                dates.push(date);
            }
            return result[date] = dayPrice;
        });
        
        let resultObj = {
            result,
            dates
        }

        return resultObj;
    }

    var determinePortfolioBalanceQuery = async (period) => {
        const today = moment().startOf('day');

        switch (period) {
            // case 'week':
            //     return  { "$gte": moment(today).subtract(1, 'weeks').toDate(), "$lte": today.toDate()};
            // case 'month':
            //     return  { "$gte": moment(today).subtract(1, 'months').toDate(), "$lte": today.toDate() };
            // case 'month':
            //     return  { "$gte": today.toDate(), "$lt": moment(today).add(7, 'days').toDate() };
            case 'year':
                return { "$gte": moment(today).subtract(1, 'years').toDate(), "$lte": today.toDate() };
            case 'ytd':
                return { "$gte": moment().startOf('year').toDate(), "$lte": today.toDate() };
        }
    }

    var calculateWeightedAverage = (data) => {
        let totalWeightedDecimals = 0;
        let totalAmounts = 0;

        data.forEach(asset => {
            if (!asset.change_percentage) {
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