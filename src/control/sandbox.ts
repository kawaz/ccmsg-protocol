import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";
import { FileKind } from "./files.ts";

/** Mints a URL on the sandbox origin for one file.
 *
 * A file served from the instance's own origin cannot be handed its real
 * content type without letting it act as part of the application, so a client
 * that wants to open a file as a page, or download it as itself, asks for a URL
 * on a separate origin instead.
 *
 * The grant widens nothing: the same check the matching read performs runs both
 * when the URL is minted and on every request it serves, so this can fail only
 * the way that read would and can never reach a file the caller could not
 * already read. */
export const SandboxGrantArgs = Type.Object({
  sid: Sid,
  kind: FileKind,
  path: Type.String({ minLength: 1 }),
});
export type SandboxGrantArgs = Static<typeof SandboxGrantArgs>;

export const SandboxGrantResult = Type.Object({
  /** Names the grant, and separates its origin from every other grant's. It
   * travels inside a hostname and is therefore seen by every resolver on the
   * way, so it is not a secret and authorizes nothing by itself. */
  gid: Type.String({ minLength: 1 }),
  /** The secret that does authorize a request. Returned so a client can build
   * a sibling URL — a download beside a preview — without minting again. */
  token: Type.String({ minLength: 1 }),
  /** Ready to open as it stands. */
  url: Type.String({ minLength: 1 }),
  /** When the grant stops working. Minting the same scope again returns this
   * same grant with a later expiry, so an open preview keeps working. */
  expires_at: Timestamp,
});
export type SandboxGrantResult = Static<typeof SandboxGrantResult>;

export const SandboxGrantRequest = request("sandbox.grant", SandboxGrantArgs);
export const SandboxGrantResponse = response("sandbox.grant", SandboxGrantResult);

/** Ends a grant early, as when a preview is closed.
 *
 * Best effort by design. The expiry is what actually bounds a grant's life, so
 * an unknown or already-expired grant still succeeds: there is nothing a caller
 * would do differently, and reporting "no such grant" would make this an
 * existence oracle. */
export const SandboxRevokeArgs = Type.Object({
  gid: Type.String({ minLength: 1 }),
});
export type SandboxRevokeArgs = Static<typeof SandboxRevokeArgs>;

export const SandboxRevokeResult = Type.Object({});
export type SandboxRevokeResult = Static<typeof SandboxRevokeResult>;

export const SandboxRevokeRequest = request("sandbox.revoke", SandboxRevokeArgs);
export const SandboxRevokeResponse = response("sandbox.revoke", SandboxRevokeResult);
