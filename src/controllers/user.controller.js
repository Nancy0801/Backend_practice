import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Token generation failed");
  }
};

//register user
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exits
  // check for images , avatar
  // upload them to cloudinary
  // check avatar uploaded correctly on cloudinary
  // create user object - create entry in db
  // remove password and refresh token feild from response
  // check for user creation
  // return response

  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(400, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;                 this line does not work if coverImage is not uploaded , this will throw error

  //sp use classic method to avoid undefined coverImage
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  //uploading on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  //entry in db
  const newUser = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "User not created");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "user registered successfully"));
});

//login user
const loginUser = asyncHandler(async (req, res) => {
  // get user details from frontend req body -> data
  // validation - not empty  username or email
  // check if user exists
  // check password
  // generate access token
  // generate refresh token
  // send cookies

  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secrue: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

//logout user
const logoutUser = asyncHandler(async (req, res) => {
  // we will execute a auth middleware first as we do not have access of user object in our req object.
  // that is why auth middleware is used to get user object from token
  // for logout we have to clear cookies and remove refresh token from db

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secrue: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

//endpoint to refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(400, "Refresh token is not valid");
  }

  try {
    const decodedRefresh = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedRefresh?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired");
    }

    const options = {
      httpOnly: true,
      secrue: true,
    };

    const { ac, rf } = await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", ac, options)
      .cookie("refreshToken", rf, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: ac,
            refreshToken: rf,
          },
          "Access Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async(req, res) => {
  // get current password, new password and confirm password from frontend
  // validation - not empty
  // check if new password and confirm password are same
  // check if current password is correct
  // update password in db
  // return response

  const {oldPassword , newPassword } = req.body;

  // again auth middleware is used to acces user id from user object
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if(!isPasswordCorrect){
    throw new ApiError(401, "Invalid credentials");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(200, {}, "Password changed successfully")
  )
})

const getCurrentUser = asyncHandler(async(req,res) => {

  return res.status(200).json(
    new ApiResponse(200, req.user, "User found successfully")
  )
})

const updateAccountDetails = asyncHandler(async(req , res) => {
  const {fullname , email } = req.body;

  if(!fullname || !email){
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(req.user?._id,  {
      $set: {
        fullname: fullname,
        email: email
      }
    } , 
    {new: true}
  ).select("-password")

  return res.status(200).json(
    new ApiResponse(200, user, "User updated successfully")
  )
});

//update files
const updateUserAvatar = asyncHandler(async(req,res) => {
  //two middlewares are used : auth middleware and multer middleware
  // get avatar from frontend
  // validation - not empty
  // upload avatar on cloudinary
  // check if avatar uploaded correctly
  // update avatar in db
  // return response

  const avatarLocalPath = req.file?.path;   //in this we have .file instead of .files as we just need one file but in register we have avatar as well as cover image that is why we have .files there

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if(!avatar.url){
    throw new ApiError(400, "Error while uploading on cloudinary");
  }

  const user = await User.findByIdAndUpdate(req.user?._id, {
    $set: {
      avatar: avatar.url
    }
  }, {new: true}).select("-password");

  return res.status(200).json(
    new ApiResponse(200, user, "Avatar updated successfully")
  )
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
  //two middlewares are used : auth middleware and multer middleware
  // get avatar from frontend
  // validation - not empty
  // upload avatar on cloudinary
  // check if avatar uploaded correctly
  // update avatar in db
  // return response

  const coverImageLocalPath = req.file?.path;   //in this we have .file instead of .files as we just need one file but in register we have avatar as well as cover image that is why we have .files there

  if(!coverImageLocalPath){
    throw new ApiError(400, "Cover Image is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if(!coverImage.url){
    throw new ApiError(400, "Error while uploading on cloudinary");
  }

  const user = await User.findByIdAndUpdate(req.user?._id, {
    $set: {
     coverImage: coverImage.url
    }
  }, {new: true}).select("-password");

  return res.status(200).json(
    new ApiResponse(200, user, "coverImage updated successfully")
  )
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
  const { username } = req.params;
  if(!username?.trim()){
    throw new ApiError(400, "Username is required");
  }

  //aggregation pipeline are used to get user channel profile
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers"},
        channelSubscribedToCount: { $size: "$subscribedTo"},
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id , "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        avatar: 1,
        isSubscribed: 1,
        coverImage: 1,
        email: 1,
      }
    }
  ]);

  if(!channel?.length){
    throw new ApiError(404, "channel does not exists")
  }

  return res.status(200).json(
    new ApiResponse(200, channel[0], "Channel found successfully")
  )

})

const getWatchHistory = asyncHandler(async(req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        //subpipeline because we want to add owner name of video in history which we will get from users
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res.status(200)
  .json(
    new ApiResponse(200 , user[0],watchHisory , "watch history fetched successfully")
  )
})

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken ,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
};
