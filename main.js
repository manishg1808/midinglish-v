const coachingLat =  21.223581;
const coachingLon =  81.653684;
const allowedRadiusMeters = 100;

const ADMIN_USERNAME = "vks@485";
const ADMIN_PASSWORD = "vikash@485#";
const ATTENDANCE_STORAGE_KEY = "attendance";
let isAdminLoggedIn = false;
let currentAdminFilter = "today";
let selectedCustomDate = "";
let adminSearchTerm = "";

function getDistance(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371e3;

  const lat1Radians = lat1 * Math.PI / 180;
  const lat2Radians = lat2 * Math.PI / 180;

  const deltaLat = (lat2 - lat1) * Math.PI / 180;
  const deltaLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Radians) * Math.cos(lat2Radians) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function parseAttendanceEntry(entry) {
  if (typeof entry === "string") {
    const separator = " - ";
    const separatorIndex = entry.indexOf(separator);

    if (separatorIndex === -1) {
      return {
        name: entry || "Unknown Student",
        phone: "-",
        timestamp: "Unknown time",
        isoTimestamp: "",
        distance: null
      };
    }

    return {
      name: entry.slice(0, separatorIndex).trim() || "Unknown Student",
      phone: "-",
      timestamp: entry.slice(separatorIndex + separator.length).trim() || "Unknown time",
      isoTimestamp: "",
      distance: null
    };
  }

  if (entry && typeof entry === "object") {
    return {
      name: String(entry.name || "Unknown Student"),
      phone: String(entry.phone || entry.mobile || "-"),
      timestamp: String(entry.timestamp || entry.date || "Unknown time"),
      isoTimestamp: String(entry.isoTimestamp || ""),
      distance: Number.isFinite(entry.distance) ? Math.round(entry.distance) : null
    };
  }

  return null;
}

function readAttendance() {
  const rawData = JSON.parse(localStorage.getItem(ATTENDANCE_STORAGE_KEY)) || [];

  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData.map(parseAttendanceEntry).filter(Boolean);
}

function saveAttendance(records) {
  localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
}

function setMessage(text, type) {
  const messageElement = document.getElementById("message");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = text;
  messageElement.className = "message " + (type || "info");
}

function setLoginMessage(text, type) {
  const loginMessage = document.getElementById("loginMessage");

  if (!loginMessage) {
    return;
  }

  loginMessage.textContent = text;
  loginMessage.className = "message " + (type || "info");
}

function setAdminMessage(text, type) {
  const adminMessage = document.getElementById("adminMessage");

  if (!adminMessage) {
    return;
  }

  adminMessage.textContent = text;
  adminMessage.className = "message " + (type || "info");
}

function updateSummary(records) {
  const totalCountElement = document.getElementById("totalCount");

  if (!totalCountElement) {
    return;
  }

  totalCountElement.textContent = String(records.length);
}

function getValidatedPhone(rawPhone) {
  const cleaned = rawPhone.replace(/\D/g, "");

  if (cleaned.length < 10 || cleaned.length > 13) {
    return null;
  }

  return cleaned;
}

