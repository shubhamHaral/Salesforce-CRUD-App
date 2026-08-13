const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const axios = require("axios");
const crypto = require("crypto");
const { createClient } = require("redis");
const { RedisStore } = require("connect-redis");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// app.set("trust proxy", 1);

// CORS
app.use(
    cors({
        origin: "https://salesforce-crud-app-1.onrender.com",
        credentials: true
    })
);

app.use(express.json());

// let redisStore = undefined;

// if (process.env.NODE_ENV === "production") {
//     const redisClient = createClient({
//         url: process.env.REDIS_URL
//     });

//     redisClient.on("error", (err) => {
//         console.error("Redis error:", err);
//     });

//     redisClient.connect()
//         .then(() => console.log("Redis connected successfully"))
//         .catch((err) => console.error("Redis connection failed:", err));

//     redisStore = new RedisStore({
//         client: redisClient,
//         prefix: "salesforce:"
//     });
// }

let redisClient = null;
let redisStore = null;

if (process.env.NODE_ENV === "production") {

    if (!process.env.REDIS_URL) {
        throw new Error(
            "REDIS_URL is missing in production"
        );
    }

    redisClient = createClient({
        url: process.env.REDIS_URL
    });

    redisClient.on("error", (err) => {
        console.error("Redis error:", err);
    });

    redisStore = new RedisStore({
        client: redisClient,
        prefix: "salesforce:"
    });
}

// const redisStore = new RedisStore({
//     client: redisClient,
//     prefix: "salesforce:"
// });

// Session
// 1. Change this to 'true' instead of 1 to trust all Render proxies


const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(
    session({
        ...(isProduction
            ? { store: redisStore }
            : {}),

        name: "salesforce.sid",

        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        proxy: isProduction,

        cookie: {
            httpOnly: true,

            secure: isProduction,

            sameSite: isProduction
                ? "none"
                : "lax",

            maxAge: 24 * 60 * 60 * 1000
        }
    })
);
// Test
app.get("/", (req, res) => {
    res.send("Salesforce CRUD Backend is running!");
});

// --------------------------------------------------
// SALESFORCE LOGIN
// --------------------------------------------------

app.get("/auth/login", (req, res) => {
    try {
        // Generate PKCE verifier
        const codeVerifier = crypto
            .randomBytes(32)
            .toString("base64url");

        // Generate PKCE challenge
        const codeChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url");

        // Save verifier in session
        req.session.codeVerifier = codeVerifier;
        
        console.log(
            "Saved PKCE verifier:",
            !!req.session.codeVerifier
        );

        req.session.save((err) => {
            if (err) {
                console.error("Failed to save PKCE session:", err);
                return res.status(500).send("Failed to start OAuth login.");
            }

            console.log("OAuth session created.");
            console.log("Session ID:", req.sessionID);

            const params = new URLSearchParams({
                response_type: "code",
                client_id: process.env.SALESFORCE_CLIENT_ID,
                redirect_uri: process.env.SALESFORCE_CALLBACK_URL,
                code_challenge: codeChallenge,
                code_challenge_method: "S256"
            });

            console.log("CALLBACK URL BEING SENT:", process.env.SALESFORCE_CALLBACK_URL);
            const loginUrl =
                `${process.env.SALESFORCE_LOGIN_URL}` +
                `/services/oauth2/authorize?${params.toString()}`;

            console.log("Redirecting to Salesforce...");

            res.redirect(loginUrl);
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Unable to start Salesforce login.");
    }
});

// --------------------------------------------------
// SALESFORCE CALLBACK
// --------------------------------------------------

app.get("/oauth/callback", async (req, res) => {
    console.log("\n========== OAUTH CALLBACK ==========");
    console.log("Session ID:", req.sessionID);
    console.log("Code received:", !!req.query.code);
    console.log(
        "Code verifier exists:",
        !!req.session.codeVerifier
    );

    const { code } = req.query;

    if (!code) {
        return res
            .status(400)
            .send("Authorization code not received.");
    }

    if (!req.session.codeVerifier) {
        return res
            .status(400)
            .send(
                "PKCE session was lost. Please restart the Salesforce login."
            );
    }

    try {
        const response = await axios.post(
            `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`,

            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                client_id: process.env.SALESFORCE_CLIENT_ID,
                client_secret: process.env.SALESFORCE_CLIENT_SECRET,
                redirect_uri: process.env.SALESFORCE_CALLBACK_URL,
                code_verifier: req.session.codeVerifier
            }).toString(),

            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );

        console.log("Salesforce token received.");
        console.log(
            "Instance URL:",
            response.data.instance_url
        );

        // Save Salesforce information
        req.session.salesforce = {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            instance_url: response.data.instance_url,
            token_type: response.data.token_type
        };

        // Remove PKCE verifier after successful login
        delete req.session.codeVerifier;

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res
                    .status(500)
                    .send("Failed to save login session.");
            }

            console.log("Salesforce login successful!");
            console.log("Session saved successfully!");
            console.log("===================================\n");

            res.redirect("https://salesforce-crud-app-1.onrender.com/");
        });
    } catch (error) {
        console.error(
            "Salesforce OAuth Error:",
            error.response?.data || error.message
        );

        res.status(500).send(
            "Salesforce authentication failed."
        );
    }
});

