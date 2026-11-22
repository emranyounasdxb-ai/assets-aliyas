import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createStatements } from "../../database/schema.mjs";
import {
  propertyCover,
  type AppData,
  type DocumentRecord,
} from "../../src/lib/domain";

const photo = (id: string, fields: Partial<DocumentRecord> = {}) =>
  ({
    id,
    target_type: "building",
    target_id: "building-a",
    category: "Photo",
    mime: "image/jpeg",
    status: "current",
    created_at: "2026-11-22T00:00:00",
    ...fields,
  }) as DocumentRecord;
describe("Property cover selection", () => {
  it("uses the selected current photo from the same property", () => {
    const data: Pick<AppData, "documents" | "propertyCovers"> = {
      documents: [photo("a"), photo("b")],
      propertyCovers: [
        { id: "cover", building_id: "building-a", document_id: "b" },
      ],
    };
    expect(propertyCover(data, "building-a")?.id).toBe("b");
  });
  it("ignores archived, superseded, foreign and non-photo cover references", () => {
    const documents = [
      photo("old", { status: "superseded" }),
      photo("archived", { status: "archived" }),
      photo("foreign", { target_id: "building-b" }),
      photo("map", { category: "Floor plan" }),
      photo("pdf", { mime: "application/pdf" }),
      photo("valid"),
    ];
    for (const doc of documents.slice(0, -1))
      expect(
        propertyCover(
          {
            documents,
            propertyCovers: [
              { id: "cover", building_id: "building-a", document_id: doc.id },
            ],
          },
          "building-a",
        )?.id,
      ).toBe("valid");
  });
  it("keeps fallback selection stable across snapshot ordering and handles empty galleries", () => {
    const documents = [photo("b"), photo("a")];
    expect(
      propertyCover({ documents, propertyCovers: [] }, "building-a")?.id,
    ).toBe("a");
    expect(
      propertyCover(
        { documents: documents.reverse(), propertyCovers: [] },
        "building-a",
      )?.id,
    ).toBe("a");
    expect(
      propertyCover({ documents, propertyCovers: [] }, "empty"),
    ).toBeUndefined();
  });
});
it("preserves the deployed version 001 checksum and adds media without altering existing tables", () => {
  expect(
    createHash("sha256").update(createStatements(1).join("\n")).digest("hex"),
  ).toBe("d54a012dd0f4bbe95e19c6b191910671df38e7fe60d9e9a95a02beb87420cbea");
  const additions = createStatements(2).filter(
    (s) => !createStatements(1).includes(s),
  );
  expect(additions).toHaveLength(1);
  expect(additions[0]).toContain(
    "create table if not exists `property_covers`",
  );
});
