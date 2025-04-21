const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs=require('fs');
const base64Credentials = fs.readFileSync("credentials_base64.txt", "utf8");

const credentials = JSON.parse(Buffer.from(base64Credentials, "base64").toString("utf8"));
require("dotenv").config();



const app = express();
app.use(cors());
app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
    service: "gmail", 
    auth: {
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASS, 
    },
  });


  // Send email function
const sendMail = async (firstname,lastname,email) => {
    const name=`${firstname} ${lastname}`
    try {
      const info = await transporter.sendMail({
        from: `${name} ${process.env.EMAIL_USER}`, 
        to:process.env.EMAIL_USER, 
        subject:`Message from ${name} in HighRiz`, 
        text:`Name: ${name}\nEmail: ${email}\n\nMessage:New client registered`,
        replyTo:email
      });
  
      console.log("Email sent:", info.messageId);
      return info;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  };

// Load Google Sheets API credentials
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId = process.env.SPREADSHEET_ID; // Replace with your Google Sheet ID

app.post("/send-data", async (req, res) => {
  try {
    const {firstname,lastname,email,subject,message} = req.body;
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

   const response=await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A1:C1",
      valueInputOption: "RAW",
      requestBody: {
        values: [[firstname,lastname,email,subject,message]],
      },
    });
    if(response){
        await sendMail(firstname,lastname,email)
    }
     
    
    res.json({ message: "Data added to Google Sheets!" });
  } catch (error) {
    console.error("Error adding data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
