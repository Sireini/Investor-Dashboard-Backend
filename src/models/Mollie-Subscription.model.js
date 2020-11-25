const mongoose = require("mongoose");

var Schema = mongoose.Schema;

var mollieSubscription = new Schema({
  _id: Schema.Types.ObjectId,
  status: { type: String, required: true },
  customerId: { type: String, required: true },
  paymentId: { type: String },
  mandateId: { type: String },
  profileId: { type: String },
  subscriptionId: { type: String },
  type: { type: String, required: true },
  sequenceType: { type: String },
  metadata: { type: Object, required: true },
  description: { type: String, required: true },
  method: { type: String },
  resource: { type: String, required: true },
  createdAt: { type: Date, required: true },
  paidAt: { type: Date },
  startDate: { type: Date },
  canceledAt: { type: Date },
  times: { type: Number },
  timesRemaining: { type: Number },
  interval: { type: String },
  amount: { type: Object },
  nextPaymentDate: { type: Date },
  recordCreatedAt: { type: Date },
});

var orders = mongoose.model("MollieSubscription", mollieSubscription);

module.exports = orders;
