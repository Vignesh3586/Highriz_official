const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

// Validate environment variables
const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASS', 'SPREADSHEET_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Load and validate credentials
let credentials;
try {
  const base64Credentials = fs.readFileSync("credentials_base64.txt", "utf8");
  credentials = JSON.parse(Buffer.from(base64Credentials, "base64").toString("utf8"));
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Invalid credentials format - missing client_email or private_key");
  }
} catch (err) {
  console.error("Failed to load credentials:", err);
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure multer with file filtering
const fileFilter = (req, file, cb) => {
      const allowedTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',                
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(null, false); // Reject the file
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Optional: Limit file size to 5MB
});

// Configure nodemailer with improved settings
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Only for development, remove in production
  }
});

// Improved email function
const sendMail = async (name, email, phone, message = "") => {
  try {
    const info = await transporter.sendMail({
      from: `HighRiz Contact <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New ${message ? 'contact' : 'enquiry'} from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`,
      html: `
        <p>
          <strong>Name:</strong> ${name}<br>
          <strong>Email:</strong> ${email}<br>
          <strong>Phone:</strong> ${phone}<br><br>
          ${message.replace(/\n/g, '<br>')}
        </p>
      `,
      replyTo: email
    });
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};

// Google API setup with verification
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file"
  ],
});

const spreadsheetId = process.env.SPREADSHEET_ID;

// Verify Google API access on startup
async function verifyGoogleAccess() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    await sheets.spreadsheets.get({ spreadsheetId });
    console.log("✅ Verified access to Google Sheets");
  } catch (err) {
    console.error("❌ Failed to access Google Sheets:", err.message);
    process.exit(1);
  }
}
verifyGoogleAccess();

// Contact form route
app.post("/contact-form", express.json(), async (req, res) => {
  try {
    
    // Validation
    const requiredFields = ['firstname', 'lastname', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const { firstname, lastname, email, service, subject, message, phone } = req.body;

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
     
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "ContactSheet!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [[firstname, lastname, phone, email, service, subject, message]],
      },
    });

    const name = `${firstname} ${lastname}`;
    await sendMail(name, email, phone, message);

    res.json({ message: "Thank you for contacting us" });
  } catch (error) {
    console.error("Error in contact form:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enquiry form route
app.post("/enquiry-form", upload.single('attach'), async (req, res) => {
  try {
      // Validation
      const { name, email, phone } = req.body;
      if (!name || !email || !phone) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "Missing required fields (name, email, phone)" });
      }

      if (!req.file) {
          return res.status(400).json({ error: "Please upload a file" });
      }

      const { subject } = req.body;
      const file = req.file;

      const client = await auth.getClient();
      const drive = google.drive({ version: 'v3', auth: client });
      const sheets = google.sheets({ version: "v4", auth: client });

      // Upload file to Google Drive
      const fileMetadata = {
          name: file.originalname, // Use originalname instead of filename
          parents: [process.env.DRIVE_FOLDER_ID || '1SylB2UoOYJJw6aFarKY7J9aUdYVqoQAH'],
          description: `Uploaded from enquiry form by ${name} (${email})`
      };

      const media = {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.path)
      };

      const driveResponse = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id,webViewLink,webContentLink'
      });

      // Add record to Google Sheets
      await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "EnquirySheet!A1",
          valueInputOption: "RAW",
          requestBody: {
              values: [[
                  name,
                  phone,
                  email,
                  subject || '', // Handle cases where subject might be missing
                  driveResponse.data.webViewLink || 'File uploaded'
              ]],
          },
      });

      // Send notification email
      await sendMail(
          name,
          email,
          phone,
          `New enquiry with attachment\nSubject: ${subject || 'No Subject'}\nFile: ${driveResponse.data.webViewLink}`
      );

      // Clean up
      fs.unlinkSync(file.path);

      res.json({
          message: "Thank you for your enquiry",
          fileLink: driveResponse.data.webViewLink
      });
  } catch (error) {
      console.error("Error in enquiry form:", error);

      if (req.file) {
          fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
          error: "Internal Server Error",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
