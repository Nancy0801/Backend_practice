import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(requestAnimationFrame, res) => {
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

    const {fullname , email, username , password } = req.body

    if(
        [fullname , email , username , password].some((field) => field?.trim() === "" )
    ){
        throw new ApiError(400 , "All fields are required")
    }

    const existedUser = User.findOne({
        $or: [{ email } , { username }]
    })

    if(existedUser){
        throw new ApiError(400 , "User already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar is required")
    }

    //uploading on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400 , "Avatar is required")
    }

    //entry in db
    const User = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(User._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500 , "User not created")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )

})

export {registerUser}; 