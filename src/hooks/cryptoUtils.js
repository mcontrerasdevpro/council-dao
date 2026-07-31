import { ethers } from "ethers";
import { CFG } from "../context/Web3Context"; 

export const SAFE_ABI = [
  "function nonce() view returns (uint256)",
  "function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 _nonce) view returns (bytes32)",
  "function approveHash(bytes32 hashToApprove)",
  "function approvedHashes(address,bytes32) view returns (uint256)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool)"
];

const RESOLVE_IFACE = new ethers.Interface([
  "function resolve(uint256 id,bool approve,(uint64 startTimestamp,uint64 duration,uint256 multichoice,uint256[] acceptedOptions,string description,address[] votingWhitelist,bytes[] votingWhitelistData) config)"
]);

const ZERO_DATE = BigInt("52983525044272");
const RULES_TYPE = "tuple(uint256 selector,uint256[] citizenshipWhitelist,uint256 identityCreationTimestampUpperBound,uint256 identityCounterUpperBound,uint256 sex,uint256 birthDateLowerbound,uint256 birthDateUpperbound,uint256 expirationDateLowerBound)";

const BIO_VOTING = "0xdFe18d90F1eCDeF351a09444EAd99A89ec6749e2";
const TS_UPPER = BigInt(4102444800);
const ID_LIMIT = (BigInt(1) << BigInt(32)) - BigInt(1);
export const wordAt = (raw, o) => BigInt("0x" + raw.substr(o * 2, 64));

export const addrAt = (raw, o) => "0x" + raw.substr(o * 2 + 24, 40);
  
export const utf8FromHex = (hex) => {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return new TextDecoder().decode(b);
};

export const decodeIdeas = (resultHex) => {
  const raw = resultHex.replace(/^0x/, "");
  if (raw.length < 128) return [];
  const arrOff = Number(wordAt(raw, 0));
  const len = Number(wordAt(raw, arrOff));
  const region = arrOff + 32;
  const out = [];
  for (let i = 0; i < len; i++) {
    const el = region + Number(wordAt(raw, region + i * 32));
    const cidRel = Number(wordAt(raw, el));
    const status = Number(wordAt(raw, el + 32));
    const submitter = addrAt(raw, el + 64);
    const proposalId = Number(wordAt(raw, el + 96));
    const deposit = wordAt(raw, el + 128);
    const cidAt = el + cidRel;
    const cidLen = Number(wordAt(raw, cidAt));
    const cid = utf8FromHex(raw.substr((cidAt + 32) * 2, cidLen * 2));
    out.push({ id: i, cid, status, submitter, proposalId, deposit });
  }
  return out;
};

export const formatEther = (wei) => {
  return ethers.formatEther(wei);
};

export const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");

export const buildProposalConfig = (cid, content) => {
  const variants = content?.acceptedOptions?.variants || [];
  const n = BigInt(variants.length || 1);
  const acceptedOptions = [(BigInt(1) << n) - BigInt(1)];
  const duration = BigInt(content?.voting?.durationDays || 90) * BigInt(86400);
  const rules = [BigInt(1), [], TS_UPPER, ID_LIMIT, BigInt(0), ZERO_DATE, ZERO_DATE, ZERO_DATE];
  const rulesData = ethers.AbiCoder.defaultAbiCoder().encode([RULES_TYPE], [rules]);
  return [BigInt(0), duration, BigInt(0), acceptedOptions, cid, [BIO_VOTING], [rulesData]];
};

export const resolveCalldata = (idea, content, approve) => {
  return RESOLVE_IFACE.encodeFunctionData("resolve", [idea.id, approve, buildProposalConfig(idea.cid, content)]);
};