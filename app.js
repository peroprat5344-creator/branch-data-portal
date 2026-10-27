/**
 * =========================================================================
 * 🏦 BRANCH REPORTING PORTAL - CORE APPLICATION LOGIC (v2.1)
 * =========================================================================
 * 
 * 💡 महत्वपूर्ण: अपनी Google Sheet का Web App URL नीचे डालें।
 * इसे डालते ही दुनिया के किसी भी कोने से भरा गया डेटा आपकी Google Sheet
 * और एडमिन डैशबोर्ड दोनों में 100% लाइव दिखाई देने लगेगा।
 * =========================================================================
 */

// ⬇️ अपना Google Script Web App URL यहाँ डबल कोट्स ("") के अंदर पेस्ट करें ⬇️
const DEFAULT_GOOGLE_SCRIPT_URL = ""; 
const DEFAULT_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1AHoaMG-iQtm0cCQ84qBM55NiipqaQaHc9ELPkrAi8G0/edit?usp=sharing"; 

// Storage Keys
const STORAGE_KEY_DATA = 'branch_portal_records';
const STORAGE_KEY_SETTINGS = 'branch_portal_settings';
const STORAGE_KEY_ADMIN_AUTH = 'branch_portal_admin_auth';

// Global State
let portalSettings = loadSettings();
let allRecords = [];
let filteredRecords = [];
let currentDeviceSubmissions = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Set default reporting date to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('reportingDate');
  if (dateInput) dateInput.value = today;

  // Check backend configuration
  checkBackendConfigBanner();

  // Load records
  loadLocalRecords();

  // Check admin session
  checkAdminSession();

  // Update backend status badge
  updateBackendBadge();
});

// Load Settings
function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  let settings = {
    adminPin: '1234',
    googleScriptUrl: DEFAULT_GOOGLE_SCRIPT_URL || '',
    googleSheetViewUrl: DEFAULT_SHEET_VIEW_URL || ''
  };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      settings = { ...settings, ...parsed };
    } catch (e) {
      console.error('Error parsing settings:', e);
    }
  }

  // Hardcoded constants take precedence if defined in code
  if (DEFAULT_GOOGLE_SCRIPT_URL) {
    settings.googleScriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;
  }
  if (DEFAULT_SHEET_VIEW_URL) {
    settings.googleSheetViewUrl = DEFAULT_SHEET_VIEW_URL;
  }

  return settings;
}

// Check Backend Banner to guide user if URL is not configured
function checkBackendConfigBanner() {
  const banner = document.getElementById('configWarningBanner');
  if (!banner) return;

  if (!portalSettings.googleScriptUrl) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// Save Settings from Admin Modal
function saveSettings() {
  const scriptUrl = document.getElementById('googleScriptUrlInput').value.trim();
  const sheetViewUrl = document.getElementById('googleSheetViewUrlInput').value.trim();
  const newPin = document.getElementById('newAdminPinInput').value.trim();

  if (newPin && newPin.length < 4) {
    showAlert('त्रुटि', 'पिन कम से कम 4 अंकों का होना चाहिए।', 'error');
    return;
  }

  portalSettings.googleScriptUrl = scriptUrl;
  portalSettings.googleSheetViewUrl = sheetViewUrl;
  if (newPin) portalSettings.adminPin = newPin;

  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(portalSettings));
  updateBackendBadge();
  checkBackendConfigBanner();
  closeSettingsModal();
  showAlert('सफलता', 'सेटिंग्स सफलतापूर्वक सेव हो गई हैं!', 'success');

  // Trigger live data reload
  if (scriptUrl) {
    loadAdminData();
  }
}

