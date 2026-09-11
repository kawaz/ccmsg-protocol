import { Type } from "@sinclair/typebox";
import { InstanceInfo } from "../common/hello.ts";
import { topicFrame } from "../envelope.ts";

/** The `instances` topic: the mesh as one instance sees it, itself included,
 * as `hello` answers it.
 *
 * Carried as a topic so that a link going down is something a subscriber
 * learns where it is already listening, rather than by greeting again to find
 * out.
 *
 * Whole-value per instance: `reachable` is one instance's reading of every
 * link it has, taken together, and two instances may legitimately disagree
 * about the same link — so a frame states one sender's whole view and leaves
 * every other sender's alone. It is apart from `peers` for the same reason it
 * is whole: a mesh view is one value, while a session row is a row, and an
 * entry here may also stand before its instance has an id to be matched by. */
export const InstancesFrame = topicFrame(
  "instances",
  Type.Object({ instances: Type.Array(InstanceInfo) }),
);
