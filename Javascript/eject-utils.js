/**
 * @module crypto-key-recovery
 * @description A library for recovering private keys from distributed key generation results
 * supporting both secp256k1 and ed25519 curves
 */

const secp256k1 = require('noble-secp256k1');
const elliptic = require('elliptic');
const bs58 = require('bs58');

// Constants for supported curves
const CURVE_PARAMS = {
  SECP256K1: {
    name: 'secp256k1',
    fieldOrder: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141")
  },
  ED25519: {
    name: 'ed25519',
    fieldOrder: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed")
  }
};

/**
 * Class representing a public key
 */
class Pubkey {
  /**
   * Create a public key
   * @param {string} x - The x coordinate
   * @param {string} y - The y coordinate
   */
  constructor(x = "", y = "") {
    this.x = x;
    this.y = y;
  }
}

/**
 * Class representing a Birkhoff parameter
 */
class BK {
  /**
   * Create a Birkhoff parameter
   * @param {string} x - The x value
   * @param {number} rank - The rank value
   */
  constructor(x = "", rank = 0) {
    this.x = x;
    this.rank = rank;
  }
}

/**
 * Class representing auxiliary information for key recovery
 */
class AuxInfo {
  /**
   * Create an auxiliary info object
   * @param {Object} options - Configuration options
   * @param {string} options.clientId - Client identifier
   * @param {string} options.backupSharePairId - Backup share pair ID
   * @param {string} options.signingSharePairId - Signing share pair ID
   * @param {string} options.share - Share value
   * @param {string} options.ssid - Session ID
   * @param {Pubkey|null} options.pubKey - Public key
   * @param {Object} options.partialPubKey - Partial public keys
   * @param {Object} options.allY - All Y values
   * @param {string} options.paillerP - Pailler P value
   * @param {string} options.paillerQ - Pailler Q value
   * @param {Object} options.pederson - Pederson parameters
   * @param {Object} options.bks - Birkhoff parameters
   */
  constructor({
    clientId = "",
    backupSharePairId = "",
    signingSharePairId = "",
    share = "",
    ssid = "",
    pubKey = null,
    partialPubKey = {},
    allY = {},
    paillerP = "",
    paillerQ = "",
    pederson = {},
    bks = {}
  } = {}) {
    this.clientId = clientId;
    this.backupSharePairId = backupSharePairId;
    this.signingSharePairId = signingSharePairId;
    this.share = share;
    this.ssid = ssid;
    this.pubkey = pubKey;
    this.partialPubkey = partialPubKey;
    this.allY = allY;
    this.p = paillerP;
    this.q = paillerQ;
    this.pederson = pederson;
    this.bks = bks;
  }
}

/**
 * Class representing CGGMP backup data
 */
class CggmpBackup {
  /**
   * Create a CGGMP backup
   * @param {Object} options - Configuration options
   */
  constructor({
    clientId = "",
    custodianId = "",
    x = "",
    y = "",
    clientBk = "",
    serverBk = "",
    share = "",
    clientPartialPubKey_x = "",
    clientPartialPubKey_y = "",
    serverPartialPubKey_x = "",
    serverPartialPubKey_y = "",
    yClient_x = "",
    yClient_y = "",
    yServer_x = "",
    yServer_y = "",
    pailler_p = "",
    pailler_q = "",
    ssid = "",
    pedersenClient_n = "",
    pedersenClient_s = "",
    pedersenClient_t = "",
    pedersenServer_n = "",
    pedersenServer_s = "",
    pedersenServer_t = ""
  } = {}) {
    this.clientId = clientId;
    this.custodianId = custodianId;
    this.x = x;
    this.y = y;
    this.clientBk = clientBk;
    this.serverBk = serverBk;
    this.share = share;
    this.clientPartialPubKey_x = clientPartialPubKey_x;
    this.clientPartialPubKey_y = clientPartialPubKey_y;
    this.serverPartialPubKey_x = serverPartialPubKey_x;
    this.serverPartialPubKey_y = serverPartialPubKey_y;
    this.yClient_x = yClient_x;
    this.yClient_y = yClient_y;
    this.yServer_x = yServer_x;
    this.yServer_y = yServer_y;
    this.pailler_p = pailler_p;
    this.pailler_q = pailler_q;
    this.ssid = ssid;
    this.pedersenClient_n = pedersenClient_n;
    this.pedersenClient_s = pedersenClient_s;
    this.pedersenClient_t = pedersenClient_t;
    this.pedersenServer_n = pedersenServer_n;
    this.pedersenServer_s = pedersenServer_s;
    this.pedersenServer_t = pedersenServer_t;
  }
}

