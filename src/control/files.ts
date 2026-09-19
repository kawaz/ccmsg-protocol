import { type Static, Type } from "@sinclair/typebox";
import { MAX_FRAME_BYTES, request, response } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";

/** The most bytes of a file one reply carries, and so the default and the
 * ceiling of `file.read`'s `length`.
 *
 * Derived from `MAX_FRAME_BYTES` rather than chosen: base64 grows by 4/3, so
 * half a frame's worth of bytes leaves the encoded body at about two thirds of
 * the frame and the envelope and the path with the rest. The contract states
 * the derived value because a caller has to know what it may ask for before it
 * asks. */
export const MAX_FILE_READ_BYTES = MAX_FRAME_BYTES / 2;

/** Bytes as they travel: base64, whatever the file holds.
 *
 * One spelling for text and for anything else, so a caller decodes the same
 * way every time instead of branching on what the instance sniffed the content
 * to be. Reading and writing share the container, so anything that can be read
 * can be written back. */
export const Base64Bytes = Type.String();
export type Base64Bytes = Static<typeof Base64Bytes>;

/** Which authorization surface a path is reached through, and with it the
 * shape the path takes.
 *
 * - `contained` — inside the session's own root. The path is relative to it.
 * - `workspace` — inside one of the workspace folders the session's editor
 *   configuration names. The path is absolute, and access is by directory
 *   prefix.
 * - `external` — one file outside both, named by the session's transcript. The
 *   path is absolute and the grant is that exact file: there is no directory to
 *   descend, which is why listing and searching offer no `external`.
 *
 * The kind is an argument rather than three ops because the reply is the same
 * document in all three cases and only the check in front of it differs. */
export const FileKind = Type.Union(
  [Type.Literal("contained"), Type.Literal("workspace"), Type.Literal("external")],
  { $id: "FileKind" },
);
export type FileKind = Static<typeof FileKind>;

/** The kinds that name a directory to work within. */
export const DirKind = Type.Union([Type.Literal("contained"), Type.Literal("workspace")], {
  $id: "DirKind",
});
export type DirKind = Static<typeof DirKind>;

/** Lists one directory.
 *
 * What a session may see differs from what a person may see — the role decides
 * the visible range, not whether the call is allowed. */
export const DirListArgs = Type.Object({
  /** The session whose roots are browsed. */
  sid: Sid,
  kind: DirKind,
  /** Relative to the session root for `contained`, where an empty string is the
   * root itself; absolute for `workspace`. */
  path: Type.Optional(Type.String()),
});
export type DirListArgs = Static<typeof DirListArgs>;

/** One directory entry. Sockets, devices and the like collapse to `other`; a
 * symlink is reported as itself, and one pointing out of the root is listed but
 * refuses to resolve. */
export const DirEntry = Type.Object(
  {
    name: Type.String(),
    type: Type.Union([
      Type.Literal("file"),
      Type.Literal("dir"),
      Type.Literal("symlink"),
      Type.Literal("other"),
    ]),
    /** Bytes. Files only. */
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    /** Absent when the host would not state one. */
    mtime_at: Type.Optional(Timestamp),
  },
  { $id: "DirEntry" },
);
export type DirEntry = Static<typeof DirEntry>;

export const DirListResult = Type.Object({
  sid: Sid,
  /** The path as the instance normalized it, in the shape the kind implies. */
  path: Type.String(),
  entries: Type.Array(DirEntry),
});
export type DirListResult = Static<typeof DirListResult>;

export const DirListRequest = request("dir.list", DirListArgs);
export const DirListResponse = response("dir.list", DirListResult);

/** Reads one range of one file's bytes.
 *
 * A range rather than the whole file because a frame is bounded
 * (`MAX_FRAME_BYTES`), so a large file could never travel in one reply at all.
 * A range that runs past the end returns the part that overlaps, and one
 * entirely past it returns nothing — a caller reading to the end lands there on
 * its last step, and the end of a correct read is not an error. */
export const FileReadArgs = Type.Object({
  sid: Sid,
  kind: FileKind,
  path: Type.String({ minLength: 1 }),
  /** Bytes from the start of the file. Absent reads from the start. */
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  /** How many bytes to read. Absent asks for as many as a reply can carry, so
   * reading a small file whole needs nothing but its path. */
  length: Type.Optional(
    Type.Integer({ minimum: 0, maximum: MAX_FILE_READ_BYTES, default: MAX_FILE_READ_BYTES }),
  ),
});
export type FileReadArgs = Static<typeof FileReadArgs>;

