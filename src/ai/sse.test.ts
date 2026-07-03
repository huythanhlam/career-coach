import { describe, it, expect } from "vitest";
import { parseSseFrame, parseSseBuffer } from "@/ai/sse";

describe("parseSseFrame", () => {
  it("parses an event name and data payload, stripping the one leading space", () => {
    expect(parseSseFrame('event: token\ndata: {"delta":"hi"}')).toEqual({
      event: "token",
      data: '{"delta":"hi"}',
    });
  });

  it("defaults the event name to 'message' when only data is present", () => {
    expect(parseSseFrame("data: hello")).toEqual({ event: "message", data: "hello" });
  });

  it("joins multiple data lines with newlines", () => {
    expect(parseSseFrame("event: e\ndata: line1\ndata: line2")).toEqual({
      event: "e",
      data: "line1\nline2",
    });
  });

  it("ignores comment lines and tolerates CRLF endings", () => {
    expect(parseSseFrame(": keep-alive\r\nevent: done\r\ndata: {}\r\n")).toEqual({
      event: "done",
      data: "{}",
    });
  });

  it("returns null for a frame with no data field", () => {
    expect(parseSseFrame(": just a comment")).toBeNull();
    expect(parseSseFrame("event: token")).toBeNull();
  });
});

describe("parseSseBuffer", () => {
  it("splits multiple complete events and leaves no remainder", () => {
    const buf = 'event: token\ndata: {"delta":"a"}\n\nevent: token\ndata: {"delta":"b"}\n\n';
    const { events, rest } = parseSseBuffer(buf);
    expect(events.map((e) => e.event)).toEqual(["token", "token"]);
    expect(events.map((e) => e.data)).toEqual(['{"delta":"a"}', '{"delta":"b"}']);
    expect(rest).toBe("");
  });

  it("carries a partial trailing frame forward as the remainder", () => {
    const buf = 'event: token\ndata: {"delta":"a"}\n\nevent: tok';
    const { events, rest } = parseSseBuffer(buf);
    expect(events).toHaveLength(1);
    expect(rest).toBe("event: tok");
  });

  it("reassembles a frame split across two buffer feeds", () => {
    const first = parseSseBuffer("event: token\nda");
    expect(first.events).toHaveLength(0);
    expect(first.rest).toBe("event: token\nda");

    const second = parseSseBuffer(first.rest + 'ta: {"delta":"x"}\n\n');
    expect(second.events).toEqual([{ event: "token", data: '{"delta":"x"}' }]);
    expect(second.rest).toBe("");
  });

  it("handles CRLF frame separators", () => {
    const { events, rest } = parseSseBuffer("event: done\r\ndata: {}\r\n\r\n");
    expect(events).toEqual([{ event: "done", data: "{}" }]);
    expect(rest).toBe("");
  });
});
