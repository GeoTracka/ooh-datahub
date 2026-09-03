export function uuidToBinary(uuid: string): Buffer {
  const hex = uuid.toLocaleLowerCase("en-US").replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`INVALID_UUID:${uuid}`);
  return Buffer.from(hex, "hex");
}

export function binaryToUuid(value: Uint8Array): string {
  const hex = Buffer.from(value).toString("hex");
  if (hex.length !== 32) throw new Error("INVALID_BINARY_UUID");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

