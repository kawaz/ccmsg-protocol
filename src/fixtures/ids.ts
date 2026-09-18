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
  /** The person every auth fixture is about: sixteen random bytes spelled
   * base64url, which is at once their id in these records and the user handle
   * their authenticator holds. */
  user: "d2hvLWlzLXRoaXMtcGVyc29u",
  /** A second person, so that an instance with two owners can be written down.
   * Nothing but the id distinguishes them here. */
  other_user: "c29tZWJvZHktZWxzZS1oZXJl",
  /** Where the page a person opens is served from, which is nobody's endpoint:
   * a credential is made here and used at whichever instance the person owns.
   * Its registrable domain is not the endpoints' — so the two are cross-site
   * and a refresh cookie between them is a partitioned one. */
  origin: "https://ui.example.test",
  /** A second origin, sharing the endpoints' registrable domain: same-site, and
   * still an origin of its own. A credential made here is a separate
   * credential, and the cookie between it and an endpoint is not partitioned —
   * one contract, two shapes, which is why both are written down. */
  same_site_origin: "https://ui.example.ts.net",
  /** The address a person reaches the instances at when a load balancer is in
   * front of them: an endpoint like any other, and the one an enrolment URL
   * names as where to post. It is nobody's own address — which of the instances
   * behind it answers is not a thing the caller chooses — so it is never
   * compared with anything. */
  hosting_endpoint: "https://ccmsg2.example.ts.net/",
  mid: "3f9c1a7b5e2d48069c1a7b5e2d480691/1841",
  request_id: "1",
} as const;

/** The instant the fixtures are written as happening at, with the few they
 * derive from it. A fixture states a time in milliseconds since the epoch, as
 * every `Timestamp` in the contract does. */
export const FIXTURE_NOW = 1_757_300_000_000;