// --------------------------------------------------
// CHECK LOGIN
// --------------------------------------------------

app.get("/auth/status", (req, res) => {
    console.log(
        "Checking session:",
        req.sessionID,
        "Logged in:",
        !!req.session.salesforce
    );

    if (req.session.salesforce) {
        return res.json({
            loggedIn: true
        });
    }

    res.json({
        loggedIn: false
    });
});

// --------------------------------------------------
// SALESFORCE REQUEST HELPER
// --------------------------------------------------

async function salesforceRequest(
    req,
    method,
    url,
    data = null
) {
    if (!req.session.salesforce) {
        throw new Error(
            "Not authenticated with Salesforce"
        );
    }

    const accessToken =
        req.session.salesforce.access_token;

    const instanceUrl =
        req.session.salesforce.instance_url;

    const config = {
        method: method,
        url: `${instanceUrl}${url}`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    };

    if (data) {
        config.data = data;
    }

    return await axios(config);
}
const ALLOWED_OBJECTS = [
    "Account",
    "Opportunity",
    "Lead",
    "Contact",
    "Case"
];

function validateObject(objectName) {
    if (!ALLOWED_OBJECTS.includes(objectName)) {
        throw new Error("Invalid Salesforce object");
    }
}

// Read records
app.get("/api/records/:objectName", async (req, res) => {
    try {
        const { objectName } = req.params;

        validateObject(objectName);

        const query = `
            SELECT FIELDS(ALL)
            FROM ${objectName}
            ORDER BY CreatedDate DESC
            LIMIT 20
        `;

        const response = await salesforceRequest(
            req,
            "GET",
            `/services/data/v65.0/query?q=${encodeURIComponent(query)}`
        );

        res.json(response.data);

    } catch (error) {
        console.error(
            "Read Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to fetch records",
            details: error.response?.data || error.message
        });
    }
});

// Create record
app.post("/api/records/:objectName", async (req, res) => {
    try {
        const { objectName } = req.params;

        validateObject(objectName);

        const response = await salesforceRequest(
            req,
            "POST",
            `/services/data/v65.0/sobjects/${objectName}`,
            req.body
        );

        res.status(201).json(response.data);

    } catch (error) {
        console.error(
            "Create Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to create record",
            details: error.response?.data || error.message
        });
    }
});

// Update record
app.patch("/api/records/:objectName/:id", async (req, res) => {
    try {
        const { objectName, id } = req.params;

        validateObject(objectName);

        await salesforceRequest(
            req,
            "PATCH",
            `/services/data/v65.0/sobjects/${objectName}/${id}`,
            req.body
        );

        res.json({
            success: true,
            message: "Record updated successfully"
        });

    } catch (error) {
        console.error(
            "Update Error:",
            error.response?.data || error.message
        );

        const details = error.response?.data || {
            message: error.message
        };

        res.status(500).json({
            error: "Failed to update record",
            details: JSON.stringify(details)
        });
    }
});
// Delete record
app.delete("/api/records/:objectName/:id", async (req, res) => {
    try {
        const { objectName, id } = req.params;

        validateObject(objectName);

        await salesforceRequest(
            req,
            "DELETE",
            `/services/data/v65.0/sobjects/${objectName}/${id}`
        );

        res.json({
            success: true,
            message: "Record deleted successfully"
        });

    } catch (error) {
        console.error(
            "Delete Error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            error: "Failed to delete record",
            details: error.response?.data || error.message
        });
    }
});

// --------------------------------------------------
// ACCOUNT API
// --------------------------------------------------

// app.get("/api/accounts", async (req, res) => {
//     try {
//         const soql = `
//             SELECT Id, Name, Industry, Phone, Website
//             FROM Account
//             ORDER BY CreatedDate DESC
//             LIMIT 20
//         `;

//         const response = await salesforceRequest(
//             req,
//             "GET",
//             `/services/data/v65.0/query?q=${encodeURIComponent(
//                 soql
//             )}`
//         );

//         res.json(response.data);
//     } catch (error) {
//         console.error(
//             "Account API Error:",
//             error.response?.data || error.message
//         );

//         res.status(500).json({
//             error: "Failed to fetch Account records",
//             details:
//                 error.response?.data ||
//                 error.message
//         });
//     }
// });

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});