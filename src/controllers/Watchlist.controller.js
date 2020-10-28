module.exports = function (
    app,
    VerifyToken
  ) {    
    const Watchlist = require('../models/Watchlist.model');
    const mongoose = require("mongoose");

    app.post("/api/watchlist", VerifyToken, async (req, res) => {
        try {
            let userId = req.userId;
            let newWatchAsset = new Watchlist({
                _id: new mongoose.Types.ObjectId(),
                user_id: userId,
                name: req.body.name,
                symbol: req.body.symbol,
                asset_category: req.body.asset_category,
                exchange: req.body.exchange,
                created_date: new Date(),
                modified_date: new Date(),
            })

            let watchAssetSaved = await newWatchAsset.save();

            if (!watchAssetSaved) {
                return res.error("Something went wrong while creating a new user.");
            }

            return res.success(watchAssetSaved);
        } catch (e) {
            console.error(e);
            return res.error("Something went wrong!");
        }
    });
    
    app.get("/api/watchlist", VerifyToken, async (req, res) => {
        try {
            let userId = req.userId;
            let watchList = await Watchlist.find({user_id: userId}).lean().exec();

            if(!watchList) {
                return res.error('Unable to find watchlist for this user.')
            }

            return res.success(watchList);
        } catch (error) {
            console.log(error)
            res.error("Something went wrong!");        
        }
    });
}