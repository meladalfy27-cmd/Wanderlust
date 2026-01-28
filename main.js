// ==================== CONFIGURATION ====================
const API_CONFIG = {
  COUNTRIES: "https://countriesnow.space/api/v0.1/countries",
  HOLIDAYS: "https://date.nager.at/api/v3/PublicHolidays",
  WEEKENDS: "https://date.nager.at/api/v3/LongWeekends",
  WEATHER: "https://api.open-meteo.com/v1/forecast",
  CURRENCY: "https://api.exchangerate-api.com/v4/latest",
  SUNSET: "https://api.sunrise-sunset.org/json",
};

// ==================== STATE MANAGEMENT ====================
const appState = {
  countries: [],
  selectedCountry: "EG",
  selectedCity: "Cairo",
  selectedYear: new Date().getFullYear(),
  holidays: [],
  weekends: [],
  weather: null,
  currencyRates: {},
  sunsetData: null,
  loading: false,
  error: null,
  cityCoordinates: {
    Cairo: { lat: 30.0444, lng: 31.2357 },
    Alexandria: { lat: 31.2001, lng: 29.9187 },
    Giza: { lat: 30.0131, lng: 31.1974 },
  },
};

// ==================== DOM ELEMENTS ====================
const elements = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  mainContent: document.getElementById("main-content"),
  navItems: document.querySelectorAll("[data-view]"),
  pageTitle: document.getElementById("page-title"),
  pageSubtitle: document.getElementById("page-subtitle"),
  views: document.querySelectorAll(".view"),
};

// ==================== FETCH HELPERS ====================
async function fetchAPI(url, options = {}) {
  try {
    appState.loading = true;
    showLoadingOverlay(true);

    const response = await fetch(url, {
      method: "GET",
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    appState.error = null;
    return data;
  } catch (error) {
    console.error("Fetch Error:", error);
    appState.error = error.message;
    showNotification("error", `Error: ${error.message}`);
    return null;
  } finally {
    appState.loading = false;
    showLoadingOverlay(false);
  }
}

function showLoadingOverlay(show = true) {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) return;

  if (show) {
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
}

// ==================== COUNTRIES API ====================
async function fetchCountries() {
  console.log("Fetching countries...");
  const response = await fetchAPI(API_CONFIG.COUNTRIES);

  if (response && response.data) {
    appState.countries = response.data.slice(0, 150); // Limit to first 150
    console.log("Countries loaded:", appState.countries.length);
    renderCountriesDropdown();
    return appState.countries;
  }
  return null;
}

function renderCountriesDropdown() {
  const countrySelect = document.getElementById("global-country");
  if (!countrySelect) return;

  countrySelect.innerHTML =
    `<option value="">Select Country</option>` +
    appState.countries
      .map(
        (country) =>
          `<option value="${country.iso2}" ${
            country.iso2 === "EG" ? "selected" : ""
          }>${country.name}</option>`,
      )
      .join("");
}

// ==================== HOLIDAYS API ====================
async function fetchHolidays(countryCode, year = new Date().getFullYear()) {
  console.log(`Fetching holidays for ${countryCode} (${year})...`);
  const url = `${API_CONFIG.HOLIDAYS}/${year}/${countryCode}`;
  const holidays = await fetchAPI(url);

  if (holidays && Array.isArray(holidays)) {
    appState.holidays = holidays;
    console.log("Holidays loaded:", appState.holidays.length);
    renderHolidaysCards();
    updateStatsCards();
    return appState.holidays;
  }
  return null;
}

function renderHolidaysCards() {
  const holidaysContent = document.getElementById("holidays-content");
  if (!holidaysContent || appState.holidays.length === 0) return;

  // Clear the existing cards but keep the first info
  const existingCards = holidaysContent.querySelectorAll(".holiday-card");
  existingCards.forEach((card) => card.remove());

  // Add new holiday cards
  const holidaysHTML = appState.holidays
    .map((holiday) => {
      const date = new Date(holiday.date);
      const day = date.getDate();
      const month = date.toLocaleString("en-US", { month: "short" });
      const dayName = date.toLocaleString("en-US", { weekday: "long" });

      return `
        <div class="holiday-card">
          <div class="holiday-card-header">
            <div class="holiday-date-box"><span class="day">${day}</span><span class="month">${month}</span></div>
            <button class="holiday-action-btn save-holiday-btn" data-holiday="${
              holiday.date
            }"><i class="fa-regular fa-heart"></i></button>
          </div>
          <h3>${holiday.localName}</h3>
          <p class="holiday-name">${holiday.name}</p>
          <div class="holiday-card-footer">
            <span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ${dayName}</span>
            <span class="holiday-type-badge">${
              holiday.types[0] || "Public"
            }</span>
          </div>
        </div>
      `;
    })
    .join("");

  holidaysContent.insertAdjacentHTML("beforeend", holidaysHTML);
}

// ==================== LONG WEEKENDS API ====================
async function fetchLongWeekends(countryCode, year = new Date().getFullYear()) {
  console.log(`Fetching long weekends for ${countryCode} (${year})...`);
  const url = `${API_CONFIG.WEEKENDS}/${year}/${countryCode}`;
  const weekends = await fetchAPI(url);

  if (weekends && Array.isArray(weekends)) {
    appState.weekends = weekends;
    console.log("Long weekends loaded:", appState.weekends.length);
    return appState.weekends;
  }
  return null;
}

// ==================== WEATHER API ====================
async function fetchWeather(latitude, longitude) {
  console.log(`Fetching weather for coordinates: ${latitude}, ${longitude}...`);

  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
    timezone: "auto",
  });

  const url = `${API_CONFIG.WEATHER}?${params}`;
  const weather = await fetchAPI(url);

  if (weather) {
    appState.weather = weather;
    console.log("Weather data loaded");
    renderWeatherData();
    return weather;
  }
  return null;
}

