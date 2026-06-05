import crypto from "node:crypto";

export const VOLC_RTC_TOKEN_VERSION = "001";
export const VOLC_RTC_APP_ID_LENGTH = 24;

const PRIV_PUBLISH_STREAM = 0;
const PRIV_PUBLISH_AUDIO_STREAM = 1;
const PRIV_PUBLISH_VIDEO_STREAM = 2;
const PRIV_PUBLISH_DATA_STREAM = 3;
const PRIV_SUBSCRIBE_STREAM = 4;

export function createVolcRtcClientToken({
  appId,
  appKey,
  roomId,
  userId,
  ttlSeconds = 24 * 60 * 60,
  nowSeconds = Math.floor(Date.now() / 1000),
  nonce = crypto.randomInt(0, 0xffffffff),
}) {
  validateVolcRtcTokenInput({ appId, appKey, roomId, userId, ttlSeconds });

  const expireAt = nowSeconds + ttlSeconds;
  const privileges = new Map([
    [PRIV_PUBLISH_STREAM, expireAt],
    [PRIV_PUBLISH_AUDIO_STREAM, expireAt],
    [PRIV_PUBLISH_VIDEO_STREAM, expireAt],
    [PRIV_PUBLISH_DATA_STREAM, expireAt],
    [PRIV_SUBSCRIBE_STREAM, expireAt],
  ]);

  const message = new ByteWriter()
    .putUint32(nonce)
    .putUint32(nowSeconds)
    .putUint32(expireAt)
    .putString(roomId)
    .putString(userId)
    .putUInt32Map(privileges)
    .pack();
  const signature = crypto.createHmac("sha256", appKey).update(message).digest();
  const content = new ByteWriter().putBytes(message).putBytes(signature).pack();

  return `${VOLC_RTC_TOKEN_VERSION}${appId}${content.toString("base64")}`;
}

export function canGenerateVolcRtcClientToken(env = process.env) {
  const invalid = validateVolcRtcClientTokenConfig(env);
  return invalid.length === 0;
}

export function validateVolcRtcClientTokenConfig(env = process.env) {
  const invalid = [];
  if (!env.VOLC_RTC_APP_ID) invalid.push("VOLC_RTC_APP_ID");
  if (!env.VOLC_RTC_APP_KEY) invalid.push("VOLC_RTC_APP_KEY");
  if (env.VOLC_RTC_APP_ID && env.VOLC_RTC_APP_ID.length !== VOLC_RTC_APP_ID_LENGTH) {
    invalid.push(`VOLC_RTC_APP_ID must be ${VOLC_RTC_APP_ID_LENGTH} characters`);
  }
  if (env.VOLC_RTC_TOKEN_TTL_SECONDS) {
    const ttlSeconds = Number(env.VOLC_RTC_TOKEN_TTL_SECONDS);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      invalid.push("VOLC_RTC_TOKEN_TTL_SECONDS must be a positive integer");
    }
  }
  return invalid;
}

function validateVolcRtcTokenInput({ appId, appKey, roomId, userId, ttlSeconds }) {
  if (!appId) throw new Error("VOLC_RTC_APP_ID is required to generate RTC token");
  if (!appKey) throw new Error("VOLC_RTC_APP_KEY is required to generate RTC token");
  if (!roomId) throw new Error("roomId is required to generate RTC token");
  if (!userId) throw new Error("userId is required to generate RTC token");
  if (appId.length !== VOLC_RTC_APP_ID_LENGTH) {
    throw new Error(`VOLC_RTC_APP_ID must be ${VOLC_RTC_APP_ID_LENGTH} characters for RTC token generation`);
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("VOLC_RTC_TOKEN_TTL_SECONDS must be a positive integer");
  }
}

class ByteWriter {
  constructor() {
    this.buffer = Buffer.alloc(2048);
    this.position = 0;
  }

  pack() {
    const out = Buffer.alloc(this.position);
    this.buffer.copy(out, 0, 0, out.length);
    return out;
  }

  putUint16(value) {
    this.ensure(2);
    this.buffer.writeUInt16LE(value, this.position);
    this.position += 2;
    return this;
  }

  putUint32(value) {
    this.ensure(4);
    this.buffer.writeUInt32LE(value, this.position);
    this.position += 4;
    return this;
  }

  putBytes(bytes) {
    this.putUint16(bytes.length);
    this.ensure(bytes.length);
    bytes.copy(this.buffer, this.position);
    this.position += bytes.length;
    return this;
  }

  putString(value) {
    return this.putBytes(Buffer.from(value));
  }

  putUInt32Map(map) {
    const entries = [...map.entries()].sort(([left], [right]) => left - right);
    this.putUint16(entries.length);
    for (const [key, value] of entries) {
      this.putUint16(key);
      this.putUint32(value);
    }
    return this;
  }

  ensure(size) {
    const required = this.position + size;
    if (required <= this.buffer.length) return;
    const next = Buffer.alloc(Math.max(required, this.buffer.length * 2));
    this.buffer.copy(next);
    this.buffer = next;
  }
}