// Open / Close Settings Modal
function openSettingsModal() {
  document.getElementById('googleScriptUrlInput').value = portalSettings.googleScriptUrl || '';
  document.getElementById('googleSheetViewUrlInput').value = portalSettings.googleSheetViewUrl || '';
  document.getElementById('newAdminPinInput').value = '';
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

// Open Google Sheet in new tab
function openGoogleSheet() {
  if (portalSettings.googleSheetViewUrl) {
    window.open(portalSettings.googleSheetViewUrl, '_blank');
  } else {
    showAlert('सूचना', 'Google Sheet View URL सेटिंग्स में दर्ज नहीं है। Settings बटन पर क्लिक करके लिंक डालें।', 'info');
    openSettingsModal();
  }
}

// Update Live Sync Badge in Header
function updateBackendBadge() {
  const badge = document.getElementById('backendBadge');
  if (!badge) return;
  if (portalSettings.googleScriptUrl) {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> Google Sheet Live`;
    badge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
  } else {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span> Local Mode (Google Sheet Not Linked)`;
    badge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300';
  }
}

// Navigation Tab Switch (Branch Entry vs Admin Portal)
function switchView(viewName) {
  const branchView = document.getElementById('branchView');
  const adminView = document.getElementById('adminView');
  const navBranchBtn = document.getElementById('navBranchBtn');
  const navAdminBtn = document.getElementById('navAdminBtn');

  if (viewName === 'branch') {
    branchView.classList.remove('hidden');
    adminView.classList.add('hidden');

    navBranchBtn.className = 'px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-white text-bank-800 shadow transition-all flex items-center space-x-1.5';
    navAdminBtn.className = 'px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center space-x-1.5 border border-white/10';
  } else {
    branchView.classList.add('hidden');
    adminView.classList.remove('hidden');

    navAdminBtn.className = 'px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-white text-bank-800 shadow transition-all flex items-center space-x-1.5';
    navBranchBtn.className = 'px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center space-x-1.5 border border-white/10';

    checkAdminSession();
  }
}

// Target vs Achievement Percentage Auto-Calculation
function calculateAchievementPercentage() {
  const target = parseFloat(document.getElementById('targetAmount').value);
  const achieved = parseFloat(document.getElementById('achievementAmount').value);
  const pctInput = document.getElementById('achievementPercentage');
  const badge = document.getElementById('achievementBadge');

  if (isNaN(target) || target <= 0 || isNaN(achieved)) {
    pctInput.value = '0.00%';
    badge.textContent = 'Pending';
    badge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 text-slate-700 whitespace-nowrap';
    return;
  }

  const pct = (achieved / target) * 100;
  pctInput.value = pct.toFixed(2) + '%';

  if (pct >= 100) {
    badge.textContent = '100%+ Excellent';
    badge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap';
  } else if (pct >= 80) {
    badge.textContent = 'Good';
    badge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap';
  } else if (pct >= 50) {
    badge.textContent = 'Average';
    badge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap';
  } else {
    badge.textContent = 'Needs Focus';
    badge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap';
  }
}

// Handle Scheme selection
function handleCategoryChange() {
  const scheme = document.getElementById('schemeCategory').value;
  const customDiv = document.getElementById('customSchemeDiv');
  const customInput = document.getElementById('customSchemeName');

  if (scheme === 'Other') {
    customDiv.classList.remove('hidden');
    customInput.required = true;
  } else {
    customDiv.classList.add('hidden');
    customInput.required = false;
  }
}

// ==================== BRANCH FORM SUBMISSION ====================
async function handleBranchSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const originalBtnHtml = submitBtn.innerHTML;

  // Gather values
  const branchCode = document.getElementById('branchCode').value.trim().toUpperCase();
  const branchName = document.getElementById('branchName').value.trim();
  const reportingDate = document.getElementById('reportingDate').value;
  let scheme = document.getElementById('schemeCategory').value;
  if (scheme === 'Other') {
    scheme = document.getElementById('customSchemeName').value.trim() || 'Other';
  }

  const targetAmount = parseFloat(document.getElementById('targetAmount').value) || 0;
  const achievementAmount = parseFloat(document.getElementById('achievementAmount').value) || 0;
  const measurementUnit = document.getElementById('measurementUnit').value;
  const achievementPercentage = targetAmount > 0 ? ((achievementAmount / targetAmount) * 100).toFixed(2) + '%' : '0.00%';

  const officerName = document.getElementById('officerName').value.trim();
  const officerDesignation = document.getElementById('officerDesignation').value;
  const officerPhone = document.getElementById('officerPhone').value.trim();
  const remarks = document.getElementById('remarks').value.trim();

  // Generate Reference ID
  const dateStr = reportingDate.replace(/-/g, '');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const refId = `REF-${dateStr}-${branchCode}-${randomSuffix}`;
  const timestamp = new Date().toLocaleString('en-IN');

  const newRecord = {
    refId,
    timestamp,
    reportingDate,
    branchCode,
    branchName,
    scheme,
    targetAmount,
    achievementAmount,
    achievementPercentage,
    measurementUnit,
    officerName,
    officerDesignation,
    officerPhone,
    remarks
  };

  // UI Loading State
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>डेटा Google Sheet में सेव हो रहा है...</span>`;

  try {
    // 1. Send to Google Sheets Web App
    if (portalSettings.googleScriptUrl) {
      // Use text/plain with no-cors to prevent OPTIONS preflight blocking in browsers
      await fetch(portalSettings.googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(newRecord)
      });
    }

    // 2. Save into LocalStorage for current device acknowledgement
    currentDeviceSubmissions.unshift(newRecord);
    renderBranchHistory();

    // Also update allRecords locally
    allRecords.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(allRecords));

    // 3. Show Acknowledgement Slip Modal
    showReceiptModal(newRecord);

    // 4. Reset form (keep branch info for convenience)
    document.getElementById('schemeCategory').value = '';
    document.getElementById('targetAmount').value = '';
    document.getElementById('achievementAmount').value = '';
    document.getElementById('achievementPercentage').value = '0.00%';
    document.getElementById('remarks').value = '';
    document.getElementById('customSchemeDiv').classList.add('hidden');
    calculateAchievementPercentage();

    showAlert('सफलता', `रिपोर्ट सफलतापूर्वक दर्ज हो गई है! Ref ID: ${refId}`, 'success');
  } catch (error) {
    console.error('Submission error:', error);
    showAlert('चेतावनी', 'डेटा स्थानीय रूप से सुरक्षित हो गया है, लेकिन Google Sheet से कनेक्ट नहीं हो सका।', 'warning');
    showReceiptModal(newRecord);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
  }
}

// Show Receipt Modal
function showReceiptModal(record) {
  document.getElementById('receiptRefId').textContent = record.refId;
  document.getElementById('receiptTimestamp').textContent = record.timestamp;
  document.getElementById('receiptBranch').textContent = `${record.branchName} (${record.branchCode})`;
  document.getElementById('receiptScheme').textContent = record.scheme;
  document.getElementById('receiptTarget').textContent = `${record.targetAmount} (${record.measurementUnit})`;
  document.getElementById('receiptAchievement').textContent = `${record.achievementAmount} (${record.measurementUnit})`;
  document.getElementById('receiptPercentage').textContent = record.achievementPercentage;
  document.getElementById('receiptOfficer').textContent = `${record.officerName} (${record.officerDesignation})`;

  document.getElementById('receiptModal').classList.remove('hidden');
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.add('hidden');
}

// Render Local Branch History Table
function renderBranchHistory() {
  const tbody = document.getElementById('branchHistoryTableBody');
  const countBadge = document.getElementById('localSubCount');
  if (!tbody) return;

  countBadge.textContent = `${currentDeviceSubmissions.length} entries`;

  if (currentDeviceSubmissions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-6 text-slate-400">
          अभी तक इस डिवाइस से कोई सबमिशन नहीं हुआ है। ऊपर फॉर्म भरकर सबमिट करें।
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentDeviceSubmissions.slice(0, 10).map(rec => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="py-2.5 px-3 font-mono font-semibold text-bank-700">${rec.refId}</td>
      <td class="py-2.5 px-3 text-slate-600">${rec.reportingDate}</td>
      <td class="py-2.5 px-3 font-medium text-slate-800">${rec.branchName} <span class="text-slate-400 font-mono">(${rec.branchCode})</span></td>
      <td class="py-2.5 px-3 text-slate-700">${rec.scheme}</td>
      <td class="py-2.5 px-3 text-right font-mono font-medium">${rec.targetAmount}</td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">${rec.achievementAmount}</td>
      <td class="py-2.5 px-3 text-center font-mono font-bold">
        <span class="px-2 py-0.5 rounded ${parseFloat(rec.achievementPercentage) >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
          ${rec.achievementPercentage}
        </span>
      </td>
      <td class="py-2.5 px-3 text-center">
        <button onclick='showReceiptModal(${JSON.stringify(rec).replace(/'/g, "&apos;")})' class="text-bank-600 hover:text-bank-800 font-bold p-1">
          <i class="fa-solid fa-receipt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ==================== ADMIN DASHBOARD LOGIC ====================

// Check Admin Login Session
function checkAdminSession() {
  const isAuth = sessionStorage.getItem(STORAGE_KEY_ADMIN_AUTH) === 'true';
  const loginCard = document.getElementById('adminLoginCard');
  const dashboardContent = document.getElementById('adminDashboardContent');

  if (isAuth) {
    loginCard.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    loadAdminData();
  } else {
    loginCard.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
  }
}

// Toggle Admin PIN eye icon
function togglePinVisibility() {
  const pinInput = document.getElementById('adminPinInput');
  const icon = document.getElementById('pinToggleIcon');
  if (pinInput.type === 'password') {
    pinInput.type = 'text';
    icon.className = 'fa-regular fa-eye-slash';
  } else {
    pinInput.type = 'password';
    icon.className = 'fa-regular fa-eye';
  }
}

// Handle Admin Login
function handleAdminLogin(event) {
  event.preventDefault();
  const enteredPin = document.getElementById('adminPinInput').value.trim();

  if (enteredPin === portalSettings.adminPin) {
    sessionStorage.setItem(STORAGE_KEY_ADMIN_AUTH, 'true');
    checkAdminSession();
    showAlert('स्वागत है', 'Admin Dashboard में आपका स्वागत है!', 'success');
  } else {
    showAlert('लॉगिन विफल', 'अमान्य एडमिन पिन (Invalid PIN)! कृपया पुनः प्रयास करें।', 'error');
  }
}

// Admin Logout
function adminLogout() {
  sessionStorage.removeItem(STORAGE_KEY_ADMIN_AUTH);
  checkAdminSession();
  showAlert('अलविदा', 'आप सफलतापूर्वक लॉगआउट हो गए हैं।', 'info');
}

// Load Records LIVE from Google Sheet or LocalStorage
async function loadAdminData() {
  const syncStatus = document.getElementById('adminSyncStatus');
  
  if (portalSettings.googleScriptUrl) {
    if (syncStatus) {
      syncStatus.innerHTML = `<span class="inline-flex items-center text-blue-600"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Google Sheet से लाइव डेटा लोड हो रहा है...</span>`;
    }

    try {
      // Add timestamp to prevent browser caching of Google Apps Script GET requests
      const fetchUrl = portalSettings.googleScriptUrl + (portalSettings.googleScriptUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      const response = await fetch(fetchUrl);
      const json = await response.json();

      if (Array.isArray(json)) {
        allRecords = json;
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(allRecords));
        if (syncStatus) {
          syncStatus.innerHTML = `<span class="inline-flex items-center text-emerald-700 font-semibold"><i class="fa-solid fa-cloud-arrow-down mr-1"></i> Live Google Sheet Data (${allRecords.length} Rows)</span>`;
        }
      }
    } catch (e) {
      console.warn('Google Apps Script fetch error, loading cached data:', e);
      if (syncStatus) {
        syncStatus.innerHTML = `<span class="inline-flex items-center text-amber-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Google Sheet कनेक्ट नहीं हो सकी (Cached Local Data)</span>`;
      }
      loadLocalRecords();
    }
  } else {
    if (syncStatus) {
      syncStatus.innerHTML = `<span class="inline-flex items-center text-rose-700"><i class="fa-solid fa-circle-exclamation mr-1"></i> Google Sheet URL सेट नहीं है (Local Mode)</span>`;
    }
    loadLocalRecords();
  }

  filteredRecords = [...allRecords];
  updateAdminKPIs();
  renderAdminTable();
}