/**
 * Matrix class for linear algebra operations
 */
class Matrix {
  /**
   * Create a matrix
   * @param {BigInt} fieldOrder - The field order for modular arithmetic
   * @param {Array<Array<BigInt>>} data - The matrix data
   */
  constructor(fieldOrder, data) {
    this.fieldOrder = fieldOrder;
    this.data = data;
    this.rows = data.length;
    this.cols = data[0]?.length || 0;
  }

  /**
   * Create a deep copy of the matrix
   * @returns {Matrix} A new matrix with the same data
   */
  Copy() {
    const newData = this.data.map(row => [...row]);
    return new Matrix(this.fieldOrder, newData);
  }

  /**
   * Transpose the matrix in-place
   * @returns {Matrix} This matrix after transposition
   */
  Transpose() {
    const newData = Array(this.cols).fill().map(() => Array(this.rows));
    
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        newData[j][i] = this.data[i][j];
      }
    }
    
    this.data = newData;
    [this.rows, this.cols] = [this.cols, this.rows];
    return this;
  }

  /**
   * Multiply this matrix by another
   * @param {Matrix} other - The matrix to multiply with
   * @returns {Matrix} The product matrix
   */
  multiply(other) {
    if (this.cols !== other.rows) {
      throw new Error("Matrix dimensions don't match for multiplication");
    }
    
    const result = Array(this.rows).fill().map(() => Array(other.cols).fill(0n));
    
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        for (let k = 0; k < this.cols; k++) {
          result[i][j] = (result[i][j] + this.data[i][k] * other.data[k][j]) % this.fieldOrder;
        }
      }
    }
    
    return new Matrix(this.fieldOrder, result);
  }

  /**
   * Compute the inverse of the matrix
   * @returns {Matrix} The inverse matrix
   */
  Inverse() {
    if (this.rows !== this.cols) {
      throw new Error("Only square matrices can be inverted");
    }
    
    const n = this.rows;
    // Create augmented matrix [A|I]
    const augmented = Array(n).fill().map(() => Array(2 * n).fill(0n));
    
    // Copy the original matrix to the left side
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        augmented[i][j] = this.data[i][j];
      }
      // Set identity matrix on the right side
      augmented[i][i + n] = 1n;
    }
    
    // Perform Gaussian elimination with modular arithmetic
    for (let i = 0; i < n; i++) {
      // Find pivot
      let pivotRow = i;
      for (let j = i + 1; j < n; j++) {
        if (augmented[j][i] !== 0n) {
          pivotRow = j;
          break;
        }
      }
      
      if (augmented[pivotRow][i] === 0n) {
        throw new Error("Matrix is singular and cannot be inverted");
      }
      
      // Swap rows if needed
      if (pivotRow !== i) {
        [augmented[i], augmented[pivotRow]] = [augmented[pivotRow], augmented[i]];
      }
      
      // Scale the pivot row
      const pivot = augmented[i][i];
      const pivotInv = this.modInverse(pivot, this.fieldOrder);
      
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] = (augmented[i][j] * pivotInv) % this.fieldOrder;
      }
      
      // Eliminate other rows
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = augmented[j][i];
          for (let k = 0; k < 2 * n; k++) {
            augmented[j][k] = (augmented[j][k] - factor * augmented[i][k] % this.fieldOrder + this.fieldOrder) % this.fieldOrder;
          }
        }
      }
    }
    
    // Extract right side as inverse matrix
    const inverse = Array(n).fill().map(() => Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        inverse[i][j] = augmented[i][j + n];
      }
    }
    
    return new Matrix(this.fieldOrder, inverse);
  }

  /**
   * Apply modular arithmetic to each element in-place
   * @returns {Matrix} This matrix after modulus operation
   */
  modulus() {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        this.data[i][j] = ((this.data[i][j] % this.fieldOrder) + this.fieldOrder) % this.fieldOrder;
      }
    }
    return this;
  }

  /**
   * Get a row from the matrix
   * @param {number} index - The row index
   * @returns {Array<BigInt>} The row data
   */
  GetRow(index) {
    if (index < 0 || index >= this.rows) {
      throw new Error("Row index out of bounds");
    }
    return [...this.data[index]];
  }

  /**
   * Calculate the modular inverse of a number
   * @param {BigInt} a - The number to invert
   * @param {BigInt} m - The modulus
   * @returns {BigInt} The modular inverse
   */
  modInverse(a, m) {
    a = ((a % m) + m) % m;
    if (a === 0n) {
      throw new Error("Modular inverse does not exist");
    }
    
    // Extended Euclidean Algorithm to find modular inverse
    let [old_r, r] = [a, m];
    let [old_s, s] = [1n, 0n];
    let [old_t, t] = [0n, 1n];
    
    while (r !== 0n) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
      [old_t, t] = [t, old_t - quotient * t];
    }
    
    if (old_r !== 1n) {
      throw new Error("Modular inverse does not exist");
    }
    
    return ((old_s % m) + m) % m;
  }

  /**
   * Calculate the pseudoinverse of the matrix
   * @returns {Matrix} The pseudoinverse matrix
   */
  Pseudoinverse() {
    try {
      // Create copies of the matrix
      const copy = this.Copy();
      const copyTranspose = this.Copy().Transpose();
      
      // Calculate Mᵀ × M (symmetric matrix)
      const symmetricForm = copyTranspose.multiply(copy);
      
      // Calculate (Mᵀ × M)⁻¹ (inverse of symmetric matrix)
      const inverseSymmetric = symmetricForm.Inverse();
      
      // Calculate (Mᵀ × M)⁻¹ × Mᵀ
      const result = inverseSymmetric.multiply(copyTranspose);
      
      // Apply modular arithmetic to each element
      result.modulus();
      
      return result;
    } catch (err) {
      throw new Error(`Failed to compute pseudoinverse: ${err.message}`);
    }
  }
}

