
module.exports = function (
    app,
    VerifyToken
  ) {    
  const mongoose = require("mongoose");
  let Transaction = require("../models/Transaction.model");

  app.post("/api/transaction", VerifyToken, async (req, res) => {
    try {
        let newTransaction = new Transaction({
            _id: new mongoose.Types.ObjectId(),
            user_id: req.userId,
            name: req.body.name,
            asset_category: req.body.asset_category,
            symbol: req.body.symbol,
            price: req.body.price,
            amount: req.body.amount,
            transaction_value: req.body.price * req.body.amount,
            transaction_type: req.body.transaction_type,
            transaction_date: req.body.transaction_date,
            created_date: new Date(),
            modified_date: new Date(),
        })

        if(newTransaction.asset_category === 'Commodity') {
            newTransaction.tradingview_symbol = await tradingviewSymbol(newTransaction.symbol);
        }

        let transactionSaved = await newTransaction.save();

        if (!transactionSaved) {
            return res.error("Something went wrong while creating a new transaction.");
        }

        return res.success(transactionSaved);
    } catch (e) {
        console.error(e);
        return res.error("Something went wrong!");
    }
  });

  
  app.get("/api/transaction/list", VerifyToken, async (req, res) => {
    try {
        let userId = req.userId;
        let userOrders = await Transaction.find({user_id: userId})
            .limit(4)
            .lean()
            .exec();

        if(!userOrders) {
            return res.error('Unable to find user.')
        }

        return res.success(userOrders);
    } catch (error) {
        console.log(error)
        res.error("Something went wrong!");        
    }
  });

  const tradingviewSymbol = (symbol) => {
    // Gold
    if (symbol === 'GCUSD' || symbol === 'ZGUSD') {
        return 'FOREXCOM:XAUUSD';
    }

    // Silver
    if (symbol === 'SIUSD' || symbol === 'ZIUSD') {
        return 'FOREXCOM:XAGUSD';
    }

    // Crude Oil
    if (symbol === 'CLUSD') {
        return 'NYMEX:CL1!';
    }

    // Brent Crude Oil
    if (symbol === 'BZUSD') {
        return 'OANDA:BCOUSD';
    }

    // Natural Gas
    if(symbol === 'NGUSD') {
        return 'NYMEX:NG1!'
    }

    // Palladium
    if(symbol === 'PAUSD') {
        return 'CURRENCYCOM:PALLADIUM'
    }

    // Palladium
    if(symbol === 'PAUSD') {
        return 'CURRENCYCOM:PALLADIUM'
    }

    // Coffee
    if(symbol === 'KCUSX') {
        return 'ICEUS:KC1!';
    }
    
    // Coffee
    if(symbol === 'KCUSX') {
        return 'ICEUS:KC1!';
    }

    // Sugar
    if(symbol === 'SBUSX'){
        return 'ICEUS:SB1!';
    }

    // Cocoa
    if(symbol === 'CCUSD') {
        return 'ICEUS:CC1!';
    }

    // Copper
    if(sumbol === 'HGUSD') {
        return 'COMEX:HG1!';
    }

    // Platinum
    if(sumbol === 'PLUSD') {
        return 'OANDA:XPTUSD';
    }

    // Cotton
    if(sumbol === 'CTUSX') {
        return 'ICEUS:CT1!';
    }

  }
}