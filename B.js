const { DirectSecp256k1HdWallet, Registry } = require("@cosmjs/proto-signing");
const { SigningStargateClient, GasPrice } = require("@cosmjs/stargate");
const { MsgExecuteContract } = require("cosmjs-types/cosmwasm/wasm/v1/tx");
const { toUtf8 } = require("@cosmjs/encoding");
const { Slip10RawIndex } = require("@cosmjs/crypto");
const { ethers, JsonRpcProvider, Wallet, keccak256, solidityPacked } = require("ethers");
const axios = require("axios");
const moment = require("moment-timezone");
const fs = require("fs").promises;
const path = require("path");
const prompt = require("prompt-sync")();
const crypto = require("crypto");
const chalk = require("chalk");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

// Logger
const logger = {
  info: (msg) => console.log(chalk.cyan(`[✓] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[⚠] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[✗] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[✅] ${msg}`)),
  loading: (msg) => console.log(chalk.blue(`[⟳] ${msg}`)),
  step: (msg) => console.log(chalk.magenta(`[➤] ${msg}`)),
};

// Konfigurasi Cosmos
const BABYLON_TESTNET = {
  chainId: "bbn-test-1",
  rpcEndpoint: "https://babylon-testnet-rpc.polkachu.com/",
  prefix: "bbn",
  denom: "ubbn",
  gasPrice: GasPrice.fromString("0.0025ubbn"),
};

const XION_TESTNET = {
  prefix: "xion",
};

// Konfigurasi EVM
const EVM_CONTRACT_ADDRESS = "0x5FbE74A283f7954f10AA04C2eDf55578811aeb03";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const GRAPHQL_ENDPOINT = "https://graphql.union.build/v1/graphql";
const BASE_EXPLORER_URL = "https://sepolia.etherscan.io";
const UNION_URL = "https://app.union.build/explorer";
const TELEGRAM_LINK = "https://t.me/airdrop_node";

const rpcProviders = [new JsonRpcProvider("https://eth-sepolia.public.blastapi.io")];
let currentRpcProviderIndex = 0;

function provider() {
  return rpcProviders[currentRpcProviderIndex];
}

function rotateRpcProvider() {
  currentRpcProviderIndex = (currentRpcProviderIndex + 1) % rpcProviders.length;
  return provider();
}

// ABI EVM
const UCS03_ABI = [
  {
    inputs: [
      { internalType: "uint32", name: "channelId", type: "uint32" },
      { internalType: "uint64", name: "timeoutHeight", type: "uint64" },
      { internalType: "uint64", name: "timeoutTimestamp", type: "uint64" },
      { internalType: "bytes32", name: "salt", type: "bytes32" },
      {
        components: [
          { internalType: "uint8", name: "version", type: "uint8" },
          { internalType: "uint8", name: "opcode", type: "uint8" },
          { internalType: "bytes", name: "operand", type: "bytes" },
        ],
        internalType: "struct Instruction",
        name: "instruction",
        type: "tuple",
      },
    ],
    name: "send",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
    stateMutability: "view",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
    stateMutability: "view",
  },
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
    stateMutability: "nonpayable",
  },
];

// Template Instruksi Cosmos
const INSTRUCTION_USDC_0_01 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000340000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e62626e317a7372763233616b6b6778646e77756c3732736674677632786a74356b68736e743377776a687030666668363833687a7035617135613068366e00000000000000000000000000000000000000000000000000000000000000000004555344430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e3132766b3361386c7a3637646530357a6c7176713530707670643270636a66777674777a74356676647437357a387533327932657168646632397600";

const INSTRUCTION_USDC_0_02 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000340000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004e20000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002e00000000000000000000000000000000000000000000000000000000000004e20000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e62626e317a7372763233616b6b6778646e77756c3732736674677632786a74356b68736e743377776a687030666668363833687a7035617135613068366e00000000000000000000000000000000000000000000000000000000000000000004555344430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e3132766b3361386c7a3637646530357a6c7176713530707670643270636a66777674777a74356676647437357a387533327932657168646632397600";

const INSTRUCTION_UBBN_0_001 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003e8000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000003e8000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e316a30687036717a7467617a6137743079386476633232656176767671796473346b7a653538646c716b756c79733872326b633873396d7030736d00";

const INSTRUCTION_UBBN_0_002 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000007d0000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000007d0000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e316a30687036717a7467617a6137743079386476633232656176767671796473346b7a653538646c716b756c79733872326b633873396d7030736d00";

// Path file wallet
const WALLET_FILE = path.join(__dirname, "wallet.json");

