/** The identifiers every fixture is built from.
 *
 * One session, one peer session, the instance the frames come from and one
 * other instance, so a fixture that names two of anything names these. */
export const FIXTURE_IDS = {
  sid: "6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607",
  other_sid: "0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b",
  instance: "3f9c1a7b5e2d48069c1a7b5e2d480691",
  other_instance: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
  endpoint: "https://mba.example.ts.net/ccmsg/personal/",
  other_endpoint: "https://nuc.example.ts.net/ccmsg/personal/",
  mid: "3f9c1a7b5e2d48069c1a7b5e2d480691/1841",
  request_id: "1",
} as const;

/** The instant the fixtures are written as happening at, with the few they
 * derive from it. A fixture states a time in milliseconds since the epoch, as
 * every `Timestamp` in the contract does. */
export const FIXTURE_NOW = 1_757_300_000_000;