function renderWeatherData() {
  if (!appState.weather) return;

  const current = appState.weather.current;
  const daily = appState.weather.daily;

  // Update weather hero card
  const weatherHero = document.querySelector(".weather-hero-card");
  if (weatherHero) {
    weatherHero.querySelector(
      ".weather-hero-icon i",
    ).className = `fa-solid ${getWeatherIcon(current.weather_code)}`;
    weatherHero.querySelector(".temp-value").textContent = Math.round(
      current.temperature_2m,
    );
    weatherHero.querySelector(
      ".weather-feels",
    ).textContent = `Feels like ${Math.round(current.apparent_temperature)}°C`;
    weatherHero.querySelector(
      ".weather-high-low .high",
    ).textContent = `⬆ ${Math.round(daily.temperature_2m_max[0])}°`;
    weatherHero.querySelector(
      ".weather-high-low .low",
    ).textContent = `⬇ ${Math.round(daily.temperature_2m_min[0])}°`;
  }

  // Update weather details
  const detailCards = document.querySelectorAll(".weather-detail-card");
  if (detailCards.length >= 4) {
    detailCards[0].querySelector(
      ".detail-value",
    ).textContent = `${current.relative_humidity_2m}%`;
    detailCards[1].querySelector(
      ".detail-value",
    ).textContent = `${current.wind_speed_10m} km/h`;
  }

  // Update forecast
  const forecastList = document.querySelector(".forecast-list");
  if (forecastList) {
    daily.time.forEach((date, index) => {
      const forecastDay = forecastList.querySelectorAll(".forecast-day")[index];
      if (forecastDay) {
        forecastDay.querySelector(
          ".forecast-icon i",
        ).className = `fa-solid ${getWeatherIcon(daily.weather_code[index])}`;
        forecastDay.querySelector(".temp-max").textContent = `${Math.round(
          daily.temperature_2m_max[index],
        )}°`;
        forecastDay.querySelector(".temp-min").textContent = `${Math.round(
          daily.temperature_2m_min[index],
        )}°`;
      }
    });
  }
}

function getWeatherIcon(weatherCode) {
  // WMO Weather interpretation codes
  if (weatherCode === 0) return "fa-sun";
  if (weatherCode === 1 || weatherCode === 2) return "fa-cloud-sun";
  if (weatherCode === 3) return "fa-cloud";
  if (weatherCode >= 45 && weatherCode <= 48) return "fa-cloud-fog";
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  )
    return "fa-cloud-rain";
  if (weatherCode >= 71 && weatherCode <= 77) return "fa-snowflake";
  if (weatherCode >= 80 && weatherCode <= 82) return "fa-cloud-rain";
  if (weatherCode >= 85 && weatherCode <= 86) return "fa-cloud-snow";
  if (weatherCode === 80 || weatherCode === 81 || weatherCode === 82)
    return "fa-cloud-meatball";
  if (weatherCode >= 90 && weatherCode <= 99) return "fa-bolt";
  return "fa-sun";
}

