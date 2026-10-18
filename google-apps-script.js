/**
 * Google Apps Script for Corelia Academy Form Submissions
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with 3 tabs: "Waitlist", "Contact", and "Subscribe"
 * 2. In "Waitlist" tab, add headers in row 1: Timestamp | Name | Email | Phone | Role
 * 3. In "Contact" tab, add headers in row 1: Timestamp | FullName | Email | Phone | Subject | Message
 * 3b. In "Subscribe" tab, add headers in row 1: Timestamp | Email
 * 4. Go to Extensions > Apps Script
 * 5. Paste this entire code into the script editor
 * 6. Update NOTIFICATION_EMAIL below with your email
 * 7. Click Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy the Web App URL and paste it into src/lib/submitForm.ts as APPS_SCRIPT_URL
 * 9. On first form submission, Google will ask you to authorize the script
 */

var NOTIFICATION_EMAIL = "terran@corelia.academy"; // <-- Change this to your email

function safeText(val) {
  var s = String(val || "");
  if (/^[+=\-@]/.test(s)) return "'" + s;
  return s;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var formType = data.formType;

    if (formType === "waitlist") {
      var sheet = ss.getSheetByName("Waitlist");
      sheet.appendRow([
        new Date().toISOString(),
        data.name || "",
        data.email || "",
        safeText(data.phone),
        data.role || "",
      ]);

      GmailApp.sendEmail(
        NOTIFICATION_EMAIL,
        "[Corelia] New Waitlist Signup: " + data.name,
        "New waitlist registration:\n\n" +
          "Name: " +
          data.name +
          "\n" +
          "Email: " +
          data.email +
          "\n" +
          "Phone: " +
          data.phone +
          "\n" +
          "Role: " +
          data.role +
          "\n" +
          "Time: " +
          new Date().toLocaleString("vi-VN"),
      );
    } else if (formType === "contact") {
      var contactName = String(
        data.fullName || [data.firstName, data.lastName].filter(Boolean).join(" "),
      ).trim();
      var sheet = ss.getSheetByName("Contact");
      sheet.appendRow([
        new Date().toISOString(),
        contactName,
        data.email || "",
        safeText(data.phone),
        data.subject || "",
        data.message || "",
      ]);

      GmailApp.sendEmail(
        NOTIFICATION_EMAIL,
        "[Corelia] New Contact: " +
          contactName +
          " - " +
          data.subject,
          "New contact form submission:\n\n" +
          "Name: " +
          contactName +
          "\n" +
          "Email: " +
          data.email +
          "\n" +
          "Phone: " +
          data.phone +
          "\n" +
          "Subject: " +
          data.subject +
          "\n" +
          "Message: " +
          data.message +
          "\n" +
          "Time: " +
          new Date().toLocaleString("vi-VN"),
      );
    } else if (formType === "subscribe") {
      var sheet = ss.getSheetByName("Subscribe");
      sheet.appendRow([
        new Date().toISOString(),
        data.email || "",
      ]);

      GmailApp.sendEmail(
        NOTIFICATION_EMAIL,
        "[Corelia] New Subscriber: " + data.email,
        "New email subscriber:\n\n" +
          "Email: " + data.email + "\n" +
          "Time: " + new Date().toLocaleString("vi-VN"),
      );
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ result: "error", message: "Unknown formType" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ result: "success" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ result: "error", message: error.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "Corelia Forms API is running" }),
  ).setMimeType(ContentService.MimeType.JSON);
}
