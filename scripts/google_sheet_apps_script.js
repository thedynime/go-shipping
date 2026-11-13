/**
 * =========================================================================
 * GoShipping Official POS Ledger & Order Synchronization Script
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1qoEIU65CTDn_AYUyozRJiBJgnpWmmCThz4rM0jAWl8s/edit
 * Sheet / Tab Name: "All-in-One"
 * Total Columns: 30 (Columns A to AD)
 * =========================================================================
 *
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1qoEIU65CTDn_AYUyozRJiBJgnpWmmCThz4rM0jAWl8s/edit
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete any code in the editor, and paste this entire script.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Description: "GoShipping Live Ledger Webhook".
 * 7. Execute as: "Me" (your Google account).
 * 8. Who has access: "Anyone" (allows GoShipping server to POST order data).
 * 9. Click "Deploy" and copy the Web App URL (ends with /exec).
 * 10. Paste the Web App URL into your .env as:
 *     GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
 * =========================================================================
 */

var HEADERS = [
  "Order ID",                          // 1 (A)
  "Order Date",                        // 2 (B)
  "CN Date",                           // 3 (C)
  "BD Date",                           // 4 (D)
  "Customer Name",                     // 5 (E)
  "Mobile No",                         // 6 (F)
  "Importer / Client",                 // 7 (G)
  "Shipping Mark",                     // 8 (H)
  "Website Order No",                  // 9 (I)
  "Item / Product Details",            // 10 (J)
  "China Courier Tracking (SF/ZTO)",   // 11 (K)
  "Current Status",                    // 12 (L)
  "Supplier / Shop Name",              // 13 (M)
  "Quantity (Pcs)",                    // 14 (N)
  "Unit Price (RMB)",                  // 15 (O)
  "Total Purchase (RMB) [Auto]",       // 16 (P)
  "RMB Rate (BDT)",                    // 17 (Q)
  "Purchase Cost (BDT) [Auto]",        // 18 (R)
  "Purchase Cost Paid     [ Customer ]", // 19 (S)
  "Purchase Cost Due [Auto]",          // 20 (T)
  "Service Type",                      // 21 (U)
  "CN Weight (KG)",                    // 22 (V)
  "BD Weight (KG)",                    // 23 (W)
  "Shipping Rate / KG (BDT)",          // 24 (X)
  "International Freight (BDT) [Auto]", // 25 (Y)
  "Total Bill (BDT) [Auto]",           // 26 (Z)
  "Payment Status [Auto]",             // 27 (AA)
  "BD Tracking No",                    // 28 (AB)
  "Remark / Customer Update",          // 29 (AC)
  "Profit Estimate (BDT) [Auto]"       // 30 (AD)
];

/**
 * Initializes and styles the header row in the "All-in-One" sheet.
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("All-in-One") || ss.getActiveSheet();
  var firstCellVal = sheet.getRange(1, 1).getValue().toString().trim();

  // If row 1 is not already header, insert new row at top
  if (firstCellVal !== "Order ID") {
    sheet.insertRowBefore(1);
  }

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setBackground("#11181E")
             .setFontColor("#FFFFFF")
             .setFontWeight("bold")
             .setFontSize(10)
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle")
             .setWrap(true);

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  // Set plain text format for Order ID, Mobile, Tracking numbers to prevent formula errors
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("F:F").setNumberFormat("@");
  sheet.getRange("H:H").setNumberFormat("@");
  sheet.getRange("I:I").setNumberFormat("@");
  sheet.getRange("K:K").setNumberFormat("@");
  sheet.getRange("AB:AB").setNumberFormat("@");

  for (var c = 1; c <= HEADERS.length; c++) {
    sheet.autoResizeColumn(c);
  }
}

/**
 * Custom Menu inside Google Sheets
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 GoShipping')
    .addItem('⚙️ Setup Sheet Headers & Styling', 'setupSheet')
    .addToUi();
}

/**
 * Webhook handler for incoming order data from GoShipping portal.
 */
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("All-in-One") || ss.getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // If manual header setup action
    if (data.action === "setup_headers") {
      setupSheet();
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Headers initialized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var orderId = data.orderId;
    if (!orderId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing orderId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var lastRow = sheet.getLastRow();
    var targetRow = -1;

    // 1. Search if order already exists in Column A (from row 2 down)
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === String(orderId).trim()) {
          targetRow = i + 2;
          break;
        }
      }
    }

    // 2. If not found, find the first available row where Col A or Col E is empty
    if (targetRow === -1 && lastRow > 1) {
      var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var j = 0; j < colA.length; j++) {
        var valA = String(colA[j][0] || '').trim();
        if (valA === '') {
          targetRow = j + 2;
          break;
        }
      }
    }

    // Format phone number to force string
    var mobile = data.mobileNo ? String(data.mobileNo) : '';
    if (mobile && !mobile.startsWith("'")) {
      mobile = "'" + mobile;
    }

    // Build the 30-column row array
    var rowValues = [
      data.orderId || '',
      data.orderDate || '',
      data.cnDate || '',
      data.bdDate || '',
      data.customerName || '',
      mobile,
      data.importerClient || '',
      data.shippingMark || '',
      data.websiteOrderNo || '',
      data.itemDetails || '',
      data.chinaCourierTracking || '',
      data.currentStatus || 'Processing',
      data.supplierName || 'Taobao',
      Number(data.quantity) || 1,
      Number(data.unitPriceRmb) || 0,
      Number(data.totalPurchaseRmb) || 0,
      Number(data.rmbRateBdt) || 19.5,
      Number(data.purchaseCostBdt) || 0,
      Number(data.purchaseCostPaidBdt) || 0,
      Number(data.purchaseCostDueBdt) || 0,
      data.serviceType || 'Sourcing & Shipping',
      Number(data.cnWeightKg) || 0,
      Number(data.bdWeightKg) || 0,
      Number(data.shippingRatePerKgBdt) || 850,
      Number(data.internationalFreightBdt) || 0,
      Number(data.totalBillBdt) || 0,
      data.paymentStatus || 'Due',
      data.bdTrackingNo || '',
      data.remark || '',
      Number(data.profitEstimateBdt) || 0
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
      targetRow = sheet.getLastRow();
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      orderId: orderId,
      row: targetRow,
      action: targetRow > 0 ? 'updated' : 'appended'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
