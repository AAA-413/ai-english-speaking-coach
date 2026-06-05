import crypto from "node:crypto";

export const DEFAULT_VOLC_RTC_OPENAPI_HOST = "rtc.volcengineapi.com";
export const DEFAULT_VOLC_RTC_OPENAPI_REGION = "cn-north-1";
export const DEFAULT_VOLC_RTC_OPENAPI_VERSION = "2024-12-01";

const SERVICE_NAME = "rtc";
const HEADER_KEYS_TO_IGNORE = new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
]);

export function volcOpenApiHealth(env = process.env) {
  const config = resolveVolcOpenApiConfig(env);
  const missing = missingVolcOpenApiFields(env);
  return {
    service: SERVICE_NAME,
    region: config.region,
    host: config.host,
    version: config.version,
    hasAccessKeyId: Boolean(config.accessKeyId),
    hasSecretAccessKey: Boolean(config.secretAccessKey),
    ready: missing.length === 0,
    missing,
  };
}

export function missingVolcOpenApiFields(env = process.env) {
  const config = resolveVolcOpenApiConfig(env);
  const fields = [];
  if (!config.accessKeyId) fields.push("VOLCENGINE_ACCESS_KEY_ID");
  if (!config.secretAccessKey) fields.push("VOLCENGINE_SECRET_ACCESS_KEY");
  return fields;
}

export function resolveVolcOpenApiConfig(env = process.env) {
  return {
    accessKeyId: env.VOLCENGINE_ACCESS_KEY_ID
      || env.VOLC_ACCESS_KEY_ID
      || env.VOLC_ACCESSKEY_ID
      || "",
    secretAccessKey: env.VOLCENGINE_SECRET_ACCESS_KEY
      || env.VOLC_SECRET_ACCESS_KEY
      || env.VOLC_SECRETKEY
      || "",
    region: env.VOLC_RTC_OPENAPI_REGION || DEFAULT_VOLC_RTC_OPENAPI_REGION,
    host: env.VOLC_RTC_OPENAPI_HOST || DEFAULT_VOLC_RTC_OPENAPI_HOST,
    version: env.VOLC_RTC_OPENAPI_VERSION || DEFAULT_VOLC_RTC_OPENAPI_VERSION,
    protocol: env.VOLC_RTC_OPENAPI_PROTOCOL || "https",
  };
}

export async function callVolcRtcOpenApi({
  action,
  payload,
  env = process.env,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable for Volc OpenAPI");
  }

  const missing = missingVolcOpenApiFields(env);
  if (missing.length) {
    throw new Error(`Volc OpenAPI is missing ${missing.join(", ")}`);
  }

  const signed = signVolcOpenApiRequest({
    action,
    payload,
    config: resolveVolcOpenApiConfig(env),
  });

  const response = await fetchImpl(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body,
  });
  const text = await response.text();
  const data = parseJson(text);
  const apiError = data?.ResponseMetadata?.Error || data?.Error;

  if (!response.ok || apiError) {
    const message = apiError?.Message
      || data?.message
      || text
      || `Volc OpenAPI returned ${response.status}`;
    const code = apiError?.Code ? `${apiError.Code}: ` : "";
    throw new Error(`${action} failed: ${code}${message}`);
  }

  return {
    action,
    version: signed.version,
    requestId: data?.ResponseMetadata?.RequestId || null,
    data,
  };
}

export function signVolcOpenApiRequest({
  action,
  payload = {},
  config,
  method = "POST",
  pathName = "/",
  now = new Date(),
}) {
  if (!action) throw new Error("Volc OpenAPI action is required");
  if (!config?.accessKeyId || !config?.secretAccessKey) {
    throw new Error("Volc OpenAPI access key and secret key are required");
  }

  const body = method.toUpperCase() === "GET" ? "" : JSON.stringify(payload);
  const bodySha = hash(body);
  const xDate = formatVolcDate(now);
  const date = xDate.slice(0, 8);
  const version = config.version || DEFAULT_VOLC_RTC_OPENAPI_VERSION;
  const query = { Action: action, Version: version };
  const queryString = queryParamsToString(query);
  const host = config.host || DEFAULT_VOLC_RTC_OPENAPI_HOST;
  const headersToSign = {
    Host: host,
    "X-Date": xDate,
    "X-Content-Sha256": bodySha,
  };
  const [signedHeaders, canonicalHeaders] = getSignHeaders(headersToSign);
  const canonicalRequest = [
    method.toUpperCase(),
    pathName,
    queryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    bodySha,
  ].join("\n");
  const credentialScope = [date, config.region, SERVICE_NAME, "request"].join("/");
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    hash(canonicalRequest),
  ].join("\n");
  const signingKey = hmacBuffer(
    hmacBuffer(hmacBuffer(hmacBuffer(config.secretAccessKey, date), config.region), SERVICE_NAME),
    "request",
  );
  const signature = hmacHex(signingKey, stringToSign);
  const authorization = [
    "HMAC-SHA256",
    `Credential=${config.accessKeyId}/${credentialScope},`,
    `SignedHeaders=${signedHeaders},`,
    `Signature=${signature}`,
  ].join(" ");

  return {
    method: method.toUpperCase(),
    url: `${config.protocol || "https"}://${host}${pathName}?${queryString}`,
    version,
    body,
    headers: {
      "Content-Type": "application/json",
      ...headersToSign,
      Authorization: authorization,
    },
    signedHeaders,
    canonicalRequest,
    stringToSign,
  };
}

export function formatVolcDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function getSignHeaders(headers) {
  const keys = Object.keys(headers)
    .filter((key) => !HEADER_KEYS_TO_IGNORE.has(key.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const signedHeaders = keys.map((key) => key.toLowerCase()).join(";");
  const canonicalHeaders = keys
    .map((key) => `${key.toLowerCase()}:${trimHeaderValue(headers[key])}`)
    .join("\n");
  return [signedHeaders, canonicalHeaders];
}

function queryParamsToString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      if (value === undefined || value === null) return null;
      const escapedKey = uriEscape(key);
      if (Array.isArray(value)) {
        return value.map(uriEscape).sort().map((item) => `${escapedKey}=${item}`).join(`&`);
      }
      return `${escapedKey}=${uriEscape(value)}`;
    })
    .filter(Boolean)
    .join("&");
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function hmacBuffer(secret, value) {
  return crypto.createHmac("sha256", secret).update(value, "utf8").digest();
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function hash(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function trimHeaderValue(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function uriEscape(value) {
  return encodeURIComponent(String(value))
    .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
    .replace(/[*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
