
module.exports = function (
    app,
    VerifyToken
  ) {    
  const mongoose = require("mongoose");
  let Transaction = require("../models/Transaction.model");
  
  app.get("/api/portfolio/asset-value", VerifyToken, async (req, res) => {
    try {
        let userId = req.userId;
        let userOrders = await Transaction.find({user_id: userId})
            .limit(4)
            .lean()
            .exec();

        if(!userOrders) {
            return res.error('Unable to find user.')
        }

        userOrders.forEach(order => {

        });
        
        const stocks = userOrders.filter(order => {
            return order.asset_category === ('Equity' || 'ETF')
        });

        const crypto = userOrders.filter(order => {
            return order.asset_category === 'Crypto'
        });

        const commodities = userOrders.filter(order => {
            return order.asset_category === 'Commodity'
        });

        stocks.forEach(stockOrder => {

        })
        

        // Response
        // avg_value: $800,
        // name: Stock,
        // 
        // icon_path?: ''


        const response = {
            stocks: stocks,
            crypto: crypto,
            commodity: commodities
        }

        return res.success(response);
    } catch (error) {
        console.log(error)
        res.error("Something went wrong!");        
    }
  });

}