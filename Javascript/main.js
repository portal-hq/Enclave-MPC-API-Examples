const Signup = require('./signup.js');
const Generate = require('./generate.js');
const Backup = require('./backup.js');
const Recover = require('./recover.js');
const SignEth = require('./eth-sign.js');
const solana = require('./sol-sign.js');

async function main() {
  // Call Signup function
  await Signup();

  // Call generate function
  await Generate();

  // Call backup function
  await Backup();

  // Call recover function
  await Recover();

  // Sign an ethereum transaction
  await SignEth();

  // Sign a Solana transaction
  await solana.SignSol("");

  // Co-sign a Solana transaction
  await solana.CoSignTransaction();
}

main();