// Fungsi Utilitas
function getRandomDelay() {
  return Math.floor(Math.random() * (120000 - 30000 + 1)) + 30000; // 30-120 detik
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timelog() {
  return moment().tz("Asia/Jakarta").format("HH:mm:ss | DD-MM-YYYY");
}

// Fungsi Spesifik Cosmos
function getRandomInstruction(mode) {
  const usdcInstructions = [INSTRUCTION_USDC_0_01, INSTRUCTION_USDC_0_02];
  const ubbnInstructions = [INSTRUCTION_UBBN_0_001, INSTRUCTION_UBBN_0_002];
  let selected;
  if (mode === "1") {
    selected = ubbnInstructions[crypto.randomInt(0, ubbnInstructions.length)];
    logger.info(`Instruksi Terpilih: ubbn ${selected.includes("3e8") ? "0.001" : "0.002"}`);
  } else if (mode === "2") {
    selected = usdcInstructions[crypto.randomInt(0, usdcInstructions.length)];
    logger.info(`Instruksi Terpilih: USDC ${selected.includes("2710") ? "0.01" : "0.02"}`);
  } else {
    const allInstructions = [...usdcInstructions, ...ubbnInstructions];
    selected = allInstructions[crypto.randomInt(0, allInstructions.length)];
    logger.info(`Instruksi Terpilih: ${selected.includes("2710") ? "USDC 0.01" : selected.includes("4e20") ? "USDC 0.02" : selected.includes("3e8") ? "ubbn 0.001" : "ubbn 0.002"}`);
  }
  return selected;
}

function generateSalt() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

function generateTimeoutTimestamp() {
  const now = Date.now();
  const bufferSeconds = 259200;
  const timeoutMs = now + bufferSeconds * 1000;
  const timeoutNs = timeoutMs * 1e6;
  return timeoutNs.toString();
}

async function readCosmosWallets() {
  try {
    const content = await fs.readFile(WALLET_FILE, "utf8");
    const wallets = JSON.parse(content);
    if (!Array.isArray(wallets) || wallets.length === 0) {
      throw new Error("Tidak ada wallet ditemukan di wallet.json atau format tidak valid");
    }
    for (const wallet of wallets) {
      if (!wallet.credential || !wallet.xionAddress) {
        throw new Error("Setiap wallet harus memiliki kolom 'credential' dan 'xionAddress'");
      }
      if (!wallet.xionAddress.startsWith(XION_TESTNET.prefix) || wallet.xionAddress.length !== 43) {
        throw new Error(`Alamat Xion tidak valid: ${wallet.xionAddress}. Harus diawali '${XION_TESTNET.prefix}' dan panjang 43 karakter`);
      }
      const isMnemonic = wallet.credential.split(" ").length === 12 || wallet.credential.split(" ").length === 24;
      if (!isMnemonic) {
        throw new Error(`Credential tidak valid: ${wallet.credential}. Harus berupa mnemonic 12/24 kata`);
      }
    }
    return wallets;
  } catch (error) {
    throw new Error(`Gagal membaca wallet.json: ${error.message}`);
  }
}

async function createCosmosWalletList(wallets) {
  const walletList = [];
  for (let i = 0; i < wallets.length; i++) {
    const { credential, xionAddress, telegramBotToken, telegramChatId } = wallets[i];
    const babylonWallet = await DirectSecp256k1HdWallet.fromMnemonic(credential, {
      prefix: BABYLON_TESTNET.prefix,
      hdPaths: [[Slip10RawIndex.hardened(44), Slip10RawIndex.hardened(118), Slip10RawIndex.hardened(0), Slip10RawIndex.normal(0), Slip10RawIndex.normal(0)]],
    });
    const [babylonAccount] = await babylonWallet.getAccounts();
    const babylonAddress = babylonAccount.address;
    walletList.push({ babylonWallet, babylonAddress, xionAddress, telegramBotToken, telegramChatId });
  }
  return walletList;
}

function encodeBech32ToHex(bech32Address) {
  return Buffer.from(bech32Address, "ascii").toString("hex");
}

function isValidHex(hex) {
  return /^[0-9a-fA-F]+$/.test(hex);
}

async function checkCosmosBalance(client, address, denom) {
  try {
    const balance = await client.getBalance(address, denom);
    return parseInt(balance.amount);
  } catch (error) {
    logger.error(`Gagal memeriksa saldo untuk ${address}: ${error.message}`);
    return 0;
  }
}

function generateCosmosInstruction(senderAddress, xionAddress, mode) {
  const senderHex = encodeBech32ToHex(senderAddress);
  const receiverHex = encodeBech32ToHex(xionAddress);
  logger.info(`Sender Hex: ${senderHex}`);
  logger.info(`Receiver Hex: ${receiverHex}`);
  if (!isValidHex(senderHex) || !isValidHex(receiverHex)) {
    throw new Error(`Format hex tidak valid untuk sender (${senderHex}) atau receiver (${receiverHex})`);
  }
  let instructionHex = getRandomInstruction(mode);
  if (!instructionHex || instructionHex.length < 10) {
    throw new Error("Template instruksi tidak valid atau kosong");
  }
  instructionHex = instructionHex.replace("{sender}", senderHex).replace("{receiver}", receiverHex);
  logger.info(`Instruksi Hex yang Dihasilkan: ${instructionHex}`);
  logger.info(`Panjang Instruksi Hex: ${instructionHex.length}`);
  if (!instructionHex.startsWith("0x") || !isValidHex(instructionHex.slice(2))) {
    throw new Error(`Format instruksi hex tidak valid: ${instructionHex}`);
  }
  const expectedLength = instructionHex.includes("455534443") ? 2370 : 2306;
  if (instructionHex.length !== expectedLength) {
    throw new Error(`Panjang instruksi tidak cocok: diharapkan ${expectedLength}, didapat ${instructionHex.length}`);
  }
  return instructionHex;
}

async function estimateCosmosGas(client, senderAddress, msg) {
  try {
    const gasEstimation = await client.simulate(senderAddress, [msg], "");
    const gasWithBuffer = Math.ceil(gasEstimation * 1.5);
    return { gasEstimation, gasWithBuffer };
  } catch (error) {
    throw new Error(`Estimasi gas gagal: ${error.message}`);
  }
}

async function createCosmosTransaction(client, senderAddress, instructionHex, sequence) {
  const contractAddress = "bbn1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292q77945h";
  const salt = generateSalt();
  const timeoutTimestamp = generateTimeoutTimestamp();
  const isUbbn = instructionHex.includes("7562626e");
  const amount = isUbbn ? (instructionHex.includes("3e8") ? "1000" : "2000") : null;
  const feeAmount = isUbbn ? "3479" : "4150";
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: MsgExecuteContract.fromPartial({
      sender: senderAddress,
      contract: contractAddress,
      msg: toUtf8(
        JSON.stringify({
          send: {
            channel_id: 4,
            timeout_height: "0",
            timeout_timestamp: timeoutTimestamp,
            salt: salt,
            instruction: instructionHex,
          },
        })
      ),
      funds: isUbbn ? [{ denom: BABYLON_TESTNET.denom, amount: amount }] : [],
    }),
  };
  const { gasEstimation, gasWithBuffer } = await estimateCosmosGas(client, senderAddress, msg);
  logger.info(`Estimasi Gas: ${gasEstimation}, Gas dengan Buffer: ${gasWithBuffer}`);
  logger.info(`Jumlah: ${isUbbn ? (instructionHex.includes("3e8") ? "0.001 ubbn" : "0.002 ubbn") : (instructionHex.includes("2710") ? "0.01 USDC" : "0.02 USDC")}`);
  const fee = {
    amount: [{ denom: BABYLON_TESTNET.denom, amount: feeAmount }],
    gas: gasWithBuffer.toString(),
  };
  return { msg, fee };
}

