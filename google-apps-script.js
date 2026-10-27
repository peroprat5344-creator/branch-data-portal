/**
 * =========================================================================
 * GOOGLE APPS SCRIPT CODE (Branch Data Portal Backend - v2.0)
 * =========================================================================
 * 
 * ⚠️ अति महत्वपूर्ण निर्देश (Crucial Deployment Settings):
 * 1. अपनी Google Sheet खोलें (उदा. https://sheets.new).
 * 2. मेनू में "Extensions" > "Apps Script" खोलें।
 * 3. यह पूरा कोड वहाँ पेस्ट करें और Save (💾) करें।
 * 4. ऊपर "Deploy" > "New deployment" चुनें:
 *    - Type (गियर ⚙️): "Web app"
 *    - Description: "Branch Portal API v2"
 *    - Execute as: "Me" (आपकी अपनी ईमेल)
 *    - Who has access: "Anyone" (कोई भी - इसे 'Anyone' रखना अनिवार्य है!)
 * 5. "Deploy" पर क्लिक करें और "Authorize access" (Allow) करें।
 * 6. जो "Web app URL" मिले, उसे app.js में DEFAULT_GOOGLE_SCRIPT_URL में डालें।
 * =========================================================================
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Check if headers need to be added
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Reference ID",
        "Submission Timestamp",
        "Reporting Date",
        "Branch Code",
        "Branch Name",
        "Scheme / Category",
        "Measurement Unit",
        "Target Assigned",
        "Actual Achievement",
        "% Achievement",
        "Officer Name",
        "Designation",
        "Mobile Number",
        "Remarks"
      ]);
      // Format header row
      var headerRange = sheet.getRange(1, 1, 1, 14);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e40af");
      headerRange.setFontColor("#ffffff");
    }

    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    sheet.appendRow([
      data.refId || "",
      data.timestamp || new Date().toLocaleString(),
      data.reportingDate || "",
      data.branchCode || "",
      data.branchName || "",
      data.scheme || "",
      data.measurementUnit || "",
      data.targetAmount || 0,
      data.achievementAmount || 0,
      data.achievementPercentage || "",
      data.officerName || "",
      data.officerDesignation || "",
      data.officerPhone ? "'" + data.officerPhone : "",
      data.remarks || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data recorded successfully",
      refId: data.refId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rows = sheet.getDataRange().getValues();
    
    if (rows.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    var result = [];
    // Skip row 0 (headers)
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0] && !row[2] && !row[3]) continue; // Skip empty rows

      var dateVal = row[2];
      var formattedDate = "";
      if (dateVal instanceof Date) {
        formattedDate = Utilities.formatDate(dateVal, Session.getScriptTimeZone() || "Asia/Kolkata", "yyyy-MM-dd");
      } else {
        formattedDate = String(dateVal || "");
      }

      result.push({
        refId: String(row[0] || ""),
        timestamp: String(row[1] || ""),
        reportingDate: formattedDate,
        branchCode: String(row[3] || ""),
        branchName: String(row[4] || ""),
        scheme: String(row[5] || ""),
        measurementUnit: String(row[6] || ""),
        targetAmount: Number(row[7]) || 0,
        achievementAmount: Number(row[8]) || 0,
        achievementPercentage: String(row[9] || ""),
        officerName: String(row[10] || ""),
        officerDesignation: String(row[11] || ""),
        officerPhone: String(row[12] || "").replace(/^'/, ""),
        remarks: String(row[13] || "")
      });
    }

    // Return in reverse order (latest entries at the top)
    result.reverse();

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