/**
 * Class for Birkhoff parameters
 */
class BkParameter {
  /**
   * Create a Birkhoff parameter
   * @param {Array<{x: BigInt, rank: number}>} x - The x values
   */
  constructor(x) {
    this.x = x;
  }
}

/**
 * Create a new Birkhoff parameter object
 * @param {BigInt} x - The x value
 * @param {number} rank - The rank value
 * @returns {Object} A Birkhoff parameter object
 */
function NewBkParameter(x, rank) {
  return {
    x: x,
    rank: rank
  };
}

/**
 * Convert a BigInt to a Uint8Array
 * @param {BigInt} bigInt - The BigInt to convert
 * @returns {Uint8Array} The resulting bytes
 */
function bigIntToUint8Array(bigInt) {
  // Convert the BigInt to a hex string without the "0x" prefix
  let hexString = bigInt.toString(16);
  
  // Ensure even length by padding with a leading zero if needed
  if (hexString.length % 2) {
    hexString = '0' + hexString;
  }
  
  // Create a Uint8Array of the appropriate length
  const byteLength = hexString.length / 2;
  const uint8Array = new Uint8Array(byteLength);
  
  // Fill the array by converting each pair of hex digits to a byte
  for (let i = 0; i < byteLength; i++) {
    const byteHex = hexString.substring(i * 2, i * 2 + 2);
    uint8Array[i] = parseInt(byteHex, 16);
  }
  
  return uint8Array;
}