function markAttendance() {
  const nameInput = document.getElementById("name");
  const phoneInput = document.getElementById("phone");

  if (!nameInput || !phoneInput) {
    return;
  }

  const name = nameInput.value.trim();
  const rawPhone = phoneInput.value.trim();

  if (!name) {
    setMessage("Please enter student name.", "error");
    nameInput.focus();
    return;
  }

  if (!rawPhone) {
    setMessage("Please enter phone number.", "error");
    phoneInput.focus();
    return;
  }

  const phone = getValidatedPhone(rawPhone);

  if (!phone) {
    setMessage("Please enter a valid phone number (10-13 digits).", "error");
    phoneInput.focus();
    return;
  }

  if (!navigator.geolocation) {
    setMessage("Geolocation is not supported on this device.", "error");
    return;
  }

  setMessage("Checking live location...", "info");

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const studentLat = position.coords.latitude;
      const studentLon = position.coords.longitude;

      const distance = getDistance(studentLat, studentLon, coachingLat, coachingLon);

      if (distance <= allowedRadiusMeters) {
        const records = readAttendance();
        const now = new Date();
        const today = new Date().toDateString();

const alreadyMarked = records.some(function (record) {
  const recordDate = getRecordDate(record);

  return (
    record.phone === phone &&
    recordDate &&
    recordDate.toDateString() === today
  );
});

if (alreadyMarked) {
  setMessage("⚠️ Attendance already marked today.", "error");
  return;
}

        records.push({
          name: name,
          phone: phone,
          timestamp: now.toLocaleString(),
          isoTimestamp: now.toISOString(),
          distance: Math.round(distance)
        });

        saveAttendance(records);
        updateSummary(records);
        setMessage("Attendance marked for " + name + ".", "success");

        nameInput.value = "";
        phoneInput.value = "";

        if (isAdminLoggedIn) {
          renderAdminTable();
          setAdminMessage("Attendance log updated.", "success");
        }

        return;
      }

      setMessage("You are outside coaching area. Current distance: " + Math.round(distance) + "m.", "error");
    },
    function (error) {
      if (error.code === error.PERMISSION_DENIED) {
        setMessage("Location permission denied. Please allow location and try again.", "error");
        return;
      }

      if (error.code === error.TIMEOUT) {
        setMessage("Location request timed out. Try again with better GPS signal.", "error");
        return;
      }

      setMessage("Could not get your location. Please try again.", "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function showAdminView() {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("adminView").classList.remove("hidden");
}

function showLoginView() {
  document.getElementById("loginView").classList.remove("hidden");
  document.getElementById("adminView").classList.add("hidden");
}

function handleAdminLogin() {
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");

  if (!usernameInput || !passwordInput) {
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setLoginMessage("Please enter username and password.", "error");
    return;
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    isAdminLoggedIn = true;
    currentAdminFilter = "today";
    selectedCustomDate = "";
    adminSearchTerm = "";
    setActiveFilterButton(currentAdminFilter);

    const customDateInput = document.getElementById("customDateFilter");
    if (customDateInput) {
      customDateInput.value = "";
    }

    const searchInput = document.getElementById("adminSearch");
    if (searchInput) {
      searchInput.value = "";
    }

    showAdminView();
    renderAdminTable();
    setLoginMessage("Login successful.", "success");
    setAdminMessage("Attendance log loaded.", "success");
    passwordInput.value = "";
    return;
  }

  isAdminLoggedIn = false;
  showLoginView();
  setLoginMessage("Invalid username or password.", "error");
}

function handleLogout() {
  isAdminLoggedIn = false;
  currentAdminFilter = "today";
  selectedCustomDate = "";
  adminSearchTerm = "";
  setActiveFilterButton(currentAdminFilter);

  document.getElementById("adminUsername").value = "";
  const passwordInput = document.getElementById("adminPassword");
  if (passwordInput) {
    passwordInput.value = "";
  }

  const customDateInput = document.getElementById("customDateFilter");
  if (customDateInput) {
    customDateInput.value = "";
  }

  const searchInput = document.getElementById("adminSearch");
  if (searchInput) {
    searchInput.value = "";
  }

  showLoginView();
  setLoginMessage("Logged out.", "info");
  setAdminMessage("Admin panel ready.", "info");
}

function appendCell(row, value) {
  const td = document.createElement("td");
  td.textContent = value;
  row.appendChild(td);
}

function getRecordDate(record) {
  if (record.isoTimestamp) {
    const parsedIso = new Date(record.isoTimestamp);
    if (!Number.isNaN(parsedIso.getTime())) {
      return parsedIso;
    }
  }

  const parsedTimestamp = new Date(record.timestamp);
  if (!Number.isNaN(parsedTimestamp.getTime())) {
    return parsedTimestamp;
  }

  return null;
}

function isSameLocalDate(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function parseDateInput(value) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return null;
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function filterAttendanceRecords(records) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  if (currentAdminFilter === "today") {
    return records.filter(function (record) {
      const recordDate = getRecordDate(record);
      return recordDate ? isSameLocalDate(recordDate, today) : false;
    });
  }

  if (currentAdminFilter === "yesterday") {
    return records.filter(function (record) {
      const recordDate = getRecordDate(record);
      return recordDate ? isSameLocalDate(recordDate, yesterday) : false;
    });
  }

  if (currentAdminFilter === "month") {
    return records.filter(function (record) {
      const recordDate = getRecordDate(record);
      return recordDate ? recordDate >= oneMonthAgo && recordDate <= now : false;
    });
  }

  if (currentAdminFilter === "custom") {
    if (!selectedCustomDate) {
      return [];
    }

    const selectedDate = parseDateInput(selectedCustomDate);
    if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
      return [];
    }

    return records.filter(function (record) {
      const recordDate = getRecordDate(record);
      return recordDate ? isSameLocalDate(recordDate, selectedDate) : false;
    });
  }

  return records;
}

