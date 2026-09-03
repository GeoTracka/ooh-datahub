import { customType } from "drizzle-orm/mysql-core";

export const binaryBuffer = customType<{
  data: Buffer;
  driverData: Buffer;
  config: { length: number };
  configRequired: true;
}>({
  dataType: ({ length }) => `binary(${length})`,
  toDriver: (value) => value,
  fromDriver: (value) => Buffer.from(value),
});
