require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const compression = require("compression");

const app = express();
const PORT = 5000;

// Middleware
app.use(compression()); // Enables Gzip compression for faster responses
app.use(cors());
app.use(bodyParser.json());
app.use(cors({ origin: 'https://highriz.in' }));

// **✅ Load Google Sheets Credentials**
const keyFilePath = path.join(__dirname, "genuine-airfoil-453109-u1-1225a3c0c95b.json");

// **Check if JSON key file exists**
if (!fs.existsSync(keyFilePath)) {
    console.error("❌ ERROR: Google Sheets JSON key file is missing!");
    process.exit(1);
}

const serviceAccount = require(keyFilePath);

// **Authenticate with Google Sheets API**
const client = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth: client });
const SPREADSHEET_ID = "1VpyZl0DvNvtj-LuTz8jV6oIZOiTZv_1Gu1VKLeiTE3w";
const RANGE = "Sheet1!A:F"; // Updated range to include phone number

// **✅ Test Google Sheets Authentication Before Starting the Server**
client.authorize((err) => {
    if (err) {
        console.error("❌ Google Authentication Failed:", err);
        process.exit(1);
    } else {
        console.log("✅ Google Authentication Successful!");
    }
});

// **✅ Form Submission API (Optimized Google Sheets & Emails)**
app.post("/submit", async (req, res) => {
    const { name, email, phone, service, message } = req.body;

    if (!name || !email || !phone || !service || !message) {
        return res.status(400).json({ success: false, message: "❌ All fields are required." });
    }

    // **Trim Input Data**
    const trimmedData = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        service: service.trim(),
        message: message.trim(),
        timestamp: new Date().toLocaleString(),
    };

    try {
        // **Google Sheets Update (Non-blocking)**
        sheets.spreadsheets.values.append(
            {
                spreadsheetId: SPREADSHEET_ID,
                range: RANGE,
                valueInputOption: "RAW",
                requestBody: {
                    values: [[
                        trimmedData.name,
                        trimmedData.email,
                        trimmedData.phone,
                        trimmedData.service,
                        trimmedData.message,
                        trimmedData.timestamp
                    ]],
                },
            },
            (err) => {
                if (err) {
                    console.error("❌ Google Sheets Error:", err);
                } else {
                    console.log("✅ Data saved to Google Sheets:", trimmedData);
                }
            }
        );

        // **Send Immediate Response (No Waiting for Emails)**
        res.json({ success: true, message: "✅ Data saved! Email will be sent shortly." });

        // **Send Email Confirmation to User & Team Lead Asynchronously**
        let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: trimmedData.email,
            subject: "🌿 Thank You for Contacting Us!",
            text: `Hello ${trimmedData.name},\n\nThank you for your interest in our ${trimmedData.service} service. We will get back to you soon!\n\n📞 Phone: ${trimmedData.phone}\n📩 Email: ${trimmedData.email}\n📜 Message: ${trimmedData.message}\n\nBest Regards,\nYour Company Name`,
        };

        const leadMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.TEAM_LEAD_EMAIL, // Notify team lead
            subject: "📩 New Service Inquiry Received",
            text: `Hello Team Lead,\n\nA new inquiry has been submitted.\n\n📌 Name: ${trimmedData.name}\n📌 Email: ${trimmedData.email}\n📌 Phone: ${trimmedData.phone}\n📌 Service: ${trimmedData.service}\n📌 Message: ${trimmedData.message}\n📌 Time: ${trimmedData.timestamp}\n\nPlease check and respond accordingly.`,
        };

        // **Send Emails in the Background (Non-blocking)**
        transporter.sendMail(userMailOptions, (err) => {
            if (err) console.error("❌ Email to User Failed:", err);
            else console.log("✅ Confirmation Email sent to User!");
        });

        transporter.sendMail(leadMailOptions, (err) => {
            if (err) console.error("❌ Email to Team Lead Failed:", err);
            else console.log("✅ Notification Email sent to Team Lead!");
        });

    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ success: false, message: "❌ Something went wrong." });
    }
});

// **✅ Start Server**
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
