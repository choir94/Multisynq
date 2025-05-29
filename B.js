const { DirectSecp256k1HdWallet, Registry } = require("@cosmjs/proto-signing");
const { SigningStargateClient, GasPrice } = require("@cosmjs/stargate");
const { MsgExecuteContract } = require("cosmjs-types/cosmwasm/wasm/v1/tx");
const { toUtf8 } = require("@cosmjs/encoding");
const { Slip10RawIndex } = require("@cosmjs/crypto");
const { ethers, JsonRpcProvider, Wallet } = require("ethers");
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
const INSTRUCTION_USDC_0_01 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000340000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000002600000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e62626e317a7372763233616b6b6778646e77756c3732736674677632786a74356b68736e743377776a687030666668363833687a7035617135613068366e00000000000000000000000000000000000000000000000000000000000000000004555344430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e3132766b3361386c7a3637646530357a6c7176713530707670643270636a66777674777a74356676647437357a387533327932657168646632397600";

const INSTRUCTION_USDC_0_02 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000340000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004e20000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002e00000000000000000000000000000000000000000000000000000000000004e20000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e62626e317a7372763233616b6b6778646e77756c3732736674677632786a74356b68736e743377776a687030666668363833687a7035617135613068366e00000000000000000000000000000000000000000000000000000000000000000004555344430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e3132766b3361386c7a3637646530357a6c7176713530707670643270636a66777674777a74356676647437357a387533327932657168646632397600";

const INSTRUCTION_UBBN_0_001 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003e8000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000003e8000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e316a30687036717a7467617a6137743079386476633232656176767671796473346b7a653538646c716b756c79733872326b633873396d7030736d00";

const INSTRUCTION_UBBN_0_002 = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000007d0000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000007d0000000000000000000000000000000000000000000000000000000000000002a{sender}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b{receiver}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047562626e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f78696f6e316a30687036717a7467617a6137743079386476633232656176767671796473346b7a653538646c716b756c79733872326b633873396d7030736d00";

// Path file wallet
const WALLET_FILE = path.join(__dirname, "wallet.json");

// Fungsi Utilitas
function getRandomDelay() {
  return Math.floor(Math.random() * (120000 - 30000 + 1)) + 30000; // 30-120 seconds
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
    logger.info(`Selected Instruction: ubbn ${selected.includes("3e8") ? "0.001" : "0.002"}`);
  } else if (mode === "2") {
    selected = usdcInstructions[crypto.randomInt(0, usdcInstructions.length)];
    logger.info(`Selected Instruction: USDC ${selected.includes("2710") ? "0.01" : "0.02"}`);
  } else {
    const allInstructions = [...usdcInstructions, ...ubbnInstructions];
    selected = allInstructions[crypto.randomInt(0, allInstructions.length)];
    logger.info(`Selected Instruction: ${selected.includes("2710") ? "USDC 0.01" : selected.includes("4e20") ? "USDC 0.02" : selected.includes("3e8") ? "ubbn 0.001" : "ubbn 0.002"}`);
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
      throw new Error("No wallets found in wallet.json or invalid format");
    }
    for (const wallet of wallets) {
      if (!wallet.credential || !wallet.xionAddress) {
        throw new Error("Each wallet must have 'credential' and 'xionAddress' fields");
      }
      if (!wallet.xionAddress.startsWith(XION_TESTNET.prefix) || wallet.xionAddress.length !== 43) {
        throw new Error(`Invalid Xion address: ${wallet.xionAddress}. Must start with '${XION_TESTNET.prefix}' and be 43 characters long`);
      }
      const isMnemonic = wallet.credential.split(" ").length === 12 || wallet.credential.split(" ").length === 24;
      if (!isMnemonic) {
        throw new Error(`Invalid credential: ${wallet.credential}. Must be a 12/24 word mnemonic`);
      }
    }
    return wallets;
  } catch (error) {
    throw new Error(`Failed to read wallet.json: ${error.message}`);
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
    logger.error(`Failed to check balance for ${address}: ${error.message}`);
    return 0;
  }
}

