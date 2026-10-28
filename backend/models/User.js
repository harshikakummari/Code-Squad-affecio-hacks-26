const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: Number,
      required: true,
      min: 18,
    },

    photo: {
      type: String,
      required: true,
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
    },

    interests: {
      type: [String],
      required: true,
      validate: {
        validator: (items) => items.length >= 2,
        message: "Select at least 2 interests",
      },
    },

    preferredHobbies: {
      type: [String],
      required: true,
      validate: {
        validator: (items) => items.length >= 1,
        message: "Select at least 1 hobby",
      },
    },

    music: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },


    lookingFor: {
      type: String,
      required: true,
      enum: ["Friendship", "Relationship", "Both"],
    },

    likes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

  likedBy: {
  type: [mongoose.Schema.Types.ObjectId],
  ref: "User",
  default: [],
},
 },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);