async function cosmosMain(mode, txPerWallet, telegramBot = null, chatId = null) {
  try {
    const registry = new Registry();
    registry.register("/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract);
    logger.loading(`Menghubungkan ke RPC: ${BABYLON_TESTNET.rpcEndpoint}`);
    const walletData = await readCosmosWallets();
    const wallets = await createCosmosWalletList(walletData);
    if (wallets.length === 0) {
      throw new Error("Tidak ada wallet valid ditemukan");
    }
    const numTxs = txPerWallet * wallets.length;
    logger.info(`Total transaksi untuk disimulasikan: ${numTxs} (${txPerWallet} per wallet di ${wallets.length} wallet)`);
    if (telegramBot && chatId) {
      telegramBot.sendMessage(chatId, `Memulai ${numTxs} transaksi Cosmos (${txPerWallet} per wallet di ${wallets.length} wallet)`);
    }
    const walletInfo = [];
    for (const wallet of wallets) {
      logger.info(`Alamat Pengirim (Babylon): ${wallet.babylonAddress}`);
      logger.info(`Alamat Penerima (Xion): ${wallet.xionAddress}`);
      const client = await SigningStargateClient.connectWithSigner(BABYLON_TESTNET.rpcEndpoint, wallet.babylonWallet, {
        registry,
        gasPrice: BABYLON_TESTNET.gasPrice,
      }).catch((error) => {
        throw new Error(`Gagal terhubung ke RPC untuk ${wallet.babylonAddress}: ${error.message}`);
      });
      const balance = await checkCosmosBalance(client, wallet.babylonAddress, BABYLON_TESTNET.denom);
      logger.info(`Saldo Pengirim: ${balance} ${BABYLON_TESTNET.denom}`);
      if (balance < 5479) {
        throw new Error(`Saldo tidak cukup untuk ${wallet.babylonAddress}: ${balance} ${BABYLON_TESTNET.denom}, perlu setidaknya 5479`);
      }
      const accountInfo = await client.getAccount(wallet.babylonAddress);
      let sequence = accountInfo?.sequence;
      if (!sequence) {
        throw new Error(`Akun tidak ditemukan di chain untuk ${wallet.babylonAddress}. Pastikan memiliki dana atau gunakan faucet.`);
      }
      walletInfo.push({ ...wallet, sequence, client });
    }
    logger.success(`Berhasil terhubung ke RPC untuk semua wallet`);
    let txCount = 0;
    for (const wallet of walletInfo) {
      const bot = wallet.telegramBotToken && wallet.telegramChatId ? new TelegramBot(wallet.telegramBotToken) : telegramBot;
      const notifyChatId = wallet.telegramChatId || chatId;
      for (let j = 0; j < txPerWallet && txCount < numTxs; j++) {
        txCount++;
        logger.step(`Mempersiapkan transaksi ${txCount} untuk wallet ${wallet.babylonAddress}`);
        if (bot && notifyChatId) {
          bot.sendMessage(notifyChatId, `Mempersiapkan transaksi ${txCount} untuk wallet ${wallet.babylonAddress}`);
        }
        const instructionHex = generateCosmosInstruction(wallet.babylonAddress, wallet.xionAddress, mode);
        const { msg, fee } = await createCosmosTransaction(wallet.client, wallet.babylonAddress, instructionHex, wallet.sequence).catch((error) => {
          throw new Error(`Persiapan transaksi gagal untuk ${wallet.babylonAddress}: ${error.message}`);
        });
        const result = await wallet.client.signAndBroadcast(wallet.babylonAddress, [msg], fee, "").catch((error) => {
          throw new Error(`Gagal menyiarkan transaksi untuk ${wallet.babylonAddress}: ${error.message}`);
        });
        const successMsg = `${timelog()} | Transaksi ${txCount} terkirim! Tx Hash: ${result.transactionHash}`;
        logger.success(successMsg);
        if (bot && notifyChatId) {
          bot.sendMessage(notifyChatId, successMsg);
        }
        wallet.sequence++;
        if (txCount < numTxs) {
          const delay = getRandomDelay();
          logger.info(`Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`);
          if (bot && notifyChatId) {
            bot.sendMessage(notifyChatId, `Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`);
          }
          await sleep(delay);
        }
      }
    }
    logger.success(`Semua transaksi selesai!`);
    if (telegramBot && chatId) {
      telegramBot.sendMessage(chatId, `Semua transaksi Cosmos selesai!`);
    }
  } catch (error) {
    logger.error(`Kesalahan: ${error.message}`);
    if (telegramBot && chatId) {
      telegramBot.sendMessage(chatId, `Kesalahan Cosmos: ${error.message}`);
    }
  }
}

// Fungsi Spesifik EVM
async function checkEvmBalanceAndApprove(wallet, usdcAddress, spenderAddress) {
  const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, wallet);
  const balance = await usdcContract.balanceOf(wallet.address);
  if (balance === 0n) {
    logger.error(`${wallet.address} tidak memiliki cukup USDC. Isi wallet terlebih dahulu!`);
    return false;
  }
  const allowance = await usdcContract.allowance(wallet.address, spenderAddress);
  if (allowance === 0n) {
    logger.loading(`USDC belum disetujui. Mengirim transaksi persetujuan...`);
    const approveAmount = ethers.MaxUint256;
    try {
      const tx = await usdcContract.approve(spenderAddress, approveAmount);
      const receipt = await tx.wait();
      logger.success(`Persetujuan dikonfirmasi: ${BASE_EXPLORER_URL}/tx/${receipt.hash}`);
      await sleep(3000);
    } catch (err) {
      logger.error(`Persetujuan gagal: ${err.message}`);
      return false;
    }
  }
  return true;
}

