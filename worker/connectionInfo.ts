export interface ConnectionInfo {
  provider: string | null
  asn: number | null
  country: string | null
  region: string | null
  city: string | null
  cloudflareColo: string | null
  protocol: string | null
}

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const buildConnectionInfo = (
  cf: unknown,
): ConnectionInfo => ({
  provider: stringOrNull(readField(cf, 'asOrganization')),
  asn: numberOrNull(readField(cf, 'asn')),
  country: stringOrNull(readField(cf, 'country')),
  region: stringOrNull(readField(cf, 'region')),
  city: stringOrNull(readField(cf, 'city')),
  cloudflareColo: stringOrNull(readField(cf, 'colo')),
  protocol: stringOrNull(readField(cf, 'httpProtocol')),
})

const readField = (value: unknown, field: string): unknown =>
  typeof value === 'object' && value !== null
    ? Reflect.get(value, field)
    : undefined