// ==================== CURRENCY CONVERSION API ====================
async function fetchCurrencyRates(baseCurrency = "USD") {
  console.log(`Fetching currency rates for ${baseCurrency}...`);
  const url = `${API_CONFIG.CURRENCY}/${baseCurrency}`;
  const rates = await fetchAPI(url);

  if (rates && rates.rates) {
    appState.currencyRates = rates.rates;
    console.log(
      "Currency rates loaded:",
      Object.keys(appState.currencyRates).length,
    );
    setupCurrencyConverter();
    return rates;
  }
  return null;
}

function setupCurrencyConverter() {
  const convertBtn = document.getElementById("convert-btn");
  if (convertBtn) {
    convertBtn.addEventListener("click", performCurrencyConversion);
  }

  const swapBtn = document.getElementById("swap-currencies-btn");
  if (swapBtn) {
    swapBtn.addEventListener("click", swapCurrencies);
  }

  const amountInput = document.getElementById("currency-amount");
  if (amountInput) {
    amountInput.addEventListener("input", performCurrencyConversion);
  }

  const toSelect = document.getElementById("currency-to");
  if (toSelect) {
    toSelect.addEventListener("change", performCurrencyConversion);
  }
}

function performCurrencyConversion() {
  const amountInput = document.getElementById("currency-amount");
  const fromCurrency = document.getElementById("currency-from");
  const toCurrency = document.getElementById("currency-to");
  const resultDisplay = document.getElementById("currency-result");

  if (!amountInput || !fromCurrency || !toCurrency || !resultDisplay) return;

  const amount = parseFloat(amountInput.value) || 0;
  const from = fromCurrency.value;
  const to = toCurrency.value;

  // Get conversion rate
  let rate = 1;

  if (from === to) {
    rate = 1;
  } else if (from === "USD") {
    rate = appState.currencyRates[to] || 1;
  } else {
    // Convert from any currency to USD first, then to target
    const toUSD = 1 / (appState.currencyRates[from] || 1);
    rate = toUSD * (appState.currencyRates[to] || 1);
  }

  const converted = (amount * rate).toFixed(2);
  const rateDisplay = rate.toFixed(4);

  resultDisplay.innerHTML = `
    <div class="conversion-display">
      <div class="conversion-from">
        <span class="amount">${amount.toFixed(2)}</span>
        <span class="currency-code">${from}</span>
      </div>
      <div class="conversion-equals"><i class="fa-solid fa-equals"></i></div>
      <div class="conversion-to">
        <span class="amount">${converted}</span>
        <span class="currency-code">${to}</span>
      </div>
    </div>
    <div class="exchange-rate-info">
      <p>1 ${from} = ${rateDisplay} ${to}</p>
      <small>Last updated: ${new Date().toLocaleDateString()}</small>
    </div>
  `;
}

function swapCurrencies() {
  const fromSelect = document.getElementById("currency-from");
  const toSelect = document.getElementById("currency-to");

  if (fromSelect && toSelect) {
    [fromSelect.value, toSelect.value] = [toSelect.value, fromSelect.value];
    performCurrencyConversion();
  }
}

// ==================== SUNSET/SUNRISE API ====================
async function fetchSunsetData(latitude, longitude) {
  console.log(
    `Fetching sunset data for coordinates: ${latitude}, ${longitude}...`,
  );

  const params = new URLSearchParams({
    lat: latitude,
    lng: longitude,
    formatted: 0,
  });

  const url = `${API_CONFIG.SUNSET}?${params}`;
  const sunsetData = await fetchAPI(url);

  if (sunsetData && sunsetData.results) {
    appState.sunsetData = sunsetData.results;
    console.log("Sunset data loaded");
    renderSunsetData();
    return sunsetData.results;
  }
  return null;
}

