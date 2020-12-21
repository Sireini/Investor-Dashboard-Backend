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

            for (const order of userOrders) {
                //@TO DO Handle all other assets.

                if (order.asset_category === 'Crypto') {
                    //@TO DO Add period filter
                    //@TO DO startDate & endDate
                    let dailyHistoricalPrices = await YahooFinanceController.getHistoricalData(order.symbol + '-USD', '2020-01-01', '2020-12-31');

                    let total_avg_value = 0;
                    total_avg_value += order.price * order.amount;

                    const today = moment().startOf('day');
                    const $gte = period !== 'ytd' ? moment(today).subtract(1, period + 's') : moment().startOf('year');
                    
                    let dailyPriceObj = {};

                    //@TO DO REDUCE DUPLICATED CODE
                    dailyHistoricalPrices.forEach(dayPrice => {
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
                        return dailyPriceObj[date] = dayPrice;
                    });

                    assetData.push({ [order.symbol]: dailyPriceObj });

                } else if (order.asset_category === 'Commodity') {
                    //@TO DO Add period filter
                    let dailyHistoricalPrices = await FMPController.getHistoricalData(order.symbol, '2020-01-01', '2020-12-31');
                    
                    // let total_avg_value = 0;
                    // total_avg_value += order.price * order.amount;
                    
                    const today = moment().startOf('day');
                    const $gte = period !== 'ytd' ? moment(today).subtract(1, period + 's') : moment().startOf('year');
                    
                    //@TO DO REDUCE DUPLICATED CODE
                    const dailyPriceObj = await calculateAssetChange(order, dailyHistoricalPrices.historical);
                    console.log('dailyPriceObj', dailyPriceObj)

                    // dailyHistoricalPrices.historical.forEach(dayPrice => {
                    //     dayPrice.current_total_avg_value = 0;
                    //     dayPrice.change_percentage = 0;
                    //     dayPrice.change_value = 0;

                    //     dayPrice.total_avg_value = total_avg_value;
                    //     dayPrice.price = Number(dayPrice['adjClose']);
                        
                    //     dayPrice.current_total_avg_value += dayPrice.price * order.amount;
                    //     dayPrice.change_percentage = (dayPrice.current_total_avg_value - total_avg_value) / total_avg_value * 100;

                    //     dayPrice.change_value = dayPrice.current_total_avg_value - total_avg_value;
                    //     dayPrice.amount = order.amount;

                    //     let date = new Date(dayPrice.date);
                    //     let year = date.getFullYear();
                    //     let month = date.getMonth() + 1 ;
                    //     let dt = date.getDate();

                    //     if (dt < 10) {
                    //         dt = '0' + dt;
                    //     }
                        
                    //     if (month < 10) {
                    //         month = '0' + month;
                    //     }

                    //     date = year + '-' + month + '-' + dt;
                    //     return dailyPriceObj[date] = dayPrice;
                    // });
                    assetData.push({ [order.symbol]: dailyPriceObj });

                } else if (order.asset_category === 'Equity' || order.asset_category === 'ETF') {
                    //@TO DO get current price of the stock user has bought.
                    //@TO DO do not get double stock data.
                    let outputSize = { outputsize: period === 'ytd' ? 'full' : 'compact' };
                    let dailyPrices = await AlphavantageController.getDailyStockPrices(order.symbol, outputSize);

                    if (!dailyPrices['Time Series (Daily)']) {
                        return;
                    }

                    let total_avg_value = 0;
                    total_avg_value += order.price * order.amount;

                    const today = moment().startOf('day');
                    const $gte = period !== 'ytd' ? moment(today).subtract(1, period + 's') : moment().startOf('year');

                    const filtered = Object.keys(dailyPrices['Time Series (Daily)'])
                        // .filter(key => key >= moment(query.transaction_date['$gte']).format('YYYY-MM-DD') && key <= moment(query.transaction_date['$lte']).format('YYYY-MM-DD'))
                        .filter(key => key >= $gte.format('YYYY-MM-DD') && key <= today.format('YYYY-MM-DD'))
                        .reduce((obj, key) => {
                            obj[key] = dailyPrices['Time Series (Daily)'][key];

                            if (!dates.includes(key)) {
                                dates.push(key);
                            }

                            obj[key].total_avg_value = 0;
                            obj[key].current_total_avg_value = 0;
                            obj[key].change_percentage = 0;
                            obj[key].change_value = 0;
                            obj[key].price = 0;
                            obj[key].amount = 0;

                            if (key >= moment(order.transaction_date).format('YYYY-MM-DD')) {
                                obj[key].total_avg_value = total_avg_value;
                                obj[key].price = Number(obj[key]['4. close']);
                                obj[key].current_total_avg_value += obj[key].price * order.amount;
                                obj[key].change_percentage = (obj[key].current_total_avg_value - total_avg_value) / total_avg_value * 100;

                                obj[key].change_value = obj[key].current_total_avg_value - total_avg_value;
                                obj[key].amount = order.amount;
                            }

                            return obj;
                        }, {});

                    assetData.push({ [order.symbol]: filtered });
                }
            };

            let response = [];

            for (let date of dates) {
                // Monthly for everything
                let total_avg_value = 0;
                let total_change_value = 0;

                // For all dates
                for (let data of assetData) {
                    let companyTicker = (Object.keys(data)[0]);

                    // For all companies
                    if (data[companyTicker] !== undefined) {
                        let month = data[companyTicker][date];
                        total_avg_value += parseFloat(month.total_avg_value);
                        total_change_value += parseFloat(month.change_value);
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
        console.log('calculateAssetChange', order, asset)
        let dailyPriceObj = {};
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
            return dailyPriceObj[date] = dayPrice;
        });

        return dailyPriceObj;
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