async function pollPacketHash(txHash, retries = 50, intervalMs = 5000) {
  const headers = {
    accept: "application/graphql-response+json, application/json",
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0",
  };
  const data = {
    query: `
      query ($submission_tx_hash: String!) {
        v2_transfers(args: {p_transaction_hash: $submission_tx_hash}) {
          packet_hash
        }
      }
    `,
    variables: {
      submission_tx_hash: txHash.startsWith("0x") ? txHash : `0x${txHash}`,
    },
  };
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(GRAPHQL_ENDPOINT, data, { headers });
      const result = res.data?.data?.v2_transfers;
      if (result && result.length > 0 && result[0].packet_hash) {
        return result[0].packet_hash;
      }
    } catch (e) {
      logger.error(`Kesalahan paket: ${e.message}`);
    }
    await sleep(intervalMs);
  }
  logger.warn(`Tidak ada hash paket ditemukan setelah ${retries} percobaan.`);
  return null;
}

async function sendEvmTransaction(walletInfo, maxTransaction, destination, telegramBot = null, chatId = null) {
  const wallet = new ethers.Wallet(walletInfo.privateKey, provider());
  let recipientAddress, destinationName, channelId, operand;
  if (destination === "babylon") {
    recipientAddress = walletInfo.babylonAddress;
    destinationName = "Babylon";
    channelId = 7;
    if (!recipientAddress) {
      const msg = `Melewati wallet '${walletInfo.name || "Tanpa Nama"}': Alamat Babylon tidak ada.`;
      logger.warn(msg);
      if (telegramBot && chatId) telegramBot.sendMessage(chatId, msg);
      return;
    }
  } else if (destination === "holesky") {
    recipientAddress = wallet.address;
    destinationName = "Holesky";
    channelId = 8;
  } else {
    const msg = `Tujuan tidak valid: ${destination}`;
    logger.error(msg);
    if (telegramBot && chatId) telegramBot.sendMessage(chatId, msg);
    return;
  }
  const msg = `Mengirim ${maxTransaction} Transaksi dari Sepolia ke ${destinationName} dari ${wallet.address} (${walletInfo.name || "Tanpa Nama"})`;
  logger.loading(msg);
  if (telegramBot && chatId) telegramBot.sendMessage(chatId, msg);
  const shouldProceed = await checkEvmBalanceAndApprove(wallet, USDC_ADDRESS, EVM_CONTRACT_ADDRESS);
  if (!shouldProceed) {
    if (telegramBot && chatId) telegramBot.sendMessage(chatId, `Gagal melanjutkan dengan ${walletInfo.name || "Tanpa Nama"}: USDC tidak cukup atau persetujuan gagal.`);
    return;
  }
  const contract = new ethers.Contract(EVM_CONTRACT_ADDRESS, UCS03_ABI, wallet);
  const senderHex = wallet.address.slice(2).toLowerCase();
  const recipientHex = destination === "babylon" ? Buffer.from(recipientAddress, "utf8").toString("hex") : senderHex;
  const timeoutHeight = 0;
  if (destination === "babylon") {
    operand = `0x...${senderHex}...${recipientHex}...`;
} else {
    operand = `0x...${senderHex}...`;
} // Pastikan ini ada

for (let i = 1; i <= maxTransaction; i++) {
    logger.step(`${walletInfo.name || "Tanpa Nama"} | Transaksi ${i}/${maxTransaction}`);
    if (telegramBot && chatId) telegramBot.sendMessage(chatId, `${walletInfo.name || "Tanpa Nama"} | Transaksi ${i}/${maxTransaction}`);
    
    const now = BigInt(Date.now()) * 1_000_000n;
    const oneDayNs = 86_400_000_000_000n;
    const timeoutTimestamp = (now + oneDayNs * 1n).toString();
    const timestampNow = Math.floor(Date.now() / 1000);
    const salt = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder.encode(["address", "uint256"], [wallet.address, timestampNow]));
    const instruction = { version: "0", opcode: "0x02", operand };
    
    try {
        const tx = await contract.send(channelId, timeoutHeight, timeoutTimestamp, salt, instruction);
        await tx.wait(1);
        const successMsg = `${timelog()} | ${walletInfo.name || "Tanpa Nama"} | Transaksi Dikonfirmasi: ${BASE_EXPLORER_URL}/tx/${tx.hash}`;
        logger.success(successMsg);
        if (telegramBot && chatId) telegramBot.sendMessage(chatId, successMsg);
        const txHash = tx.hash.startsWith("0x") ? tx.hash : `0x${tx.hash}`;
        const packetHash = await pollPacketHash(txHash);
        if (packetHash) {
            const packetMsg = `${timelog()} | ${walletInfo.name || "Tanpa Nama"} | Paket Dikirim: ${UNION_URL}/${packetHash}`;
            logger.info(packetMsg);
            if (telegramBot && chatId) telegramBot.sendMessage(chatId, packetMsg);
        }
    } catch (err) {
        const errMsg = `Gagal untuk ${wallet.address}: ${err.message}`;
        logger.error(errMsg);
        if (telegramBot && chatId) telegramBot.sendMessage(chatId, errMsg);
    }
    
    if (i < maxTransaction) {
        const delay = getRandomDelay();
        logger.info(`Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`);
        if (telegramBot && chatId) telegramBot.sendMessage(chatId, `Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`);
        await sleep(delay);
    }
} // Pastikan ini ada
// Fungsi untuk memuat wallet EVM dari .env
function loadEvmWallets() {
  const wallets = [];
  let index = 1;
  while (true) {
    const privateKey = process.env[`PRIVATE_KEY_${index}`];
    const babylonAddress = process.env[`BABYLON_ADDRESS_${index}`];
    if (!privateKey) break;
    if (!privateKey.startsWith("0x") || !/^(0x)[0-9a-fA-F]{64}$/.test(privateKey)) {
      logger.warn(`Kunci privat ${index} tidak valid: harus berupa string heksadesimal 64 karakter yang diawali 0x`);
    } else {
      wallets.push({
        name: `Wallet${index}`,
        privateKey,
        babylonAddress: babylonAddress || "",
      });
    }
    index++;
  }
  return wallets;
}

