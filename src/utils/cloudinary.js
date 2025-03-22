import {v2 as cloudinary} from "cloudinary";
import fs from "fs";           //for sile syatem

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath) => {
    try{
        if(!localFilePath){
            console.log("Please provide a file path");
            return null;
        }
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        //file uploaded successfully
        console.log("File uploaded successfully", response.url);
        return response;
    }catch(error){
        fs.unlinkSync(localFilePath)   //remove the locally save temp file as upload operation is failed
        console.log("Error in uploading file", error);
        return null;
    }
}

export default uploadOnCloudinary;