/**
 * Convert a Uint8Array to a hex string
 * @param {Uint8Array} uint8Array - The bytes to convert
 * @returns {string} The hex string
 */
function uint8ArrayToHex(uint8Array) {
  return Array.from(uint8Array)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Format a private key with padding at the beginning
 * @param {BigInt} privateKeyBigInt - The private key as a BigInt
 * @returns {string} The formatted private key
 */
function formatPrivateKeyWithPaddingAtBeginning(privateKeyBigInt) {
  const privateKeyBytes = bigIntToUint8Array(privateKeyBigInt);
  // Create a new Uint8Array with 32 bytes (all zeroes by default)
  const privateKeyPadded = new Uint8Array(32);
  
  // Calculate the offset to copy privateKeyBytes at the end of the padded array
  const offset = 32 - privateKeyBytes.length;

  // Copy the privateKeyBytes at the end of the padded array
  privateKeyPadded.set(privateKeyBytes, offset);
  
  // Format uint8array to hex string
  return uint8ArrayToHex(privateKeyPadded);
}

/**
 * Perform modular exponentiation (x^n mod m)
 * @param {BigInt} x - The base
 * @param {BigInt} n - The exponent
 * @param {BigInt} m - The modulus
 * @returns {BigInt} The result
 */
function modPow(x, n, m) {
  if (m === 1n) return 0n;
  let result = 1n;
  x = x % m;
  while (n > 0n) {
    if (n % 2n === 1n) {
      result = (result * x) % m;
    }
    n = n / 2n;
    x = (x * x) % m;
  }
  return result;
}

/**
 * Get the coefficient of a differential monomial
 * @param {BigInt} x - The x value
 * @param {BigInt} fieldOrder - The field order
 * @param {number} degree - The degree
 * @param {number} rank - The rank
 * @returns {BigInt} The coefficient
 */
function getDiffMonomialCoeff(x, fieldOrder, degree, rank) {
  // If degree is less than rank, return 0
  if (degree < rank) {
    return 0n;
  }

  // If degree is 0, return 1
  if (degree === 0) {
    return 1n;
  }

  // Get extra coefficient
  let tempValue = 1n;
  for (let j = 0; j < rank; j++) {
    tempValue *= BigInt(degree - j);
  }

  // Calculate x^(degree-rank)
  const power = BigInt(degree - rank);

  // Modular exponentiation (x^power) % fieldOrder
  let result = modPow(x, power, fieldOrder);

  // Multiply by the extra value and return
  return (result * tempValue) % fieldOrder;
}

/**
 * Get the coefficients for a linear equation
 * @param {BigInt} bkX - The Birkhoff parameter x value
 * @param {BigInt} fieldOrder - The field order
 * @param {number} degreePoly - The polynomial degree
 * @param {number} rank - The rank
 * @returns {Array<BigInt>} The coefficients
 */
function GetLinearEquationCoefficient(bkX, fieldOrder, degreePoly, rank) {
  try {
    const result = new Array(degreePoly + 1);
    for (let i = 0; i < result.length; i++) {
      result[i] = getDiffMonomialCoeff(bkX, fieldOrder, i, rank);
    }
    return result;
  } catch (err) {
    throw new Error(`Failed to get linear equation coefficient: ${err.message}`);
  }
}

/**
 * Get the coefficient matrix for a linear equation
 * @param {Object} bks - The Birkhoff parameters
 * @param {number} nThreshold - The threshold
 * @param {BigInt} fieldOrder - The field order
 * @returns {Matrix} The coefficient matrix
 */
async function getLinearEquationCoefficientMatrix(bks, nThreshold, fieldOrder) {
  try {
    const lens = bks.x.length;
    const result = new Array(lens);
    const degree = nThreshold - 1;
    const rank = 0;
    
    for (let i = 0; i < lens; i++) {
      result[i] = GetLinearEquationCoefficient(bks.x[i].x, fieldOrder, degree, rank);
    }

    return new Matrix(fieldOrder, result);
  } catch (err) {
    throw new Error(`Failed to get linear equation coefficient matrix: ${err.message}`);
  }
}

/**
 * Compute the Birkhoff coefficient
 * @param {Object} bks - The Birkhoff parameters
 * @param {number} threshold - The threshold
 * @param {BigInt} fieldOrder - The field order
 * @returns {Array<BigInt>} The coefficient
 */
async function computeBkCoefficient(bks, threshold, fieldOrder) {
  try {
    // Get linear equation coefficient matrix
    const birkhoffMatrix = await getLinearEquationCoefficientMatrix(bks, threshold, fieldOrder);

    // Calculate pseudoinverse of the matrix
    const result = birkhoffMatrix.Pseudoinverse();
    
    // Return the first row of the result
    return result.GetRow(0);
  } catch (err) {
    throw new Error(`Failed to compute Birkhoff coefficient: ${err.message}`);
  }
}

/**
 * Parse and validate a share from DKG result
 * @param {string|Object|Uint8Array} dkgResult - The DKG result
 * @returns {Object} The validated share
 */
async function validateShare(dkgResult) {
  const share = {};
  
  // Unmarshal server dkgResult into JSON variable
  try {
    // If dkgResult is already a string
    if (typeof dkgResult === 'string') {
      Object.assign(share, JSON.parse(dkgResult));
    } 
    // If dkgResult is a Uint8Array
    else if (dkgResult instanceof Uint8Array) {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(dkgResult);
      Object.assign(share, JSON.parse(jsonString));
    }
    // If dkgResult is already an object
    else if (typeof dkgResult === 'object') {
      Object.assign(share, dkgResult);
    }
    else {
      throw new Error("Invalid dkgResult format");
    }
  } catch (err) {
    throw new Error(`Failed to parse dkgResult: ${err.message}`);
  }

  // Check if the dkgResult has all the necessary fields
  if (!share.pubkey || !share.share || !share.bks) {
    throw new Error("Inputted DKG does not include necessary fields");
  }

  return share;
}

/**
 * Validate and format a server share
 * @param {string|Object|Uint8Array} dkgResult - The DKG result
 * @returns {Object} The formatted share
 */
async function validateAndFormatServerShare(dkgResult) {
  let backup = {};
  
  try {
    // Handle different input formats
    if (typeof dkgResult === 'string') {
      backup = JSON.parse(dkgResult);
    } else if (dkgResult instanceof Uint8Array) {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(dkgResult);
      backup = JSON.parse(jsonString);
    } else if (typeof dkgResult === 'object') {
      backup = dkgResult;
    } else {
      throw new Error("Invalid dkgResult format");
    }
  } catch (err) {
    throw new Error(`Failed to parse dkgResult: ${err.message}`);
  }

  const auxInfo = {
    clientId: backup.clientId,
    share: backup.share,
    ssid: backup.ssid,
    p: backup.pailler_p,
    q: backup.pailler_q,
    partialPubkey: {},
    allY: {},
    pederson: {},
    bks: {},
    pubkey: {}
  };

  // Setup client partial public key
  auxInfo.partialPubkey["client"] = {
    x: backup.clientPartialPubKey_x,
    y: backup.clientPartialPubKey_y
  };

  // Setup server partial public key
  auxInfo.partialPubkey["server"] = {
    x: backup.serverPartialPubKey_x,
    y: backup.serverPartialPubKey_y
  };

  // Setup PubKey
  auxInfo.pubkey = {
    x: backup.x,
    y: backup.y
  };

  // Setup client allY
  auxInfo.allY["client"] = {
    x: backup.yClient_x,
    y: backup.yClient_y
  };

  // Setup server allY
  auxInfo.allY["server"] = {
    x: backup.yServer_x,
    y: backup.yServer_y
  };

  // Setup client BKS
  auxInfo.bks["client"] = {
    x: backup.clientBk,
    rank: 0
  };

  // Setup server BKS
  auxInfo.bks["server"] = {
    x: backup.serverBk,
    rank: 0
  };

  // Setup client Pederson
  auxInfo.pederson["client"] = {
    n: backup.pedersenClient_n,
    s: backup.pedersenClient_s,
    t: backup.pedersenClient_t
  };

  // Setup server Pederson
  auxInfo.pederson["server"] = {
    n: backup.pedersenServer_n,
    s: backup.pedersenServer_s,
    t: backup.pedersenServer_t
  };

  return auxInfo;
}

/**
 * Get a public key point from a public key
 * @param {Object} publicKey - The public key
 * @param {string} curveName - The curve name ('secp256k1' or 'ed25519')
 * @returns {Object} The point
 */
function getPublicKeyPoint(publicKey, curveName) {
  try {
    // Convert strings to BigInts
    const x = BigInt(publicKey.x);
    const y = BigInt(publicKey.y);
    
    // Create and validate the point based on curve type
    let point;
    if (curveName === CURVE_PARAMS.SECP256K1.name) {
      point = new secp256k1.Point(x, y);
    } else if (curveName === CURVE_PARAMS.ED25519.name) {
      // For ED25519, we need to handle the curve differently
      // The noble-ed25519 library doesn't have a direct Point class like secp256k1
      // We're creating a compatible interface for our recovery process
      point = {
        x: x,
        y: y,
        // Add any other necessary properties or methods for compatibility
      };
    } else {
      throw new Error(`Unsupported curve: ${curveName}`);
    }
    
    return point;
  } catch (err) {
    throw new Error(`Failed to get public key point: ${err.message}`);
  }
}

/**
 * Set up peers for recovery
 * @param {Object} clientShare - The client share
 * @param {Object} serverShare - The server share
 * @returns {Array<Object>} The peers
 */
async function setupPeers(clientShare, serverShare) {
  try {
    // Convert client share to BigInt
    const clientShareBigInt = BigInt(clientShare.share);
    if (clientShareBigInt === 0n && clientShare.share !== '0') {
      throw new Error("Error converting client share to BigInt");
    }

    // Convert server share to BigInt
    const serverShareBigInt = BigInt(serverShare.share);
    if (serverShareBigInt === 0n && serverShare.share !== '0') {
      throw new Error("Error converting server share to BigInt");
    }

    // Convert bks values to BigInt for client
    const clientBks = BigInt(serverShare.bks["client"].x);
    if (clientBks === 0n && serverShare.bks["client"].x !== '0') {
      throw new Error("Error converting client bks to BigInt");
    }

    // Convert bks values to BigInt for server
    const serverBks = BigInt(clientShare.bks["server"].x);
    if (serverBks === 0n && clientShare.bks["server"].x !== '0') {
      throw new Error("Error converting server bks to BigInt");
    }

    // Setup BKS types
    const clientBksType = NewBkParameter(clientBks, 0);
    const serverBksType = NewBkParameter(serverBks, 0);

    // Setup the peers
    const clientPeer = {
      share: clientShareBigInt,
      bk: clientBksType
    };
    
    const serverPeer = {
      share: serverShareBigInt,
      bk: serverBksType
    };
    
    return [clientPeer, serverPeer];
  } catch (err) {
    throw new Error(`Failed to set up peers: ${err.message}`);
  }
}

/**
 * Recover a private key from shares
 * @param {string} curveName - The curve name ('secp256k1' or 'ed25519')
 * @param {number} threshold - The threshold
 * @param {Object} pubKey - The public key
 * @param {Array<Object>} peers - The peers
 * @returns {Object} The private key
 */
async function RecoverPrivateKey(curveName, threshold, pubKey, peers) {
  const peerNum = peers.length;
  
  if (peerNum < 2) {
    throw new Error("Not enough peers");
  }
  
  // Get the appropriate curve parameters
  let curveParams;
  if (curveName === CURVE_PARAMS.SECP256K1.name) {
    curveParams = CURVE_PARAMS.SECP256K1;
  } else if (curveName === CURVE_PARAMS.ED25519.name) {
    curveParams = CURVE_PARAMS.ED25519;
  } else {
    throw new Error(`Unsupported curve: ${curveName}`);
  }
  
  const bks = [];
  const shares = [];
  
  for (const peer of peers) {
    shares.push(peer.share);
    bks.push(peer.bk);
  }
  
  const bksInterface = new BkParameter(bks);
  
  // Compute Birkhoff coefficients using the correct field order for the curve
  const coefs = await computeBkCoefficient(bksInterface, threshold, curveParams.fieldOrder);
  
  // Calculate the private key as a linear combination of shares with computed coefficients
  let privKeyBigInt = 0n;
  for (let i = 0; i < coefs.length; i++) {
    privKeyBigInt = (privKeyBigInt + coefs[i] * shares[i]) % curveParams.fieldOrder;
  }
  
  // Perform curve-specific verification
  if (curveName === CURVE_PARAMS.SECP256K1.name) {
    // Initialize secp256k1 curve
    const ec = new elliptic.ec('secp256k1');
    
    // Convert BigInt to hex string without '0x' prefix
    const privateKeyHex = privKeyBigInt.toString(16).padStart(64, '0');
    
    // Create key pair from private key
    const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
    
    // Verify that the derived public key matches the expected public key
    if (keyPair.getPublic().getX().toString() !== pubKey.x.toString() || 
        keyPair.getPublic().getY().toString() !== pubKey.y.toString()) {
      throw new Error("Derived public key does not match expected public key");
    }
    
    // Create and return the private key object
    return {
      publicKey: keyPair.getPublic().encode('hex', false).slice(2),
      D: privKeyBigInt
    };
    
  } else if (curveName === CURVE_PARAMS.ED25519.name) {
    const ec = new elliptic.ec('ed25519');

    // Convert BigInt to hex string without '0x' prefix
    const privateKeyHex = privKeyBigInt.toString(16).padStart(64, '0');

    // Create key pair from private key
    const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
    
    // Verify that the derived public key matches the expected public key
    if (keyPair.getPublic().getX().toString() !== pubKey.x.toString() || 
        keyPair.getPublic().getY().toString() !== pubKey.y.toString()) {
      throw new Error("Derived public key does not match expected public key");
    }

    return {
        publicKey: keyPair.getPublic().encode('hex', false).slice(2),
        D: privKeyBigInt
    };

  }
  
  throw new Error(`Curve verification not implemented: ${curveName}`);
}

/**
 * Recover and format a private key from DKG results
 * @param {string|Object|Uint8Array} clientDkgResult - The client DKG result
 * @param {string|Object|Uint8Array} serverDkgResult - The server DKG result
 * @param {Object} options - Options for recovery
 * @param {string} [options.curve='secp256k1'] - Curve to use ('secp256k1' or 'ed25519')
 * @param {boolean} [options.littleEndian=false] - Whether to return in little endian format
 * @returns {string} The recovered private key in hex format
 */
async function recoverAndFormatPrivateKey(clientDkgResult, serverDkgResult, options = {}) {
  try {
    // Set default options
    const curve = options.curve || 'secp256k1';
    const littleEndianReturnType = options.littleEndian || false;
    
    // Validate curve
    if (curve !== CURVE_PARAMS.SECP256K1.name && curve !== CURVE_PARAMS.ED25519.name) {
      throw new Error(`Unsupported curve: ${curve}`);
    }
    
    // Validate client share
    const clientShare = await validateShare(clientDkgResult);
    
    // Validate and format server share
    const serverShare = await validateAndFormatServerShare(serverDkgResult);
    if (!serverShare) {
      throw new Error("Failed to validate and format server share");
    }
    
    // Get public key point
    const publicKey = getPublicKeyPoint(clientShare.pubkey, curve);
    if (!publicKey) {
      throw new Error("Failed to get public key point");
    }
    
    // Setup peers
    const peers = await setupPeers(clientShare, serverShare);
    if (!peers) {
      throw new Error("Failed to set up peers");
    }
    
    // Use threshold of 2 for 2-of-2 key recovery
    const THRESHOLD = 2;
    const privateKey = await RecoverPrivateKey(curve, THRESHOLD, publicKey, peers);
    if (!privateKey) {
      throw new Error("Failed to recover private key");
    }
    
    // Format private key based on endianness preference
    let privateKeyHex;
    if (littleEndianReturnType) {
      // Convert to little endian - reverse bytes
      const privateKeyBytes = bigIntToUint8Array(privateKey.D);
      const n = privateKeyBytes.length;
      if (n > 32) {
        throw new Error("Private key is longer than 32 bytes");
      }
      
      const reversed = new Uint8Array(32);
      for (let i = 0; i < privateKeyBytes.length; i++) {
        reversed[32 - 1 - i] = privateKeyBytes[i];
      }
      
      privateKeyHex = uint8ArrayToHex(reversed);

    } else {
        // Big endian (default for secp256k1)
        privateKeyHex = formatPrivateKeyWithPaddingAtBeginning(privateKey.D);
    }
    
    return privateKeyHex;
  } catch (err) {
    throw new Error(`Failed to recover and format private key: ${err.message}`);
  }
}

/**
 * Convenience function for recovering a secp256k1 key
 * @param {string|Object|Uint8Array} clientDkgResult - The client DKG result
 * @param {string|Object|Uint8Array} serverDkgResult - The server DKG result
 * @param {boolean} [littleEndian=false] - Whether to return in little endian format
 * @returns {string} The recovered private key in hex format
 */
async function recoverSecp256k1Key(clientDkgResult, serverDkgResult, littleEndian = false) {
  return recoverAndFormatPrivateKey(clientDkgResult, serverDkgResult, {
    curve: CURVE_PARAMS.SECP256K1.name,
    littleEndian
  });
}

/**
 * Convenience function for recovering an ED25519 key
 * @param {string|Object|Uint8Array} clientDkgResult - The client DKG result
 * @param {string|Object|Uint8Array} serverDkgResult - The server DKG result
 * @param {boolean} [littleEndian=true] - Whether to return in little endian format (default true for ED25519)
 * @returns {string} The recovered private key in hex format
 */
async function recoverEd25519Key(clientDkgResult, serverDkgResult, littleEndian = true) {
  const privateKeyHex = await recoverAndFormatPrivateKey(clientDkgResult, serverDkgResult, {
    curve: CURVE_PARAMS.ED25519.name,
    littleEndian
  })

  // Convert hex string to Buffer
  const bytes = Buffer.from(privateKeyHex, 'hex');

  const base58EncodedPrivateKey = bs58.encode(bytes);

  // Encode to Base58
  return base58EncodedPrivateKey;

}

// Export the public API
module.exports = {
  // Main functions
  recoverAndFormatPrivateKey,
  recoverSecp256k1Key,
  recoverEd25519Key,
  
  // Constants
  CURVE_PARAMS,
  
  // Classes for constructing inputs
  AuxInfo,
  CggmpBackup,
  Pubkey,
  BK
};