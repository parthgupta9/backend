import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const { connection } = await mongoose.connect(process.env.MONGO_URI);
    // const { connection } = await mongoose.connect(
    //   "mongodb://localhost:27017/Zealicon"
    // );
    console.log(`Connected to mongodb database ${connection.host}`);
  } catch (error) {
    console.log(`Error in Mongodb Connection:${error}`);
  }
};

export default connectDB;