// Load records from LocalStorage
function loadLocalRecords() {
  const saved = localStorage.getItem(STORAGE_KEY_DATA);
  if (saved) {
    try {
      allRecords = JSON.parse(saved);
      currentDeviceSubmissions = [...allRecords];
    } catch (e) {
      allRecords = [];
    }
  }
  renderBranchHistory();
}

// Update Admin KPI Cards
function updateAdminKPIs() {
  const totalEntries = allRecords.length;
  const uniqueBranches = new Set(allRecords.map(r => r.branchCode)).size;

  let totalTarget = 0;
  let totalAchieved = 0;

  allRecords.forEach(r => {
    totalTarget += parseFloat(r.targetAmount) || 0;
    totalAchieved += parseFloat(r.achievementAmount) || 0;
  });

  const overallPct = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(2) + '%' : '0.00%';

  document.getElementById('statTotalSubmissions').textContent = totalEntries;
  document.getElementById('statActiveBranches').textContent = uniqueBranches;
  document.getElementById('statTotalTarget').textContent = totalTarget.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  document.getElementById('statTotalAchievement').textContent = overallPct;
}

// Filter Admin Table by Search and Scheme
function filterAdminTable() {
  const query = (document.getElementById('adminSearchQuery').value || '').trim().toLowerCase();
  const selectedScheme = document.getElementById('adminFilterScheme').value;

  filteredRecords = allRecords.filter(rec => {
    const matchesQuery = !query || 
      rec.refId.toLowerCase().includes(query) ||
      rec.branchCode.toLowerCase().includes(query) ||
      rec.branchName.toLowerCase().includes(query) ||
      rec.officerName.toLowerCase().includes(query);

    const matchesScheme = !selectedScheme || rec.scheme === selectedScheme;

    return matchesQuery && matchesScheme;
  });

  renderAdminTable();
}