function renderSunsetData() {
  if (!appState.sunsetData) return;

  const data = appState.sunsetData;
  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const dayLengthSeconds = data.day_length;
  const dayLengthHours = Math.floor(dayLengthSeconds / 3600);
  const dayLengthMinutes = Math.floor((dayLengthSeconds % 3600) / 60);

  // Update sun times cards
  const sunTimeCards = document.querySelectorAll(".sun-time-card");
  if (sunTimeCards.length >= 6) {
    sunTimeCards[0].querySelector(".time").textContent = formatTime(
      data.civil_twilight_begin,
    );
    sunTimeCards[1].querySelector(".time").textContent = formatTime(
      data.sunrise,
    );
    sunTimeCards[2].querySelector(".time").textContent = formatTime(
      data.solar_noon,
    );
    sunTimeCards[3].querySelector(".time").textContent = formatTime(
      data.sunset,
    );
    sunTimeCards[4].querySelector(".time").textContent = formatTime(
      data.civil_twilight_end,
    );
    sunTimeCards[5].querySelector(
      ".time",
    ).textContent = `${dayLengthHours}h ${dayLengthMinutes}m`;
  }

  // Update day length
  const dayLengthPercent = (dayLengthSeconds / 86400) * 100;
  const progressFill = document.querySelector(".day-progress-fill");
  if (progressFill) {
    progressFill.style.width = dayLengthPercent + "%";
  }

  const dayStats = document.querySelectorAll(".day-stat");
  if (dayStats.length >= 3) {
    dayStats[0].querySelector(
      ".value",
    ).textContent = `${dayLengthHours}h ${dayLengthMinutes}m`;
    dayStats[1].querySelector(".value").textContent =
      dayLengthPercent.toFixed(1) + "%";
    const nightLength = 86400 - dayLengthSeconds;
    const nightHours = Math.floor(nightLength / 3600);
    const nightMinutes = Math.floor((nightLength % 3600) / 60);
    dayStats[2].querySelector(
      ".value",
    ).textContent = `${nightHours}h ${nightMinutes}m`;
  }
}

// ==================== COUNTRY SELECTION HANDLER ====================
async function onCountrySelected(countryCode) {
  if (!countryCode) return;

  console.log(`Country selected: ${countryCode}`);
  appState.selectedCountry = countryCode;

  const country = appState.countries.find((c) => c.iso2 === countryCode);
  if (!country) return;

  // Update UI
  updateSelectedDestination(country);

  // Fetch country-related data
  const year = appState.selectedYear;
  const promises = [
    fetchHolidays(countryCode, year),
    fetchLongWeekends(countryCode, year),
  ];

  await Promise.all(promises);
  showNotification("success", `Data loaded for ${country.name}`);
}

function updateSelectedDestination(country) {
  const selectedFlag = document.getElementById("selected-country-flag");
  const selectedName = document.getElementById("selected-country-name");
  const selectedCity = document.getElementById("selected-city-name");

  if (selectedFlag && country.iso2) {
    selectedFlag.src = `https://flagcdn.com/w80/${country.iso2.toLowerCase()}.png`;
  }
  if (selectedName) {
    selectedName.textContent = country.name;
  }
  if (selectedCity) {
    selectedCity.textContent = `• ${appState.selectedCity}`;
  }
}

// ==================== STATS CARDS ====================
function updateStatsCards() {
  const statHolidays = document.getElementById("stat-holidays");
  if (statHolidays) {
    statHolidays.textContent = appState.holidays.length;
  }
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(type = "info", message = "") {
  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: type,
      title: message,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Country selection
  const countrySelect = document.getElementById("global-country");
  if (countrySelect) {
    countrySelect.addEventListener("change", (e) => {
      onCountrySelected(e.target.value);
    });
  }

  // Year selection
  const yearSelect = document.getElementById("global-year");
  if (yearSelect) {
    yearSelect.addEventListener("change", (e) => {
      appState.selectedYear = parseInt(e.target.value);
      if (appState.selectedCountry) {
        onCountrySelected(appState.selectedCountry);
      }
    });
  }

  // Explore button
  const exploreBtn = document.getElementById("global-search-btn");
  if (exploreBtn) {
    exploreBtn.addEventListener("click", handleExplore);
  }

  // Clear selection button
  const clearBtn = document.getElementById("clear-selection-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", handleClearSelection);
  }

  // Navigation
  elements.navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      navigateToView(view);
    });
  });

  // Mobile menu
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", toggleSidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", toggleSidebar);
  }

  // Update datetime
  updateCurrentDateTime();
  setInterval(updateCurrentDateTime, 60000);
}

