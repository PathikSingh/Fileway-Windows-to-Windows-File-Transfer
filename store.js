/**
 * store.js - Local data persistence using electron-store
 * Stores user profile, device ID, and settings
 */

const Store = require("electron-store");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const os = require("os");

const store = new Store({
  name: "fileway-data",
  defaults: {
    deviceId: null,
    email: null,
    firstName: null,
    lastName: null,
    deviceName: null,
    isLoggedIn: false,
    receivePath: null,
    // Settings
    settings: {
      soundEffects: true,
      notifications: true,
      autoAccept: 'my-devices',
      downloadLocation: path.join(os.homedir(), 'Downloads'),
      speedDiagnostics: false,
      searchableByName: true
    }
  },
});

// Initialize device ID if not exists
function initializeDevice() {
  if (!store.get("deviceId")) {
    store.set("deviceId", uuidv4());
  }
  if (!store.get("deviceName")) {
    store.set("deviceName", os.hostname());
  }
  return store.get("deviceId");
}

// User profile functions
function saveProfile(email, firstName, lastName) {
  store.set("email", email);
  store.set("firstName", firstName);
  store.set("lastName", lastName);
  store.set("isLoggedIn", true);
}

function getProfile() {
  return {
    deviceId: store.get("deviceId"),
    deviceName: store.get("deviceName"),
    email: store.get("email"),
    firstName: store.get("firstName"),
    lastName: store.get("lastName"),
    isLoggedIn: store.get("isLoggedIn"),
  };
}

function setEmail(email) {
  store.set("email", email);
}

function setName(firstName, lastName) {
  store.set("firstName", firstName);
  store.set("lastName", lastName);
  store.set("isLoggedIn", true);
}

function isLoggedIn() {
  return store.get("isLoggedIn") === true;
}

function hasName() {
  return store.get("firstName") !== null && store.get("firstName") !== "";
}

function logout() {
  store.set("email", null);
  store.set("firstName", null);
  store.set("lastName", null);
  store.set("isLoggedIn", false);
}

function getDeviceId() {
  return store.get("deviceId");
}

function getDeviceName() {
  return store.get("deviceName");
}

function setDeviceName(name) {
  store.set("deviceName", name);
}

function getEmail() {
  return store.get("email");
}

// Check if this email has a stored name (for cross-device sync simulation)
// In V1, this just checks local storage
function hasNameForEmail(email) {
  const storedEmail = store.get("email");
  if (storedEmail === email && store.get("firstName")) {
    return true;
  }
  return false;
}

// Settings functions
function getSettings() {
  return store.get("settings") || {
    soundEffects: true,
    notifications: true,
    autoAccept: 'my-devices',
    downloadLocation: path.join(os.homedir(), 'Downloads'),
    speedDiagnostics: false,
    searchableByName: true
  };
}

function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  store.set("settings", settings);
}

module.exports = {
  initializeDevice,
  saveProfile,
  getProfile,
  setEmail,
  setName,
  isLoggedIn,
  hasName,
  hasNameForEmail,
  logout,
  getDeviceId,
  getDeviceName,
  setDeviceName,
  getEmail,
  getSettings,
  setSetting,
};
