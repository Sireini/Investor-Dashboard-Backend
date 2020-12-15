

module.exports = function (
    app, VerifyToken
) {
    const apiKey = 'test_bxFVF3zMEEsyBk3N7qJ9x8wSQwWPkP';
    const mongoose = require("mongoose");
    const User = require('../models/User.model');
    const MollieSubscription = require('../models/Mollie-Subscription.model');

    /*
     **
     ** Financi Standard - Mollie €1 subscription
     ** 1. Create customer
     ** 2. Create first payment
     ** 3. Create Subscription
     **
     **/
    app.post(
        "/api/mollie/investly-standard/create-customer",
        VerifyToken,
        async (req, res) => {
            if (req.body != null && req.body != undefined) {
                let userId = req.userId;
                let user = await User.findById(userId).lean().exec();

                if (user) {
                    let requestData = { name: `${user.firstname} ${user.lastname}`, email: user.email };
                    let request = require("request");

                    let options = {
                        method: "POST",
                        url: "https://api.mollie.com/v2/customers",
                        headers: {
                            Authorization: "Bearer " + apiKey,
                        },
                        form: requestData,
                    };

                    request(options, async (error, response, body) => {
                        if (error) {
                            return res.status(422).json({
                                status: 422,
                                data: error,
                                message: "Failed to create customer",
                                token: "",
                            });
                        }

                        let data = JSON.parse(body);

                        let updateData = { $set: { mollie_customerId: data.id } };
                        let updateUser = await User.findOneAndUpdate(
                            { _id: userId },
                            updateData
                        );

                        if (updateUser && Object.keys(updateUser).length > 0) {
                            res.success(JSON.parse(body));
                        } else {
                            res.error("Failed to update customerId in user collection");
                        }
                    });
                } else {
                    res.error("No user record found for the given userId");
                }
            }
        });

    /**
    * Create first payment
    */
    app.post(
        "/api/user/:customerId/mollie/investly-standard/create-payment",
        async (req, res) => {
            if (req.body) {
                let customerId = req.params.customerId;
                let paymentId = mongoose.mongo.ObjectId();
                let subscriptionPlan = req.body.subscriptionPlan;

                let webhookUrl =
                    "https://investly.nl/api/investly-standard/" + subscriptionPlan + "/payment/" + req.body.UserId;

                let redirectUrl = "https://investly.nl/dashboard/auth/login?customerId=" + customerId;
                // let redirectUrl = "https://investly.nl/dashboard/";

                if (!customerId) {
                    return res.error("Please send a valid Mollie Customer Id");
                }

                let requestData = {
                    "amount[currency]": "EUR",
                    "amount[value]": "1.21",
                    customerId: customerId,
                    sequenceType: "first",
                    description: "Investly Standard First Payment - " + customerId,
                    metadata: { UserId: req.body.UserId, Type: "Standard" },
                    redirectUrl: redirectUrl,
                    webhookUrl: webhookUrl
                };

                let request = require("request");

                let options = {
                    method: "POST",
                    url: "https://api.mollie.com/v2/payments",
                    headers: {
                        Authorization: "Bearer " + apiKey,
                    },
                    form: requestData,
                };

                request(options, async (error, response, body) => {
                    if (error) {
                        return res.status(422).json({
                            status: 422,
                            data: error,
                            message: "Failed to create a payment",
                            token: "",
                        });
                    }

                    let data = JSON.parse(body);

                    let investlySubscription = new MollieSubscription();
                    investlySubscription._id = paymentId;
                    investlySubscription.status = data.status;
                    investlySubscription.paymentId = data.id;
                    investlySubscription.customerId = customerId;
                    investlySubscription.profileId = data.profileId;

                    investlySubscription.type = "Standard";
                    investlySubscription.resource = data.resource;
                    investlySubscription.sequenceType = data.sequenceType;
                    investlySubscription.metadata = data.metadata;
                    investlySubscription.method = data.method;
                    investlySubscription.description = data.description;
                    investlySubscription.amount = data.amount;
                    investlySubscription.createdAt = data.createdAt;
                    investlySubscription.recordCreatedAt = new Date();

                    await investlySubscription.save();
                    res.success(data);
                });
            }
        });


    /**
     * Get Payment & Subscription Status
     */
    app.get(
        "/api/investly-standard/subscription/:customerId",
        async (req, res, next) => {
            try {
                let customerId = req.params.customerId;

                let mollieFirstPayment = await MollieSubscription.find({
                    customerId: customerId,
                    resource: "payment",
                    status: "paid",
                })
                    .lean()
                    .exec();

                let mollieSubscription = await MollieSubscription.find({
                    customerId: customerId,
                    resource: "subscription",
                    status: "active",
                })
                    .lean()
                    .exec();

                if (!mollieSubscription && !mollieFirstPayment) {
                    return res.success({
                        payment: null,
                        mollieSubscription: null,
                    });
                } else {
                    return res.success({
                        payment: mollieFirstPayment,
                        mollieSubscription: mollieSubscription,
                    });
                }
            } catch (e) {
                console.error(e);
                return res.success({
                    payment: null,
                    mollieSubscription: null,
                });
            }
        }
    );


    /**
     * Handle webhook url for first payment
     * Called by Mollie webhook to update status of the first payment
     */
    app.post("/api/investly-standard/:subscriptionPlan/payment/:userId", async (req, res) => {
        try {
            let paymentId = req.body.id;
            let userId = req.params.userId;

            let paymentRequest = await getSubscriptionPayment(
                paymentId
            );

            let subscriptionPlan = req.params.subscriptionPlan;
            let subscriptionInterval;
            let subscriptionAmount;

            let webhookUrl =
                "https://investly.nl/api/investly/subscription/webhook";

            if (subscriptionPlan === "monthly") {
                subscriptionInterval = "1 month"
                subscriptionAmount = "5.99";
            }

            if (subscriptionPlan === "yearly") {
                subscriptionInterval = "12 months";
                subscriptionAmount = "65.34"
            }

            if (!paymentRequest && paymentRequest.status !== "paid") {
                return res.error("Unable to get payment request or you did not pay");
            }

            let mandate = await getMandate(
                paymentRequest.customerId,
                paymentRequest.mandateId
            );

            if (!mandate) {
                return res.error("Sorry unable to find mandate");
            }

            if (!mandate.status === ("pending" || "valid")) {
                return res.error(
                    "Sorry unable to create subscription your mandate is not valid."
                );
            }

            let payment = await MollieSubscription.find({
                paymentId: paymentRequest.id,
            })
                .lean()
                .exec();

            if (!payment) {
                return res.error("Sorry unable to find userpayment");
            }

            let date = new Date();
            let startDate = new Date(date.setMonth(date.getMonth() + 1));

            let requestData = {
                "amount[currency]": "EUR",
                "amount[value]": subscriptionAmount,
                interval: subscriptionInterval,
                metadata: { UserId: userId, Type: "Standard" },
                mandateId: mandate.id,
                startDate: startDate,
                description:
                    `Investly Standard - ${subscriptionPlan} Subscription - ` +
                    paymentRequest.customerId,
                webhookUrl: webhookUrl
            };

            // Create Subscription
            let createMollieSubscription = await createSubscription(
                paymentRequest.customerId,
                requestData
            );

            if (!createMollieSubscription) {
                return res.error("Sorry unable to create your subscription");
            }

            let investlySubscription = new MollieSubscription();
            investlySubscription._id = mongoose.mongo.ObjectId();
            investlySubscription.status = createMollieSubscription.status;
            investlySubscription.customerId = paymentRequest.customerId;
            investlySubscription.profileId = paymentRequest.profileId;
            investlySubscription.subscriptionId = createMollieSubscription.id;
            investlySubscription.mandateId = mandate.id;

            investlySubscription.type = "Standard";
            investlySubscription.resource = createMollieSubscription.resource;
            investlySubscription.sequenceType = createMollieSubscription.sequenceType;
            investlySubscription.metadata = createMollieSubscription.metadata;
            investlySubscription.method = createMollieSubscription.method;
            investlySubscription.description = createMollieSubscription.description;
            investlySubscription.amount = createMollieSubscription.amount;
            investlySubscription.times = createMollieSubscription.times;
            investlySubscription.timesRemaining =
                createMollieSubscription.timesRemaining;
            investlySubscription.interval = createMollieSubscription.interval;
            investlySubscription.startDate = createMollieSubscription.startDate;
            investlySubscription.nextPaymentDate =
                createMollieSubscription.nextPaymentDate;
            investlySubscription.createdAt = createMollieSubscription.createdAt;
            investlySubscription.recordCreatedAt = new Date();

            await investlySubscription.save();

            let updatedData = {};
            updatedData["status"] = paymentRequest.status;
            updatedData["mandateId"] = paymentRequest.mandateId;
            updatedData["method"] = paymentRequest.method;
            updatedData["paidAt"] = paymentRequest.paidAt;

            let updateInvestlySubscriptionPayment = await MollieSubscription.findOneAndUpdate(
                {
                    paymentId: paymentRequest.id,
                },
                {
                    $set: updatedData,
                },
                {
                    new: true,
                }
            );

            if (!updateInvestlySubscriptionPayment) {
                return res.error("Could not update Investly Subscription");
            }

            let user = User.findByIdAndUpdate(
                userId,
                {
                    $set: { verified: true },
                },
                { new: true }
            )
                .lean()
                .exec();

            if (!user) {
                return res.error("Sorry unable to find a user with this id.");
            }

            return res.success({});
        } catch (e) {
            console.error('Mollie webhookd error: ', e);
            return res.success({
                payment: null,
            });
        }
    });

    /**
     * Handle webhook url Recurring payment
     * Called by Mollie to store a new Investly Standard payment
     */
    app.post("/api/investly/subscription/webhook", async (req, res) => {
        try {
            let subscriptionId = req.body.id;
            let subscription = await MollieSubscription.find({
                subscriptionId: subscriptionId,
                resource: "subscription",
            })
                .lean()
                .exec();

            if (!subscription) {
                return res.error("Unable to find subscription in database");
            }

            let mollieSubscription = await getSubscription(
                subscription.customerId,
                subscriptionId
            );

            if (!mollieSubscription) {
                return res.error("Unable to get payment request or you did not pay");
            }

            let investlySubscription = new MollieSubscription();
            investlySubscription._id = mongoose.mongo.ObjectId();
            investlySubscription.status = subscription.status;
            investlySubscription.customerId = subscription.customerId;
            investlySubscription.profileId = subscription.profileId;
            investlySubscription.subscriptionId = subscriptionId;
            investlySubscription.mandateId = mollieSubscription.mandateId;

            investlySubscription.type = subscription.type;
            investlySubscription.resource = mollieSubscription.resource;
            investlySubscription.sequenceType = subscription.sequenceType;
            investlySubscription.metadata = mollieSubscription.metadata;
            investlySubscription.method = subscription.method;
            investlySubscription.description = mollieSubscription.description;
            investlySubscription.amount = mollieSubscription.amount;
            investlySubscription.times = mollieSubscription.times;
            investlySubscription.timesRemaining = mollieSubscription.timesRemaining;
            investlySubscription.interval = mollieSubscription.interval;
            investlySubscription.startDate = mollieSubscription.startDate;
            investlySubscription.nextPaymentDate = mollieSubscription.nextPaymentDate;
            investlySubscription.createdAt = mollieSubscription.createdAt;

            await investlySubscription.save();

            return res.success({});
        } catch (e) {
            console.error(e);
            return res.success({
                payment: null,
            });
        }
    });


    /**
     * get Subscription Payment - Mijn Menu Standard
     * @param {*} molliePaymentId
     */
    const getSubscriptionPayment = async (molliePaymentId) => {
        let options = {
            method: "GET",
            url: "https://api.mollie.com/v2/payments/" + molliePaymentId,
            headers: {
                Authorization: "Bearer " + apiKey,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        return await makeRequest(options);
    };


    /**
     * get Investly Standard Subscription
     * @param {*} customerId
     * @param {*} subscriptionId
     */
    const getSubscription = async (customerId, subscriptionId) => {
        let options = {
            method: "GET",
            url:
                "https://api.mollie.com/v2/customers/" +
                customerId +
                "/subscriptions/" +
                subscriptionId,
            headers: {
                Authorization: "Bearer " + apiKey,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        return await makeRequest(options);
    };

    /**
     * get Mandate details of customer - Investly Standard
     * @param {*} customerId
     * @param {*} mandateId
     */
    const getMandate = async (customerId, mandateId) => {
        let options = {
            method: "GET",
            url:
                "https://api.mollie.com/v2/customers/" +
                customerId +
                "/mandates/" +
                mandateId,
            headers: {
                Authorization: "Bearer " + apiKey,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        return await makeRequest(options);
    };

    /**
     * Create Investly Standard Subscription
     * @param {*} customerId
     * @param {*} requestObject
     */
    const createSubscription = async (customerId, requestObject) => {
        let options = {
            method: "POST",
            url: "https://api.mollie.com/v2/customers/" + customerId + "/subscriptions",
            headers: {
                Authorization: "Bearer " + apiKey,
            },
            form: requestObject,
        };

        return await makeRequest(options);
    };

    /**
     * Delete Subscription Payment - Investly Standard
     * @param {*} molliePaymentId
     */
    const cancelSubscription = async (customerId, subscriptionId) => {
        let options = {
            method: "DELETE",
            url:
                "https://api.mollie.com/v2/customers/" +
                customerId +
                "/subscriptions/" +
                subscriptionId,
            headers: {
                Authorization: "Bearer " + apiKey,
            },
        };

        return await makeRequest(options);
    };

    const makeRequest = (options) => {
        let request = require("request");
        return new Promise((resolve, reject) => {
            request(options, function (error, response, body) {
                if (!error && body) {
                    let bodyRes = JSON.parse(body);
                    if (response.statusCode >= 200 && response.statusCode <= 299) {
                        resolve(bodyRes);
                    } else {
                        reject(bodyRes.error || bodyRes.detail);
                    }
                } else {
                    reject(error);
                }
            });
        });
    };
}