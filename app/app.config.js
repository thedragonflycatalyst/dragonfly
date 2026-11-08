// Adds the Firebase file for push notifications when it's present (CI writes it from the GOOGLE_SERVICES_JSON secret).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(file)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } };
};