export const FileReadResult = Type.Object({
  sid: Sid,
  path: Type.String(),
  /** The whole file, not this range. With `offset` and `length` it says whether
   * anything follows, which is why no separate "there is more" flag exists: two
   * ways to say one thing leaves one of them free to lie. */
  size: Type.Integer({ minimum: 0 }),
  /** Where this range starts, as the instance read it. */
  offset: Type.Integer({ minimum: 0 }),
  /** How many bytes `content` decodes to, which is at most what was asked for
   * and less where the range met the end. */
  length: Type.Integer({ minimum: 0 }),
  /** The head of the file sniffed as binary: do not read these bytes as text.
   * The bytes travel either way. */
  binary: Type.Boolean(),
  content: Base64Bytes,
  /** Also the token an edit passes back: an edit whose file has moved on since
   * this read is refused instead of overwriting the newer copy. */
  mtime_at: Timestamp,
});
export type FileReadResult = Static<typeof FileReadResult>;

export const FileReadRequest = request("file.read", FileReadArgs);
export const FileReadResponse = response("file.read", FileReadResult);

/** Writes a new file into the session's inbox directory.
 *
 * The one place a client may put a file without the user having opened it
 * first, which is why it takes no `kind`: the destination is fixed and only the
 * name within it is the caller's. `file.create` is the general form. */
export const FileWriteArgs = Type.Object({
  sid: Sid,
  /** Relative to the session's working directory. */
  path: Type.String({ minLength: 1 }),
  content: Base64Bytes,
});
export type FileWriteArgs = Static<typeof FileWriteArgs>;

export const FileWriteResult = Type.Object({
  sid: Sid,
  path: Type.String(),
});
export type FileWriteResult = Static<typeof FileWriteResult>;

export const FileWriteRequest = request("file.write", FileWriteArgs);
export const FileWriteResponse = response("file.write", FileWriteResult);

/** Creates a file that does not exist yet.
 *
 * The symmetric partner of `file.edit`: create versus overwrite. It never
 * replaces an existing path, and it does not make parent directories. There is
 * no `external` kind — that allowlist names single files, so it holds no
 * directory to create in. */
export const FileCreateArgs = Type.Object({
  sid: Sid,
  kind: DirKind,
  path: Type.String({ minLength: 1 }),
  /** Usually empty: a client creates the file and lets the user fill it in. */
  content: Base64Bytes,
});
export type FileCreateArgs = Static<typeof FileCreateArgs>;

export const FileCreateResult = Type.Object({
  sid: Sid,
  path: Type.String(),
});
export type FileCreateResult = Static<typeof FileCreateResult>;

export const FileCreateRequest = request("file.create", FileCreateArgs);
export const FileCreateResponse = response("file.create", FileCreateResult);

/** Overwrites an existing text file in place.
 *
 * It only ever overwrites — it does not create, delete or rename. The expected
 * size and time come from the read the editor was populated from; a file that
 * changed in between is refused rather than clobbered. A file whose current
 * content sniffs as binary is refused too, so this can never turn a binary into
 * text. */
export const FileEditArgs = Type.Object({
  sid: Sid,
  kind: FileKind,
  path: Type.String({ minLength: 1 }),
  content: Base64Bytes,
  /** The modification time the editor read. */
  expected_mtime_at: Timestamp,
  /** Guards a change that happened to leave the modification time alone, which
   * a coarse filesystem clock makes possible. */
  expected_size: Type.Integer({ minimum: 0 }),
});
export type FileEditArgs = Static<typeof FileEditArgs>;

export const FileEditResult = Type.Object({
  sid: Sid,
  path: Type.String(),
  size: Type.Integer({ minimum: 0 }),
  /** The new lock token, so a second edit in the same sitting needs no re-read. */
  mtime_at: Timestamp,
});
export type FileEditResult = Static<typeof FileEditResult>;

export const FileEditRequest = request("file.edit", FileEditArgs);
export const FileEditResponse = response("file.edit", FileEditResult);

/** Deletes one regular file. Never a directory, never a symlink, never
 * recursive: this only unlinks files a person could see as a leaf. `external`
 * is not offered — that allowlist exists so a transcript's files can be read,
 * and deleting one on the strength of having observed it is another matter. */
export const FileDeleteArgs = Type.Object({
  sid: Sid,
  kind: DirKind,
  path: Type.String({ minLength: 1 }),
});
export type FileDeleteArgs = Static<typeof FileDeleteArgs>;

export const FileDeleteResult = Type.Object({
  sid: Sid,
  path: Type.String(),
});
export type FileDeleteResult = Static<typeof FileDeleteResult>;

export const FileDeleteRequest = request("file.delete", FileDeleteArgs);
export const FileDeleteResponse = response("file.delete", FileDeleteResult);

/** Searches for files by name under one browsable root.
 *
 * Listing one directory at a time cannot answer "where is the file whose path
 * contains this" without the asker having already opened every candidate
 * directory, so the walk happens where the whole subtree is reachable at once. */