// Fungsi utama mode konsol
async function mainConsole() {
  while (true) {
    console.log(`\n=== Union Testnet Auto Bot (by airdropnode - ${TELEGRAM_LINK}) ===`);
    console.log("1. Cosmos (Babylon ke Xion)");
    console.log("2. EVM (Sepolia ke Holesky/Babylon)");
    console.log("3. Keluar");
    const choice = prompt("Pilih opsi (1-3): ").trim();
    if (choice === "3") {
      logger.info("Keluar dari program.");
      process.exit(0);
    }
    if (!["1", "2"].includes(choice)) {
      logger.error("Opsi salah. Pilih 1, 2, atau 3.");
      continue;
    }
    const maxTransactionInput = prompt("Masukkan jumlah transaksi per wallet: ").trim();
    const maxTransaction = parseInt(maxTransactionInput);
    if (isNaN(maxTransaction) || maxTransaction <= 0) {
      logger.error("Masukkan angka positif yang valid.");
      continue;
    }
    if (choice === "1") {
      console.log("\nPilih submode untuk Cosmos:");
      console.log("1. Babylon ke Xion (ubbn)");
      console.log("2. USDC Babylon ke USDC Xion");
      console.log("3. Acak (ubbn atau USDC)");
      const subMode = prompt("Pilih submode (1-3): ").trim();
      if (!["1", "2", "3"].includes(subMode)) {
        logger.error("Submode salah. Pilih 1, 2, atau 3.");
        continue;
      }
      await cosmosMain(subMode, maxTransaction);
    } else if (choice === "2") {
      console.log("\nPilih submode untuk EVM:");
      console.log("1. Sepolia ke Holesky");
      console.log("2. Sepolia ke Babylon");
      console.log("3. Acak (Holesky dan Babylon)");
      const subMode = prompt("Pilih submode (1-3): ").trim();
      if (!["1", "2", "3"].includes(subMode)) {
        logger.error("Submode salah. Pilih 1, 2, atau 3.");
        continue;
      }
      const wallets = loadEvmWallets();
      if (wallets.length === 0) {
        logger.error("Tidak ada wallet ditemukan di .env. Tambahkan PRIVATE_KEY_...");
        continue;
      }
      for (const walletInfo of wallets) {
        if (subMode === "1") {
          await sendEvmTransaction(walletInfo, maxTransaction, "holesky");
        } else if (subMode === "2") {
          await sendEvmTransaction(walletInfo, maxTransaction, "babylon");
        } else if (subMode === "3") {
          const destinations = ["holesky", "babylon"].filter(dest => dest !== "babylon" || walletInfo.babylonAddress);
          if (destinations.length === 0) {
            logger.warn(`Melewati wallet '${walletInfo.name}': Tidak ada tujuan valid (alamat Babylon tidak ada).`);
            continue;
          }
          for (let i = 0; i < maxTransaction; i++) {
            const randomDest = destinations[Math.floor(Math.random() * destinations.length)];
            await sendEvmTransaction(walletInfo, 1, randomDest);
          }
        }
      }
      if (wallets.length === 0) {
        logger.warn("Tidak ada wallet yang diproses. Periksa .env untuk entri valid.");
      }
    }
  }
}