function filterLabel() {
  if (currentAdminFilter === "today") {
    return "Today";
  }

  if (currentAdminFilter === "yesterday") {
    return "Yesterday";
  }

  if (currentAdminFilter === "month") {
    return "Last 1 Month";
  }

  if (currentAdminFilter === "custom") {
    return selectedCustomDate ? "Date: " + selectedCustomDate : "Custom Date (select a date)";
  }

  return "All";
}

function matchSearch(record, rawTerm) {
  const term = rawTerm.toLowerCase().trim();
  if (!term) {
    return true;
  }

  const name = String(record.name || "").toLowerCase();
  const phone = String(record.phone || "").toLowerCase();
  const digitsOnlyTerm = term.replace(/\D/g, "");
  const digitsOnlyPhone = phone.replace(/\D/g, "");

  if (name.includes(term)) {
    return true;
  }

  if (phone.includes(term)) {
    return true;
  }

  if (digitsOnlyTerm && digitsOnlyPhone.includes(digitsOnlyTerm)) {
    return true;
  }

  return false;
}

function updateFilterMeta(recordsCount) {
  const filterMeta = document.getElementById("filterMeta");

  if (!filterMeta) {
    return;
  }

  let label = "Showing attendance for: " + filterLabel() + " (" + recordsCount + ")";

  if (adminSearchTerm) {
    label += " | Search: " + adminSearchTerm;
  }

  filterMeta.textContent = label;
}

function setActiveFilterButton(filterType) {
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-filter") === filterType);
  });

  const customDateInput = document.getElementById("customDateFilter");
  if (customDateInput) {
    if (filterType === "custom") {
      customDateInput.classList.remove("hidden");
    } else {
      customDateInput.classList.add("hidden");
    }
  }
}

function renderStudentInsight(allRecords) {
  const insightCard = document.getElementById("studentInsight");
  const titleElement = document.getElementById("studentInsightTitle");
  const totalElement = document.getElementById("studentInsightTotal");
  const datesList = document.getElementById("studentDatesList");

  if (!insightCard || !titleElement || !totalElement || !datesList) {
    return;
  }

  if (!adminSearchTerm) {
    insightCard.classList.add("hidden");
    return;
  }

  const matchingRecords = allRecords.filter(function (record) {
    return matchSearch(record, adminSearchTerm);
  });

  insightCard.classList.remove("hidden");
  datesList.innerHTML = "";

  if (matchingRecords.length === 0) {
    titleElement.textContent = "Student Summary";
    totalElement.textContent = "Total Attendance: 0";

    const item = document.createElement("li");
    item.textContent = "No student match found for search input.";
    datesList.appendChild(item);
    return;
  }

  const grouped = {};

  matchingRecords.forEach(function (record) {
    const key = record.name + "||" + (record.phone || "-");
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(record);
  });

  const bestKey = Object.keys(grouped).sort(function (a, b) {
    return grouped[b].length - grouped[a].length;
  })[0];

  const selectedStudentRecords = grouped[bestKey];
  const sample = selectedStudentRecords[0];

  titleElement.textContent = sample.name + " (" + (sample.phone || "-") + ")";
  totalElement.textContent = "Total Attendance: " + selectedStudentRecords.length;

  const dateCounts = {};

  selectedStudentRecords.forEach(function (record) {
    const recordDate = getRecordDate(record);
    const dateLabel = recordDate ? recordDate.toLocaleDateString() : "Unknown Date";

    if (!dateCounts[dateLabel]) {
      dateCounts[dateLabel] = 0;
    }

    dateCounts[dateLabel] += 1;
  });

  Object.keys(dateCounts).forEach(function (dateLabel) {
    const item = document.createElement("li");
    item.textContent = dateLabel + " - " + dateCounts[dateLabel] + " attendance";
    datesList.appendChild(item);
  });
}

function renderAdminTable() {
  const tableBody = document.getElementById("adminListBody");
  const emptyState = document.getElementById("adminEmptyState");

  if (!tableBody || !emptyState) {
    return;
  }

  const records = readAttendance().slice().reverse();
  let filteredRecords = filterAttendanceRecords(records);

  if (adminSearchTerm) {
    filteredRecords = records.filter(function (record) {
      return matchSearch(record, adminSearchTerm);
    });
  }

  tableBody.innerHTML = "";
  updateFilterMeta(filteredRecords.length);
  renderStudentInsight(records);

  if (filteredRecords.length === 0) {
    emptyState.style.display = "block";
    emptyState.textContent = "No attendance entries found for selected filter.";
    return;
  }

  emptyState.style.display = "none";

  filteredRecords.forEach(function (record, index) {
    const row = document.createElement("tr");

    appendCell(row, String(index + 1));
    appendCell(row, record.name);
    appendCell(row, record.phone || "-");
    appendCell(row, record.timestamp);

    tableBody.appendChild(row);
  });
}