function generateCosmosInstruction(senderAddress, xionAddress, mode) {
  const senderHex = encodeBech32ToHex(senderAddress);
  const receiverHex = encodeBech32ToHex(xionAddress);
  logger.info(`Sender Hex: ${senderHex}`);
  logger.info(`Receiver Hex: ${receiverHex}`);
  if (!isValidHex(senderHex) || !isValidHex(receiverHex)) {
    throw new Error(`Invalid hex format for sender (${senderHex}) or receiver (${receiverHex})`);
  }
  let instructionHex = getRandomInstruction(mode);
  if (!instructionHex || instructionHex.length < 10) {
    throw new Error("Invalid or empty instruction template");
  }
  instructionHex = instructionHex.replace("{sender}", senderHex).replace("{receiver}", receiverHex);
  logger.info(`Generated Instruction Hex: ${instructionHex}`);
  logger.info(`Instruction Hex Length: ${instructionHex.length}`);
  if (!instructionHex.startsWith("0x") || !isValidHex(instructionHex.slice(2))) {
    throw new Error(`Invalid instruction hex format: ${instructionHex}`);
  }
  const expectedLength = instructionHex.includes("455534443") ? 2370 : 2306;
  if (instructionHex.length !== expectedLength) {
    throw new Error(`Instruction length mismatch: expected ${expectedLength}, got ${instructionHex.length}`);
  }
  return instructionHex;
}

