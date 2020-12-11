

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

                console.log('create-payment req.body: ', req.body)

                let webhookUrl =
                    "https://investly.nl/api/investly-standard/" + subscriptionPlan + "/payment/" + req.body.UserId;

                let redirectUrl = "https://investly.nl/login?customerId=" + customerId;
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

                    console.log('Create Payment Post Mollie Data: ', data);

                    let mijnMenuSubscription = new MollieSubscription();
                    mijnMenuSubscription._id = paymentId;
                    mijnMenuSubscription.status = data.status;
                    mijnMenuSubscription.paymentId = data.id;
                    mijnMenuSubscription.customerId = customerId;
                    mijnMenuSubscription.profileId = data.profileId;

                    mijnMenuSubscription.type = "Standard";
                    mijnMenuSubscription.resource = data.resource;
                    mijnMenuSubscription.sequenceType = data.sequenceType;
                    mijnMenuSubscription.metadata = data.metadata;
                    mijnMenuSubscription.method = data.method;
                    mijnMenuSubscription.description = data.description;
                    mijnMenuSubscription.amount = data.amount;
                    mijnMenuSubscription.createdAt = data.createdAt;
                    mijnMenuSubscription.recordCreatedAt = new Date();

                    await mijnMenuSubscription.save();
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

            console.log('req body: ', req);
            console.log('webhook paymentId: ', paymentId);
            console.log('webhook userId: ', userId);

            let paymentRequest = await getSubscriptionPayment(
                paymentId
            );
            console.log('webhook paymentRequest: ', paymentRequest);

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

            console.log('webhook mandate: ', mandate);

            if (!mandate) {
                return res.error("Sorry unable to find mandate");
            }

            if (!mandate.status === ("pending" || "valid")) {
                return res.error(
                    "Sorry unable to create subscription your mandate is not valid."
                );
            }

            let payment = await MijnMenuSubscriptions.find({
                paymentId: paymentRequest.id,
            })
                .lean()
                .exec();

            console.log('webhook payment in database', payment);

            if (!payment) {
                return res.error("Sorry unable to find userpayment");
            }

            let requestData = {
                "amount[currency]": "EUR",
                "amount[value]": subscriptionAmount,
                interval: subscriptionInterval,
                metadata: { UserId: userId, Type: "Standard" },
                mandateId: mandate.id,
                description:
                    `Investly Standard - ${subscriptionPlan} Subscription - ` +
                    paymentRequest.customerId,
                webhookUrl: webhookUrl
            };

            console.log('webhook requestData: ', requestData);

            // Create Subscription
            let createMollieSubscription = await createSubscription(
                paymentRequest.customerId,
                requestData
            );
            console.log('webhook createMollieSubscription: ', requestData);

            if (!createMollieSubscription) {
                return res.error("Sorry unable to create your subscription");
            }

            let mijnMenuSubscription = new MijnMenuSubscriptions();
            mijnMenuSubscription._id = mongoose.mongo.ObjectId();
            mijnMenuSubscription.status = createMollieSubscription.status;
            mijnMenuSubscription.customerId = paymentRequest.customerId;
            mijnMenuSubscription.profileId = paymentRequest.profileId;
            mijnMenuSubscription.subscriptionId = createMollieSubscription.id;
            mijnMenuSubscription.mandateId = mandate.id;

            mijnMenuSubscription.type = "Standard";
            mijnMenuSubscription.resource = createMollieSubscription.resource;
            mijnMenuSubscription.sequenceType = createMollieSubscription.sequenceType;
            mijnMenuSubscription.metadata = createMollieSubscription.metadata;
            mijnMenuSubscription.method = createMollieSubscription.method;
            mijnMenuSubscription.description = createMollieSubscription.description;
            mijnMenuSubscription.amount = createMollieSubscription.amount;
            mijnMenuSubscription.times = createMollieSubscription.times;
            mijnMenuSubscription.timesRemaining =
                createMollieSubscription.timesRemaining;
            mijnMenuSubscription.interval = createMollieSubscription.interval;
            mijnMenuSubscription.startDate = createMollieSubscription.startDate;
            mijnMenuSubscription.nextPaymentDate =
                createMollieSubscription.nextPaymentDate;
            mijnMenuSubscription.createdAt = createMollieSubscription.createdAt;
            mijnMenuSubscription.recordCreatedAt = new Date();

            await mijnMenuSubscription.save();

            let updatedData = {};
            updatedData["status"] = paymentRequest.status;
            updatedData["mandateId"] = paymentRequest.mandateId;
            updatedData["method"] = paymentRequest.method;
            updatedData["paidAt"] = paymentRequest.paidAt;

            let updateMijnMenuSubscriptionPayment = await MollieSubscription.findOneAndUpdate(
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

            if (!updateMijnMenuSubscriptionPayment) {
                return res.error("Could not update Mijn Menu Subscription");
            }

            let user = User.findByIdAndUpdate(
                userId,
                {
                    $set: { MijnMenuStandard: true, EmailVerified: true },
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
     * Called by Mollie to store a new Mijn Menu Standard or Plus payment
     */
    app.post("/api/investly/subscription/webhook", async (req, res) => {
        try {
            console.log("WEBHOOK DATA", req.body, JSON.parse(body));
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

            let mijnMenuSubscription = new MijnMenuSubscriptions();
            mijnMenuSubscription._id = mongoose.mongo.ObjectId();
            mijnMenuSubscription.status = subscription.status;
            mijnMenuSubscription.customerId = subscription.customerId;
            mijnMenuSubscription.profileId = subscription.profileId;
            mijnMenuSubscription.subscriptionId = subscriptionId;
            mijnMenuSubscription.mandateId = mollieSubscription.mandateId;

            mijnMenuSubscription.type = subscription.type;
            mijnMenuSubscription.resource = mollieSubscription.resource;
            mijnMenuSubscription.sequenceType = subscription.sequenceType;
            mijnMenuSubscription.metadata = mollieSubscription.metadata;
            mijnMenuSubscription.method = subscription.method;
            mijnMenuSubscription.description = mollieSubscription.description;
            mijnMenuSubscription.amount = mollieSubscription.amount;
            mijnMenuSubscription.times = mollieSubscription.times;
            mijnMenuSubscription.timesRemaining = mollieSubscription.timesRemaining;
            mijnMenuSubscription.interval = mollieSubscription.interval;
            mijnMenuSubscription.startDate = mollieSubscription.startDate;
            mijnMenuSubscription.nextPaymentDate = mollieSubscription.nextPaymentDate;
            mijnMenuSubscription.createdAt = mollieSubscription.createdAt;

            await mijnMenuSubscription.save();

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

        console.log('getSubscription Payment options: ', molliePaymentId, options, apiKey);

        return await makeRequest(options);
    };


    /**
     * get Mijn Menu Standard Subscription
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
     * get Mandate details of customer - Mijn Menu Standard
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
     * Create Mijn Menu Standard Subscription
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
     * Delete Subscription Payment - Mijn Menu Standard
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