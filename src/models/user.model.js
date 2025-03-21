import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true      //used for searching in the database optimally 
    },
    email:{
        type:String,
        required:true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullname: {
        type:String,
        required:true,
        trim: true,
        index: true
    },
    avatar: {
        type:String,      //cloudinary url
        required:true,
    },
    coverImage: {
        type: String,     //cloudinary url
    },
    watchHistory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video",
        }
    ],
    password: {
        type: String,
        required: true,

    },
    refreshToken: {
        type: String,
    }

}, {timestamps: true});

//password is encrypted
userSchema.pre("save", async function(next){
    if(!this.isModified("password")){
        return next();
    }
    this.password= bcrypt.hash(this.password, 10);
    next();
})

//method to verify password encrypted is correct or not
//custom methods for schema
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password , this.password);
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this.id,
            email: this.email,
            username: this.username,
            fullname: this.fullname,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this.id, 
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema); 