async function estimateCosmosGas(client, senderAddress, msg) {
  try {
    const gasEstimation = await client.simulate(senderAddress, [msg], "");
    const gasWithBuffer = Math.ceil(gasEstimation * 1.5);
    return { gasEstimation, gasWithBuffer };
  } catch (error) {
    throw new Error(`Gas estimation failed: ${error.message}`);
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
  logger.info(`Gas Estimation: ${gasEstimation}, Gas with Buffer: ${gasWithBuffer}`);
  logger.info(`Amount: ${isUbbn ? (instructionHex.includes("3e8") ? "0.001 ubbn" : "0.002 ubbn") : (instructionHex.includes("2710") ? "0.01 USDC" : "0.02 USDC")}`);
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
    logger.loading(`Connecting to RPC: ${BABYLON_TESTNET.rpcEndpoint}`);
    const walletData = await readCosmosWallets();
    const wallets = await createCosmosWalletList(walletData);
    if (wallets.length === 0) {
      throw new Error("No valid wallets found");
    }
    const numTxs = txPerWallet * wallets.length;
    logger.info(`Total transactions to simulate: ${numTxs} (${txPerWallet} per wallet across ${wallets.length} wallets)`);
    if (telegramBot && chatId) {
      telegramBot.sendMessage(chatId, `Starting ${numTxs} Cosmos transactions (${txPerWallet} per wallet across ${wallets.length} wallets)`);
    }
    const walletInfo = [];
    for (const wallet of wallets) {
      logger.info(`Sender Address (Babylon): ${wallet.babylonAddress}`);
      logger.info(`Receiver Address (Xion): ${wallet.xionAddress}`);
      const client = await SigningStargateClient.connectWithSigner(BABYLON_TESTNET.rpcEndpoint, wallet.babylonWallet, {
        registry,
        gasPrice: BABYLON_TESTNET.gasPrice,
      }).catch((error) => {
        throw new Error(`Failed to connect to RPC for ${wallet.babylonAddress}: ${error.message}`);
      });
      const balance = await checkCosmosBalance(client, wallet.babylonAddress, BABYLON_TESTNET.denom);
      logger.info(`Sender Balance: ${balance} ${BABYLON_TESTNET.denom}`);
      if (balance < 5479) {
        throw new Error(`Insufficient balance for ${wallet.babylonAddress}: ${balance} ${BABYLON_TESTNET.denom}, need at least 5479`);
      }
      const accountInfo = await client.getAccount(wallet.babylonAddress);
      let sequence = accountInfo?.sequence;
      if (!sequence) {
        throw new Error(`Account not found on chain for ${wallet.babylonAddress}. Ensure it has funds or use a faucet.`);
      }
      walletInfo.push({ ...wallet, sequence, client });
    }
    logger.success(`Successfully connected to RPC for all wallets`);
    let txCount = 0;
    for (const wallet of walletInfo) {
      const bot = wallet.telegramBotToken && wallet.telegramChatId ? new TelegramBot(wallet.telegramBotToken) : telegramBot;
      const notifyChatId = wallet.telegramChatId || chatId;
      for (let j = 0; j < txPerWallet && txCount < numTxs; j++) {
        txCount++;
        logger.step(`Preparing transaction ${txCount} for wallet ${wallet.babylonAddress}`);
        if (bot && notifyChatId) {
          bot.sendMessage(notifyChatId, `Preparing transaction ${txCount} for wallet ${wallet.babylonAddress}`);
        }
        const instructionHex = generateCosmosInstruction(wallet.babylonAddress, wallet.xionAddress, mode);
        const { msg, fee } = await createCosmosTransaction(wallet.client, wallet.babylonAddress, instructionHex, wallet.sequence).catch((error) => {
          throw new Error(`Transaction preparation failed for ${wallet.babylonAddress}: ${error.message}`);
        });
        const result = await wallet.client.signAndBroadcast(wallet.babylonAddress, [msg], fee, "").catch((error) => {
          throw new Error(`Failed to broadcast transaction for ${wallet.babylonAddress}: ${error.message}`);
        });
        const successMsg = `${timelog()} | Transaction ${txCount} sent! Tx Hash: ${result.transactionHash}`;
        logger.success(successMsg);
        if (bot && notifyChatId) {
          bot.sendMessage(notifyChatId, successMsg);
        }
        wallet.sequence++;
        if (txCount < numTxs) {
          const delay = getRandomDelay();
          logger.info(`Waiting ${delay / 1000} seconds before next transaction...`);
          if (bot && notifyChatId) {
            bot.sendMessage(notifyChatId, `Waiting ${delay / 1000} seconds before next transaction...`);
          }
          await sleep(delay);
        }
      }
    }
    logger.success(`All transactions completed!`);
    if (telegramBot && chatId) {
      telegramBot.sendMessage(chatId, `All Cosmos transactions completed!`);
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    if (telegramBot && chatId) {
      telegramBot.sendMessage(chatId, `Cosmos Error: ${error.message}`);
    }
  }
}

// Fungsi Spesifik EVM
async function checkEvmBalanceAndApprove(wallet, usdcAddress, spenderAddress) {
  const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, wallet);
  const balance = await usdcContract.balanceOf(wallet.address);
  if (balance === 0n) {
    logger.error(`${wallet.address} does not have enough USDC. Fund the wallet first!`);
    return false;
  }
  const allowance = await usdcContract.allowance(wallet.address, spenderAddress);
  if (allowance === 0n) {
    logger.loading(`USDC not approved. Sending approval transaction...`);
    const approveAmount = ethers.MaxUint256;
    try {
      const tx = await usdcContract.approve(spenderAddress, approveAmount);
      const receipt = await tx.wait();
      logger.success(`Approval confirmed: ${BASE_EXPLORER_URL}/tx/${receipt.hash}`);
      await sleep(3000);
    } catch (err) {
      logger.error(`Approval failed: ${err.message}`);
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
      logger.error(`Packet error: ${e.message}`);
    }
    await sleep(intervalMs);
  }
  logger.warn(`No packet hash found after ${retries} attempts.`);
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
      const msg = `Skipping wallet '${walletInfo.name || "No Name"}': No Babylon address provided.`;
      logger.warn(msg);
      if (telegramBot && chatId) telegramBot.sendMessage(chatId, msg);
      return;
    }
  } else if (destination === "holesky") {
    recipientAddress = wallet.address;
    destinationName = "Holesky";
    channelId = 8;
  } else {
    const msg = `Invalid destination: ${destination}`;
    logger.error(msg);
    if (telegramBot && chatId) telegramBot.sendMessage(chatId, msg);
    return;
  }
  const msg = `Sending ${maxTransaction} Transactions from Sepolia to ${destinationName} from ${wallet.address} (${walletInfo.name || "No Name"})`;
  logger.loading(msg);
  if (telegramBot && chatId) telegramBot.sendMessage(chatId, msg);
  const shouldProceed = await checkEvmBalanceAndApprove(wallet, USDC_ADDRESS, EVM_CONTRACT_ADDRESS);
  if (!shouldProceed) {
    if (telegramBot && chatId) telegramBot.sendMessage(chatId, `Failed to proceed with ${walletInfo.name || "No Name"}: Insufficient USDC or approval failed.`);
    return;
  }
  const contract = new ethers.Contract(EVM_CONTRACT_ADDRESS, UCS03_ABI, wallet);
  const senderHex = wallet.address.slice(2).toLowerCase(); // Alamat EVM tanpa 0x (40 chars)
  const recipientHex = destination === "babylon" ? encodeBech32ToHex(recipientAddress) : senderHex;

  // Validasi panjang hex
  if (senderHex.length !== 40) {
    logger.error(`Invalid senderHex length: ${senderHex.length}, expected 40`);
    return;
  }
  if (destination === "babylon" && recipientHex.length < 40) {
    logger.error(`Invalid recipientHex length for Babylon: ${recipientHex.length}, expected >= 40`);
    return;
  }

  logger.info(`Sender Hex: ${senderHex}`);
  logger.info(`Recipient Hex: ${recipientHex}`);

  // Template operand berdasarkan destination
  if (destination === "babylon") {
    operand = `0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002600000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000014${senderHex}000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a${recipientHex}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000141c7d4b196cb0c7b01d743fbc6116a902379c72380000000000000000000000000000000000000000000000000000000000000000000000000000000000000004555344430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e${recipientHex}0000`;
  } else {
    operand = `0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000002c00000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000014${senderHex}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000014${senderHex}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000141c7d4b196cb0c7b01d743fbc6116a902379c72380000000000000000000000000000000000000000000000000000000000000000000000000000000000000004555344430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001457978bfe465ad9b1c0bf80f6c1539d300705ea50000000000000000000000000`;
  }

  // Validasi operand
  if (!operand.startsWith("0x") || !isValidHex(operand.slice(2))) {
    logger.error(`Invalid operand format: ${operand}`);
    return;
  }

  for (let i = 1; i <= maxTransaction; i++) {
    logger.step(`${walletInfo.name || "No Name"} | Transaction ${i}/${maxTransaction}`);
    if (telegramBot && chatId) telegramBot.sendMessage(chatId, `${walletInfo.name || "No Name"} | Transaction ${i}/${maxTransaction}`);
    const now = BigInt(Date.now()) * 1_000_000n;
    const oneDayNs = 86_400_000_000_000n;
    const timeoutTimestamp = (now + oneDayNs).toString();
    const timestampNow = Math.floor(Date.now() / 1000);
    const salt = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [wallet.address, timestampNow]));
    const instruction = { version: 0, opcode: "0x02", operand };

    try {
      // Estimasi gas untuk debugging
      const gasEstimate = await contract.send.estimateGas(channelId, 0, timeoutTimestamp, salt, instruction);
      logger.info(`Estimated Gas: ${gasEstimate.toString()}`);

      const tx = await contract.send(channelId, 0, timeoutTimestamp, salt, instruction, { gasLimit: gasEstimate * 120n / 100n });
      const receipt = await tx.wait(1);
      const successMsg = `${timelog()} | ${walletInfo.name || "No Name"} | Transaction Confirmed: ${BASE_EXPLORER_URL}/tx/${receipt.hash}`;
      logger.success(successMsg);
      if (telegramBot && chatId) telegramBot.sendMessage(chatId, successMsg);
      const txHash = receipt.hash.startsWith("0x") ? receipt.hash : `0x${receipt.hash}`;
      const packetHash = await pollPacketHash(txHash);
      if (packetHash) {
        const packetMsg = `${timelog()} | ${walletInfo.name || "No Name"} | Packet Sent: ${UNION_URL}/${packetHash}`;
        logger.info(packetMsg);
        if (telegramBot && chatId) telegramBot.sendMessage(chatId, packetMsg);
      }
    } catch (err) {
      const errMsg = `Failed for ${wallet.address}: ${err.message}`;
      logger.error(errMsg);
      if (telegramBot && chatId) telegramBot.sendMessage(chatId, errMsg);
      logger.error(`Error Details: ${JSON.stringify(err, null, 2)}`);
    }
    if (i < maxTransaction) {
      const delay = getRandomDelay();
      logger.info(`Waiting ${delay / 1000} seconds before next transaction...`);
      if (telegramBot && chatId) telegramBot.sendMessage(chatId, `Waiting ${delay / 1000} seconds before next transaction...`);
      await sleep(delay);
    }
  }
}

