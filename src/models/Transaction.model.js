const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

const transactionSchema = new Schema({
    _id: mongoose.Schema.Types.ObjectId,
    user_id: { type: String },
    name: { type: String },
    asset_category: { type: String },
    symbol: { type: String },
    tradingview_symbol: { type: String },
    price: { type: Number },
    amount: { type: Number },
    transaction_value: { type: Number },
    transaction_type: { type: String },
    transaction_date: { type: Date }
});

transactionSchema.plugin(aggregatePaginate);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction