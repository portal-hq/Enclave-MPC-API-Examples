const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');
const { PORTAL_EX } = require('./config');

async function Signup() {
  const now = new Date();
  const myUUID = uuidv4();
  const username = 'js-example-' + now.toISOString() + myUUID;
  const portalExResponse = await axios.post(
    `${PORTAL_EX}/mobile/signup`,
    { username: username, isAccountAbstracted: false },
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
  if (portalExResponse.status != 200) {
    console.error('Failed to sign up:', portalExResponse.data);
    return;
  }
  console.log(`Successfully signed up user ${username}!`);
  const clientApiKey = portalExResponse.data.clientApiKey;

  // Write clientApiKey to a file
  fs.writeFileSync('clientApiKey.txt', clientApiKey);
}

module.exports = Signup;
