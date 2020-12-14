const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  _id: mongoose.Schema.Types.ObjectId,
  firstname: { type: String },
  lastname: { type: String },
  password: { type: String },
  email: { type: String, unique: true },
  plan: { type: String },
  verified: { type: Boolean },
  mollie_customerId: { type: String },
});

const User = mongoose.model('User', userSchema)

module.exports = User