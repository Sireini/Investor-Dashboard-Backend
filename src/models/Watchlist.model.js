const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const watchlistSchema = new Schema({
  _id: mongoose.Schema.Types.ObjectId,
  user_id: { type: String },
  name: { type: String },
  symbol: {type: String},
  asset_category: { type: String },
  exchange: { type: String },
  created_date: { type: Date },
  modified_date: { type: Date }
});

const Watchlist = mongoose.model('Watchlist', watchlistSchema)

module.exports = Watchlist