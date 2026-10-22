import { describe, expect, it } from "vitest";

import { reorderTeamMembers, saveTeamMember } from "@/features/admin/team/api";
import {
  emptyTeamMemberForm,
  updateTeamTranslation
} from "@/features/admin/team/teamForm";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-028 — team mutation seam contract.
 *
 * Root + translations travel in one RPC (no partial member on failure);
 * reordering uses the dedicated dense-order RPC. The pgTAP suite proves the
 * transactional/collision-free behaviour at the data boundary.
 */

describe("admin team API", () => {
  it("creates through save_team_member_v1 with a null position for the RPC to assign", async () => {
    const fake = createFakeSupabase({ rpc: { data: "member-1" } });
    const values = updateTeamTranslation(
      { ...emptyTeamMemberForm(), name: "Anna Kowalska" },
      "en",
      { role: "Chair", bio: "Bio" }
    );

    const result = await saveTeamMember(fake.client, values);

    expect(result).toEqual({ ok: true, id: "member-1" });
    expect(fake.rpcCalls[0]?.name).toBe("save_team_member_v1");
    expect(fake.rpcCalls[0]?.args).toMatchObject({
      p_id: null,
      p_name: "Anna Kowalska",
      p_status: "draft",
      p_sort_order: null,
      p_portrait_path: null,
      p_translations: [{ locale: "en", role: "Chair", bio: "Bio" }]
    });
  });

  it("persists the complete desired order through reorder_team_members_v1", async () => {
    const fake = createFakeSupabase();

    const result = await reorderTeamMembers(fake.client, ["b", "a", "c"]);

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls[0]?.name).toBe("reorder_team_members_v1");
    expect(fake.rpcCalls[0]?.args).toEqual({ p_ids: ["b", "a", "c"] });
  });

  it("retries the reorder once when the first attempt hits a transient conflict", async () => {
    const fake = createFakeSupabase({
      rpcResults: [
        { error: { message: "duplicate key", code: "23505" } },
        { data: null, error: null }
      ]
    });

    const result = await reorderTeamMembers(fake.client, ["b", "a", "c"]);

    expect(result).toEqual({ ok: true });
    expect(fake.rpcCalls).toHaveLength(2);
    expect(fake.rpcCalls[0]?.args).toEqual({ p_ids: ["b", "a", "c"] });
    expect(fake.rpcCalls[1]?.args).toEqual({ p_ids: ["b", "a", "c"] });
  });

  it("does not retry a non-transient reorder failure", async () => {
    const fake = createFakeSupabase({
      rpc: { error: { message: "permission denied", code: "42501" } }
    });

    const result = await reorderTeamMembers(fake.client, ["b", "a"]);

    expect(result).toMatchObject({ ok: false, code: "failed" });
    expect(fake.rpcCalls).toHaveLength(1);
  });
});
