const secp256k1 = require('noble-secp256k1');
const elliptic = require('elliptic');
const { recoverAndFormatPrivateKey, recoverEd25519Key, CggmpBackup, AuxInfo, Pubkey, BK } = require('./eject-utils.js');

(async () => {
    console.log("Using secp256k1 curve");
    const PubX = "95905857107301357381155516338362784207317010673073787675690511286760317802272";
    const PubY = "84471157200556546968836560278865290072494471108462199268947632974788956557127";
    const share1 = "20239155973571792266164364275964524242029729063304656485165418448115248082802";
    const share2 = "35548699788994050550146262427737959890227338646889173786783560192790230768775";

    const bks1 = "86868548274168401139460440216870783092063038666835278534832349302396154314237";
    const bks2 = "18215211649252066570518778981645428771794111974791698622992184423457425369616";

    // Setup server share 
    const serverShare = new CggmpBackup({
        x: PubX,
        y: PubY,
        share: share2,
        clientBk: bks1,
        serverBk: bks2
    });

    // Marshal serverShare to JSON and convert to byte array
    let serverShareBytes;
    try {
    const jsonString = JSON.stringify(serverShare);
    
    // Convert string to Uint8Array (JavaScript's equivalent to []byte in Go)
    const encoder = new TextEncoder();
    serverShareBytes = encoder.encode(jsonString);
    } catch (err) {
    console.error("Error marshalling server share: ", err);
    throw new Error("Error marshalling server share: " + err.message);
    }

    // Setup client share
    const clientShare = new AuxInfo({
        pubKey: new Pubkey(PubX, PubY),
        share: share1,
        bks: {
            "client": new BK(bks1, 0),
            "server": new BK(bks2, 0)
        }
    });
    

    // Marshal clientShare to JSON and convert to byte array
    let clientShareBytes;
    try {
        const jsonString = JSON.stringify(clientShare);
        
        // Convert string to Uint8Array (JavaScript's equivalent to []byte in Go)
        const encoder = new TextEncoder();
        clientShareBytes = encoder.encode(jsonString);
    } catch (err) {
        console.error("Error marshalling client share: ", err);
        throw new Error("Error marshalling client share: " + err.message);
    }

    recoverOptions = {
        curve: 'secp256k1',
        littleEndian: false
    }
    const privateKey = await recoverAndFormatPrivateKey(clientShareBytes, serverShareBytes, )
    console.log("Private key - ECDSA: ", privateKey);

})();

(async () => {
    console.log("Using Edwards curve");
    const PubX = "4155079341668263211468645490523568285081269952458706525782542662765297681720";
    const PubY = "33170931963135572976162508038363263257341896290508808710058213404228890998925";
    const share1 = "209966714242237444698175757090286175213972386782216686905361352132244887465";
    const share2 = "3972754397714006467384117681683827603947104866080154044667201466825208338771";

    const bks1 = "674076495015830984277819692722227700482715353628168867159273906537386870716";
    const bks2 = "4645588044633541551475641810441554672302500022056130044324874662839150929177";

    // Setup server share 
    const serverShare = new CggmpBackup({
        x: PubX,
        y: PubY,
        share: share2,
        clientBk: bks1,
        serverBk: bks2
    });

    // Marshal serverShare to JSON and convert to byte array
    let serverShareBytes;
    try {
    const jsonString = JSON.stringify(serverShare);
    
    // Convert string to Uint8Array (JavaScript's equivalent to []byte in Go)
    const encoder = new TextEncoder();
    serverShareBytes = encoder.encode(jsonString);
    } catch (err) {
    console.error("Error marshalling server share: ", err);
    throw new Error("Error marshalling server share: " + err.message);
    }

    // Setup client share
    const clientShare = new AuxInfo({
        pubKey: new Pubkey(PubX, PubY),
        share: share1,
        bks: {
            "client": new BK(bks1, 0),
            "server": new BK(bks2, 0)
        }
    });
    

    // Marshal clientShare to JSON and convert to byte array
    let clientShareBytes;
    try {
        const jsonString = JSON.stringify(clientShare);
        
        // Convert string to Uint8Array (JavaScript's equivalent to []byte in Go)
        const encoder = new TextEncoder();
        clientShareBytes = encoder.encode(jsonString);
    } catch (err) {
        console.error("Error marshalling client share: ", err);
        throw new Error("Error marshalling client share: " + err.message);
    }

    recoverOptions = {
        curve: 'ed25519',
        littleEndian: true
    }
    const privateKey = await recoverEd25519Key(clientShareBytes, serverShareBytes )
    console.log("Private key - EDDSA: ", privateKey);

})();