export const FileFindArgs = Type.Object({
  sid: Sid,
  kind: DirKind,
  /** Where to search. Relative to the session root for `contained`, absolute
   * for `workspace`; absent means the root itself. */
  root: Type.Optional(Type.String()),
  /** Whitespace-separated words, all of which must appear in a candidate's
   * path, with a leading `-` excluding one. Matching ignores case. A query with
   * nothing to include matches nothing rather than returning the whole tree, so
   * a cleared search box costs no walk. */
  query: Type.String(),
  /** Skip what the repository's ignore rules hide, and do not descend into
   * ignored directories. Defaults to true, because the unfiltered result is
   * dominated by vendored trees — with a capped reply those hits do not merely
   * add noise, they push the real answer out of it. */
  respect_gitignore: Type.Optional(Type.Boolean()),
});
export type FileFindArgs = Static<typeof FileFindArgs>;

export const FileFindHit = Type.Object(
  {
    /** In the shape the kind implies, so it can be opened as it stands. */
    path: Type.String(),
    type: Type.Union([Type.Literal("file"), Type.Literal("dir"), Type.Literal("symlink")]),
  },
  { $id: "FileFindHit" },
);
export type FileFindHit = Static<typeof FileFindHit>;

export const FileFindResult = Type.Object({
  sid: Sid,
  hits: Type.Array(FileFindHit),
  /** The walk hit its result cap or its visit budget, so the hits are not the
   * complete match set. Saying so is better than implying these are all. */
  truncated: Type.Boolean(),
});
export type FileFindResult = Static<typeof FileFindResult>;

export const FileFindRequest = request("file.find", FileFindArgs);
export const FileFindResponse = response("file.find", FileFindResult);

/** Asks which of a batch of paths the instance is willing to serve as files.
 *
 * A client that has found path-shaped text in a message uses this to decide
 * which of them to turn into links. Each path is tried against the three
 * surfaces in turn and the first that admits it and finds a regular file wins. */
export const FileStatArgs = Type.Object({
  sid: Sid,
  /** Absolute paths, resolved by the caller. */
  paths: Type.Array(Type.String()),
});
export type FileStatArgs = Static<typeof FileStatArgs>;

export const FileStatEntry = Type.Object(
  {
    kind: FileKind,
    /** In the shape that kind implies, ready to be opened. */
    path: Type.String(),
  },
  { $id: "FileStatEntry" },
);
export type FileStatEntry = Static<typeof FileStatEntry>;

export const FileStatResult = Type.Object({
  /** One slot per requested path, in the same order.
   *
   * Design rationale: an unresolved path is `null` rather than being left out,
   * which is the one place this contract states an absence instead of omitting
   * it. The slots are the caller's own list read back, and dropping the misses
   * would break the correspondence that makes the reply usable at all. A miss
   * is deliberately one value for every reason — outside the allowlist, not a
   * regular file, or simply not there — so this cannot be used to ask whether a
   * path the caller may not read exists. */
  results: Type.Array(Type.Union([FileStatEntry, Type.Null()])),
});
export type FileStatResult = Static<typeof FileStatResult>;

export const FileStatRequest = request("file.stat", FileStatArgs);
export const FileStatResponse = response("file.stat", FileStatResult);

/** Reads the directory tree the launcher may start a session in.
 *
 * Directories only: this answers "where could a new session run", which is a
 * different question from browsing a session's files, and it is bounded by the
 * roots the launcher is configured with rather than by any session. */
export const DirTreeArgs = Type.Object({
  /** Configured roots, or any directory below one — a client expands the tree
   * lazily by asking for a descendant. */
  roots: Type.Array(Type.String()),
  /** How deep to walk. Absent uses the configured depth; a lazy expansion asks
   * for one level. */
  depth: Type.Optional(Type.Integer({ minimum: 1 })),
  /** Substring of the root-relative path. Matching nodes and their ancestors
   * survive the filter. */
  filter: Type.Optional(Type.String()),
});
export type DirTreeArgs = Static<typeof DirTreeArgs>;

/** One node of the tree. No `children` means the walk stopped at its depth
 * here, and a client may ask for this path to go further; an empty array means
 * the directory holds no subdirectories. */
export const DirTreeEntry = Type.Recursive(
  (self) =>
    Type.Object({
      path: Type.String(),
      children: Type.Optional(Type.Array(self)),
    }),
  { $id: "DirTreeEntry" },
);
export type DirTreeEntry = Static<typeof DirTreeEntry>;

export const DirTreeResult = Type.Object({
  entries: Type.Array(DirTreeEntry),
});
export type DirTreeResult = Static<typeof DirTreeResult>;

export const DirTreeRequest = request("dir.tree", DirTreeArgs);
export const DirTreeResponse = response("dir.tree", DirTreeResult);