// Reset Filters
function resetAdminFilters() {
  document.getElementById('adminSearchQuery').value = '';
  document.getElementById('adminFilterScheme').value = '';
  filteredRecords = [...allRecords];
  renderAdminTable();
}

// Render Master Data Table in Admin View
function renderAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  const badge = document.getElementById('filteredCountBadge');
  if (!tbody) return;

  badge.textContent = `Showing ${filteredRecords.length} of ${allRecords.length} records`;

  if (filteredRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-10 text-slate-400">
          कोई रिकॉर्ड नहीं मिला। खोज मानदंड बदलें या नई एंट्री करें।
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredRecords.map(rec => `
    <tr class="hover:bg-blue-50/40 transition-colors">
      <td class="py-3 px-3.5 font-mono font-bold text-bank-700 whitespace-nowrap">${rec.refId}</td>
      <td class="py-3 px-3.5 text-slate-600 whitespace-nowrap">${rec.reportingDate}</td>
      <td class="py-3 px-3.5 font-mono font-bold text-slate-800">${rec.branchCode}</td>
      <td class="py-3 px-3.5 font-semibold text-slate-800">${rec.branchName}</td>
      <td class="py-3 px-3.5"><span class="px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">${rec.scheme}</span></td>
      <td class="py-3 px-3.5 text-right font-mono font-semibold">${rec.targetAmount} <span class="text-[10px] text-slate-400 block">${rec.measurementUnit}</span></td>
      <td class="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">${rec.achievementAmount}</td>
      <td class="py-3 px-3.5 text-center font-mono font-bold">
        <span class="px-2 py-0.5 rounded text-xs ${parseFloat(rec.achievementPercentage) >= 100 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800'}">
          ${rec.achievementPercentage}
        </span>
      </td>
      <td class="py-3 px-3.5">
        <div class="font-semibold text-slate-800">${rec.officerName}</div>
        <div class="text-[10px] text-slate-500">${rec.officerDesignation} | <a href="tel:${rec.officerPhone}" class="text-blue-600 underline">${rec.officerPhone}</a></div>
      </td>
      <td class="py-3 px-3.5 text-slate-600 max-w-[150px] truncate" title="${rec.remarks || ''}">${rec.remarks || '-'}</td>
      <td class="py-3 px-3.5 text-center whitespace-nowrap">
        <button onclick='showReceiptModal(${JSON.stringify(rec).replace(/'/g, "&apos;")})' class="p-1.5 text-bank-600 hover:text-bank-800" title="रसीद देखें">
          <i class="fa-solid fa-receipt"></i>
        </button>
        <button onclick="deleteRecord('${rec.refId}')" class="p-1.5 text-rose-500 hover:text-rose-700 ml-1" title="हटाएं (Delete)">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Delete Record
function deleteRecord(refId) {
  if (confirm(`क्या आप वाकई इस रिकॉर्ड (Ref: ${refId}) को हटाना चाहते हैं?`)) {
    allRecords = allRecords.filter(r => r.refId !== refId);
    filteredRecords = filteredRecords.filter(r => r.refId !== refId);
    currentDeviceSubmissions = currentDeviceSubmissions.filter(r => r.refId !== refId);

    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(allRecords));
    updateAdminKPIs();
    renderAdminTable();
    renderBranchHistory();
    showAlert('हटाया गया', `रिकॉर्ड ${refId} हटा दिया गया है। (नोट: Google Sheet से स्थायी हटाने के लिए सीधे Sheet से रो डिलीट करें)`, 'info');
  }
}

// ==================== 1-CLICK EXCEL EXPORT (.XLSX) ====================
function exportToExcel() {
  if (allRecords.length === 0) {
    showAlert('त्रुटि', 'डाउनलोड करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।', 'warning');
    return;
  }

  // Prepare clean structured rows for Excel
  const excelData = filteredRecords.map((r, index) => ({
    'S.No': index + 1,
    'Reference ID': r.refId,
    'Submission Timestamp': r.timestamp,
    'Reporting Date': r.reportingDate,
    'Branch Code': r.branchCode,
    'Branch Name': r.branchName,
    'Scheme / Category': r.scheme,
    'Unit': r.measurementUnit,
    'Target Assigned': r.targetAmount,
    'Actual Achievement': r.achievementAmount,
    'Achievement %': r.achievementPercentage,
    'Officer Name': r.officerName,
    'Designation': r.officerDesignation,
    'Mobile Number': r.officerPhone,
    'Remarks': r.remarks || ''
  }));

  // Create SheetJS Worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Auto-fit column widths
  const colWidths = [
    { wch: 6 },  // S.No
    { wch: 22 }, // Ref ID
    { wch: 22 }, // Timestamp
    { wch: 14 }, // Date
    { wch: 12 }, // Branch Code
    { wch: 25 }, // Branch Name
    { wch: 30 }, // Scheme
    { wch: 25 }, // Unit
    { wch: 16 }, // Target
    { wch: 18 }, // Achieved
    { wch: 15 }, // %
    { wch: 22 }, // Officer Name
    { wch: 20 }, // Designation
    { wch: 14 }, // Phone
    { wch: 30 }  // Remarks
  ];
  worksheet['!cols'] = colWidths;

  // Create Workbook and Append
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Branch_Reporting_Data');

  // Generate file name with current timestamp
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Branch_Target_Achievement_Report_${dateStr}.xlsx`;

  // Trigger download
  XLSX.writeFile(workbook, fileName);

  showAlert('डाउनलोड शुरू', `Excel फाइल (${fileName}) सफलतापूर्वक डाउनलोड हो रही है!`, 'success');
}

// Show Alert Notification Banner
function showAlert(title, message, type = 'info') {
  const alertContainer = document.getElementById('statusAlert');
  const alertBox = document.getElementById('statusAlertBox');
  const alertIcon = document.getElementById('statusAlertIcon');
  const alertTitle = document.getElementById('statusAlertTitle');
  const alertMsg = document.getElementById('statusAlertMessage');

  alertTitle.textContent = title;
  alertMsg.textContent = message;

  if (type === 'success') {
    alertBox.className = 'p-4 rounded-xl flex items-start space-x-3 shadow-md border text-sm bg-emerald-50 text-emerald-800 border-emerald-300';
    alertIcon.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600"></i>`;
  } else if (type === 'error') {
    alertBox.className = 'p-4 rounded-xl flex items-start space-x-3 shadow-md border text-sm bg-rose-50 text-rose-800 border-rose-300';
    alertIcon.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-600"></i>`;
  } else if (type === 'warning') {
    alertBox.className = 'p-4 rounded-xl flex items-start space-x-3 shadow-md border text-sm bg-amber-50 text-amber-800 border-amber-300';
    alertIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-600"></i>`;
  } else {
    alertBox.className = 'p-4 rounded-xl flex items-start space-x-3 shadow-md border text-sm bg-blue-50 text-blue-800 border-blue-300';
    alertIcon.innerHTML = `<i class="fa-solid fa-circle-info text-blue-600"></i>`;
  }

  alertContainer.classList.remove('hidden');

  setTimeout(() => {
    dismissAlert();
  }, 5000);
}

function dismissAlert() {
  const alertContainer = document.getElementById('statusAlert');
  if (alertContainer) alertContainer.classList.add('hidden');
}