function handleExplore() {
  const country = document.getElementById("global-country").value;
  if (country) {
    onCountrySelected(country);
    navigateToView("holidays");
  } else {
    showNotification("warning", "Please select a country");
  }
}

function handleClearSelection() {
  document.getElementById("global-country").value = "";
  appState.selectedCountry = null;
  appState.holidays = [];
  appState.weekends = [];
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  sidebar.classList.toggle("active");
  overlay.classList.toggle("hidden");
}

function updateCurrentDateTime() {
  const datetimeEl = document.getElementById("current-datetime");
  if (datetimeEl) {
    const now = new Date();
    const formatted = now.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    datetimeEl.textContent = formatted;
  }
}

// ==================== VIEW NAVIGATION ====================
function navigateToView(viewName) {
  console.log(`Navigating to view: ${viewName}`);

  // Update page title and subtitle
  const titleMap = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Welcome back! Ready to plan your next adventure?",
    },
    holidays: {
      title: "Public Holidays Explorer",
      subtitle: "Browse public holidays and plan your trips",
    },
    events: {
      title: "Events Explorer",
      subtitle: "Discover concerts, sports, theatre and more",
    },
    weather: {
      title: "Weather Forecast",
      subtitle: "Check 7-day weather forecasts",
    },
    "long-weekends": {
      title: "Long Weekend Finder",
      subtitle: "Find perfect long weekend opportunities",
    },
    currency: {
      title: "Currency Converter",
      subtitle: "Convert between currencies with live rates",
    },
    "sun-times": {
      title: "Sunrise & Sunset Times",
      subtitle: "Plan activities around golden hour",
    },
    "my-plans": {
      title: "My Saved Plans",
      subtitle: "Your saved holidays, events, and trip ideas",
    },
  };

  const titleData = titleMap[viewName] || { title: "Wanderlust", subtitle: "" };

  if (elements.pageTitle) elements.pageTitle.textContent = titleData.title;
  if (elements.pageSubtitle)
    elements.pageSubtitle.textContent = titleData.subtitle;

  // Hide all views
  elements.views.forEach((view) => {
    view.classList.remove("active");
  });

  // Show selected view
  const selectedView = document.getElementById(`${viewName}-view`);
  if (selectedView) {
    selectedView.classList.add("active");
  }

  // Update active nav item
  elements.navItems.forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.view === viewName) {
      item.classList.add("active");
    }
  });

  // Close mobile menu
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (sidebar && sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    overlay.classList.add("hidden");
  }
}

// ==================== CURRENCY DISPLAY ====================
function updateCurrencyDisplay() {
  const amountInput = document.getElementById("currency-amount");
  const toCurrency = document.getElementById("to-currency");
  const resultDisplay = document.getElementById("conversion-result");

  if (!amountInput || !toCurrency || !resultDisplay) return;

  const amount = parseFloat(amountInput.value) || 0;
  const converted = convertCurrency(amount, "USD", toCurrency.value);

  if (converted) {
    resultDisplay.textContent = `${converted} ${toCurrency.value}`;
  }
}

// ==================== START APP ====================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// Export functions for external use
window.wanderlustAPI = {
  fetchWeather,
  fetchSunsetData,
  fetchHolidays,
  fetchLongWeekends,
  onCountrySelected,
  navigateToView,
  getAppState: () => appState,
};
async function initializeApp() {
  console.log("Initializing Wanderlust App...");

  try {
    // Setup event listeners first
    setupEventListeners();

    // Fetch initial data
    await fetchCountries();
    await fetchCurrencyRates("USD");

    // Default: Load data for Egypt
    appState.selectedCountry = "EG";
    await onCountrySelected("EG");

    // Fetch weather for Cairo
    const cairoCoords = appState.cityCoordinates["Cairo"];
    await fetchWeather(cairoCoords.lat, cairoCoords.lng);

    // Fetch sunset data for Cairo
    await fetchSunsetData(cairoCoords.lat, cairoCoords.lng);

    // Navigate to dashboard
    navigateToView("dashboard");

    console.log("App initialized successfully");
    showNotification("success", "Wanderlust app loaded!");
  } catch (error) {
    console.error("Initialization error:", error);
    showNotification("error", "Failed to initialize app");
  }
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(type = "info", message = "") {
  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: type,
      title: message,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}