// Fungsi utama untuk mode Telegram
function mainTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !allowedChatId) {
    logger.warn("Bot Telegram tidak dikonfigurasi: TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID tidak ditemukan di .env. Memulai dalam mode konsol.");
    return mainConsole();
  }

  const bot = new TelegramBot(token, { polling: true });
  const userState = {};

  // Tombol menu utama
  const mainMenu = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Cosmos (Babylon ke Xion)", callback_data: "mode_cosmos" }],
        [{ text: "EVM (Sepolia ke Holesky/Babylon)", callback_data: "mode_evm" }],
        [{ text: "Tambah Wallet (Cosmos)", callback_data: "add_wallet_cosmos" }],
        [{ text: "Daftar Wallet (Cosmos)", callback_data: "list_wallets_cosmos" }],
        [{ text: "Bantuan", callback_data: "help" }],
        [{ text: "Join Telegram (airdropnode)", url: TELEGRAM_LINK }],
      ],
    },
  };

  // Tombol kembali ke beranda
  const backToHomeButton = [{ text: "Kembali ke Beranda", callback_data: "home" }];

  function showMainMenu(chatId, message = `Selamat datang di Union Testnet Auto Bot! (by airdropnode - ${TELEGRAM_LINK})\nPilih opsi:`) {
    delete userState[chatId];
    bot.sendMessage(chatId, message, mainMenu);
  }

  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== allowedChatId) {
      bot.sendMessage(chatId, "Akses tidak diizinkan.");
      return;
    }
    showMainMenu(chatId);
  });

  // Handle button callbacks
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id.toString();
    if (chatId !== allowedChatId) {
      bot.sendMessage(chatId, "Akses tidak diizinkan.");
      bot.answerCallbackQuery(query.id);
      return;
    }
    const data = query.data;
    bot.answerCallbackQuery(query.id);

    if (data === "home") {
      showMainMenu(chatId, "Kembali ke menu utama.");
      return;
    }

    if (data === "help") {
      bot.sendMessage(
        chatId,
        "Aksi yang tersedia:\n- Cosmos Mode: Jalankan transaksi Babylon ke Xion\n- EVM Mode: Transaksi Sepolia ke Holesky/Babylon\n- Tambah Wallet: Tambah wallet Cosmos baru\n- Daftar Wallet: Lihat wallet Cosmos\n- Bantuan: Tampilkan pesan ini",
        {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        }
      );
      return;
    }

    if (data === "add_wallet_cosmos") {
      userState[chatId] = { step: "add_wallet_cosmos_input" };
      bot.sendMessage(
        chatId,
        "Masukkan detail wallet dengan format:\nmnemonic: <12-24 kata mnemonic>\nxion_alamat: <alamat xion>\ntoken_bot: <token bot Telegram>\nchat_id: <chat ID Telegram>",
        {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        }
      );
      return;
    }

    if (data === "list_wallets_cosmos") {
      const wallets = await readCosmosWallets().catch(() => []);
      if (!wallets || wallets.length === 0) {
        bot.sendMessage(chatId, "Tidak ada wallet Cosmos ditemukan.", {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        return;
      }
      const walletList = wallets.map(w => `Mnemonic: ${w.credential.substring(0, 20)}...\nXion: ${w.xionAddress}\nToken Bot: ${w.telegramBotToken || 'Tidak Ada'}\nChat ID: ${w.telegramChatId || 'Tidak Ada'}`).join("\n\n");
      bot.sendMessage(chatId, `Daftar Wallet Cosmos:\n\n${walletList}`, {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      return;
    }

    if (data === "mode_cosmos") {
      userState[chatId] = { step: "select_cosmos_mode" };
      bot.sendMessage(chatId, "Pilih mode Cosmos:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Babylon ke Xion (ubbn)", callback_data: "cosmos_mode_1" }],
            [{ text: "USDC Babylon ke USDC Xion", callback_data: "cosmos_mode_2" }],
            [{ text: "Acak (ubbn atau USDC)", callback_data: "cosmos_mode_random" }],
            backToHomeButton,
          ],
        },
      });
      return;
    }

    if (data === "mode_evm") {
      userState[chatId] = { step: "select_evm_mode" };
      bot.sendMessage(chatId, "Pilih mode EVM:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Sepolia ke Holesky", callback_data: "evm_mode_holesky" }],
            [{ text: "Sepolia ke Babylon", callback_data: "evm_mode_babylon" }],
            [{ text: "Acak (Holesky dan Babylon)", callback_data: "evm_mode_random" }],
            backToHomeButton,
          ],
        },
      });
      return;
    }

    if (data.startsWith("cosmos_mode_")) {
      const mode = data.split("_")[2] === "random" ? "3" : data.split("_")[2];
      userState[chatId] = { step: "cosmos_transactions", mode };
      bot.sendMessage(chatId, "Masukkan jumlah transaksi per wallet untuk Cosmos:", {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      return;
    }

    if (data.startsWith("evm_mode_")) {
      const destination = data.split("_")[2];
      userState[chatId] = { step: "evm_transactions", destination };
      bot.sendMessage(chatId, "Masukkan jumlah transaksi per wallet untuk EVM:", {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      return;
    }
  });

  // Handle text input
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== allowedChatId) {
      bot.sendMessage(chatId, "Akses tidak diizinkan.");
      return;
    }
    if (msg.text && msg.text.startsWith("/")) {
      return;
    }
    if (!userState[chatId]) {
      showMainMenu(chatId, "Harap gunakan tombol untuk berinteraksi.");
      return;
    }
    const state = userState[chatId];

    if (state.step === "add_wallet_cosmos_input") {
      try {
        const lines = msg.text.split("\n").map(line => line.trim());
        const wallet = {};
        lines.forEach(line => {
          const [key, value] = line.split(":").map(s => s.trim());
          wallet[key] = value;
        });
        if (!wallet.mnemonic || !wallet.xion_alamat) {
          bot.sendMessage(chatId, "Format salah. Masukkan mnemonic dan xion_alamat.", {
            reply_markup: {
              inline_keyboard: [backToHomeButton],
            },
          });
          return;
        }
        const isMnemonic = wallet.mnemonic.split(" ").length === 12 || wallet.mnemonic.split(" ").length === 24;
        if (!isMnemonic) {
          bot.sendMessage(chatId, "Mnemonic tidak valid. Harus 12 atau 24 kata.", {
            reply_markup: {
              inline_keyboard: [backToHomeButton],
            },
          });
          return;
        }
        if (!wallet.xion_alamat.startsWith(XION_TESTNET.prefix) || wallet.xion_alamat.length !== 43) {
          bot.sendMessage(chatId, `Alamat Xion tidak valid: ${wallet.xion_alamat}. Harus diawali ${XION_TESTNET.prefix} dan panjang 43 karakter.`, {
            reply_markup: {
              inline_keyboard: [backToHomeButton],
            },
          });
          return;
        }
        const wallets = await readCosmosWallets().catch(() => []);
        wallets.push({
          credential: wallet.mnemonic,
          xionAddress: wallet.xion_alamat,
          telegramBotToken: wallet.token_bot || "",
          telegramChatId: wallet.chat_id || "",
        });
        await fs.writeFile(WALLET_FILE, JSON.stringify(wallets, null, 2));
        bot.sendMessage(chatId, `Wallet Cosmos berhasil ditambahkan!`, {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        delete userState[chatId];
      } catch (err) {
        bot.sendMessage(chatId, `Gagal menambah wallet: ${err.message}`, {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
      }
      return;
    }

    if (state.step === "cosmos_transactions") {
      const maxTransaction = parseInt(msg.text.trim());
      if (isNaN(maxTransaction) || maxTransaction <= 0) {
        bot.sendMessage(chatId, "Masukkan angka positif yang valid.", {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        return;
      }
      const wallets = await readCosmosWallets().catch(() => []);
      if (wallets.length === 0) {
        bot.sendMessage(chatId, "Tidak ada wallet Cosmos ditemukan. Tambahkan wallet terlebih dahulu.", {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        delete userState[chatId];
        return;
      }
      bot.sendMessage(chatId, `Memulai ${maxTransaction} transaksi Cosmos (mode ${state.mode})...`, {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      await cosmosMain(state.mode, maxTransaction, bot, chatId);
      bot.sendMessage(chatId, "Proses transaksi Cosmos selesai.", {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      delete userState[chatId];
      return;
    }

    if (state.step === "evm_transactions") {
      const maxTransaction = parseInt(msg.text.trim());
      if (isNaN(maxTransaction) || maxTransaction <= 0) {
        bot.sendMessage(chatId, "Masukkan angka positif yang valid.", {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        return;
      }
      const wallets = loadEvmWallets();
      if (wallets.length === 0) {
        bot.sendMessage(chatId, "Tidak ada wallet EVM ditemukan di .env. Tambahkan PRIVATE_KEY_...", {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        delete userState[chatId];
        return;
      }
      bot.sendMessage(chatId, `Memulai ${maxTransaction} transaksi EVM ke ${state.destination}...`, {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      for (const walletInfo of wallets) {
        if (state.destination === "holesky") {
          await sendEvmTransaction(walletInfo, maxTransaction, "holesky", bot, chatId);
        } else if (state.destination === "babylon") {
          await sendEvmTransaction(walletInfo, maxTransaction, "babylon", bot, chatId);
        } else if (state.destination === "random") {
          const destinations = ["holesky", "babylon"].filter(dest => dest !== "babylon" || walletInfo.babylonAddress);
          if (destinations.length === 0) {
            bot.sendMessage(chatId, `Melewati wallet '${walletInfo.name}': Tidak ada tujuan valid (alamat Babylon tidak ada).`, {
              reply_markup: {
                inline_keyboard: [backToHomeButton],
              },
            });
            continue;
          }
          for (let i = 0; i < maxTransaction; i++) {
            const randomDest = destinations[Math.floor(Math.random() * destinations.length)];
            await sendEvmTransaction(walletInfo, 1, randomDest, bot, chatId);
          }
        }
      }
      bot.sendMessage(chatId, "Proses transaksi EVM selesai.", {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      delete userState[chatId];
    }
  });

  logger.info("Bot Telegram berhasil dimulai.");
}

// Fungsi utama
async function main() {
  try {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      mainTelegram();
    } else {
      mainConsole();
    }
  } catch (err) {
    logger.error(`Kesalahan utama: ${err.message}`);
    process.exit(1);
  }
}

main();
