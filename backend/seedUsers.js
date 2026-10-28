
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");

const demoUsers = [
  {
    name: "Aarav",
    age: 21,
    photo: "https://i.pravatar.cc/400?img=12",
    bio: "Love exploring new places and meeting new people.",
    interests: ["Travel", "Photography", "Music"],
    preferredHobbies: ["Hiking", "Photography"],
    music: "Indie",
    location: "Raipur",
    lookingFor: "Friendship",
  },
  {
    name: "Ananya",
    age: 20,
    photo: "https://i.pravatar.cc/400?img=47",
    bio: "Books, coffee, and meaningful conversations.",
    interests: ["Reading", "Music", "Art"],
    preferredHobbies: ["Painting", "Reading"],
    music: "Pop",
    location: "Raipur",
    lookingFor: "Both",
  },
  {
    name: "Vihaan",
    age: 22,
    photo: "https://i.pravatar.cc/400?img=13",
    bio: "Sports lover who enjoys trying new food.",
    interests: ["Sports", "Fitness", "Food"],
    preferredHobbies: ["Cricket", "Cooking"],
    music: "Hip-hop",
    location: "Bhilai",
    lookingFor: "Friendship",
  },
  {
    name: "Meera",
    age: 21,
    photo: "https://i.pravatar.cc/400?img=44",
    bio: "Creative soul who loves art and travel.",
    interests: ["Art", "Travel", "Photography"],
    preferredHobbies: ["Painting", "Photography"],
    music: "Indie",
    location: "Raipur",
    lookingFor: "Relationship",
  },
  {
    name: "Kabir",
    age: 23,
    photo: "https://i.pravatar.cc/400?img=14",
    bio: "Tech enthusiast, gamer, and music fan.",
    interests: ["Technology", "Gaming", "Music"],
    preferredHobbies: ["Gaming", "Coding"],
    music: "Rock",
    location: "Durg",
    lookingFor: "Both",
  },
  {
    name: "Isha",
    age: 20,
    photo: "https://i.pravatar.cc/400?img=45",
    bio: "Nature lover who enjoys quiet weekends.",
    interests: ["Nature", "Reading", "Travel"],
    preferredHobbies: ["Hiking", "Reading"],
    music: "Classical",
    location: "Raipur",
    lookingFor: "Friendship",
  },
  {
    name: "Reyansh",
    age: 22,
    photo: "https://i.pravatar.cc/400?img=15",
    bio: "Always ready for an adventure or a good playlist.",
    interests: ["Travel", "Fitness", "Photography"],
    preferredHobbies: ["Hiking", "Cricket"],
    music: "Pop",
    location: "Bhilai",
    lookingFor: "Relationship",
  },
  {
    name: "Saanvi",
    age: 21,
    photo: "https://i.pravatar.cc/400?img=46",
    bio: "I love cooking, art, and discovering new music.",
    interests: ["Food", "Art", "Music"],
    preferredHobbies: ["Cooking", "Painting"],
    music: "Jazz",
    location: "Raipur",
    lookingFor: "Both",
  },
];

async function seedUsers() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // Prevent duplicate demo profiles if this script is run again.
    const existing = await User.find({
      name: { $in: demoUsers.map((user) => user.name) },
      bio: { $in: demoUsers.map((user) => user.bio) },
    }).select("name bio");

    const existingKeys = new Set(
      existing.map((user) => `${user.name}|${user.bio}`)
    );

    const newUsers = demoUsers.filter(
      (user) => !existingKeys.has(`${user.name}|${user.bio}`)
    );

    if (newUsers.length > 0) {
      await User.insertMany(newUsers);
    }

    console.log(`Added ${newUsers.length} new demo profiles.`);
    console.log("Existing profiles were not deleted.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedUsers();
