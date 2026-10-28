
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const User = require("./models/user.js");
const bcrypt = require("bcryptjs");
const Auth = require("./models/Auth");
const calculateCompatibility = require("./utils/compatibility");

const app = express();

app.set("view engine", "ejs");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);


// Health check API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Beyond the Swipe API is running",
  });
});


app.post("/signup", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).send("Please enter a valid email.");
    }

    if (password.length < 8) {
      return res.status(400).send("Password must be at least 8 characters.");
    }

    const existingAccount = await Auth.findOne({ email });

    if (existingAccount) {
      return res.status(409).send("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Auth.create({
      email,
      passwordHash,
    });

    return res.redirect("/login");
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send("An account with this email already exists.");
    }

    console.error("Signup error:", error.message);
    return res.status(500).send("Unable to create account. Please try again.");
  }
});


app.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).send("Email and password are required.");
    }

    const account = await Auth.findOne({ email }).select("+passwordHash");

    if (!account) {
      return res.status(401).send("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(
      password,
      account.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).send("Invalid email or password.");
    }

    req.session.userId = account._id.toString();

    return req.session.save((error) => {
      if (error) {
        console.error("Session save error:", error.message);
        return res.status(500).send("Unable to log in. Please try again.");
      }

      return res.redirect("/");
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).send("Unable to log in. Please try again.");
  }
});


app.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error.message);
      return res.status(500).send("Unable to log out. Please try again.");
    }

    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
});

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  next();
}

// Home page and Looking For filter
app.get("/",requireLogin, async (req, res) => {
  try {
    const filter = {};

    if (req.query.lookingFor) {
      filter.lookingFor = req.query.lookingFor;
    }

    const users = await User.find(filter);
   let account = null;

if (req.session.userId) {
  account = await Auth.findById(req.session.userId)
    .populate("profile");
}
   res.render("home.ejs", {
  users,
  selectedLookingFor: req.query.lookingFor || "",
  account,
});
  } catch (error) {
    console.error("Home page error:", error);
    res.status(500).send(
      "Unable to load the website. Please try again."
    );
  }
});

// Calculate compatibility when the button is clicked
app.get("/api/users/:id/compatibility", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid profile ID.",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    // Exclude the selected profile from the comparison
    const allUsers = await User.find({
      _id: { $ne: user._id },
    });

    // Normalize interests and hobbies and calculate scores
    const results = allUsers
      .map((otherUser) => {
        const normalize = (items) =>
          [
            ...new Set(
              (items || [])
                .map((item) => String(item).trim().toLowerCase())
                .filter(Boolean)
            ),
          ];

        const interestsA = normalize(user.interests);
        const interestsB = normalize(otherUser.interests);

        const hobbiesA = normalize(user.preferredHobbies);
        const hobbiesB = normalize(otherUser.preferredHobbies);

        const commonInterests = interestsA.filter((item) =>
          interestsB.includes(item)
        );

        const commonHobbies = hobbiesA.filter((item) =>
          hobbiesB.includes(item)
        );

        return {
          _id: otherUser._id,
          name: otherUser.name,
          age: otherUser.age,
          photo: otherUser.photo,
          bio: otherUser.bio,
          location: otherUser.location,
          lookingFor: otherUser.lookingFor,

          score: calculateCompatibility(user, otherUser),

          commonInterests,
          commonHobbies,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Only profiles with scores strictly above 50% qualify
    const compatibleProfiles = results.filter(
      (profile) => profile.score > 50
    );

    const topMatch = results.length > 0 ? results[0] : null;

    return res.json({
      profileName: user.name,
      topMatch,
      totalProfilesChecked: results.length,
      compatibleCount: compatibleProfiles.length,
      compatibleProfiles,
    });
  } catch (error) {
    console.error("Compatibility calculation error:", error);

    return res.status(500).json({
      message:
        "Unable to calculate compatibility right now. Please try again.",
    });
  }
});


/* Show compatible profiles on a separate page */
app.get("/matches/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).send("Invalid profile ID.");
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).send("Profile not found.");
    }

    const allUsers = await User.find({
      _id: { $ne: user._id },
    });

    const normalize = (items) =>
      [
        ...new Set(
          (items || [])
            .map((item) => String(item).trim().toLowerCase())
            .filter(Boolean)
        ),
      ];

    const compatibleProfiles = allUsers
      .map((otherUser) => {
        const interestsA = normalize(user.interests);
        const interestsB = normalize(otherUser.interests);

        const hobbiesA = normalize(user.preferredHobbies);
        const hobbiesB = normalize(otherUser.preferredHobbies);

        return {
          _id: otherUser._id,
          name: otherUser.name,
          age: otherUser.age,
          photo: otherUser.photo,
          bio: otherUser.bio,
          location: otherUser.location,
          lookingFor: otherUser.lookingFor,
          score: calculateCompatibility(user, otherUser),
          commonInterests: interestsA.filter((item) =>
            interestsB.includes(item)
          ),
          commonHobbies: hobbiesA.filter((item) =>
            hobbiesB.includes(item)
          ),
        };
      })
      .filter((profile) => profile.score > 50)
      .sort((a, b) => b.score - a.score);

    res.render("matches.ejs", {
      user,
      compatibleProfiles,
    });
  } catch (error) {
    console.error("Compatible matches page error:", error);
    res.status(500).send("Unable to load compatible matches.");
  }
});


// Create a new profile
app.post("/api/users", async (req, res) => {
  try {
    const formData = {
      ...req.body,

      interests: (req.body.interests || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),

      preferredHobbies: (req.body.preferredHobbies || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  if (!req.session.userId) {
  return res.redirect("/login");
}
const account = await Auth.findById(req.session.userId);

if (!account) {
  req.session.destroy(() => {});
  return res.redirect("/login");
}

if (account.profile) {
  return res.status(409).send("Your account already has a profile.");
}
   const newUser = new User(formData);
await newUser.save();

await Auth.findByIdAndUpdate(req.session.userId, {
  profile: newUser._id,
});

return res.redirect("/");
  } catch (error) {
    console.error("Create profile error:", error);
    return res.status(400).send(error.message);
  }
});

// Like a profile and check for a mutual match
app.post("/api/users/:id/like", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const likedUser = await User.findById(req.body.likedUserId);

    if (!user || !likedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user._id.equals(likedUser._id)) {
      return res.status(400).json({
        message: "You cannot like your own profile!",
      });
    }

    if (
      user.likes.some((id) => id.equals(likedUser._id))
    ) {
      return res.status(400).json({
        message: "You already liked this profile ❤️",
      });
    }

    user.likes.push(likedUser._id);
    likedUser.likedBy.push(user._id);

    await user.save();
    await likedUser.save();

    const isMatch = likedUser.likes.some((id) =>
      id.equals(user._id)
    );

    if (isMatch) {
      return res.json({
        message: "It's a Match! 💕 You both liked each other!",
        isMatch: true,
      });
    }

    return res.json({
      message: "Like sent! ❤️ They can see that you liked them.",
      isMatch: false,
    });
  } catch (error) {
    console.error("Like error:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
});

// Get all profiles as JSON
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

// Get profiles liked by a particular user
app.get("/api/users/:id/likes", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      likes: user.likes.map((id) => id.toString()),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

// Get people who liked a particular user
app.get("/api/users/:id/liked-by", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "likedBy",
      "name age photo bio location"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      count: user.likedBy.length,
      people: user.likedBy,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/login", (req, res) => {
  res.render("login");
});

// Connect to MongoDB and start the server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error.message
    );
  });
