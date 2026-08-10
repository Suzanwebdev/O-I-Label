import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMoolreWebhook } from "../lib/payments/providers/moolre.ts";

describe("moolre reference identity", () => {
  it("keeps order_id metadata so concurrent payments map to the right order", () => {
    const a = parseMoolreWebhook({
      status: 1,
      data: {
        reference: "oi_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa_1",
        amount: "100.00",
        txstatus: 1,
        metadata: { order_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      },
    });
    const b = parseMoolreWebhook({
      status: 1,
      data: {
        reference: "oi_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb_2",
        amount: "100.00",
        txstatus: 1,
        metadata: { order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      },
    });
    assert.equal(a.success && b.success, true);
    assert.notEqual(a.reference, b.reference);
    assert.notEqual(a.orderId, b.orderId);
  });
});
