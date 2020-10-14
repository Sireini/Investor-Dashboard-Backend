const { VerifyToken } = require('../auth/VerifyToken');

module.exports = function (
    app,
    VerifyToken
  ) {    
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const bcrypt = require("bcryptjs");
  const config = require("../../config");
  let User = require("../models/User.model");

  app.post("/api/user/login", async (req, res) => {
    try {
        let user = await User.findOne({ email: req.body.email })
            .lean()
            .exec();

        if (!user) {
            return res.error("No User found");
        }

        let passwordIsValid = bcrypt.compareSync(
            req.body.password,
            user.password
        );

        if (!passwordIsValid) {
            return res.error("Incorrect password!");
        }

        // create a accessToken
        let accessToken = jwt.sign({ id: user._id }, config.secret, {
            expiresIn: 86400, // expires in 24 hours
        });

        return res.success(user, accessToken, "User logged in Successfully");
    } catch (e) {
        console.error(e);
        return res.error("Something went wrong!");
    }
  });

  app.post("/api/user/register", async (req, res) => {
    try {
        const email = req.body.email;
        let user = await User.find({email: email}).lean().exec();

        if (user.length) {
            res.status(409).json({
                message: {
                error: { message: "Email is already in use try to log in!" },
                status: 409,
                statusText: "Email in use.",
                },
            });
        }

        let hashedPasswordUsed = false;
        let hashedPassword = null;

        if (
            req.body.password
        ) {
            hashedPassword = bcrypt.hashSync(req.body.password, 8);
            hashedPasswordUsed = true;
        }

        let newUser = new User({
            _id: new mongoose.Types.ObjectId(),
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            email: req.body.email,
            CreatedDate: new Date(),
            ModifiedDate: new Date(),
        });

        if (hashedPasswordUsed) {
            newUser.password = hashedPassword;
        }

        // create a accessToken
        let accessToken = jwt.sign({ id: newUser._id }, config.secret, {
            expiresIn: 86400, // expires in 24 hours
        });
        
        let userSaved = await newUser.save();

        if (!userSaved) {
            return res.error("Something went wrong while creating a new user.");
        }

        return res.success(userSaved, accessToken, "Your account has been successfuly registered.");
          
    } catch (error) {
        console.log(error)
        return res.error("Something went wrong!");
    }
  });

  
  app.get("/api/user/bytoken", VerifyToken, async (req, res) => {
    try {
        let authorization = req.headers['x-access-token'];
        let decoded = jwt.verify(authorization, config.secret);
        let userId = mongoose.Types.ObjectId(decoded.id);
        let user = await User.findById(userId).lean().exec();

        if(!user) {
            return res.error('Unable to find user.')
        }

        return res.success(user);
    } catch (error) {
        console.log(error)
        res.error("Something went wrong!");        
    }
  });

//   app.post("/api/user/forgetPassword", function (req, res) {
//     if (req.body != null && req.body != undefined) {
//       req
//         .checkBody("EmailAddress")
//         .notEmpty()
//         .withMessage("EmailAddress is missing");
//       let errors = req.validationErrors({ firstErrorOnly: true });
//       if (errors) {
//         return sendError({ message: errors }, res);
//       } else {
//         User.findOne({ EmailAddress: req.body["EmailAddress"] }, function (
//           err,
//           user
//         ) {
//           if (err != null) {
//             sendError(err, res);
//           } else {
//             if (user != null) {
//               sendForgetEmailToUser(user);
//               sendSuccessResponse(
//                 user,
//                 "An email is sent to you. Check your inbox to reset password",
//                 res
//               );
//             } else {
//               sendError({ message: "No user found with this details" }, res);
//             }
//           }
//         });
//       }
//     } else {
//       sendError({ message: "Request body is null" }, res);
//     }
//   });
  }