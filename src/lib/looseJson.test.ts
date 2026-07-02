import { describe, it, expect } from "vitest";
import { parseJsonObject, parseJsonArray, parseLooseJsonObject } from "./looseJson";

describe("parseJsonObject", () => {
  it("parses clean JSON", () => {
    expect(parseJsonObject('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseJsonObject('  \n {"a":1}\n ')).toEqual({ a: 1 });
  });

  it("strips ```json code fences", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips bare ``` fences", () => {
    expect(parseJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts the object when wrapped in prose", () => {
    expect(parseJsonObject('Here is your result:\n{"a":1}\nHope that helps!')).toEqual({ a: 1 });
  });

  it("handles nested objects via the greedy block match", () => {
    expect(parseJsonObject('noise {"a":{"b":[1,2]}} more')).toEqual({
      a: { b: [1, 2] },
    });
  });

  it("throws when there is no object", () => {
    expect(() => parseJsonObject("just some prose")).toThrow();
  });
});

describe("parseJsonArray", () => {
  it("parses a clean array", () => {
    expect(parseJsonArray("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("strips fences", () => {
    expect(parseJsonArray('```json\n[{"id":"1"}]\n```')).toEqual([{ id: "1" }]);
  });

  it("extracts the array when wrapped in prose", () => {
    expect(parseJsonArray('Suggestions:\n[{"t":"a"}]\ndone')).toEqual([{ t: "a" }]);
  });

  it("is generically typed", () => {
    const out = parseJsonArray<{ id: string }>('[{"id":"x"}]');
    expect(out[0].id).toBe("x");
  });

  it("throws when there is no array", () => {
    expect(() => parseJsonArray("no array here")).toThrow();
  });
});

describe("parseLooseJsonObject", () => {
  it("parses clean JSON", () => {
    expect(parseLooseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips fences and leading prose before the first brace", () => {
    expect(parseLooseJsonObject('Result: ```json\n{"a":1}\n```')).toEqual({
      a: 1,
    });
  });

  it("tolerates a dangling trailing comma", () => {
    expect(parseLooseJsonObject('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
  });

  // The production bug these helpers exist for: the model hits its token cap
  // mid-object and the response is cut off. The repair closes open containers.
  it("repairs an object truncated mid-value", () => {
    expect(parseLooseJsonObject('{"a":1,"b":2')).toEqual({ a: 1, b: 2 });
  });

  it("repairs truncation inside a nested array", () => {
    expect(parseLooseJsonObject('{"a":1,"items":[1,2,3')).toEqual({
      a: 1,
      items: [1, 2, 3],
    });
  });

  it("closes an unterminated string value", () => {
    // Cut off partway through a string — the repair re-quotes and closes.
    const out = parseLooseJsonObject('{"a":"hello wor');
    expect(out).toEqual({ a: "hello wor" });
  });

  it("does not treat braces inside string values as structure", () => {
    expect(parseLooseJsonObject('{"a":"a } { value","b":2}')).toEqual({
      a: "a } { value",
      b: 2,
    });
  });

  // Truncated mid-string where the partial string contains a brace: the repair
  // must not count that brace as an open container (it's inside the string).
  it("ignores braces in a string when repairing truncation", () => {
    expect(parseLooseJsonObject('{"a":"unclosed } brace')).toEqual({
      a: "unclosed } brace",
    });
  });

  it("does not miscount escaped quotes inside strings", () => {
    expect(parseLooseJsonObject('{"a":"she said \\"hi\\"","b":2}')).toEqual({
      a: 'she said "hi"',
      b: 2,
    });
  });

  it("strips a trailing comma left at the truncation point", () => {
    expect(parseLooseJsonObject('{"a":1,"items":[1,2,')).toEqual({
      a: 1,
      items: [1, 2],
    });
  });

  it("throws when no object start is present", () => {
    expect(() => parseLooseJsonObject("totally not json")).toThrow();
  });
});