// Fungsi untuk memuat wallet EVM dari .env
function loadEvmWallets() {
  const wallets = [];
  let index = 1;
  while (true) {
    const privateKey = process.env[`PRIVATE_KEY_${index}`];
    const babylonAddress = process.env[`BABYLON_ADDRESS_${index}`];
    if (!privateKey) break;
    if (!privateKey.startsWith("0x") || !/^(0x)[0-9a-fA-F]{64}$/.test(privateKey)) {
      logger.warn(`Private key ${index} invalid: must be a 64-character hexadecimal string starting with 0x`);
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
    console.log("1. Cosmos (Babylon to Xion)");
    console.log("2. EVM (Sepolia to Holesky/Babylon)");
    console.log("3. Exit");
    const choice = prompt("Select an option (1-3): ").trim();
    if (choice === "3") {
      logger.info("Exiting program.");
      process.exit(0);
    }
    if (!["1", "2"].includes(choice)) {
      logger.error("Invalid option. Please select 1, 2, or 3.");
      continue;
    }
    const maxTransactionInput = prompt("Enter the number of transactions per wallet: ").trim();
    const maxTransaction = parseInt(maxTransactionInput);
    if (isNaN(maxTransaction) || maxTransaction <= 0) {
      logger.error("Please enter a valid positive number.");
      continue;
    }
    if (choice === "1") {
      console.log("\nSelect submode for Cosmos:");
      console.log("1. Babylon to Xion (ubbn)");
      console.log("2. USDC Babylon to USDC Xion");
      console.log("3. Random (ubbn or USDC)");
      const subMode = prompt("Select submode (1-3): ").trim();
      if (!["1", "2", "3"].includes(subMode)) {
        logger.error("Invalid submode. Please select 1, 2, or 3.");
        continue;
      }
      await cosmosMain(subMode, maxTransaction);
    } else if (choice === "2") {
      console.log("\nSelect submode for EVM:");
      console.log("1. Sepolia to Holesky");
      console.log("2. Sepolia to Babylon");
      console.log("3. Random (Holesky and Babylon)");
      const subMode = prompt("Select submode (1-3): ").trim();
      if (!["1", "2", "3"].includes(subMode)) {
        logger.error("Invalid submode. Please select 1, 2, or 3.");
        continue;
      }
      const wallets = loadEvmWallets();
      if (wallets.length === 0) {
        logger.error("No wallets found in .env. Please add PRIVATE_KEY_...");
        continue;
      }
      for (const walletInfo of wallets) {
        if (subMode === "1") {
          await sendEvmTransaction(walletInfo, maxTransaction, "holesky");
        } else if (subMode === "2") {
          await sendEvmTransaction(walletInfo, maxTransaction, "babylon");
        } else if (subMode === "3") {
          const destinations = ["holesky", "babylon"].filter((dest) => dest !== "babylon" || walletInfo.babylonAddress);
          if (destinations.length === 0) {
            logger.warn(`Skipping wallet '${walletInfo.name}': No valid destinations (Babylon address missing).`);
            continue;
          }
          for (let i = 0; i < maxTransaction; i++) {
            const randomDest = destinations[Math.floor(Math.random() * destinations.length)];
            await sendEvmTransaction(walletInfo, 1, randomDest);
          }
        }
      }
      if (wallets.length === 0) {
        logger.warn("No wallets processed. Check .env for valid entries.");
      }
    }
  }
}

// Fungsi utama untuk mode Telegram
function mainTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !allowedChatId) {
    logger.warn("Telegram bot not configured: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in .env. Starting in console mode.");
    return mainConsole();
  }

  const bot = new TelegramBot(token, { polling: true });
  const userState = {};

  // Tombol menu utama
  const mainMenu = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Cosmos (Babylon to Xion)", callback_data: "mode_cosmos" }],
        [{ text: "EVM (Sepolia to Holesky/Babylon)", callback_data: "mode_evm" }],
        [{ text: "Add Wallet (Cosmos)", callback_data: "add_wallet_cosmos" }],
        [{ text: "List Wallets (Cosmos)", callback_data: "list_wallets_cosmos" }],
        [{ text: "Help", callback_data: "help" }],
        [{ text: "Join Telegram (airdropnode)", url: TELEGRAM_LINK }],
      ],
    },
  };

  // Tombol kembali ke beranda
  const backToHomeButton = [{ text: "Back to Home", callback_data: "home" }];

  function showMainMenu(chatId, message = `Welcome to Union Testnet Auto Bot! (by airdropnode - ${TELEGRAM_LINK})\nSelect an option:`) {
    delete userState[chatId];
    bot.sendMessage(chatId, message, mainMenu);
  }

  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== allowedChatId) {
      bot.sendMessage(chatId, "Access denied.");
      return;
    }
    showMainMenu(chatId);
  });

  // Handle button callbacks
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id.toString();
    if (chatId !== allowedChatId) {
      bot.sendMessage(chatId, "Access denied.");
      bot.answerCallbackQuery(query.id);
      return;
    }
    const data = query.data;
    bot.answerCallbackQuery(query.id);

    if (data === "home") {
      showMainMenu(chatId, "Back to main menu.");
      return;
    }

    if (data === "help") {
      bot.sendMessage(
        chatId,
        "Available actions:\n- Cosmos Mode: Run Babylon to Xion transactions\n- EVM Mode: Sepolia to Holesky/Babylon transactions\n- Add Wallet: Add new Cosmos wallet\n- List Wallets: View Cosmos wallets\n- Help: Show this message",
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
        "Enter wallet details in the format:\nmnemonic: <12-24 word mnemonic>\nxion_alamat: <xion address>\ntoken_bot: <Telegram bot token>\nchat_id: <Telegram chat ID>",
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
        bot.sendMessage(chatId, "No Cosmos wallets found.", {
          reply_markup: {
            inline_keyboard: [backToHomeButton],
          },
        });
        return;
      }
      const walletList = wallets
        .map(
          (w) =>
            `Mnemonic: ${w.credential.substring(0, 20)}...\nXion: ${w.xionAddress}\nToken Bot: ${w.telegramBotToken || "None"}\nChat ID: ${w.telegramChatId || "None"}`
        )
        .join("\n\n");
      bot.sendMessage(chatId, `List of Cosmos Wallets:\n\n${walletList}`, {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      return;
    }

    if (data === "mode_cosmos") {
      userState[chatId] = { step: "select_cosmos_mode" };
      bot.sendMessage(chatId, "Select Cosmos mode:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Babylon to Xion (ubbn)", callback_data: "cosmos_mode_1" }],
            [{ text: "USDC Babylon to USDC Xion", callback_data: "cosmos_mode_2" }],
            [{ text: "Random (ubbn or USDC)", callback_data: "cosmos_mode_random" }],
            backToHomeButton,
          ],
        },
      });
      return;
    }

    if (data === "mode_evm") {
      userState[chatId] = { step: "select_evm_mode" };
      bot.sendMessage(chatId, "Select EVM mode:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Sepolia to Holesky", callback_data: "evm_mode_holesky" }],
            [{ text: "Sepolia to Babylon", callback_data: "evm_mode_babylon" }],
            [{ text: "Random (Holesky and Babylon)", callback_data: "evm_mode_random" }],
            backToHomeButton,
          ],
        },
      });
      return;
    }

    if (data.startsWith("cosmos_mode_")) {
      const mode = data.split("_")[2] === "random" ? "3" : data.split("_")[2];
      userState[chatId] = { step: "cosmos_transactions", mode };
      bot.sendMessage(chatId, "Enter the number of transactions per wallet for Cosmos:", {
        reply_markup: {
          inline_keyboard: [backToHomeButton],
        },
      });
      return;
    }

    if (data.startsWith("evm_mode_")) {
      const destination = data.split("_")[2];
      userState[chatId] = { step: "evm_transactions", destination };
      bot.sendMessage(chatId, "Enter the number of transactions per wallet for EVM:", {
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

    // Check if chat ID is allowed
    if (chatId !== allowedChatId) {
      await bot.sendMessage(chatId, "Access denied.");
      return;
    }

    // Ignore commands
    if (msg.text && msg.text.startsWith("/")) {
      return;
    }

    // Check user state
    if (!userState[chatId]) {
      await showMainMenu(chatId, "Please use the buttons to interact.");
      return;
    }

    const state = userState[chatId];

    // Handle Cosmos wallet input
    if (state.step === "add_wallet_cosmos_input") {
      try {
        const lines = msg.text.split("\n").map((line) => line.trim());
        const wallet = {};
        lines.forEach((line) => {
          const [key, value] = line.split(":").map((s) => s.trim());
          if (key && value) wallet[key] = value;
        });

        if (!wallet.mnemonic || !wallet.xion_alamat) {
          await bot.sendMessage(chatId, "Invalid format. Please provide mnemonic and xion_alamat.", {
            reply_markup: { inline_keyboard: [backToHomeButton] },
          });
          return;
        }

        const isMnemonicValid = wallet.mnemonic.split(" ").length === 12 || wallet.mnemonic.split(" ").length === 24;
        if (!isMnemonicValid) {
          await bot.sendMessage(chatId, "Invalid mnemonic. Must be 12 or 24 words.", {
            reply_markup: { inline_keyboard: [backToHomeButton] },
          });
          return;
        }

        if (!wallet.xion_alamat.startsWith(XION_TESTNET.prefix) || wallet.xion_alamat.length !== 43) {
          await bot.sendMessage(
            chatId,
            `Invalid Xion address: ${wallet.xion_alamat}. Must start with ${XION_TESTNET.prefix} and be 43 characters long.`,
            { reply_markup: { inline_keyboard: [backToHomeButton] } }
          );
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
        await bot.sendMessage(chatId, "Cosmos wallet added successfully!", {
          reply_markup: { inline_keyboard: [backToHomeButton] },
        });
        delete userState[chatId];
      } catch (err) {
        await bot.sendMessage(chatId, `Failed to add wallet: ${err.message}`, {
          reply_markup: { inline_keyboard: [backToHomeButton] },
        });
      }
      return;
    }

    // Handle Cosmos transactions
    if (state.step === "cosmos_transactions") {
      const maxTransaction = parseInt(msg.text.trim());
      if (isNaN(maxTransaction) || maxTransaction <= 0) {
        await bot.sendMessage(chatId, "Please enter a valid positive number.", {
          reply_markup: { inline_keyboard: [backToHomeButton] },
        });
        return;
      }

      const wallets = await readCosmosWallets().catch(() => []);
      if (wallets.length === 0) {
        await bot.sendMessage(chatId, "No Cosmos wallets found. Please add a wallet first.", {
          reply_markup: { inline_keyboard: [backToHomeButton] },
        });
        delete userState[chatId];
        return;
      }

      await bot.sendMessage(chatId, `Starting ${maxTransaction} Cosmos transactions (mode ${state.mode})...`, {
        reply_markup: { inline_keyboard: [backToHomeButton] },
      });
      await cosmosMain(state.mode, maxTransaction, bot, chatId);
      await bot.sendMessage(chatId, "Cosmos transaction process completed.", {
        reply_markup: { inline_keyboard: [backToHomeButton] },
      });
      delete userState[chatId];
      return;
    }

    // Handle EVM transactions
    if (state.step === "evm_transactions") {
      const maxTransaction = parseInt(msg.text.trim());
      if (isNaN(maxTransaction) || maxTransaction <= 0) {
        await bot.sendMessage(chatId, "Please enter a valid positive number.", {
          reply_markup: { inline_keyboard: [backToHomeButton] },
        });
        return;
      }

      const wallets = loadEvmWallets();
      if (wallets.length === 0) {
        await bot.sendMessage(chatId, "No EVM wallets found in .env. Please add PRIVATE_KEY_...", {
          reply_markup: { inline_keyboard: [backToHomeButton] },
        });
        delete userState[chatId];
        return;
      }

      await bot.sendMessage(chatId, `Starting ${maxTransaction} EVM transactions to ${state.destination}...`, {
        reply_markup: { inline_keyboard: [backToHomeButton] },
      });

      for (const walletInfo of wallets) {
        if (state.destination === "holesky") {
          await sendEvmTransaction(walletInfo, maxTransaction, "holesky", bot, chatId);
        } else if (state.destination === "babylon") {
          await sendEvmTransaction(walletInfo, maxTransaction, "babylon", bot, chatId);
        } else if (state.destination === "random") {
          const destinations = ["holesky", "babylon"].filter((dest) => dest !== "babylon" || walletInfo.babylonAddress);
          if (destinations.length === 0) {
            await bot.sendMessage(chatId, `Skipping wallet '${walletInfo.name}': No valid destinations (Babylon address missing).`, {
              reply_markup: { inline_keyboard: [backToHomeButton] },
            });
            continue;
          }
          for (let i = 0; i < maxTransaction; i++) {
            const randomDest = destinations[Math.floor(Math.random() * destinations.length)];
            await sendEvmTransaction(walletInfo, 1, randomDest, bot, chatId);
          }
        }
      }

      await bot.sendMessage(chatId, "EVM transaction process completed.", {
        reply_markup: { inline_keyboard: [backToHomeButton] },
      });
      delete userState[chatId];
      return;
    }
  });

  // Log bot startup
  logger.info("Telegram bot started successfully.");
}

// Main function
async function main() {
  try {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await mainTelegram();
    } else {
      await mainConsole();
    }
  } catch (err) {
    logger.error(`Main error: ${err.message}`);
    process.exit(1);
  }
}

// Run main function
main();
