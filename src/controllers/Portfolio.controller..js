
module.exports = function (
    app,
    VerifyToken
  ) {    
  const mongoose = require("mongoose");
  let Transaction = require("../models/Transaction.model");
  
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
            { name: 'Stocks', type: 'stocks', icon_url_path: 'Shopping/Chart-line1.svg', total_avg_value: 0, assets: [] },
            { name: 'Crypto', type: 'crypto', icon_url_path: 'Shopping/Bitcoin.svg', total_avg_value: 0, assets: [] },
            { name: 'Commodities', type: 'commodities', icon_url_path: 'Design/Sketch.svg', total_avg_value: 0, assets: [] },
            { name: 'Real Estate', type: 'real-estate', icon_url_path: 'Home/Building.svg', total_avg_value: 0, assets: [] }
        ]

        //@TO DO Create dynamic categories only combine ETF & Equity
        userOrders.forEach(order => {
            if(order.asset_category === 'ETF' || order.asset_category === 'Equity') {
                response[0].total_avg_value += order.price * order.amount;
                if(response[0].assets.length < 4) {
                    response[0].assets.push(order);
                }
            }

            if(order.asset_category === 'Crypto') {
                response[1].total_avg_value += order.price * order.amount;
                if(response[1].assets.length < 4) {
                    response[1].assets.push(order);
                }
            }

            if(order.asset_category === 'Commodity') {
                response[2].total_avg_value += order.price * order.amount;
                if(response[2].assets.length < 4) {
                    response[2].assets.push(order);
                }
            }

            if(order.asset_category === 'real-estate') {
                response[3].total_avg_value += order.price * order.amount;
                if(response[3].assets.length < 4) {
                    response[3].assets.push(order);
                }
            }
        });

        response.sort((a, b) => b.total_avg_value - a.total_avg_value);

        return res.success(response);
    } catch (error) {
        console.log(error)
        res.error("Something went wrong!");        
    }
  });

}