function clearAttendanceRecords() {
  if (!isAdminLoggedIn) {
    setAdminMessage("Please login first.", "error");
    return;
  }

  const records = readAttendance();

  if (records.length === 0) {
    setAdminMessage("No attendance records to clear.", "info");
    return;
  }

  const confirmed = window.confirm("Clear all attendance records?");

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(ATTENDANCE_STORAGE_KEY);
  updateSummary(readAttendance());
  renderAdminTable();
  setAdminMessage("All attendance records cleared.", "info");
}

function isAdminRoute() {
  const forcedRoute = document.body.getAttribute("data-route");

  if (forcedRoute === "vks" || forcedRoute === "admin") {
    return true;
  }

  const cleanedPath = window.location.pathname.replace(/\/+$/, "");

  if (cleanedPath.endsWith("/vks") || cleanedPath.endsWith("/vks/index.html")) {
    return true;
  }

  const hashRoute = window.location.hash.toLowerCase().replace(/^#\/?/, "");
  if (hashRoute === "vks") {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  const queryRoute = (params.get("route") || params.get("page") || "").toLowerCase();

  return queryRoute === "vks";
}

function initializeRouteView() {
  const studentApp = document.getElementById("studentApp");
  const adminRouteApp = document.getElementById("adminRouteApp");

  if (!studentApp || !adminRouteApp) {
    return;
  }

  if (isAdminRoute()) {
    studentApp.classList.add("hidden");
    adminRouteApp.classList.remove("hidden");
    return;
  }

  studentApp.classList.remove("hidden");
  adminRouteApp.classList.add("hidden");
}

function bindStudentEvents() {
  const markButton = document.getElementById("markBtn");
  const nameInput = document.getElementById("name");
  const phoneInput = document.getElementById("phone");

  if (!markButton || !nameInput || !phoneInput) {
    return;
  }

  markButton.addEventListener("click", markAttendance);

  nameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      markAttendance();
    }
  });

  phoneInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      markAttendance();
    }
  });
}

function bindAdminEvents() {
  const loginButton = document.getElementById("loginBtn");
  const logoutButton = document.getElementById("logoutBtn");
  const clearButton = document.getElementById("clearRecordsBtn");
  const printButton = document.getElementById("printBtn");
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const customDateInput = document.getElementById("customDateFilter");
  const searchInput = document.getElementById("adminSearch");
  const clearSearchButton = document.getElementById("clearSearchBtn");
  const filterButtons = document.querySelectorAll(".filter-btn");

  if (!loginButton || !logoutButton || !clearButton || !usernameInput || !passwordInput) {
    return;
  }

  loginButton.addEventListener("click", handleAdminLogin);

  usernameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleAdminLogin();
    }
  });

  passwordInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleAdminLogin();
    }
  });

  logoutButton.addEventListener("click", handleLogout);
  clearButton.addEventListener("click", clearAttendanceRecords);

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      adminSearchTerm = searchInput.value.trim();

      if (isAdminLoggedIn) {
        renderAdminTable();
      }
    });
  }

  if (clearSearchButton && searchInput) {
    clearSearchButton.addEventListener("click", function () {
      adminSearchTerm = "";
      searchInput.value = "";

      if (isAdminLoggedIn) {
        renderAdminTable();
      }
    });
  }

  if (printButton) {
    printButton.addEventListener("click", function () {
      window.print();
    });
  }

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      currentAdminFilter = button.getAttribute("data-filter") || "today";
      setActiveFilterButton(currentAdminFilter);

      if (currentAdminFilter === "custom" && !selectedCustomDate) {
        setAdminMessage("Select a date from calendar to view attendance.", "info");
      }

      if (isAdminLoggedIn) {
        renderAdminTable();
      }
    });
  });

  if (customDateInput) {
    customDateInput.addEventListener("change", function () {
      selectedCustomDate = customDateInput.value;
      currentAdminFilter = "custom";
      setActiveFilterButton("custom");

      if (isAdminLoggedIn) {
        renderAdminTable();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initializeRouteView();
  updateSummary(readAttendance());
  bindStudentEvents();
  bindAdminEvents();
  showLoginView();
  setActiveFilterButton(currentAdminFilter);

  if (isAdminRoute()) {
    const usernameInput = document.getElementById("adminUsername");
    setLoginMessage("Enter username and password to open attendance log.", "info");

    if (usernameInput) {
      usernameInput.focus();
    }
  }
});
